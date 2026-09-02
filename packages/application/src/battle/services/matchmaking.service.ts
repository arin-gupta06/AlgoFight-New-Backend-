import { UserRepository, ProblemRepository } from "@algofight/database";
import { BattleRoomService } from "./battle-room.service";
import Redis from "ioredis";

export interface MatchmakingTicket {
    userId: string;
    username?: string;
    rating: number;
    queuedAt: number;
    range: number;
}

export interface MatchResult {
    roomId: string;
    roomCode: string;
    player1Id: string;
    player1Username: string;
    player1Rating: number;
    player2Id: string;
    player2Username: string;
    player2Rating: number;
    problemId?: string;
}

export class MatchmakingService {
    private readonly localFallbackQueue: Map<string, MatchmakingTicket> = new Map();
    private redisClient?: Redis;
    private isRedisReady: boolean = false;

    public readonly REDIS_QUEUE_KEY = "matchmaking:pool";
    public readonly REDIS_TICKETS_KEY = "matchmaking:tickets";
    public readonly REDIS_PUB_CHANNEL = "matchmaking:matched";

    private readonly LUA_CLAIM_MATCH = `
        local claimed = redis.call('ZREM', KEYS[1], ARGV[1])
        if claimed == 1 then
            redis.call('HDEL', KEYS[2], ARGV[1])
            redis.call('ZREM', KEYS[1], ARGV[2])
            redis.call('HDEL', KEYS[2], ARGV[2])
            return 1
        else
            return 0
        end
    `;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly battleRoomService: BattleRoomService,
        private readonly problemRepository?: ProblemRepository,
        redisClient?: Redis,
    ) {
        if (redisClient) {
            this.redisClient = redisClient;
            this.isRedisReady = redisClient.status === "ready" || redisClient.status === "connect";
            redisClient.on("ready", () => { this.isRedisReady = true; });
            redisClient.on("error", () => { /* fallback gracefully */ });
        } else {
            const rawUrl =
                process.env.REDIS_URL ||
                process.env.REDIS_PRIVATE_URL ||
                (process.env.REDIS_HOST?.startsWith("redis://") ||
                process.env.REDIS_HOST?.startsWith("valkey://") ||
                process.env.REDIS_HOST?.startsWith("rediss://")
                    ? process.env.REDIS_HOST
                    : null);

            const isTls = rawUrl ? rawUrl.startsWith("rediss://") : process.env.REDIS_TLS === "true";

            try {
                this.redisClient = rawUrl
                    ? new Redis(rawUrl, {
                          lazyConnect: true,
                          enableOfflineQueue: false,
                          tls: isTls ? { rejectUnauthorized: false } : undefined,
                          maxRetriesPerRequest: 1,
                      })
                    : new Redis({
                          host: process.env.REDIS_HOST || "localhost",
                          port: Number(process.env.REDIS_PORT) || 6379,
                          password: process.env.REDIS_PASSWORD || undefined,
                          tls: isTls ? { rejectUnauthorized: false } : undefined,
                          lazyConnect: true,
                          enableOfflineQueue: false,
                          maxRetriesPerRequest: 1,
                      });

                this.redisClient.connect()
                    .then(() => { this.isRedisReady = true; })
                    .catch(() => { this.isRedisReady = false; });
                this.redisClient.on("ready", () => { this.isRedisReady = true; });
                this.redisClient.on("error", () => { this.isRedisReady = false; });
            } catch {
                this.isRedisReady = false;
            }
        }
    }

    /**
     * Enters a combatant into the distributed matchmaking pool.
     * If a compatible opponent is found, creates the 1v1 battle room and returns MatchResult.
     */
    async joinQueue(userId: string, customUsername?: string): Promise<MatchResult | null> {
        let user = await this.userRepository.getUserById(userId);
        if (!user) {
            user = await this.userRepository.upsertUser({
                id: userId,
                username: customUsername || `Player_${Math.floor(1000 + Math.random() * 9000)}`,
                email: `${userId}@algofight.local`,
            });
        }

        const username = customUsername || user.username || "Combatant";
        const rating = user.rating ?? 0;

        const newTicket: MatchmakingTicket = {
            userId,
            username,
            rating,
            queuedAt: Date.now(),
            range: 50,
        };

        // 1. If Redis is available, execute distributed matching
        if (this.isRedisReady && this.redisClient) {
            try {
                // Ensure player is not already lingering in queue
                await this.redisClient.zrem(this.REDIS_QUEUE_KEY, userId);
                await this.redisClient.hdel(this.REDIS_TICKETS_KEY, userId);

                const match = await this.tryMatchRedis(newTicket);
                if (match) {
                    return match;
                }

                // No immediate match found -> persist ticket to distributed Redis pool
                await this.redisClient.hset(this.REDIS_TICKETS_KEY, userId, JSON.stringify(newTicket));
                await this.redisClient.zadd(this.REDIS_QUEUE_KEY, rating, userId);
                return null;
            } catch (err) {
                // Fall back to in-memory on Redis transient error
            }
        }

        // 2. Local in-memory fallback
        this.localFallbackQueue.delete(userId);
        const localMatch = await this.tryMatchLocal(newTicket);
        if (localMatch) {
            return localMatch;
        }
        this.localFallbackQueue.set(userId, newTicket);
        return null;
    }

    /**
     * Cancels an active matchmaking ticket.
     */
    async cancelQueue(userId: string): Promise<boolean> {
        let removed = false;
        if (this.isRedisReady && this.redisClient) {
            try {
                const zrem = await this.redisClient.zrem(this.REDIS_QUEUE_KEY, userId);
                await this.redisClient.hdel(this.REDIS_TICKETS_KEY, userId);
                if (zrem > 0) removed = true;
            } catch {
                // ignore
            }
        }
        if (this.localFallbackQueue.delete(userId)) {
            removed = true;
        }
        return removed;
    }

    /**
     * Checks if a player is actively waiting in queue.
     */
    async isQueued(userId: string): Promise<boolean> {
        if (this.isRedisReady && this.redisClient) {
            try {
                const exists = await this.redisClient.hexists(this.REDIS_TICKETS_KEY, userId);
                if (exists === 1) return true;
            } catch {
                // fallback
            }
        }
        return this.localFallbackQueue.has(userId);
    }

    /**
     * Creates an instant match against AlgoBot without waiting.
     */
    async createBotMatch(userId: string, customUsername?: string): Promise<MatchResult> {
        await this.cancelQueue(userId);

        let user = await this.userRepository.getUserById(userId);
        if (!user) {
            user = await this.userRepository.upsertUser({
                id: userId,
                username: customUsername || `Player_${Math.floor(1000 + Math.random() * 9000)}`,
                email: `${userId}@algofight.local`,
            });
        }

        await this.userRepository.upsertUser({
            id: "bot",
            username: "AlgoBot",
            email: "bot@algofight.local",
            userType: "INDIVIDUAL",
        });

        const botRoom = await this.battleRoomService.createRoom({
            hostId: userId,
            maxPlayers: 2,
            timeLimitMinutes: 15,
            difficulty: "MIX",
            questionCount: 3,
        });

        await this.battleRoomService.joinRoom(botRoom.id, "bot");
        await this.battleRoomService.setPlayerReady(botRoom.id, userId, true);
        await this.battleRoomService.setPlayerReady(botRoom.id, "bot", true);

        return {
            roomId: botRoom.id,
            roomCode: botRoom.roomCode,
            player1Id: userId,
            player1Username: customUsername || user.username || "Combatant",
            player1Rating: user.rating ?? 0,
            player2Id: "bot",
            player2Username: "AlgoBot",
            player2Rating: 200,
        };
    }

    /**
     * Distributed Redis matching logic with atomic Lua pairing.
     */
    private async tryMatchRedis(newTicket: MatchmakingTicket): Promise<MatchResult | null> {
        if (!this.redisClient) return null;

        const now = Date.now();
        // Query candidate IDs within expanding search range in Redis
        const minRating = Math.max(0, newTicket.rating - 600);
        const maxRating = newTicket.rating + 600;

        const candidateIds = await this.redisClient.zrangebyscore(
            this.REDIS_QUEUE_KEY,
            minRating,
            maxRating
        );

        for (const candidateId of candidateIds) {
            if (candidateId === newTicket.userId) continue;

            const candidateRaw = await this.redisClient.hget(
                this.REDIS_TICKETS_KEY,
                candidateId
            );
            if (!candidateRaw) continue;

            const candidateTicket: MatchmakingTicket = JSON.parse(candidateRaw);
            const candidateWaitSeconds = (now - candidateTicket.queuedAt) / 1000;
            // Progressive rating window expansion (+50 ELO every 5 seconds)
            const candidateWindow = candidateTicket.range + Math.floor(candidateWaitSeconds / 5) * 50;
            const ratingDiff = Math.abs(newTicket.rating - candidateTicket.rating);

            if (ratingDiff <= candidateWindow) {
                // ATOMIC PAIRING LUA SCRIPT: Exclusively claim candidate from Redis
                const claimSuccess = await this.redisClient.eval(
                    this.LUA_CLAIM_MATCH,
                    2,
                    this.REDIS_QUEUE_KEY,
                    this.REDIS_TICKETS_KEY,
                    candidateId,
                    newTicket.userId
                );

                if (claimSuccess === 1) {
                    // Successfully and atomically acquired both players!
                    const room = await this.battleRoomService.createRoom({
                        hostId: candidateTicket.userId,
                        maxPlayers: 2,
                        timeLimitMinutes: 15,
                    });

                    await this.battleRoomService.joinRoom(room.id, newTicket.userId);
                    await this.battleRoomService.setPlayerReady(room.id, candidateTicket.userId, true);
                    await this.battleRoomService.setPlayerReady(room.id, newTicket.userId, true);

                    const matchResult: MatchResult = {
                        roomId: room.id,
                        roomCode: room.roomCode,
                        player1Id: candidateTicket.userId,
                        player1Username: candidateTicket.username || "Combatant 1",
                        player1Rating: candidateTicket.rating ?? 0,
                        player2Id: newTicket.userId,
                        player2Username: newTicket.username || "Combatant 2",
                        player2Rating: newTicket.rating ?? 0,
                    };

                    // Broadcast cross-instance match notification over Redis Pub/Sub
                    await this.redisClient.publish(
                        this.REDIS_PUB_CHANNEL,
                        JSON.stringify(matchResult)
                    );

                    return matchResult;
                }
            }
        }

        return null;
    }

    /**
     * Local in-memory matching algorithm for standalone / disconnected fallback.
     */
    private async tryMatchLocal(newTicket: MatchmakingTicket): Promise<MatchResult | null> {
        const now = Date.now();

        for (const [candidateId, candidateTicket] of this.localFallbackQueue.entries()) {
            if (candidateId === newTicket.userId) continue;

            const candidateWaitSeconds = (now - candidateTicket.queuedAt) / 1000;
            const candidateWindow = candidateTicket.range + Math.floor(candidateWaitSeconds / 5) * 50;
            const ratingDiff = Math.abs(newTicket.rating - candidateTicket.rating);

            if (ratingDiff <= candidateWindow) {
                this.localFallbackQueue.delete(candidateId);
                this.localFallbackQueue.delete(newTicket.userId);

                const room = await this.battleRoomService.createRoom({
                    hostId: candidateId,
                    maxPlayers: 2,
                    timeLimitMinutes: 15,
                });

                await this.battleRoomService.joinRoom(room.id, newTicket.userId);
                await this.battleRoomService.setPlayerReady(room.id, candidateId, true);
                await this.battleRoomService.setPlayerReady(room.id, newTicket.userId, true);

                return {
                    roomId: room.id,
                    roomCode: room.roomCode,
                    player1Id: candidateId,
                    player1Username: candidateTicket.username || "Combatant 1",
                    player1Rating: candidateTicket.rating ?? 0,
                    player2Id: newTicket.userId,
                    player2Username: newTicket.username || "Combatant 2",
                    player2Rating: newTicket.rating ?? 0,
                };
            }
        }

        return null;
    }
}
