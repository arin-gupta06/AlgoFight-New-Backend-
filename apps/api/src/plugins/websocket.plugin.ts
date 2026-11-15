import fp from "fastify-plugin";
import fastifyWebsocket from "@fastify/websocket";
import { logger } from "@algofight/logger";
import { createRedisClient } from "@algofight/queue";
import { ConnectionManager } from "../websocket/connection-manager";
import { SocketHandler } from "../websocket/socket-handler";
import { syncBattleToTelemetry } from "../events/battle.events";
import { auditService } from "../services/audit.service";
import type { FastifyInstance } from "fastify";

export const connectionManager = new ConnectionManager();
export const socketHandler = new SocketHandler(connectionManager);

export default fp(async function (app: FastifyInstance) {
    // Register the @fastify/websocket plugin
    await app.register(fastifyWebsocket, {
        options: {
            maxPayload: 1048576, // 1MB limit
        }
    });

    app.register(async function (fastify) {
        // 💓 30-Second Ping/Pong Heartbeat to prune dead socket connections
        const heartbeatInterval = setInterval(() => {
            fastify.websocketServer.clients.forEach((ws: any) => {
                if (ws.isAlive === false) {
                    logger.info("Terminating inactive zombie socket");
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        fastify.addHook("onClose", (instance, done) => {
            clearInterval(heartbeatInterval);
            done();
        });

        const handleSocketConnection = (connection: any, req: any) => {
            const socket: any = connection.socket || connection;
            socket.isAlive = true;
            
            socket.on("pong", () => {
                socket.isAlive = true;
            });

            const clientIp = req ? (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1") : "127.0.0.1";
            const cleanIp = String(clientIp).split(",")[0].trim();

            logger.info({ path: req?.url }, "New WebSocket connection established");
            try {
                auditService.recordEvent({
                    category: "WEBSOCKET",
                    severity: "INFO",
                    action: "WS_CONNECTION_ESTABLISHED",
                    actor: "WebSocket_Client",
                    ip: cleanIp,
                    method: "WS",
                    details: `New WebSocket connection opened on ${req?.url || "/ws"}`,
                });
            } catch {}

            const currentUserId: { value: string | null } = { value: null };

            socket.on("message", (data: any) => {
                socketHandler.handleMessage(socket, data.toString(), currentUserId);
            });

            socket.on("close", () => {
                socketHandler.handleDisconnect(socket);
                if (currentUserId.value) {
                    connectionManager.unregisterUser(currentUserId.value, socket);
                }
                try {
                    auditService.recordEvent({
                        category: "WEBSOCKET",
                        severity: "INFO",
                        action: "WS_CONNECTION_CLOSED",
                        actor: currentUserId.value || "WebSocket_Client",
                        ip: cleanIp,
                        method: "WS",
                        details: `WebSocket client disconnected${currentUserId.value ? ` (${currentUserId.value})` : ""}`,
                    });
                } catch {}
            });

            socket.on("error", (error: any) => {
                logger.error({ error }, "WebSocket error occurred");
                try {
                    auditService.recordEvent({
                        category: "WEBSOCKET",
                        severity: "ERROR",
                        action: "WS_ERROR",
                        actor: currentUserId.value || "WebSocket_Client",
                        ip: cleanIp,
                        method: "WS",
                        details: error?.message || "WebSocket error occurred",
                    });
                } catch {}
            });
        };

        fastify.get("/ws", { websocket: true }, handleSocketConnection);
        fastify.get("/api/ws", { websocket: true }, handleSocketConnection);

        // Redis Subscriber setup
        const redisSubscriber = createRedisClient();

        redisSubscriber.on("error", (err) => {
            logger.warn({ error: err.message }, "Non-fatal Redis subscriber error in WebSocket server");
        });

        redisSubscriber.subscribe("battle-events", "system-announcements", "platform-audit-logs", (err, count) => {
            if (err) logger.error({ err }, "Failed to subscribe to redis channels");
            else logger.info({ count }, "Subscribed to battle-events, system-announcements, and platform-audit-logs channels");
        });

        redisSubscriber.on("message", (channel, message) => {
            if (channel === "platform-audit-logs") {
                try {
                    const parsed = JSON.parse(message);
                    auditService.recordEvent(parsed);
                } catch {}
                return;
            }
            if (channel === "battle-events") {
                try {
                    const payload = JSON.parse(message);

                    if (payload.event === "PLAYER_SOLVED") {
                        connectionManager.broadcastToRoom(payload.roomId, "player_solved", payload);
                        connectionManager.broadcastToRoom(payload.roomId, "battle_state_sync", payload.newState);

                        try {
                            auditService.recordEvent({
                                category: "BATTLE",
                                severity: "INFO",
                                action: "BATTLE_PROBLEM_SOLVED",
                                actor: payload.username || payload.userId || "Combatant",
                                method: "WS",
                                details: `Room ${payload.roomId}: ${payload.username || payload.userId} solved problem (${payload.pointsEarned || 100} pts)`,
                                metadata: {
                                    roomId: payload.roomId,
                                    userId: payload.userId,
                                    username: payload.username,
                                    pointsEarned: payload.pointsEarned,
                                    solvedCount: payload.solvedCount,
                                },
                            });
                        } catch {}
                    }

                    if (payload.event === "BATTLE_FINISHED") {
                        const winnerPlayer = payload.finalState?.players?.find((p: any) => p.userId === payload.winnerId);
                        const winnerUsername = winnerPlayer?.username || payload.winnerUsername || payload.winnerId;
                        const forfeitedPlayer = payload.forfeitedPlayer || 
                            (payload.reason === "OPPONENT_FORFEIT" && payload.forfeitedUserId
                                ? payload.finalState?.players?.find((p: any) => p.userId === payload.forfeitedUserId)?.username
                                : undefined);

                        connectionManager.broadcastToRoom(payload.roomId, "battle_over", {
                            roomId: payload.roomId,
                            winner: winnerUsername,
                            winnerId: payload.winnerId,
                            winnerUsername,
                            forfeitedPlayer,
                            forfeitedUserId: payload.forfeitedUserId,
                            reason: payload.reason,
                            finalState: payload.finalState,
                        });

                        try {
                            auditService.recordEvent({
                                category: "BATTLE",
                                severity: "INFO",
                                action: "BATTLE_FINISHED",
                                actor: winnerUsername || "System",
                                method: "WS",
                                details: `Room ${payload.roomId} concluded. Winner: ${winnerUsername} [Reason: ${payload.reason || "NORMAL"}]`,
                                metadata: {
                                    roomId: payload.roomId,
                                    winnerId: payload.winnerId,
                                    winnerUsername,
                                    reason: payload.reason,
                                    forfeitedPlayer,
                                    participants: payload.finalState?.players?.map((p: any) => ({
                                        userId: p.userId,
                                        username: p.username,
                                        score: p.points,
                                    })),
                                    eloResults: payload.eloResults,
                                },
                            });
                        } catch {}

                        if (payload.eloResults) {
                            connectionManager.broadcastToRoom(payload.roomId, "rating_updates", payload.eloResults);
                        }

                        for (const player of payload.finalState.players) {
                            if (player.userId !== "bot") {
                                connectionManager.updatePresenceStatus(player.userId, "AVAILABLE");
                            }
                        }

                        // 🛰️ Sync real battle event to Linux Telemetry Service
                        syncBattleToTelemetry({
                            roomId: payload.roomId,
                            battleType: payload.finalState?.players?.length <= 2 ? "1v1" : "FFA_MULTIPLAYER",
                            durationSeconds: payload.finalState?.startTime ? Math.round((Date.now() - payload.finalState.startTime) / 1000) : 15,
                            winnerId: payload.winnerId,
                            participants: (payload.finalState?.players || []).map((p: any, idx: number) => ({
                                userId: p.userId,
                                username: p.username || `Player ${idx + 1}`,
                                score: p.points || 0,
                                rank: p.userId === payload.winnerId ? 1 : idx + 1,
                                verdict: p.points > 0 ? "ACCEPTED" : "WRONG_ANSWER",
                                testsPassed: p.solvedCount || (p.points > 0 ? 1 : 0),
                                testsTotal: payload.finalState?.totalQuestions || 1,
                            })),
                        }).catch(() => {});
                    }
                } catch (error) {
                    logger.error({ error }, "Error parsing battle-events message");
                }
            }

            if (channel === "system-announcements") {
                try {
                    const payload = JSON.parse(message);

                    if (payload.event === "BROADCAST_CREATED" && payload.broadcast) {
                        connectionManager.broadcastToAll("system_broadcast_announcement", payload.broadcast);
                        connectionManager.broadcastToAll("inbox_notification", {
                            id: payload.broadcast.id,
                            type: "SYSTEM",
                            title: payload.broadcast.title,
                            message: payload.broadcast.message,
                            read: false,
                            createdAt: Date.now(),
                            metadata: {
                                isBroadcast: true,
                                broadcastType: payload.broadcast.type,
                                flashBanner: payload.broadcast.flashBanner,
                                expiresAt: payload.broadcast.expiresAt,
                                content: payload.broadcast.content,
                                action: payload.broadcast.action,
                            },
                        });
                    }

                    if (payload.event === "BROADCAST_REVOKED") {
                        connectionManager.broadcastToAll("system_broadcast_revoked", {
                            broadcastId: payload.broadcastId,
                        });
                    }
                } catch (error) {
                    logger.error({ error }, "Error parsing system-announcements message");
                }
            }
        });

        // Add shutdown hook for Redis
        fastify.addHook("onClose", async () => {
            await redisSubscriber.quit();
            logger.info("Redis subscriber connection closed");
        });

        logger.info("WebSocket server endpoint mounted at /ws");
    });
});
