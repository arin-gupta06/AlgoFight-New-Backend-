import { BattleRoomService, RatingService } from "@algofight/application";
import {
    PrismaBattleRoomRepository,
    PrismaProblemRepository,
    PrismaUserRepository,
} from "@algofight/database";
import { createRedisClient } from "@algofight/queue";

export class BattleController {
    private readonly battleRoomService: BattleRoomService;
    private readonly ratingService: RatingService;
    private readonly userRepository: PrismaUserRepository;
    private readonly redis = createRedisClient();

    constructor() {
        const battleRoomRepository = new PrismaBattleRoomRepository();
        const problemRepository = new PrismaProblemRepository();
        const userRepository = new PrismaUserRepository();

        this.userRepository = userRepository;
        this.ratingService = new RatingService(userRepository);
        this.battleRoomService = new BattleRoomService(
            battleRoomRepository,
            problemRepository,
            this.ratingService
        );
    }

    private async resolveUserId(identifier: string, authUser?: { id: string; email?: string; username?: string }): Promise<string> {
        let user = await this.userRepository.getUserById(identifier);
        if (!user && authUser && (authUser.id === identifier || authUser.email === identifier)) {
            const safeEmail = authUser.email || `${authUser.id.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${Date.now()}@algofight.local`;
            const safeUsername = authUser.username || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
            user = await this.userRepository.upsertUser({
                id: authUser.id,
                email: safeEmail,
                username: safeUsername,
            });
        }
        if (!user) {
            const clean = identifier.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
            const safeEmail = `${clean}_${Date.now()}@algofight.local`;
            user = await this.userRepository.upsertUser({
                id: identifier,
                email: safeEmail,
                username: `Player_${Math.floor(1000 + Math.random() * 9000)}`,
            });
        }
        return user.id;
    }

    private async resolveUser(authUser: { id: string; email?: string; username?: string }): Promise<string> {
        let user = await this.userRepository.getUserById(authUser.id);
        if (!user) {
            const safeEmail = authUser.email || `${authUser.id.toLowerCase().replace(/[^a-z0-9_]/g, "")}_${Date.now()}@algofight.local`;
            const safeUsername = authUser.username || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
            user = await this.userRepository.upsertUser({
                id: authUser.id,
                email: safeEmail,
                username: safeUsername,
            });
        }
        return user.id;
    }

    async createRoom(
        authUser: { id: string; email?: string; username?: string },
        maxPlayers = 2,
        timeLimitMinutes = 15,
        difficulty = "MIX",
        questionCount = 3,
        isFriendly?: boolean,
        problemIds?: string[],
        isPublic = true,
        battleMode: "DUEL_1V1" | "SQUAD_BATTLE" | "PRACTICE_SOLO" = "DUEL_1V1",
        squadSize = 2,
        hostRole: "PARTICIPANT" | "VIEWER" = "PARTICIPANT"
    ) {
        const resolvedHostId = await this.resolveUser(authUser);
        const hostUser = await this.userRepository.getUserById(resolvedHostId);
        const room = await this.battleRoomService.createRoom({
            hostId: resolvedHostId,
            maxPlayers,
            timeLimitMinutes,
            difficulty,
            questionCount,
            isFriendly,
            problemIds,
            battleMode,
            squadSize,
            hostRole,
        });

        try {
            await this.redis.set(`room_host_role:${room.id}`, hostRole, "EX", 86400);
            await this.redis.set(`room_host_role:${room.roomCode}`, hostRole, "EX", 86400);
        } catch (_) {}

        (room as any).hostRole = hostRole;

        if (isPublic) {
            const publicMeta = {
                roomId: room.id,
                roomCode: room.roomCode,
                hostId: resolvedHostId,
                hostUsername: hostUser?.username || authUser.username || "Arena Host",
                hostRating: hostUser?.rating ?? 1200,
                difficulty: room.difficulty,
                questionCount: room.questionCount,
                timeLimitMinutes: room.timeLimitMinutes,
                maxPlayers: room.maxPlayers,
                currentPlayers: hostRole === "VIEWER" ? 0 : 1,
                isFriendly: room.isFriendly ?? false,
                createdAt: room.createdAt ? new Date(room.createdAt).toISOString() : new Date().toISOString(),
                isPublic: true,
                hostRole,
            };

            try {
                await this.redis.hset("public_battle_rooms", room.roomCode, JSON.stringify(publicMeta));
                await this.redis.expire("public_battle_rooms", 1800);
                await this.redis.publish("battle-events", JSON.stringify({
                    event: "PUBLIC_CHALLENGE_CREATED",
                    challenge: publicMeta,
                }));
            } catch (redisErr) {
                // Non-fatal if redis fails to publish
            }
        }

        return room;
    }

    async getPublicRooms() {
        const now = Date.now();
        const maxWaitingAgeMs = 25 * 60 * 1000; // 25 minutes max for waiting lobby
        const activeRooms: any[] = [];
        const seenCodes = new Set<string>();

        // 1. Process Redis public waiting rooms with strict expiration & status cleanup
        try {
            const raw = await this.redis.hgetall("public_battle_rooms");
            if (raw && Object.keys(raw).length > 0) {
                for (const [code, valStr] of Object.entries(raw)) {
                    try {
                        const parsed = JSON.parse(valStr);
                        const createdAtMs = new Date(parsed.createdAt).getTime();

                        // Clean up expired rooms (> 25 mins) or full rooms from Redis
                        if (now - createdAtMs > maxWaitingAgeMs || (parsed.currentPlayers && parsed.maxPlayers && parsed.currentPlayers >= parsed.maxPlayers)) {
                            await this.redis.hdel("public_battle_rooms", code);
                            continue;
                        }

                        parsed.status = parsed.status || "WAITING";
                        activeRooms.push(parsed);
                        seenCodes.add(code);
                    } catch {
                        await this.redis.hdel("public_battle_rooms", code);
                    }
                }
            }
        } catch {
            // Redis error fallback
        }

        // 2. Query fresh database WAITING rooms (not expired, not cancelled, not finished)
        try {
            const dbRooms = await this.battleRoomService.getOpenWaitingRooms(10);
            for (const r of dbRooms) {
                if (seenCodes.has(r.roomCode)) continue;
                if (!r.participants || r.participants.length === 0) continue;
                if (r.participants.length >= r.maxPlayers) continue;
                if (r.status !== "WAITING" && r.status !== "READY") continue;

                const createdAtMs = new Date(r.createdAt).getTime();
                if (now - createdAtMs > maxWaitingAgeMs) continue; // Exclude expired

                activeRooms.push({
                    roomId: r.id,
                    roomCode: r.roomCode,
                    hostId: r.hostId,
                    hostUsername: r.host?.username || "Arena Host",
                    hostRating: r.host?.rating ?? 1200,
                    difficulty: r.difficulty,
                    questionCount: r.questionCount,
                    timeLimitMinutes: r.timeLimitMinutes,
                    maxPlayers: r.maxPlayers,
                    currentPlayers: r.participants.length,
                    isFriendly: r.isFriendly,
                    status: "WAITING",
                    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
                    isPublic: true,
                });
                seenCodes.add(r.roomCode);
            }
        } catch {}

        // 3. Query active RUNNING battles (live matches currently in progress within time limit)
        try {
            const runningRooms = await this.battleRoomService.getActiveRunningRooms(5);
            for (const r of runningRooms) {
                if (seenCodes.has(r.roomCode)) continue;
                if (r.status !== "RUNNING" || !r.startedAt) continue;

                const players = (r.participants || []).map((p: any) => p.user?.username || p.username || "Coder");
                activeRooms.push({
                    roomId: r.id,
                    roomCode: r.roomCode,
                    hostId: r.hostId,
                    hostUsername: r.host?.username || players[0] || "Arena Host",
                    player1: players[0] || r.host?.username || "Player 1",
                    player2: players[1] || "Opponent",
                    difficulty: r.difficulty,
                    questionCount: r.questionCount,
                    timeLimitMinutes: r.timeLimitMinutes,
                    maxPlayers: r.maxPlayers,
                    currentPlayers: r.participants.length,
                    isFriendly: r.isFriendly,
                    status: "RUNNING",
                    startedAt: new Date(r.startedAt).toISOString(),
                    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
                    isPublic: true,
                });
                seenCodes.add(r.roomCode);
            }
        } catch {}

        return activeRooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getRoom(idOrCode: string, currentUserId?: string) {
        const room: any = await this.battleRoomService.getRoom(idOrCode);
        if (room) {
            try {
                const hostRole = (await this.redis.get(`room_host_role:${room.id}`))
                    || (await this.redis.get(`room_host_role:${room.roomCode}`));
                if (hostRole) {
                    room.hostRole = hostRole;
                }
            } catch (_) {}

            if (currentUserId) {
                try {
                    const saved = await this.redis.get(`battle_timer_persisted:${room.id}:${currentUserId}`)
                        || await this.redis.get(`battle_timer_persisted:${room.roomCode}:${currentUserId}`);
                    if (saved) {
                        room.persistedTimeRemaining = parseInt(saved, 10);
                    }
                } catch (_) {}
            }
        }
        return room;
    }

    async toggleHostRole(roomIdOrCode: string, userId: string, targetRole?: "PARTICIPANT" | "VIEWER") {
        const room: any = await this.battleRoomService.getRoom(roomIdOrCode);
        const resolvedId = await this.resolveUser({ id: userId });
        if (room.hostId !== resolvedId && room.host?.id !== resolvedId) {
            throw new Error("Only the room host can switch host role.");
        }

        const currentRole = (await this.redis.get(`room_host_role:${room.id}`)) || room.hostRole || "PARTICIPANT";
        const newRole = targetRole || (currentRole === "VIEWER" ? "PARTICIPANT" : "VIEWER");

        if (newRole === "VIEWER") {
            // Remove host from participants if present
            await prisma.battleParticipant.deleteMany({
                where: { roomId: room.id, userId: resolvedId },
            }).catch(() => {});
        } else {
            // Add host to participants
            const exists = await prisma.battleParticipant.findUnique({
                where: { roomId_userId: { roomId: room.id, userId: resolvedId } },
            });
            if (!exists) {
                await prisma.battleParticipant.create({
                    data: {
                        roomId: room.id,
                        userId: resolvedId,
                        isReady: true,
                    },
                }).catch(() => {});
            }
        }

        await this.redis.set(`room_host_role:${room.id}`, newRole, "EX", 86400);
        await this.redis.set(`room_host_role:${room.roomCode}`, newRole, "EX", 86400);

        try {
            await this.redis.publish("battle-events", JSON.stringify({
                event: "HOST_ROLE_UPDATED",
                roomId: room.id,
                roomCode: room.roomCode,
                hostRole: newRole,
            }));
        } catch (_) {}

        return { success: true, hostRole: newRole };
    }

    async persistPlayerTime(idOrCode: string, userId: string, timeRemaining: number) {
        if (!idOrCode || !userId || typeof timeRemaining !== "number") {
            return { success: false, message: "Invalid parameters" };
        }
        try {
            const room = await this.battleRoomService.getRoom(idOrCode).catch(() => null);
            const roomId = room?.id || idOrCode;
            const roomCode = room?.roomCode || idOrCode;
            await this.redis.set(`battle_timer_persisted:${roomId}:${userId}`, String(timeRemaining), "EX", 7200);
            await this.redis.set(`battle_timer_persisted:${roomCode}:${userId}`, String(timeRemaining), "EX", 7200);

            const rawState = await this.redis.get(`battle_state:${roomId}`);
            if (rawState) {
                const state = JSON.parse(rawState);
                const player = state.players?.find((p: any) => p.userId === userId);
                if (player) {
                    player.persistedTimeRemaining = timeRemaining;
                    await this.redis.set(`battle_state:${roomId}`, JSON.stringify(state), "EX", 7200);
                }
            }
            return { success: true, persistedTimeRemaining: timeRemaining };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    async joinRoom(idOrCode: string, userId: string, authUser?: { id: string; email?: string; username?: string }) {
        const resolvedUserId = await this.resolveUserId(userId, authUser);

        // Check if user was kicked from this room by the host
        try {
            const roomBefore = await this.battleRoomService.getRoom(idOrCode).catch(() => null);
            const rId = roomBefore?.id || idOrCode;
            const rCode = roomBefore?.roomCode || idOrCode;

            const isKicked = (await this.redis.sismember(`room_kicked_players:${rId}`, resolvedUserId)) === 1 ||
                             (await this.redis.sismember(`room_kicked_players:${rCode}`, resolvedUserId)) === 1;

            if (isKicked) {
                const error: any = new Error("You were removed from this lobby by the host. Re-entry requires host approval.");
                error.statusCode = 403;
                error.requiresApproval = true;
                throw error;
            }
        } catch (err: any) {
            if (err?.requiresApproval || err?.statusCode === 403) {
                throw err;
            }
        }

        const room = await this.battleRoomService.joinRoom(idOrCode, resolvedUserId);
        
        try {
            if (room.participants.length >= room.maxPlayers) {
                await this.redis.hdel("public_battle_rooms", room.roomCode);
                await this.redis.publish("battle-events", JSON.stringify({
                    event: "PUBLIC_CHALLENGE_REMOVED",
                    roomCode: room.roomCode,
                }));
            } else {
                const existing = await this.redis.hget("public_battle_rooms", room.roomCode);
                if (existing) {
                    const parsed = JSON.parse(existing);
                    parsed.currentPlayers = room.participants.length;
                    await this.redis.hset("public_battle_rooms", room.roomCode, JSON.stringify(parsed));
                }
            }
        } catch {}

        return room;
    }

    async leaveRoom(roomId: string, userId: string) {
        const resolvedUserId = await this.resolveUserId(userId);
        const result = await this.battleRoomService.leaveRoom(roomId, resolvedUserId);
        if (result.remainingCount === 0) {
            try {
                const room = await this.battleRoomService.getRoom(roomId).catch(() => null);
                const code = room?.roomCode || roomId;
                await this.redis.hdel("public_battle_rooms", code);
                await this.redis.publish("battle-events", JSON.stringify({
                    event: "PUBLIC_CHALLENGE_REMOVED",
                    roomCode: code,
                }));
            } catch {}
        } else if (result.wasHost && result.newHostId) {
            try {
                const room = await this.battleRoomService.getRoom(roomId).catch(() => null);
                const code = room?.roomCode || roomId;
                const newHostUser = await this.userRepository.getUserById(result.newHostId);
                const existing = await this.redis.hget("public_battle_rooms", code);
                if (existing) {
                    const parsed = JSON.parse(existing);
                    parsed.hostId = result.newHostId;
                    parsed.hostUsername = newHostUser?.username || "Arena Host";
                    parsed.hostRating = newHostUser?.rating ?? 1200;
                    parsed.currentPlayers = result.remainingCount;
                    await this.redis.hset("public_battle_rooms", code, JSON.stringify(parsed));
                }
            } catch {}
        }
        return result;
    }

    async kickPlayer(roomId: string, hostId: string, targetUserId: string) {
        const resolvedHostId = await this.resolveUserId(hostId);
        const resolvedTargetUserId = await this.resolveUserId(targetUserId);
        const res = await this.battleRoomService.kickPlayer(roomId, resolvedHostId, resolvedTargetUserId);
        try {
            const room = await this.battleRoomService.getRoom(roomId).catch(() => null);
            const rId = room?.id || roomId;
            const rCode = room?.roomCode || roomId;
            await this.redis.sadd(`room_kicked_players:${rId}`, resolvedTargetUserId);
            await this.redis.sadd(`room_kicked_players:${rCode}`, resolvedTargetUserId);
            await this.redis.expire(`room_kicked_players:${rId}`, 86400);
            await this.redis.expire(`room_kicked_players:${rCode}`, 86400);
        } catch {}
        return res;
    }

    async setPlayerReady(roomId: string, userId: string, isReady: boolean) {
        const resolvedUserId = await this.resolveUserId(userId);
        return this.battleRoomService.setPlayerReady(roomId, resolvedUserId, isReady);
    }

    async startBattle(roomId: string, hostId: string, problemId?: string) {
        const resolvedHostId = await this.resolveUserId(hostId);
        const room = await this.battleRoomService.startBattle(roomId, resolvedHostId, problemId);
        try {
            await this.redis.hdel("public_battle_rooms", room.roomCode);
            await this.redis.publish("battle-events", JSON.stringify({
                event: "PUBLIC_CHALLENGE_REMOVED",
                roomCode: room.roomCode,
            }));
        } catch {}
        return room;
    }

    async finishBattle(roomId: string) {
        const result = await this.battleRoomService.finishBattle(roomId);
        try {
            if (result.room?.roomCode) {
                await this.redis.hdel("public_battle_rooms", result.room.roomCode);
                await this.redis.publish("battle-events", JSON.stringify({
                    event: "PUBLIC_CHALLENGE_REMOVED",
                    roomCode: result.room.roomCode,
                }));
            }
        } catch {}
        return result;
    }

    async joinSquadTeam(authUser: { id: string; email?: string; username?: string }, teamCode: string) {
        const resolvedUserId = await this.resolveUser(authUser);
        const result = await this.battleRoomService.joinSquadTeam(resolvedUserId, teamCode);

        try {
            await this.redis.publish("battle-events", JSON.stringify({
                event: "SQUAD_ROSTER_UPDATED",
                roomId: result.room.id,
                roomCode: result.room.roomCode,
                action: "MEMBER_JOINED",
                teamSide: result.team.teamSide,
                userId: resolvedUserId,
                participantCode: result.participantCode,
            }));
        } catch {}

        return result;
    }

    async setSquadApproval(authUser: { id: string; email?: string; username?: string }, roomIdOrCode: string, isApproved: boolean) {
        const resolvedUserId = await this.resolveUser(authUser);
        const result = await this.battleRoomService.setSquadCaptainApproval(roomIdOrCode, resolvedUserId, isApproved);

        try {
            await this.redis.publish("battle-events", JSON.stringify({
                event: "SQUAD_APPROVAL_UPDATED",
                roomIdOrCode,
                captainUserId: resolvedUserId,
                isApproved,
                alphaApproved: result.alphaApproved,
                betaApproved: result.betaApproved,
                canStart: result.canStart,
                rosterVersion: result.rosterVersion,
            }));
        } catch {}

        return result;
    }

    async kickSquadMember(authUser: { id: string; email?: string; username?: string }, roomIdOrCode: string, targetUserId: string) {
        const resolvedCaptainId = await this.resolveUser(authUser);
        const resolvedTargetId = await this.resolveUserId(targetUserId);
        const result = await this.battleRoomService.kickSquadMember(roomIdOrCode, resolvedCaptainId, resolvedTargetId);

        try {
            await this.redis.publish("battle-events", JSON.stringify({
                event: "SQUAD_ROSTER_UPDATED",
                roomIdOrCode,
                action: "MEMBER_KICKED",
                captainUserId: resolvedCaptainId,
                targetUserId: resolvedTargetId,
                teamSide: result.teamSide,
            }));
        } catch {}

        return result;
    }
}
