import fp from "fastify-plugin";
import fastifyWebsocket from "@fastify/websocket";
import { logger } from "@algofight/logger";
import { createRedisClient } from "@algofight/queue";
import { ConnectionManager } from "../websocket/connection-manager";
import { SocketHandler } from "../websocket/socket-handler";
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

            logger.info({ path: req?.url }, "New WebSocket connection established");
            const currentUserId: { value: string | null } = { value: null };

            socket.on("message", (data: any) => {
                socketHandler.handleMessage(socket, data.toString(), currentUserId);
            });

            socket.on("close", () => {
                socketHandler.handleDisconnect(socket);
                if (currentUserId.value) {
                    connectionManager.unregisterUser(currentUserId.value, socket);
                }
            });

            socket.on("error", (error: any) => {
                logger.error({ error }, "WebSocket error occurred");
            });
        };

        fastify.get("/", { websocket: true }, handleSocketConnection);
        fastify.get("/ws", { websocket: true }, handleSocketConnection);
        fastify.get("/api/ws", { websocket: true }, handleSocketConnection);

        // Redis Subscriber setup
        const redisSubscriber = createRedisClient();

        redisSubscriber.on("error", (err) => {
            logger.warn({ error: err.message }, "Non-fatal Redis subscriber error in WebSocket server");
        });

        redisSubscriber.subscribe("battle-events", "system-announcements", (err, count) => {
            if (err) logger.error({ err }, "Failed to subscribe to redis channels");
            else logger.info({ count }, "Subscribed to battle-events and system-announcements channels");
        });

        redisSubscriber.on("message", (channel, message) => {
            if (channel === "battle-events") {
                try {
                    const payload = JSON.parse(message);

                    if (payload.event === "PLAYER_SOLVED") {
                        connectionManager.broadcastToRoom(payload.roomId, "player_solved", payload);
                        connectionManager.broadcastToRoom(payload.roomId, "battle_state_sync", payload.newState);
                    }

                    if (payload.event === "BATTLE_FINISHED") {
                        connectionManager.broadcastToRoom(payload.roomId, "battle_over", {
                            winner: payload.winnerId,
                            reason: payload.reason,
                            finalState: payload.finalState,
                        });

                        if (payload.eloResults) {
                            connectionManager.broadcastToRoom(payload.roomId, "rating_updates", payload.eloResults);
                        }

                        for (const player of payload.finalState.players) {
                            if (player.userId !== "bot") {
                                connectionManager.updatePresenceStatus(player.userId, "AVAILABLE");
                            }
                        }
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
