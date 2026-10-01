// apps/websocket/src/handlers/socket-handler.ts
import crypto from "crypto";
import { WebSocket } from "ws";
import { syncBattleToTelemetry } from "../events/battle.events";
import { ConnectionManager } from "./connection-manager";
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
import { userSessionStore } from "../gateway/session/user-session";
import { googleTokenVerifier } from "../utils/google-auth.util";

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
            hostId: match.player1Id,
            status: "RUNNING",
            timeLimitSeconds,
            startTime: Date.now(),
            totalQuestions: problems.length,
            players: [
                { userId: match.player1Id, username: match.player1Username, points: 0, solvedProblems: [], solvedCount: 0, tabSwitches: 0, disqualified: false },
                { userId: match.player2Id, username: match.player2Username, points: 0, solvedProblems: [], solvedCount: 0, tabSwitches: 0, disqualified: false }
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
                    // 🛡️ Verify AlgoFight Session Token or Google ID Token
                    let verifiedUid: string | null = null;
                    let verifiedEmail: string | undefined = undefined;
                    let verifiedUsername: string | undefined = undefined;

                    const rawToken = data.token || data.rawToken || (typeof data.auth === "object" ? data.auth.token : undefined);
                    if (rawToken) {
                        const session = await userSessionStore.getSession(rawToken);
                        if (session) {
                            verifiedUid = session.userId;
                            verifiedEmail = session.email;
                            verifiedUsername = session.username;
                        } else {
                            const googlePayload = await googleTokenVerifier.verifyIdToken(rawToken);
                            if (googlePayload) {
                                verifiedUid = googlePayload.sub;
                                verifiedEmail = googlePayload.email;
                                verifiedUsername = googlePayload.name;
                            }
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

                    const userRating = user?.rating ?? 0;
                    const platformCode = user?.platformCode || "";
                    const userType = user?.userType || "INDIVIDUAL";
                    const institutionName = user?.institutionName || undefined;
                    const userMeta = (user?.studentIdentityMetadata as any) || {};
                    const photoURL = (user as any)?.photoURL || userMeta.photoURL || data.photoURL || undefined;

                    this.connectionManager.registerUser(userId, socket, {
                        username: user?.username || username,
                        rating: userRating,
                        platformCode,
                        userType,
                        institutionName,
                        photoURL,
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

                    const fromRating = session?.rating ?? 0;

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

                    const challengeConfig = data.config || {
                        difficulty: data.difficulty || "MIX",
                        questionCount: Number(data.questionCount) || 3,
                        timeLimitMinutes: Number(data.timeLimitMinutes) || 15,
                        topics: Array.isArray(data.topics) ? data.topics : [],
                    };

                    const challenge = this.connectionManager.createChallenge({
                        fromUserId,
                        fromUsername,
                        fromRating,
                        targetUserId,
                        targetUsername: targetUsername || "Opponent",
                        config: challengeConfig,
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
                        message: `${fromUsername} challenged you to a 1v1 duel (${challengeConfig.difficulty} • ${challengeConfig.questionCount} Qs • ${challengeConfig.timeLimitMinutes}m)!`,
                        metadata: {
                            challengeId: challenge.challengeId,
                            fromUserId,
                            fromUsername,
                            fromRating,
                            config: challengeConfig,
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

                    const battleConfig = challenge.config || {
                        difficulty: "MIX",
                        questionCount: 3,
                        timeLimitMinutes: 15,
                    };

                    try {
                        const room = await this.battleRoomService.createRoom({
                            hostId: challenge.fromUserId,
                            maxPlayers: 2,
                            timeLimitMinutes: battleConfig.timeLimitMinutes || 15,
                            difficulty: battleConfig.difficulty || "MIX",
                            questionCount: battleConfig.questionCount || 3,
                            isFriendly: true
                        });

                        await this.battleRoomService.joinRoom(room.id, challenge.targetUserId);
                        await this.battleRoomService.setPlayerReady(room.id, challenge.fromUserId, true);
                        await this.battleRoomService.setPlayerReady(room.id, challenge.targetUserId, true);

                        await this.battleRoomService.startBattle(room.id, challenge.fromUserId);
                        const roomWithProblems = await this.battleRoomRepo.getRoomById(room.id);
                        const problems = roomWithProblems?.problems || [];

                        this.connectionManager.updatePresenceStatus(challenge.fromUserId, "IN_BATTLE", room.id);
                        this.connectionManager.updatePresenceStatus(challenge.targetUserId, "IN_BATTLE", room.id);

                        // 🛡️ Activity Session Tracking (Issue 2)
                        await userSessionStore.setActiveActivity(challenge.fromUserId, {
                            type: "BATTLE",
                            activityId: room.roomCode,
                            joinedAt: Date.now(),
                            status: "ACTIVE",
                        });
                        await userSessionStore.setActiveActivity(challenge.targetUserId, {
                            type: "BATTLE",
                            activityId: room.roomCode,
                            joinedAt: Date.now(),
                            status: "ACTIVE",
                        });

                        const matchPayload = {
                            roomId: room.id,
                            roomCode: room.roomCode,
                            problems: problems,
                            timeLimitSeconds: (battleConfig.timeLimitMinutes || 15) * 60,
                            players: [challenge.fromUsername, challenge.targetUsername],
                        };

                        const battleState = {
                            roomId: room.id,
                            roomCode: room.roomCode,
                            hostId: challenge.fromUserId,
                            status: "RUNNING",
                            timeLimitSeconds: (battleConfig.timeLimitMinutes || 15) * 60,
                            startTime: Date.now(),
                            totalQuestions: problems.length,
                            players: [
                                { userId: challenge.fromUserId, username: challenge.fromUsername, status: "ACTIVE", points: 0, solvedProblems: [], solvedCount: 0, tabSwitches: 0, disqualified: false },
                                { userId: challenge.targetUserId, username: challenge.targetUsername, status: "ACTIVE", points: 0, solvedProblems: [], solvedCount: 0, tabSwitches: 0, disqualified: false }
                            ]
                        };
                        await this.redis.set(`battle_state:${room.id}`, JSON.stringify(battleState), "EX", ((battleConfig.timeLimitMinutes || 15) * 60) + 300);
                        await battleTimerQueue.add(JOB_NAMES.BATTLE_TIMER, { roomId: room.id }, { delay: ((battleConfig.timeLimitMinutes || 15) * 60) * 1000 });

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
                    const explicitUserId = data.userId || data.uid;
                    const session = this.socketUsers.get(socket);
                    const identifier = explicitUserId || session?.userId || currentUserId.value;

                    let user = identifier ? await this.userRepo.getUserById(identifier).catch(() => null) : null;
                    if (!user && explicitUserId) {
                        const fallbackName = data.username || session?.username || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
                        user = await this.userRepo.upsertUser({
                            id: explicitUserId,
                            username: fallbackName,
                            email: data.email || `${fallbackName.toLowerCase().replace(/\s+/g, "_")}@algofight.local`,
                        });
                    } else if (!user) {
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

                        // 25s Timeout Cancel Queue
                        setTimeout(async () => {
                            try {
                                if (await this.matchmakingService.isQueued(activeUserId)) {
                                    logger.info({ userId: activeUserId }, "Matchmaking timed out (25s) -> Canceling queue");
                                    await this.matchmakingService.cancelQueue(activeUserId);
                                    this.send(socket, "matchmaking_timeout", {
                                        message: "No available player in matchmaking for 1v1 battle."
                                    });
                                }
                            } catch (err: any) {
                                logger.error({ err, userId: activeUserId }, "Failed to timeout matchmaking");
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



                case "join_room_channel": {
                    const { roomCode, userId, username } = data;
                    if (roomCode) {
                        const actualUserId = userId || currentUserId.value || "guest";
                        const lobbyTimeoutKey = `lobby:${roomCode}:${actualUserId}`;
                        if (this.disconnectTimeouts.has(lobbyTimeoutKey)) {
                            clearTimeout(this.disconnectTimeouts.get(lobbyTimeoutKey));
                            this.disconnectTimeouts.delete(lobbyTimeoutKey);
                        }
                        
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

                        const savedTimer = await this.redis.get(`battle_timer_persisted:${roomCode}:${actualUserId}`);
                        const persistedSec = (savedTimer !== null && !isNaN(Number(savedTimer))) ? parseInt(savedTimer, 10) : undefined;
                        if (persistedSec !== undefined) {
                            this.send(socket, "timer_restored", {
                                roomId: roomCode,
                                userId: actualUserId,
                                persistedTimeRemaining: persistedSec,
                            });
                        }

                        // 🛡️ AF-CHK: Restore participant's saved code checkpoints from Redis
                        try {
                            const rawCheckpoints = await this.redis.get(`battle_checkpoints:${roomCode}:${actualUserId}`);
                            let myCheckpoints: Record<string, any> = rawCheckpoints ? JSON.parse(rawCheckpoints) : {};

                            const singleKeys = await this.redis.keys(`battle_checkpoint:${roomCode}:${actualUserId}:*`);
                            for (const k of singleKeys) {
                                const rawSingle = await this.redis.get(k);
                                if (rawSingle) {
                                    try {
                                        const p = JSON.parse(rawSingle);
                                        if (p.problemId && !myCheckpoints[p.problemId]) {
                                            myCheckpoints[p.problemId] = p;
                                        }
                                    } catch (_) {}
                                }
                            }

                            if (Object.keys(myCheckpoints).length > 0) {
                                this.send(socket, "checkpoints_restored", {
                                    roomId: roomCode,
                                    checkpoints: myCheckpoints
                                });
                            }
                        } catch (chkErr) {
                            logger.warn({ chkErr, roomCode, userId: actualUserId }, "Failed to restore Redis checkpoints on join");
                        }

                        this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                            userId: session.userId,
                            username: session.username,
                            persistedTimeRemaining: persistedSec,
                        });
                    }
                    break;
                }

                case "leave_room_channel": {
                    const { roomCode, userId, username } = data;
                    if (roomCode) {
                        const actualUserId = userId || currentUserId.value;
                        let leaveResult: { wasHost: boolean; remainingCount: number; newHostId?: string } | undefined;
                        if (actualUserId) {
                            try {
                                leaveResult = await this.battleRoomService.leaveRoom(roomCode, actualUserId);
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
                            newHostId: leaveResult?.newHostId,
                        });
                        this.connectionManager.broadcastToRoom(roomCode, "room_updated", {
                            roomCode,
                            action: "player_left",
                            userId: actualUserId,
                            newHostId: leaveResult?.newHostId,
                        });
                    }
                    break;
                }

                case "kick_player": {
                    const { roomCode, hostId, targetUserId, targetUsername } = data;
                    if (roomCode && hostId && targetUserId) {
                        try {
                            await this.battleRoomService.kickPlayer(roomCode, hostId, targetUserId);

                            const room = await this.battleRoomRepo.getRoomByCode(roomCode)
                                || await this.battleRoomRepo.getRoomById(roomCode);
                            if (room) {
                                await this.redis.sadd(`room_kicked_players:${room.id}`, targetUserId);
                                await this.redis.sadd(`room_kicked_players:${room.roomCode}`, targetUserId);
                                await this.redis.expire(`room_kicked_players:${room.id}`, 86400);
                                await this.redis.expire(`room_kicked_players:${room.roomCode}`, 86400);
                            }

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
                                rating: rating ?? 0,
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

                                // Clear kicked restriction on host approval
                                await this.redis.srem(`room_kicked_players:${room.id}`, targetUserId);
                                await this.redis.srem(`room_kicked_players:${room.roomCode}`, targetUserId);

                                const savedTimerRaw = await this.redis.get(`battle_timer_persisted:${room.id}:${targetUserId}`)
                                    || await this.redis.get(`battle_timer_persisted:${roomCode}:${targetUserId}`);
                                const persistedTimeRemaining = savedTimerRaw ? parseInt(savedTimerRaw, 10) : undefined;

                                this.connectionManager.sendToUser(targetUserId, "join_request_approved", {
                                    roomCode,
                                    roomId: room.id,
                                    message: "Host approved your join request!",
                                    persistedTimeRemaining,
                                    battleRunning: room.status === "RUNNING",
                                });

                                this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                                    userId: targetUserId,
                                    username: targetUsername || "Player",
                                    persistedTimeRemaining,
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

                                        // Clear kicked restriction
                                        await this.redis.srem(`room_kicked_players:${room.id}`, req.userId);
                                        await this.redis.srem(`room_kicked_players:${room.roomCode}`, req.userId);

                                        const savedTimerRaw = await this.redis.get(`battle_timer_persisted:${room.id}:${req.userId}`)
                                            || await this.redis.get(`battle_timer_persisted:${roomCode}:${req.userId}`);
                                        const persistedTimeRemaining = savedTimerRaw ? parseInt(savedTimerRaw, 10) : undefined;

                                        this.connectionManager.sendToUser(req.userId, "join_request_approved", {
                                            roomCode,
                                            roomId: room.id,
                                            message: "Host approved your join request!",
                                            persistedTimeRemaining,
                                            battleRunning: room.status === "RUNNING",
                                        });
                                        this.connectionManager.broadcastToRoom(roomCode, "player_joined", {
                                            userId: req.userId,
                                            username: req.username || "Player",
                                            persistedTimeRemaining,
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

                                const playerProfiles = await Promise.all(
                                    room.participants.map(async (p) => {
                                        if (p.user?.username) return p.user;
                                        if (p.username) return { id: p.userId, username: p.username, rating: p.rating ?? 0 };
                                        const found = await this.userRepo.getUserById(p.userId);
                                        return found || { id: p.userId, username: p.userId, rating: 0 };
                                    })
                                );

                                const battleState = {
                                    roomId: room.id,
                                    roomCode: room.roomCode,
                                    hostId: room.hostId,
                                    status: "RUNNING",
                                    timeLimitSeconds: room.timeLimitMinutes * 60,
                                    startTime: Date.now(),
                                    totalQuestions: problems.length,
                                    players: room.participants.map((p, idx) => {
                                        const profile = playerProfiles[idx];
                                        const presence = this.connectionManager.getPresence(p.userId);
                                        const resolvedName = profile?.username || p.user?.username || p.username || presence?.username || `Combatant ${idx + 1}`;
                                        return {
                                            userId: p.userId,
                                            username: resolvedName,
                                            rating: profile?.rating ?? p.user?.rating ?? p.rating ?? 0,
                                            points: 0,
                                            solvedProblems: [],
                                            solvedCount: 0,
                                            tabSwitches: 0,
                                            disqualified: false
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
                        memoryLimitBytes: (problem.memoryLimit || 256) * 1024 * 1024,
                    }, undefined, "SAMPLE");

                    this.send(socket, "code_result", {
                        action: "test_result",
                        success: result.verdict === "ACCEPTED",
                        verdict: result.verdict,
                        error: result.error || null,
                        structuredError: result.error || null,
                        executionTime: result.resourceUsage?.totalTime || 0,
                        memoryUsage: result.resourceUsage?.maxMemory || 0,
                        results: (result.testCases || []).map((tc) => ({
                            testCaseId: tc.testCaseId,
                            input: problem.testCases.find(p => p.id === tc.testCaseId)?.input || "",
                            expected: problem.testCases.find(p => p.id === tc.testCaseId)?.expectedOutput || "",
                            actual: tc.actualOutput !== undefined ? tc.actualOutput : (tc.metrics?.stdout ?? ""),
                            passed: tc.passed,
                            error: tc.error,
                            structuredError: tc.structuredError || null,
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
                        memoryLimitBytes: (problem.memoryLimit || 256) * 1024 * 1024,
                    }, undefined, "SUBMIT");

                    const isAccepted = result.verdict === "ACCEPTED";
                    
                    this.send(socket, "code_result", {
                        action: "submit_result",
                        success: isAccepted,
                        verdict: result.verdict,
                        error: result.error || null,
                        structuredError: result.error || null,
                        executionTime: result.resourceUsage?.totalTime || 0,
                        memoryUsage: result.resourceUsage?.maxMemory || 0,
                        results: (result.testCases || []).map((tc) => ({
                            testCaseId: tc.testCaseId,
                            input: tc.passed ? (problem.testCases.find(p => p.id === tc.testCaseId)?.input || "") : undefined,
                            expected: tc.passed ? (problem.testCases.find(p => p.id === tc.testCaseId)?.expectedOutput || "") : undefined,
                            actual: tc.actualOutput !== undefined ? tc.actualOutput : (tc.metrics?.stdout ?? ""),
                            passed: tc.passed,
                            error: tc.error,
                            structuredError: tc.structuredError || null,
                            metrics: tc.metrics,
                        })),
                    });

                    if (isAccepted && roomId && userId) {
                        await this.battleService.processEvaluationResult(roomId, userId, problemId, true, 100);
                    }
                    break;
                }

                // 🛡️ AF-022: Server-Authoritative Anti-Cheat & Continuous Tab Switch Tracking
                case "anti_cheat_violation": {
                    const { roomId, type, tabSwitches: reportedSwitches } = data;
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    const username = session?.username || data.username || "A player";
                    if (!roomId || !userId) break;

                    const violationKey = `${roomId}:${userId}`;
                    const count = (this.violations.get(violationKey) || 0) + 1;
                    this.violations.set(violationKey, count);

                    logger.warn({ roomId, userId, type, count, reportedSwitches }, "Anti-cheat violation detected");

                    let currentSwitches = typeof reportedSwitches === "number" ? reportedSwitches : count;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (rawState) {
                        try {
                            const state = JSON.parse(rawState);
                            const player = state.players?.find((p: any) => p.userId === userId || p.username === username);
                            if (player) {
                                player.tabSwitches = Math.max(player.tabSwitches || 0, currentSwitches);
                                currentSwitches = player.tabSwitches;
                                if (count >= 3) {
                                    player.disqualified = true;
                                    player.status = "DISQUALIFIED";
                                }
                            }
                            await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 7200);
                            this.connectionManager.broadcastToRoom(roomId, "battle_state_sync", state);
                            if (state.roomCode) {
                                this.connectionManager.broadcastToRoom(state.roomCode, "battle_state_sync", state);
                            }
                        } catch (err) {
                            logger.error({ err }, "Error updating battle state on anti_cheat_violation");
                        }
                    }

                    this.send(socket, "anti_cheat_warning", {
                        warning: `Anti-cheat warning (${count}/3): Window blur / tab switch detected.`,
                        violationsCount: count,
                        maxViolations: 3,
                        tabSwitches: currentSwitches,
                    });

                    if (count >= 3) {
                        this.send(socket, "anti_cheat_disqualified", {
                            roomId,
                            userId,
                            username,
                            violationsCount: count,
                            tabSwitches: currentSwitches,
                            reason: "Disqualified due to repeated anti-cheat violations (tab switching).",
                        });

                        this.connectionManager.broadcastToRoom(roomId, "player_disqualified", {
                            roomId,
                            userId,
                            username,
                            tabSwitches: currentSwitches,
                            reason: `${username} was disqualified by Anti-Cheat.`,
                        });
                    }
                    break;
                }

                // 🛡️ User requests re-entry after anti-cheat disqualification
                case "request_anticheat_reentry": {
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    const username = session?.username || data.username || "Combatant";
                    const { roomId, tabSwitches } = data;
                    if (!roomId || !userId) break;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    let hostId = data.hostId;
                    let roomCode = data.roomCode;
                    let playerSwitches = tabSwitches || 3;

                    if (rawState) {
                        try {
                            const state = JSON.parse(rawState);
                            hostId = state.hostId || hostId;
                            roomCode = state.roomCode || roomCode;
                            const player = state.players?.find((p: any) => p.userId === userId || p.username === username);
                            if (player?.tabSwitches) {
                                playerSwitches = player.tabSwitches;
                            }
                        } catch (err) {
                            logger.error({ err }, "Error parsing battle state for request_anticheat_reentry");
                        }
                    }

                    if (!hostId) {
                        try {
                            const room = await this.battleRoomRepo.getRoomById(roomId) 
                                || (roomCode ? await this.battleRoomRepo.getRoomByCode(roomCode) : null);
                            if (room?.hostId) {
                                hostId = room.hostId;
                            }
                        } catch (_) {}
                    }

                    logger.info({ roomId, userId, username, hostId }, "Anti-cheat re-entry requested");

                    if (hostId) {
                        this.connectionManager.sendToUser(hostId, "anticheat_pardon_requested", {
                            roomId,
                            roomCode,
                            userId,
                            targetUserId: userId,
                            username: username || "A Player",
                            targetUsername: username || "A Player",
                            tabSwitches: playerSwitches,
                            timestamp: Date.now(),
                        });
                    }

                    this.send(socket, "anticheat_reentry_pending", {
                        roomId,
                        message: "Your re-entry request has been sent to the host. Please wait for approval.",
                    });
                    break;
                }

                // 🛡️ Host approves anti-cheat re-entry
                case "approve_anticheat_reentry": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const { roomId, targetUserId } = data;
                    if (!activeUserId || !roomId || !targetUserId) break;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (!rawState) break;
                    const state = JSON.parse(rawState);

                    if (state.hostId && state.hostId !== activeUserId) {
                        this.send(socket, "error", "Unauthorized: only the room host can approve re-entry.");
                        break;
                    }

                    const player = state.players?.find((p: any) => p.userId === targetUserId);
                    if (player) {
                        player.disqualified = false;
                        player.status = "ACTIVE";
                        player.forfeited = false;

                        // Clear violation warning count
                        const violationKey = `${roomId}:${targetUserId}`;
                        this.violations.delete(violationKey);

                        // Save updated state (tabSwitches preserved)
                        await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 7200);

                        logger.info({ roomId, targetUserId, hostId: activeUserId }, "Host approved anti-cheat re-entry");

                        this.connectionManager.broadcastToRoom(roomId, "player_readmitted", {
                            roomId,
                            targetUserId,
                            username: player.username,
                            tabSwitches: player.tabSwitches || 0,
                            reason: "Host approved re-entry after anti-cheat disqualification.",
                        });
                        this.connectionManager.broadcastToRoom(roomId, "battle_state_sync", state);
                        if (state.roomCode) {
                            this.connectionManager.broadcastToRoom(state.roomCode, "battle_state_sync", state);
                            this.connectionManager.broadcastToRoom(state.roomCode, "player_readmitted", {
                                roomId,
                                targetUserId,
                                username: player.username,
                                tabSwitches: player.tabSwitches || 0,
                                reason: "Host approved re-entry after anti-cheat disqualification.",
                            });
                        }

                        this.connectionManager.sendToUser(targetUserId, "anticheat_reentry_approved", {
                            roomId,
                            targetUserId,
                            message: "Your re-entry request was approved by the host! You may resume coding.",
                            tabSwitches: player.tabSwitches || 0,
                        });
                    }
                    break;
                }

                // 🛡️ Host rejects anti-cheat re-entry
                case "reject_anticheat_reentry": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const { roomId, targetUserId, reason } = data;
                    if (!activeUserId || !roomId || !targetUserId) break;

                    logger.info({ roomId, targetUserId, hostId: activeUserId }, "Host rejected anti-cheat re-entry");

                    this.connectionManager.sendToUser(targetUserId, "anticheat_reentry_rejected", {
                        roomId,
                        targetUserId,
                        message: reason || "Your re-entry request was declined by the host.",
                    });
                    break;
                }

                case "leave_battle":
                case "forfeit_battle": {
                    const session = this.socketUsers.get(socket);
                    const roomId = data.roomId || session?.roomId;
                    const userId = session?.userId || currentUserId.value;
                    const username = session?.username || data.username || "A player";
                    if (!roomId || !userId) break;

                    if (data.timeRemaining !== undefined && !isNaN(Number(data.timeRemaining))) {
                        const sec = Math.max(0, Math.floor(Number(data.timeRemaining)));
                        await this.redis.set(`battle_timer_persisted:${roomId}:${userId}`, sec, "EX", 7200);
                    }

                    // Immediately mark leaving player as AVAILABLE in presence
                    this.connectionManager.updatePresenceStatus(userId, "AVAILABLE");

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (rawState) {
                        const state = JSON.parse(rawState);
                        const player = state.players?.find((p: any) => p.userId === userId || p.username === username);
                        if (player) {
                            player.status = "LEFT";
                            player.forfeited = true;
                            if (data.timeRemaining !== undefined && !isNaN(Number(data.timeRemaining))) {
                                player.persistedTimeRemaining = Math.max(0, Math.floor(Number(data.timeRemaining)));
                            }
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

                        const isHostedRoom = Boolean(state.hostId);
                        if (activePlayers.length <= 1 && !isHostedRoom) {
                            const winner = activePlayers[0];
                            if (winner?.userId) {
                                this.connectionManager.updatePresenceStatus(winner.userId, "AVAILABLE");
                            }

                            // Mark the leaving player as forfeited in battle state
                            const forfeitedPlayerObj = state.players?.find((p: any) => p.userId === userId);
                            if (forfeitedPlayerObj) {
                                forfeitedPlayerObj.forfeited = true;
                                forfeitedPlayerObj.status = "FORFEITED";
                            }

                            state.status = "FINISHED";
                            await this.battleService.finishBattle(roomId, "OPPONENT_FORFEIT", winner?.userId, userId);

                            this.connectionManager.broadcastToRoom(roomId, "battle_over", {
                                roomId,
                                winner: winner?.username || "Opponent",
                                winnerId: winner?.userId,
                                winnerUsername: winner?.username || "Opponent",
                                reason: "OPPONENT_FORFEIT",
                                forfeitedPlayer: username,
                                forfeitedUserId: userId,
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

                    // Broadcast room and presence update to all clients
                    this.connectionManager.broadcastToAll("room_updated", {
                        roomCode: roomId,
                        roomId,
                        action: "player_left_battle",
                        userId,
                    });

                    this.connectionManager.leaveRoom(roomId, socket);
                    if (session) delete session.roomId;
                    break;
                }

                case "kick_player": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const { roomId, targetUserId, reason } = data;
                    if (!activeUserId || !roomId || !targetUserId) break;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (!rawState) break;
                    const state = JSON.parse(rawState);

                    if (state.hostId && state.hostId !== activeUserId) {
                        this.send(socket, "error", "Unauthorized: only the battle host can remove participants.");
                        break;
                    }

                    const player = state.players?.find((p: any) => p.userId === targetUserId);
                    if (player) {
                        player.status = "KICKED";
                        await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 1800);

                        this.connectionManager.broadcastToRoom(roomId, "player_kicked", {
                            roomId,
                            targetUserId,
                            username: player.username,
                            hostUsername: session?.username || "Host",
                            reason: reason || "Participant removed by host.",
                        });

                        const targetSocket = this.connectionManager.userSockets.get(targetUserId);
                        if (targetSocket) {
                            this.send(targetSocket, "kicked_from_battle", {
                                roomId,
                                reason: reason || "You were removed from this battle by the host.",
                            });
                        }
                    }
                    break;
                }

                case "readmit_player": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value;
                    const { roomId, targetUserId } = data;
                    if (!activeUserId || !roomId || !targetUserId) break;

                    const rawState = await this.redis.get(`battle_state:${roomId}`);
                    if (!rawState) break;
                    const state = JSON.parse(rawState);

                    if (state.hostId && state.hostId !== activeUserId) {
                        this.send(socket, "error", "Unauthorized: only the battle host can readmit participants.");
                        break;
                    }

                    const player = state.players?.find((p: any) => p.userId === targetUserId);
                    if (player) {
                        player.disqualified = false;
                        const violationKey = `${roomId}:${targetUserId}`;
                        this.violations.delete(violationKey);

                        // Retrieve persisted timer (e.g. 181 seconds / 3.01 mins)
                        const savedTimerRaw = await this.redis.get(`battle_timer_persisted:${roomId}:${targetUserId}`)
                            || await this.redis.get(`battle_timer_persisted:${state.roomCode || roomId}:${targetUserId}`);
                        const persistedTime = savedTimerRaw ? parseInt(savedTimerRaw, 10) : player.persistedTimeRemaining;

                        player.status = "ACTIVE";
                        player.forfeited = false;
                        if (persistedTime && persistedTime > 0) {
                            player.persistedTimeRemaining = persistedTime;
                        }

                        await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 7200);

                        // Cancel any pending disconnect forfeit timeout for this user
                        const pendingTimeout = this.disconnectTimeouts.get(targetUserId);
                        if (pendingTimeout) {
                            clearTimeout(pendingTimeout);
                            this.disconnectTimeouts.delete(targetUserId);
                        }

                        this.connectionManager.broadcastToRoom(roomId, "player_readmitted", {
                            roomId,
                            targetUserId,
                            username: player.username,
                            persistedTimeRemaining: persistedTime,
                        });

                        this.connectionManager.broadcastToRoom(roomId, "battle_state_sync", state);

                        const targetSocket = this.connectionManager.userSockets.get(targetUserId);
                        if (targetSocket) {
                            this.send(targetSocket, "readmitted_to_battle", {
                                roomId,
                                persistedTimeRemaining: persistedTime,
                                problems: state.problems,
                            });
                        }
                    }
                    break;
                }

                case "sync_timer_remaining": {
                    const session = this.socketUsers.get(socket);
                    const activeUserId = session?.userId || currentUserId.value || data?.userId;
                    const { roomId, timeRemaining } = data;
                    if (roomId && activeUserId && typeof timeRemaining === "number") {
                        await this.redis.set(`battle_timer_persisted:${roomId}:${activeUserId}`, String(timeRemaining), "EX", 7200);
                        const rawState = await this.redis.get(`battle_state:${roomId}`);
                        if (rawState) {
                            const state = JSON.parse(rawState);
                            const player = state.players?.find((p: any) => p.userId === activeUserId);
                            if (player) {
                                player.persistedTimeRemaining = timeRemaining;
                                await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 7200);
                            }
                        }
                    }
                    break;
                }

                case "checkpoint_sync": {
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    const { roomId, problemId, code, language, revision, checkpoints } = data;
                    if (userId && roomId) {
                        const incoming: Record<string, any> = {};
                        if (checkpoints && typeof checkpoints === "object") {
                            for (const [pId, item] of Object.entries(checkpoints)) {
                                if (item && typeof item === "object") {
                                    incoming[pId] = {
                                        problemId: (item as any).problemId || pId,
                                        code: (item as any).code || "",
                                        language: (item as any).language || "javascript",
                                        revision: (item as any).revision || 1,
                                        updatedAt: (item as any).updatedAt || Date.now(),
                                    };
                                }
                            }
                        } else if (problemId !== undefined) {
                            incoming[problemId] = {
                                problemId,
                                code: code || "",
                                language: language || "javascript",
                                revision: revision || 1,
                                updatedAt: Date.now(),
                            };
                        }

                        if (Object.keys(incoming).length > 0) {
                            const redisKey = `battle_checkpoints:${roomId}:${userId}`;
                            // Atomic Lua script merge comparing revisions
                            const luaScript = `
                                local key = KEYS[1]
                                local incomingJson = ARGV[1]
                                local ttl = tonumber(ARGV[2]) or 7200
                                local incoming = cjson.decode(incomingJson)
                                local currentRaw = redis.call('GET', key)
                                local current = {}
                                if currentRaw then
                                    local status, parsed = pcall(cjson.decode, currentRaw)
                                    if status and type(parsed) == "table" then
                                        current = parsed
                                    end
                                end
                                for probId, item in pairs(incoming) do
                                    local existing = current[probId]
                                    if not existing then
                                        current[probId] = item
                                    else
                                        local exRev = tonumber(existing.revision) or 0
                                        local inRev = tonumber(item.revision) or 0
                                        if inRev > exRev then
                                            current[probId] = item
                                        elseif inRev == exRev then
                                            local exUpdated = tonumber(existing.updatedAt) or 0
                                            local inUpdated = tonumber(item.updatedAt) or 0
                                            if inUpdated >= exUpdated then
                                                current[probId] = item
                                            end
                                        end
                                    end
                                end
                                local serialized = cjson.encode(current)
                                redis.call('SET', key, serialized, 'EX', ttl)
                                return serialized
                            `;

                            try {
                                await this.redis.eval(luaScript, 1, redisKey, JSON.stringify(incoming), 7200);
                            } catch (evalErr) {
                                // Fallback safe merge
                                const currentRaw = await this.redis.get(redisKey);
                                const current = currentRaw ? JSON.parse(currentRaw) : {};
                                for (const [pId, item] of Object.entries(incoming)) {
                                    const ex = current[pId];
                                    if (!ex || (item.revision || 0) >= (ex.revision || 0)) {
                                        current[pId] = item;
                                    }
                                }
                                await this.redis.set(redisKey, JSON.stringify(current), "EX", 7200);
                            }

                            // Also persist single keys for backward compatibility
                            for (const [pId, item] of Object.entries(incoming)) {
                                await this.redis.set(`battle_checkpoint:${roomId}:${userId}:${pId}`, JSON.stringify({
                                    userId,
                                    roomId,
                                    problemId: pId,
                                    code: item.code,
                                    language: item.language,
                                    revision: item.revision,
                                    updatedAt: item.updatedAt
                                }), "EX", 7200).catch(() => {});
                            }

                            this.send(socket, "checkpoint_ack", {
                                roomId,
                                problemId: problemId || Object.keys(incoming)[0],
                                revision: revision || 1,
                                timestamp: Date.now(),
                            });
                        }
                    }
                    break;
                }

                case "get_checkpoints": {
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    const { roomId } = data;
                    if (userId && roomId) {
                        try {
                            const raw = await this.redis.get(`battle_checkpoints:${roomId}:${userId}`);
                            const myCheckpoints = raw ? JSON.parse(raw) : {};
                            this.send(socket, "checkpoints_restored", {
                                roomId,
                                checkpoints: myCheckpoints
                            });
                        } catch (err) {
                            logger.warn({ err, roomId, userId }, "Failed to get checkpoints on demand");
                        }
                    }
                    break;
                }


                case "check_active_battle": {
                    const session = this.socketUsers.get(socket);
                    const userId = session?.userId || currentUserId.value;
                    if (userId) {
                        const activity = await userSessionStore.getActiveActivity(userId);
                        if (activity && activity.status === "ACTIVE") {
                            this.send(socket, "active_battle_found", activity);
                        } else {
                            this.send(socket, "no_active_battle", {});
                        }
                    }
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
        let p1Rating = match.player1Rating ?? 0;
        if (!p1Name) {
            const p1User = await this.userRepo.getUserById(match.player1Id);
            p1Name = p1User?.username || "Player 1";
            p1Rating = p1User?.rating ?? 0;
        }

        let p2Name = match.player2Username;
        let p2Rating = match.player2Rating ?? 0;
        if (!p2Name) {
            const p2User = await this.userRepo.getUserById(match.player2Id);
            p2Name = p2User?.username || "Player 2";
            p2Rating = p2User?.rating ?? 0;
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

                    // Freeze and persist this player's remaining time upon disconnection
                    const rawTimer = await this.redis.get(`battle_timer_persisted:${session.roomId}:${session.userId}`);
                    let persistedTime = rawTimer ? parseInt(rawTimer, 10) : undefined;
                    if (!persistedTime && state.startTime && state.timeLimitSeconds) {
                        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
                        persistedTime = Math.max(0, state.timeLimitSeconds - elapsed);
                    }
                    const disconnectedPlayer = state.players?.find((p: any) => p.userId === session.userId);
                    if (disconnectedPlayer && persistedTime !== undefined) {
                        disconnectedPlayer.persistedTimeRemaining = persistedTime;
                        disconnectedPlayer.disconnectedAt = Date.now();
                        await this.redis.set(`battle_timer_persisted:${session.roomId}:${session.userId}`, String(persistedTime), "EX", 7200);
                        await this.redis.set(`battle_state:${session.roomId}`, JSON.stringify(state), "EX", 7200);
                    }

                    this.connectionManager.broadcastToRoom(session.roomId, "opponent_disconnected", {
                        userId: session.userId,
                        username: session.username,
                        message: `${session.username} has disconnected from the battle.`,
                        reconnectDeadline: Date.now() + 60000,
                        persistedTimeRemaining: persistedTime,
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
                                    if (winner?.userId) {
                                        this.connectionManager.updatePresenceStatus(winner.userId, "AVAILABLE");
                                    }
                                    this.connectionManager.updatePresenceStatus(session.userId!, "AVAILABLE");

                                    await this.battleService.finishBattle(session.roomId!, "OPPONENT_FORFEIT", winner?.userId, session.userId);
                                    this.connectionManager.broadcastToRoom(session.roomId!, "battle_over", {
                                        roomId: session.roomId,
                                        winner: winner?.username || "Opponent",
                                        winnerId: winner?.userId,
                                        winnerUsername: winner?.username || "Opponent",
                                        reason: "OPPONENT_FORFEIT",
                                        forfeitedPlayer: session.username,
                                        forfeitedUserId: session.userId,
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
                const roomId = session.roomId;
                const userId = session.userId;
                const username = session.username;

                // If user is still connected via another active socket, do not trigger lobby departure
                const isStillConnected = userId && this.connectionManager.isUserConnected(userId);

                if (!isStillConnected && roomId && userId) {
                    const lobbyTimeoutKey = `lobby:${roomId}:${userId}`;
                    if (!this.disconnectTimeouts.has(lobbyTimeoutKey)) {
                        const timeout = setTimeout(async () => {
                            this.disconnectTimeouts.delete(lobbyTimeoutKey);
                            try {
                                const room = await this.battleRoomRepo.getRoomByCode(roomId)
                                    || await this.battleRoomRepo.getRoomById(roomId);
                                if (room && room.status === "WAITING") {
                                    const leaveResult = await this.battleRoomService.leaveRoom(room.id, userId);
                                    this.connectionManager.broadcastToRoom(roomId, "player_left", {
                                        userId,
                                        username,
                                        newHostId: leaveResult?.newHostId,
                                    });
                                    this.connectionManager.broadcastToRoom(roomId, "room_updated", {
                                        roomCode: room.roomCode,
                                        action: "player_left",
                                        userId,
                                        newHostId: leaveResult?.newHostId,
                                    });
                                }
                            } catch {
                                // Non-fatal cleanup error
                            }
                        }, 15000); // 15-second grace period for lobby reconnection/refresh

                        this.disconnectTimeouts.set(lobbyTimeoutKey, timeout);
                    }
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
            socket.send(JSON.stringify({ event, payload }));
        }
    }
}
