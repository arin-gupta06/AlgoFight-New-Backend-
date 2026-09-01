// apps/websocket/src/handlers/socket-handler.ts
import crypto from "crypto";
import { WebSocket } from "ws";
import { syncBattleToTelemetry } from "../events/battle.events";
import { ConnectionManager } from "../server/connection-manager";
import { logger } from "@algofight/logger";
import Redis from "ioredis";
import {
    PrismaUserRepository,
    PrismaProblemRepository,
    PrismaBattleRoomRepository,
} from "@algofight/database";
import {
    BattleRoomService,
    RatingService,
    MatchmakingService,
    MockExecutor,
    BattleService,
    EvaluationService,
} from "@algofight/application";
import { battleTimerQueue, JOB_NAMES, createRedisClient } from "@algofight/queue";

export class SocketHandler {
    private readonly userRepo = new PrismaUserRepository();
    private readonly problemRepo = new PrismaProblemRepository();
    private readonly battleRoomRepo = new PrismaBattleRoomRepository();
    private readonly ratingService = new RatingService(this.userRepo);
    private readonly battleRoomService = new BattleRoomService(
        this.battleRoomRepo,
        this.problemRepo,
        this.ratingService,
    );
    private readonly evaluationService = new EvaluationService();
    private readonly battleService = new BattleService(this.battleRoomRepo, this.battleRoomService);
    private readonly mockExecutor = new MockExecutor();
    private readonly redis = createRedisClient();
    private readonly redisSubscriber = createRedisClient();
    private readonly matchmakingService = new MatchmakingService(
        this.userRepo,
        this.battleRoomService,
        this.problemRepo,
        this.redis,
    );

    // Map socket -> user session
    private readonly socketUsers = new Map<WebSocket, {
        userId: string;
        username: string;
        rating?: number;
        platformCode?: string;
        roomId?: string;
    }>();
    private readonly disconnectTimeouts = new Map<string, NodeJS.Timeout>();
    private readonly violations = new Map<string, number>();
    private cachedCerts: Record<string, string> = {};
    private certsExpiry = 0;

    constructor(private readonly connectionManager: ConnectionManager) { 
        this.setupRedisSubscriptions();
    }

    private async refreshPublicKeys(): Promise<Record<string, string>> {
        const now = Date.now();
        if (now < this.certsExpiry && Object.keys(this.cachedCerts).length > 0) {
            return this.cachedCerts;
        }

        try {
            const res = await fetch(
                "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
                { signal: AbortSignal.timeout(3000) }
            );
            if (res.ok) {
                this.cachedCerts = await res.json();
                this.certsExpiry = now + 6 * 60 * 60 * 1000;
            }
        } catch (err: any) {
            logger.warn({ error: err.message }, "Failed to fetch Google Firebase certificates in WebSocket server");
        }

        return this.cachedCerts;
    }

    private verifyToken(token: string, certs: Record<string, string>): { uid: string; email?: string; name?: string; role?: string } | null {
        try {
            const parts = token.split(".");
            if (parts.length !== 3) return null;

            const [headerB64, payloadB64, sigB64] = parts;
            const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
            const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

            if (header.alg === "RS256" && header.kid && certs[header.kid]) {
                const now = Math.floor(Date.now() / 1000);
                if (payload.exp && payload.exp < now) return null;

                const verifier = crypto.createVerify("RSA-SHA256");
                verifier.update(`${headerB64}.${payloadB64}`);
                const sig = Buffer.from(sigB64, "base64url");

                if (verifier.verify(certs[header.kid], sig)) {
                    const uid = payload.user_id || payload.uid || payload.sub;
                    return { uid: String(uid), email: payload.email, name: payload.name, role: payload.admin ? "ADMIN" : "USER" };
                }
            }

            // Dev fallback for local tests / development
            if (process.env.NODE_ENV !== "production") {
                const uid = payload.user_id || payload.uid || payload.sub || payload.id;
                if (uid) {
                    return { uid: String(uid), email: payload.email, name: payload.name, role: payload.role };
                }
            }
        } catch {
            return null;
        }
        return null;
    }

    private setupRedisSubscriptions() {
        this.redisSubscriber.psubscribe("execution:stream:*", (err) => {
            if (err) logger.error({ err }, "Failed to subscribe to execution streams");
        });

        this.redisSubscriber.subscribe("matchmaking:matched", (err) => {
            if (err) logger.error({ err }, "Failed to subscribe to matchmaking:matched");
        });

        this.redisSubscriber.on("pmessage", (pattern, channel, message) => {
            try {
                const userId = channel.split(":")[2];
                const socket = this.connectionManager.userSockets.get(userId);
                if (socket) {
                    const parsed = JSON.parse(message);
                    this.send(socket, parsed.event, parsed.data);
                }
            } catch (err) {
                logger.error({ err }, "Error processing pubsub pmessage");
            }
        });

        this.redisSubscriber.on("message", async (channel, message) => {
            if (channel === "matchmaking:matched") {
                try {
                    const match = JSON.parse(message);
                    await this.handleCrossInstanceMatch(match);
                } catch (err) {
                    logger.error({ err }, "Error processing matchmaking:matched pubsub message");
                }
            }
        });
    }

    private async handleCrossInstanceMatch(match: {
        roomId: string;
        roomCode: string;
        player1Id: string;
        player1Username: string;
        player1Rating: number;
        player2Id: string;
        player2Username: string;
        player2Rating: number;
    }) {
        const player1Socket = this.connectionManager.userSockets.get(match.player1Id);
        const player2Socket = this.connectionManager.userSockets.get(match.player2Id);

        // If neither player is locally connected to this node, ignore
        if (!player1Socket && !player2Socket) {
            return;
        }

        if (player1Socket) {
            this.connectionManager.joinRoom(match.roomId, player1Socket);
            const session = this.socketUsers.get(player1Socket);
            if (session) session.roomId = match.roomId;
            this.connectionManager.updatePresenceStatus(match.player1Id, "IN_BATTLE", match.roomId);
        }

        if (player2Socket) {
            this.connectionManager.joinRoom(match.roomId, player2Socket);
            const session = this.socketUsers.get(player2Socket);
            if (session) session.roomId = match.roomId;
            this.connectionManager.updatePresenceStatus(match.player2Id, "IN_BATTLE", match.roomId);
        }

        const roomWithProblems = await this.battleRoomRepo.getRoomById(match.roomId);
        const problems = roomWithProblems?.problems || [];
        const timeLimitSeconds = (roomWithProblems?.timeLimitMinutes || 15) * 60;

        const matchPayload = {
            roomId: match.roomId,
            roomCode: match.roomCode,
            problems: problems,
            timeLimitSeconds,
            players: [match.player1Username, match.player2Username],
            playerDetails: [
                { userId: match.player1Id, username: match.player1Username, rating: match.player1Rating },
                { userId: match.player2Id, username: match.player2Username, rating: match.player2Rating },
            ]
        };

        const battleState = {
            roomId: match.roomId,
            status: "RUNNING",
            timeLimitSeconds,
            startTime: Date.now(),
            totalQuestions: problems.length,
            players: [
                { userId: match.player1Id, username: match.player1Username, points: 0, solvedProblems: [], solvedCount: 0 },
                { userId: match.player2Id, username: match.player2Username, points: 0, solvedProblems: [], solvedCount: 0 }
            ]
        };

        await this.redis.set(`battle_state:${match.roomId}`, JSON.stringify(battleState), "EX", timeLimitSeconds + 300);

        if (player1Socket) {
            this.send(player1Socket, "match_found", matchPayload);
            this.send(player1Socket, "battle_state_sync", battleState);
        }
        if (player2Socket) {
            this.send(player2Socket, "match_found", matchPayload);
            this.send(player2Socket, "battle_state_sync", battleState);
        }
    }

    private formatTime(seconds: number) {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }

    async handleMessage(
        socket: WebSocket,
        rawMessage: string,
        currentUserId: { value: string | null },
    ): Promise<void> {
        try {
            const parsed = JSON.parse(rawMessage);
            const action = parsed.action || parsed.type || parsed.event;
            const data = parsed.data || parsed.payload || parsed;

            switch (action) {
                case "auth":
                case "identify": {
                    // 🛡️ AF-003: Cryptographic Firebase Token Verification
                    let verifiedUid: string | null = null;
                    let verifiedEmail: string | undefined = undefined;
                    let verifiedUsername: string | undefined = undefined;

                    const rawToken = data.token || data.rawToken || (typeof data.auth === "object" ? data.auth.token : undefined);
                    if (rawToken) {
                        const certs = await this.refreshPublicKeys();
                        const verified = this.verifyToken(rawToken, certs);
                        if (verified) {
                            verifiedUid = verified.uid;
                            verifiedEmail = verified.email;
                            verifiedUsername = verified.name;
                        }
                    }

                    // Robust user identity resolution
                    const userId = verifiedUid || data.userId || data.uid;
                    const username = verifiedUsername || data.username || "Player";

                    if (!userId) {
                        this.send(socket, "error", "Authentication failed: valid user identification required.");
                        break;
                    }

                    currentUserId.value = userId;

                    let user = await this.userRepo.getUserById(userId).catch(() => null);
                    if (!user && (verifiedEmail || data.email || username)) {
                        user = await this.userRepo.upsertUser({
                            id: userId,
                            email: verifiedEmail || data.email || `${username.toLowerCase().replace(/\s+/g, "_")}@algofight.local`,
                            username: username,
                        }).catch(() => null);
                    }

                    const userRating = user?.rating || 1200;
                    const platformCode = user?.platformCode || "";
                    const userType = user?.userType || "INDIVIDUAL";
                    const institutionName = user?.institutionName || undefined;

                    this.connectionManager.registerUser(userId, socket, {
                        username: user?.username || username,
                        rating: userRating,
                        platformCode,
                        userType,
                        institutionName,
                        status: "AVAILABLE",
                    });

                    this.socketUsers.set(socket, {
                        userId,
                        username: user?.username || username,
                        rating: userRating,
                        platformCode,
                    });

                    this.send(socket, "authenticated", {
                        userId,
                        username: user?.username || username,
                        rating: userRating,
                        platformCode,
                    });

                    const presence = this.connectionManager.getPresence(userId);
                    if (presence) {
                        this.connectionManager.broadcastToAll("player_presence_update", presence);
                    }

                    const onlineList = this.connectionManager.getAllOnlinePresences();
                    this.send(socket, "presence_sync", { onlinePlayers: onlineList });
                    break;
                }

                case "get_available_players":
                case "subscribe_presence": {
                    const onlineList = this.connectionManager.getAllOnlinePresences();
                    this.send(socket, "presence_sync", { onlinePlayers: onlineList });
                    break;
                }

                case "send_challenge": {
                    const { targetUserId, targetUsername, fromUsername: rawFromUsername } = data;
                    const session = this.socketUsers.get(socket);

                    const fromUserId = session?.userId || currentUserId.value;
                    const fromUsername = session?.username || rawFromUsername || "Challenger";

                    if (!fromUserId) {
                        this.send(socket, "error", "Authentication required before sending challenges.");
                        break;
                    }

                    if (fromUserId === targetUserId) {
                        this.send(socket, "error", "Cannot challenge yourself to a duel.");
                        break;
                    }

                    const fromRating = session?.rating || 1200;

                    if (!targetUserId) {
                        this.send(socket, "error", "Invalid target player for duel challenge.");
                        break;
                    }

                    if (!this.connectionManager.isUserOnline(targetUserId)) {
                        this.send(socket, "challenge_target_offline", {
                            targetUserId,
                            targetUsername: targetUsername || "Player",
                            message: `${targetUsername || "Player"} is currently offline. Would you like to battle AlgoBot (1200) instead?`
                        });
                        break;
                    }

                    const challenge = this.connectionManager.createChallenge({
                        fromUserId,
                        fromUsername,
                        fromRating,
                        targetUserId,
                        targetUsername: targetUsername || "Opponent",
                    });

                    if (!challenge) {
                        this.send(socket, "challenge_target_offline", {
                            targetUserId,
                            targetUsername: targetUsername || "Player",
                            message: `${targetUsername || "Player"} is currently offline. Would you like to battle AlgoBot (1200) instead?`
                        });
                        break;
                    }

                    this.connectionManager.sendToUser(targetUserId, "challenge_received", challenge);
                    this.send(socket, "challenge_sent", challenge);

                    // Push persistent Redis inbox notification
                    await this.pushInboxNotification({
                        userId: targetUserId,
                        type: "CHALLENGE",
                        title: "⚔️ 1v1 Battle Invite",
                        message: `${fromUsername} challenged you to an instant 1v1 battle duel!`,
                        metadata: {
                            challengeId: challenge.challengeId,
                            fromUserId,
                            fromUsername,
                            fromRating,
                        },
                    });
                    break;
                }

                case "start_bot_battle": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const activeUsername = session?.username || data.fromUsername || "Player";

                    if (!activeUserId) {
                        this.send(socket, "error", "Authentication required before starting battle.");
                        break;
                    }

                    try {
                        const botMatch = await this.matchmakingService.createBotMatch(activeUserId, activeUsername);
                        this.connectionManager.updatePresenceStatus(activeUserId, "IN_BATTLE", botMatch.roomId);
                        await this.dispatchMatch(botMatch);
                    } catch (err: any) {
                        logger.error({ err, userId: activeUserId }, "Failed to start bot battle");
                        this.send(socket, "error", "Failed to start bot battle");
                    }
                    break;
                }

                case "accept_challenge": {
                    const { challengeId } = data;
                    const challenge = this.connectionManager.getChallenge(challengeId);

                    if (!challenge || challenge.status !== "PENDING") {
                        this.send(socket, "error", "Challenge expired or no longer available.");
                        break;
                    }

                    // 🛡️ AF-004: Only target recipient can accept challenge
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    if (!activeUserId || activeUserId !== challenge.targetUserId) {
                        this.send(socket, "error", "Unauthorized: only the challenged player may accept this duel.");
                        break;
                    }

                    challenge.status = "ACCEPTED";
                    this.connectionManager.removeChallenge(challengeId);

                    try {
                        const room = await this.battleRoomService.createRoom({
                            hostId: challenge.fromUserId,
                            maxPlayers: 2,
                            timeLimitMinutes: 15,
                            difficulty: "MIX",
                            questionCount: 3
                        });

                        await this.battleRoomService.joinRoom(room.id, challenge.targetUserId);
                        await this.battleRoomService.setPlayerReady(room.id, challenge.fromUserId, true);
                        await this.battleRoomService.setPlayerReady(room.id, challenge.targetUserId, true);

                        await this.battleRoomService.startBattle(room.id, challenge.fromUserId);
                        const roomWithProblems = await this.battleRoomRepo.getRoomById(room.id);
                        const problems = roomWithProblems?.problems || [];

                        this.connectionManager.updatePresenceStatus(challenge.fromUserId, "IN_BATTLE", room.id);
                        this.connectionManager.updatePresenceStatus(challenge.targetUserId, "IN_BATTLE", room.id);

                        const matchPayload = {
                            roomId: room.id,
                            roomCode: room.roomCode,
                            problems: problems,
                            timeLimitSeconds: room.timeLimitMinutes * 60,
                            players: [challenge.fromUsername, challenge.targetUsername],
                        };

                        const battleState = {
                            roomId: room.id,
                            status: "RUNNING",
                            timeLimitSeconds: room.timeLimitMinutes * 60,
                            startTime: Date.now(),
                            totalQuestions: problems.length,
                            players: [
                                { userId: challenge.fromUserId, username: challenge.fromUsername, points: 0, solvedProblems: [], solvedCount: 0 },
                                { userId: challenge.targetUserId, username: challenge.targetUsername, points: 0, solvedProblems: [], solvedCount: 0 }
                            ]
                        };
                        await this.redis.set(`battle_state:${room.id}`, JSON.stringify(battleState), "EX", (room.timeLimitMinutes * 60) + 300);
                        await battleTimerQueue.add(JOB_NAMES.BATTLE_TIMER, { roomId: room.id }, { delay: (room.timeLimitMinutes * 60) * 1000 });

                        const challengerSocket = this.connectionManager.userSockets.get(challenge.fromUserId);
                        const targetSocket = this.connectionManager.userSockets.get(challenge.targetUserId);

                        if (challengerSocket) {
                            this.connectionManager.joinRoom(room.id, challengerSocket);
                            const s = this.socketUsers.get(challengerSocket);
                            if (s) s.roomId = room.id;
                        }
                        if (targetSocket) {
                            this.connectionManager.joinRoom(room.id, targetSocket);
                            const s = this.socketUsers.get(targetSocket);
                            if (s) s.roomId = room.id;
                        }

                        this.connectionManager.sendToUser(challenge.fromUserId, "match_found", matchPayload);
                        this.connectionManager.sendToUser(challenge.targetUserId, "match_found", matchPayload);
                        this.connectionManager.broadcastToRoom(room.id, "battle_state_sync", battleState);

                        await this.pushInboxNotification({
                            userId: challenge.fromUserId,
                            type: "CHALLENGE_ACCEPTED",
                            title: "⚔️ Challenge Accepted!",
                            message: `${challenge.targetUsername} accepted your battle challenge!`,
                            metadata: { roomId: room.id },
                        });
                    } catch (err) {
                        this.send(socket, "error", "Failed to accept challenge or start battle.");
                    }
                    break;
                }

                case "decline_challenge": {
                    const { challengeId } = data;
                    const challenge = this.connectionManager.getChallenge(challengeId);
                    if (challenge) {
                        // 🛡️ AF-004: Only target recipient can decline challenge
                        const session = this.socketUsers.get(socket);
                        const activeUserId = session?.userId || currentUserId.value;
                        if (!activeUserId || activeUserId !== challenge.targetUserId) {
                            this.send(socket, "error", "Unauthorized: only the challenged player may decline this duel.");
                            break;
                        }

                        challenge.status = "DECLINED";
                        this.connectionManager.removeChallenge(challengeId);
                        this.connectionManager.sendToUser(challenge.fromUserId, "challenge_declined", {
                            challengeId,
                            targetUsername: challenge.targetUsername,
                        });

                        await this.pushInboxNotification({
                            userId: challenge.fromUserId,
                            type: "CHALLENGE_DECLINED",
                            title: "⚔️ Challenge Declined",
                            message: `${challenge.targetUsername} declined your battle challenge.`,
                            metadata: { challengeId },
                        });
                    }
                    break;
                }

                case "cancel_challenge": {
                    const { challengeId } = data;
                    const challenge = this.connectionManager.getChallenge(challengeId);
                    if (challenge) {
                        // 🛡️ AF-004: Only challenger can cancel challenge
                        const session = this.socketUsers.get(socket);
                        const activeUserId = session?.userId || currentUserId.value;
                        if (!activeUserId || activeUserId !== challenge.fromUserId) {
                            this.send(socket, "error", "Unauthorized: only the challenger may cancel this duel.");
                            break;
                        }

                        challenge.status = "CANCELLED";
                        this.connectionManager.removeChallenge(challengeId);
                        this.connectionManager.sendToUser(challenge.targetUserId, "challenge_cancelled", {
                            challengeId,
                        });
                    }
                    break;
                }

                case "find_match":
                case "matchmake": {
                    const session = this.socketUsers.get(socket);
                    const identifier = session?.userId || currentUserId.value || data.username || "Player";

                    let user = await this.userRepo.getUserById(identifier);
                    if (!user) {
                        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                        const fallbackName = data.username || `Player_${randomSuffix}`;
                        user = await this.userRepo.upsertUser({
                            username: fallbackName,
                            email: `${fallbackName.toLowerCase().replace(/\s+/g, "_")}@algofight.local`,
                        });
                    }

                    const activeUserId = user.id;
                    const activeUsername = data.username || session?.username || user.username;

                    currentUserId.value = activeUserId;
                    this.connectionManager.registerUser(activeUserId, socket, {
                        username: activeUsername,
                        rating: user.rating,
                        platformCode: user.platformCode || undefined,
                        status: "IN_BATTLE",
                    });
                    this.socketUsers.set(socket, {
                        userId: activeUserId,
                        username: activeUsername,
                        rating: user.rating,
                        platformCode: user.platformCode || undefined,
                    });

                    // Join distributed Redis queue
                    const match = await this.matchmakingService.joinQueue(activeUserId, activeUsername);

                    if (match) {
                        this.connectionManager.updatePresenceStatus(activeUserId, "IN_BATTLE", match.roomId);
                        await this.dispatchMatch(match);
                    } else {
                        this.send(socket, "waiting_for_opponent", {
                            status: "queued",
                            queuedAt: Date.now(),
                            searchWindow: "±50 ELO",
                            timeoutSeconds: 25,
                        });

                        // Progressive search window expansion notifications
                        setTimeout(async () => {
                            if (await this.matchmakingService.isQueued(activeUserId)) {
                                this.send(socket, "matchmaking_status", {
                                    status: "expanding_search",
                                    searchWindow: "±150 ELO",
                                });
                            }
                        }, 5000);

                        setTimeout(async () => {
                            if (await this.matchmakingService.isQueued(activeUserId)) {
                                this.send(socket, "matchmaking_status", {
                                    status: "expanding_search",
                                    searchWindow: "±300 ELO",
                                });
                            }
                        }, 12000);

                        // 25s Timeout Fallback to Bot
                        setTimeout(async () => {
                            try {
                                if (await this.matchmakingService.isQueued(activeUserId)) {
                                    logger.info({ userId: activeUserId }, "Matchmaking timed out (25s) -> Fallback to AlgoBot");
                                    const botMatch = await this.matchmakingService.createBotMatch(activeUserId, activeUsername);
                                    this.connectionManager.updatePresenceStatus(activeUserId, "IN_BATTLE", botMatch.roomId);
                                    await this.dispatchMatch(botMatch);
                                }
                            } catch (err: any) {
                                logger.error({ err, userId: activeUserId }, "Failed to dispatch bot match");
                                this.send(socket, "error", "Matchmaking error occurred");
                            }
                        }, 25000);
                    }
                    break;
                }

                case "matchmake_vs_bot":
                case "play_vs_bot": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const activeUsername = session?.username || data.username || "Player";
                    if (!activeUserId) {
                        this.send(socket, "error", "Must identify before finding match");
                        break;
                    }
                    try {
                        const botMatch = await this.matchmakingService.createBotMatch(activeUserId, activeUsername);
                        this.connectionManager.updatePresenceStatus(activeUserId, "IN_BATTLE", botMatch.roomId);
                        await this.dispatchMatch(botMatch);
                    } catch (err: any) {
                        logger.error({ err, userId: activeUserId }, "Failed to start bot battle");
                        this.send(socket, "error", "Failed to start bot battle");
                    }
                    break;
                }

                case "cancel_matchmake":
                case "cancel_queue": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    if (activeUserId) {
                        await this.matchmakingService.cancelQueue(activeUserId);
                        this.send(socket, "matchmaking_cancelled", { status: "cancelled" });
                    }
                    break;
                }

                case "test_code": {
                    const { code, language } = data;
                    const result = await this.mockExecutor.execute({
                        submissionId: `test-${Date.now()}`,
                        language: language || "javascript",
                        code: code || "",
                        testCases: [
                            { input: "2 7", expectedOutput: "9" },
                            { input: "3 2", expectedOutput: "5" },
                        ],
                        timeLimit: 2000,
                        memoryLimit: 256,
                    });

                    this.send(socket, "code_result", {
                        result: {
                            passed: result.failedCount === 0,
                            passedTestCases: result.passedCount,
                            totalTestCases: result.passedCount + result.failedCount,
                            output: result.stdout || (result.failedCount === 0 ? "Sample test cases passed!" : result.stderr || "Output mismatch."),
                            executionTime: result.executionTime,
                        },
                    });
                    break;
                }

                case "submit_code": {
                    // Handled securely by REST API + background execution service now!
                    break;
                }

                case "join_room_channel": {
                    const { roomCode, userId, username } = data;
                    if (roomCode) {
                        const actualUserId = userId || currentUserId.value || "guest";
                        
                        if (this.disconnectTimeouts.has(actualUserId)) {
                            clearTimeout(this.disconnectTimeouts.get(actualUserId));
                            this.disconnectTimeouts.delete(actualUserId);
                            
                            this.connectionManager.broadcastToRoom(roomCode, "opponent_reconnected", {
                                userId: actualUserId,
                                username: username || "Player",
                            });
                        }

                        this.connectionManager.joinRoom(roomCode, socket);
                        const session = this.socketUsers.get(socket) || {
                            userId: actualUserId,
                            username: username || "Player",
                            roomId: roomCode,
                        };
                        session.roomId = roomCode;
                        this.socketUsers.set(socket, session);

                        if (session.userId) {
                            this.connectionManager.updatePresenceStatus(session.userId, "IN_LOBBY", roomCode);
                        }

                        this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                            userId: session.userId,
                            username: session.username,
                        });
                    }
                    break;
                }

                case "leave_room_channel": {
                    const { roomCode, userId, username } = data;
                    if (roomCode) {
                        const actualUserId = userId || currentUserId.value;
                        if (actualUserId) {
                            try {
                                await this.battleRoomService.leaveRoom(roomCode, actualUserId);
                            } catch {
                                // Non-blocking if already left
                            }
                            this.connectionManager.updatePresenceStatus(actualUserId, "AVAILABLE");
                        }

                        this.connectionManager.leaveRoom(roomCode, socket);
                        const session = this.socketUsers.get(socket);
                        if (session && session.roomId === roomCode) {
                            delete session.roomId;
                        }

                        this.connectionManager.broadcastToRoom(roomCode, "player_left", {
                            userId: actualUserId,
                            username: username || "Player",
                        });
                        this.connectionManager.broadcastToRoom(roomCode, "room_updated", {
                            roomCode,
                            action: "player_left",
                            userId: actualUserId,
                        });
                    }
                    break;
                }

                case "kick_player": {
                    const { roomCode, hostId, targetUserId, targetUsername } = data;
                    if (roomCode && hostId && targetUserId) {
                        try {
                            await this.battleRoomService.kickPlayer(roomCode, hostId, targetUserId);

                            this.connectionManager.sendToUser(targetUserId, "kicked_from_room", {
                                roomCode,
                                message: "You were removed from the lobby by the room host.",
                            });

                            this.connectionManager.broadcastToRoom(roomCode, "player_kicked", {
                                targetUserId,
                                targetUsername: targetUsername || "A player",
                            });
                            this.connectionManager.broadcastToRoom(roomCode, "room_updated", {
                                roomCode,
                                action: "player_kicked",
                                targetUserId,
                            });
                        } catch (err: any) {
                            this.send(socket, "error", err.message || "Failed to kick player");
                        }
                    }
                    break;
                }

                case "request_join_room": {
                    const { roomCode, userId, username, rating } = data;
                    if (roomCode && userId) {
                        const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                            || await this.battleRoomRepo.getRoomById(roomCode);
                        if (room && room.hostId) {
                            this.connectionManager.sendToUser(room.hostId, "join_request_received", {
                                roomCode,
                                userId,
                                username: username || "A player",
                                rating: rating || 1200,
                            });
                        }
                    }
                    break;
                }

                case "approve_join_request": {
                    const { roomCode, hostId, targetUserId, targetUsername } = data;
                    if (roomCode && hostId && targetUserId) {
                        try {
                            const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                                || await this.battleRoomRepo.getRoomById(roomCode);
                            if (room && room.hostId === hostId) {
                                await this.battleRoomService.joinRoom(room.id, targetUserId);

                                this.connectionManager.sendToUser(targetUserId, "join_request_approved", {
                                    roomCode,
                                    message: "Host approved your join request!",
                                });

                                this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                                    userId: targetUserId,
                                    username: targetUsername || "Player",
                                });
                                this.connectionManager.broadcastToRoom(roomCode, "room_updated", {
                                    roomCode,
                                    action: "player_joined",
                                    userId: targetUserId,
                                });
                            }
                        } catch (err: any) {
                            this.send(socket, "error", err.message || "Failed to approve join request");
                        }
                    }
                    break;
                }

                case "approve_all_join_requests": {
                    const { roomCode, hostId, requests } = data;
                    if (roomCode && hostId && Array.isArray(requests)) {
                        try {
                            const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                                || await this.battleRoomRepo.getRoomById(roomCode);
                            if (room && room.hostId === hostId) {
                                for (const req of requests) {
                                    if (!req?.userId) continue;
                                    try {
                                        await this.battleRoomService.joinRoom(room.id, req.userId);
                                        this.connectionManager.sendToUser(req.userId, "join_request_approved", {
                                            roomCode,
                                            message: "Host approved your join request!",
                                        });
                                        this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                                            userId: req.userId,
                                            username: req.username || "Player",
                                        });
                                    } catch (e) {
                                        // continue admitting other students
                                    }
                                }
                                this.connectionManager.broadcastToRoom(roomCode, "room_updated", {
                                    roomCode,
                                    action: "batch_players_joined",
                                });
                            }
                        } catch (err: any) {
                            this.send(socket, "error", err.message || "Failed to approve all join requests");
                        }
                    }
                    break;
                }

                case "reject_join_request": {
                    const { roomCode, hostId, targetUserId, reason } = data;
                    if (roomCode && hostId && targetUserId) {
                        const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                            || await this.battleRoomRepo.getRoomById(roomCode);
                        if (room && room.hostId === hostId) {
                            this.connectionManager.sendToUser(targetUserId, "join_request_rejected", {
                                roomCode,
                                message: reason || "Host declined your join request.",
                            });
                        }
                    }
                    break;
                }

                case "reject_all_join_requests": {
                    const { roomCode, hostId, requests, reason } = data;
                    if (roomCode && hostId && Array.isArray(requests)) {
                        const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                            || await this.battleRoomRepo.getRoomById(roomCode);
                        if (room && room.hostId === hostId) {
                            for (const req of requests) {
                                if (!req?.userId) continue;
                                this.connectionManager.sendToUser(req.userId, "join_request_rejected", {
                                    roomCode,
                                    message: reason || "Host declined your join request.",
                                });
                            }
                        }
                    }
                    break;
                }

                case "toggle_ready": {
                    const { roomCode, userId, isReady } = data;
                    if (roomCode) {
                        this.connectionManager.broadcastToRoom(roomCode, "player_ready_changed", {
                            userId,
                            isReady,
                        });
                    }
                    break;
                }

                case "start_room_battle": {
                    const { roomCode } = data;
                    if (roomCode) {
                        const room = await this.battleRoomRepo.getRoomByCode(roomCode);
                        if (room) {
                            try {
                                await this.battleRoomService.startBattle(room.id, room.hostId);
                            } catch (err: any) {
                                logger.error({ err, roomCode }, "Failed to start room battle");
                                this.send(socket, "error", err.message || "Cannot start battle");
                                break;
                            }
                            const roomWithProblems = await this.battleRoomRepo.getRoomById(room.id);
                            const problems = roomWithProblems?.problems || [];

                            const matchPayload = {
                                roomId: room.id,
                                roomCode: room.roomCode,
                                problems: problems,
                                timeLimitSeconds: room.timeLimitMinutes * 60,
                            };

                            const battleState = {
                                roomId: room.id,
                                status: "RUNNING",
                                timeLimitSeconds: room.timeLimitMinutes * 60,
                                startTime: Date.now(),
                                totalQuestions: problems.length,
                                players: room.participants.map(p => {
                                    const presence = this.connectionManager.getPresence(p.userId);
                                    return {
                                        userId: p.userId,
                                        username: (p as any).user?.username || presence?.username || p.userId,
                                        points: 0,
                                        solvedProblems: [],
                                        solvedCount: 0
                                    };
                                })
                            };

                            await this.redis.set(`battle_state:${room.id}`, JSON.stringify(battleState), "EX", (room.timeLimitMinutes * 60) + 300);
                            await battleTimerQueue.add(JOB_NAMES.BATTLE_TIMER, { roomId: room.id }, { delay: (room.timeLimitMinutes * 60) * 1000 });
                            this.connectionManager.broadcastToRoom(roomCode, "battle_started", matchPayload);
                            this.connectionManager.broadcastToRoom(roomCode, "battle_state_sync", battleState);
                        }
                    }
                    break;
                }

                case "test_code": {
                    const { code, language, problemId } = data;
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId;
                    
                    if (!problemId || !code) {
                        this.send(socket, "error", "Missing problemId or code");
                        break;
                    }

                    const problem = await this.problemRepo.getProblemById(problemId);
                    if (!problem) {
                        this.send(socket, "error", "Problem not found");
                        break;
                    }

                    const result = await this.evaluationService.evaluateSubmission({
                        submissionId: "test-" + Date.now(),
                        language,
                        code,
                        testCases: problem.testCases,
                        timeLimitMs: problem.timeLimit,
                        memoryLimitBytes: problem.memoryLimit,
                    });

                    this.send(socket, "code_result", {
                        action: "test_result",
                        success: result.verdict === "ACCEPTED",
                        verdict: result.verdict,
                        executionTime: result.resourceUsage?.totalTime || 0,
                        memoryUsage: result.resourceUsage?.maxMemory || 0,
                        results: (result.testCases || []).map((tc) => ({
                            testCaseId: tc.testCaseId,
                            input: problem.testCases.find(p => p.id === tc.testCaseId)?.input || "",
                            expected: problem.testCases.find(p => p.id === tc.testCaseId)?.expectedOutput || "",
                            actual: tc.actualOutput,
                            passed: tc.passed,
                            error: tc.error,
                            metrics: tc.metrics,
                        })),
                    });
                    break;
                }

                case "submit_code": {
                    const { code, language, roomId, problemId } = data;
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId;
                    
                    if (!problemId || !code) {
                        this.send(socket, "error", "Missing problemId or code");
                        break;
                    }

                    const problem = await this.problemRepo.getProblemWithAllTestCases(problemId);
                    if (!problem) {
                        this.send(socket, "error", "Problem not found");
                        break;
                    }

                    const result = await this.evaluationService.evaluateSubmission({
                        submissionId: "submit-" + Date.now(),
                        language,
                        code,
                        testCases: problem.testCases,
                        timeLimitMs: problem.timeLimit,
                        memoryLimitBytes: problem.memoryLimit,
                    });

                    const isAccepted = result.verdict === "ACCEPTED";
                    
                    this.send(socket, "code_result", {
                        action: "submit_result",
                        success: isAccepted,
                        verdict: result.verdict,
                        executionTime: result.resourceUsage?.totalTime || 0,
                        memoryUsage: result.resourceUsage?.maxMemory || 0,
                        results: (result.testCases || []).map((tc) => ({
                            testCaseId: tc.testCaseId,
                            passed: tc.passed,
                            error: tc.error,
                            metrics: tc.metrics,
                        })),
                    });

                    if (isAccepted && roomId && userId) {
                        await this.battleService.processEvaluationResult(roomId, userId, problemId, true, 100);
                    }
                    break;
                }

                // 🛡️ AF-022: Server-Authoritative Anti-Cheat & Forfeit Handler
                case "anti_cheat_violation": {
                    const { roomId, type } = data;
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    if (!roomId || !userId) break;

                    const violationKey = `${roomId}:${userId}`;
                    const count = (this.violations.get(violationKey) || 0) + 1;
                    this.violations.set(violationKey, count);

                    logger.warn({ roomId, userId, type, count }, "Anti-cheat violation detected");

                    this.send(socket, "anti_cheat_warning", {
                        warning: `Anti-cheat warning (${count}/3): Window blur / tab switch detected.`,
                        violationsCount: count,
                        maxViolations: 3,
                    });

                    if (count >= 3) {
                        await this.battleService.finishBattle(roomId, "FORFEIT_ANTI_CHEAT", undefined, userId);
                        this.connectionManager.broadcastToRoom(roomId, "battle_forfeited", {
                            roomId,
                            forfeitedUserId: userId,
                            reason: "Disqualified due to repeated anti-cheat violations (tab switching).",
                        });
                    }
                    break;
                }

                case "leave_battle":
                case "forfeit_battle": {
                    const { roomId } = data;
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    const username = session?.username || data.username || "A player";
                    if (!roomId || !userId) break;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (rawState) {
                        const state = JSON.parse(rawState);
                        const player = state.players?.find((p: any) => p.userId === userId || p.username === username);
                        if (player) {
                            player.status = "LEFT";
                            player.forfeited = true;
                        }

                        const activePlayers = state.players?.filter((p: any) => p.status !== "LEFT" && !p.forfeited) || [];

                        this.connectionManager.broadcastToRoom(roomId, "player_left_battle", {
                            roomId,
                            userId,
                            username,
                            reason: `${username} left the battle arena.`,
                            remainingActiveCount: activePlayers.length,
                            totalPlayers: state.players?.length || 0,
                        });

                        if (activePlayers.length <= 1 && state.status === "RUNNING") {
                            const winner = activePlayers[0];
                            await this.battleService.finishBattle(roomId, "OPPONENT_FORFEIT", winner?.userId, userId);
                            this.connectionManager.broadcastToRoom(roomId, "battle_over", {
                                roomId,
                                winner: winner?.username || "Opponent",
                                reason: "OPPONENT_FORFEIT",
                                forfeitedPlayer: username,
                                finalState: state,
                            });
                        } else {
                            await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 1800);
                            this.connectionManager.broadcastToRoom(roomId, "battle_state_sync", state);
                        }
                    } else {
                        this.connectionManager.broadcastToRoom(roomId, "player_left_battle", {
                            roomId,
                            userId,
                            username,
                            reason: `${username} left the battle arena.`,
                        });
                    }

                    this.connectionManager.leaveRoom(roomId, socket);
                    if (session) delete session.roomId;
                    break;
                }

                default:
                    logger.debug({ action }, "Received unhandled socket action");
            }
        } catch (error) {
            logger.error({ error }, "Error processing socket message");
            this.send(socket, "error", "Invalid message format");
        }
    }

    private async dispatchMatch(
        match: {
            roomId: string;
            roomCode: string;
            player1Id: string;
            player1Username?: string;
            player1Rating?: number;
            player2Id: string;
            player2Username?: string;
            player2Rating?: number;
        }
    ): Promise<void> {
        await this.battleRoomService.startBattle(match.roomId, match.player1Id);
        const roomWithProblems = await this.battleRoomRepo.getRoomById(match.roomId);
        const problems = roomWithProblems?.problems || [];
        const timeLimitSeconds = (roomWithProblems?.timeLimitMinutes || 15) * 60;

        let p1Name = match.player1Username;
        let p1Rating = match.player1Rating || 1200;
        if (!p1Name) {
            const p1User = await this.userRepo.getUserById(match.player1Id);
            p1Name = p1User?.username || "Player 1";
            p1Rating = p1User?.rating || 1200;
        }

        let p2Name = match.player2Username;
        let p2Rating = match.player2Rating || 1200;
        if (!p2Name) {
            const p2User = await this.userRepo.getUserById(match.player2Id);
            p2Name = p2User?.username || "Player 2";
            p2Rating = p2User?.rating || 1200;
        }

        const player1Socket = this.connectionManager.userSockets.get(match.player1Id);
        const player2Socket = this.connectionManager.userSockets.get(match.player2Id);

        if (player1Socket) {
            this.connectionManager.joinRoom(match.roomId, player1Socket);
            const session = this.socketUsers.get(player1Socket);
            if (session) session.roomId = match.roomId;
            this.connectionManager.updatePresenceStatus(match.player1Id, "IN_BATTLE", match.roomId);
        }

        if (player2Socket) {
            this.connectionManager.joinRoom(match.roomId, player2Socket);
            const session = this.socketUsers.get(player2Socket);
            if (session) session.roomId = match.roomId;
            this.connectionManager.updatePresenceStatus(match.player2Id, "IN_BATTLE", match.roomId);
        }

        const matchPayload = {
            roomId: match.roomId,
            roomCode: match.roomCode,
            problems: problems,
            timeLimitSeconds,
            players: [p1Name, p2Name],
            playerDetails: [
                { userId: match.player1Id, username: p1Name, rating: p1Rating },
                { userId: match.player2Id, username: p2Name, rating: p2Rating },
            ]
        };

        const battleState = {
            roomId: match.roomId,
            status: "RUNNING",
            timeLimitSeconds,
            startTime: Date.now(),
            totalQuestions: problems.length,
            players: [
                { userId: match.player1Id, username: p1Name, points: 0, solvedProblems: [], solvedCount: 0 },
                { userId: match.player2Id, username: p2Name, points: 0, solvedProblems: [], solvedCount: 0 }
            ]
        };
        await this.redis.set(`battle_state:${match.roomId}`, JSON.stringify(battleState), "EX", timeLimitSeconds + 300);
        await battleTimerQueue.add(JOB_NAMES.BATTLE_TIMER, { roomId: match.roomId }, { delay: timeLimitSeconds * 1000 });

        this.connectionManager.broadcastToRoom(match.roomId, "match_found", matchPayload);
        this.connectionManager.broadcastToRoom(match.roomId, "battle_state_sync", battleState);
    }

    async handleDisconnect(socket: WebSocket): Promise<void> {
        const session = this.socketUsers.get(socket);
        if (session?.roomId && session?.userId) {
            const rawState = await this.redis.get(`battle_state:${session.roomId}`);
            if (rawState) {
                const state = JSON.parse(rawState);
                if (state.status === "RUNNING") {
                    const opponent = state.players?.find((p: any) => p.userId !== session.userId);

                    this.connectionManager.broadcastToRoom(session.roomId, "opponent_disconnected", {
                        userId: session.userId,
                        username: session.username,
                        message: `${session.username} has disconnected from the battle.`,
                        reconnectDeadline: Date.now() + 60000
                    });

                    const timeout = setTimeout(async () => {
                        this.disconnectTimeouts.delete(session.userId!);
                        
                        const currentStateRaw = await this.redis.get(`battle_state:${session.roomId}`);
                        if (currentStateRaw) {
                            const currentState = JSON.parse(currentStateRaw);
                            if (currentState.status === "RUNNING") {
                                const player = currentState.players?.find((p: any) => p.userId === session.userId);
                                if (player) {
                                    player.status = "LEFT";
                                    player.forfeited = true;
                                }
                                const active = currentState.players?.filter((p: any) => p.status !== "LEFT" && !p.forfeited) || [];
                                
                                if (active.length <= 1) {
                                    const winner = active[0] || opponent;
                                    await this.battleService.finishBattle(session.roomId!, "OPPONENT_FORFEIT", winner?.userId, session.userId);
                                    this.connectionManager.broadcastToRoom(session.roomId!, "battle_over", {
                                        roomId: session.roomId,
                                        winner: winner?.username || "Opponent",
                                        reason: "OPPONENT_FORFEIT",
                                        forfeitedPlayer: session.username,
                                        finalState: currentState,
                                    });
                                } else {
                                    await this.redis.set(`battle_state:${session.roomId}`, JSON.stringify(currentState), "EX", 1800);
                                    this.connectionManager.broadcastToRoom(session.roomId!, "battle_state_sync", currentState);
                                    this.connectionManager.broadcastToRoom(session.roomId!, "player_left_battle", {
                                        roomId: session.roomId,
                                        userId: session.userId,
                                        username: session.username,
                                        reason: `${session.username} timed out and forfeited.`,
                                        remainingActiveCount: active.length,
                                    });
                                }
                            }
                        }
                    }, 60000);
                    
                    this.disconnectTimeouts.set(session.userId, timeout);
                }
            } else {
                // Check if in a waiting lobby room
                try {
                    const room = await this.battleRoomRepo.getRoomByCode(session.roomId)
                        || await this.battleRoomRepo.getRoomById(session.roomId);
                    if (room && room.status === "WAITING") {
                        await this.battleRoomService.leaveRoom(room.id, session.userId);
                        this.connectionManager.broadcastToRoom(session.roomId, "player_left", {
                            userId: session.userId,
                            username: session.username,
                        });
                        this.connectionManager.broadcastToRoom(session.roomId, "room_updated", {
                            roomCode: room.roomCode,
                            action: "player_left",
                            userId: session.userId,
                        });
                    }
                } catch {
                    // Non-fatal cleanup error
                }
            }
            this.connectionManager.leaveRoom(session.roomId, socket);
        }

        if (session?.userId) {
            this.connectionManager.unregisterUser(session.userId, socket);
        }
        this.socketUsers.delete(socket);
    }

    private async pushInboxNotification(params: {
        userId: string;
        type: "CHALLENGE" | "CHALLENGE_ACCEPTED" | "CHALLENGE_DECLINED" | "BATTLE_START" | "BATTLE_RESULT" | "SYSTEM";
        title: string;
        message: string;
        metadata?: Record<string, any>;
    }) {
        try {
            const notification = {
                id: `notif_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: params.message,
                read: false,
                createdAt: Date.now(),
                metadata: params.metadata || {},
            };
            const key = `user:notifications:${params.userId}`;
            await this.redis.lpush(key, JSON.stringify(notification));
            await this.redis.ltrim(key, 0, 49);

            // Broadcast live inbox update event to user if online
            this.connectionManager.sendToUser(params.userId, "inbox_notification", notification);
        } catch (err) {
            logger.error({ err, userId: params.userId }, "Failed to push persistent inbox notification");
        }
    }

    private send(socket: WebSocket, event: string, payload: any): void {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ event, ...payload }));
        }
    }
}
