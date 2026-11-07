import { prisma } from "../client/prisma";
import { BattleRoomRepository, CreateBattleRoomInput } from "../contracts/battle-room.repository";
import { BattleRoomEntity } from "../entities/battle-room.entity";

const battleRoomInclude = {
    host: {
        select: {
            id: true,
            username: true,
            rating: true,
            email: true,
        },
    },
    participants: {
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    rating: true,
                    email: true,
                },
            },
        },
    },
    teams: {
        include: {
            captain: {
                select: {
                    id: true,
                    username: true,
                    rating: true,
                    email: true,
                },
            },
            problemScores: true,
        },
    },
    problems: {
        include: {
            testCases: true,
        },
    },
};

export class PrismaBattleRoomRepository implements BattleRoomRepository {
    private mapToEntity(room: any): BattleRoomEntity {
        return {
            id: room.id,
            roomCode: room.roomCode,
            hostId: room.hostId,
            host: room.host ? {
                id: room.host.id,
                username: room.host.username,
                rating: room.host.rating ?? 0,
                email: room.host.email,
            } : undefined,
            battleMode: room.battleMode,
            squadSize: room.squadSize,
            rosterVersion: room.rosterVersion,
            maxPlayers: room.maxPlayers,
            status: room.status,
            difficulty: room.difficulty,
            questionCount: room.questionCount,
            problems: room.problems,
            timeLimitMinutes: room.timeLimitMinutes,
            isFriendly: room.isFriendly ?? false,
            startedAt: room.startedAt,
            endedAt: room.endedAt,
            createdAt: room.createdAt,
            teams: (room.teams || []).map((t: any) => ({
                id: t.id,
                teamSide: t.teamSide,
                captainUserId: t.captainUserId,
                score: t.score,
                isApproved: t.isApproved,
                approvedVersion: t.approvedVersion,
                approvedAt: t.approvedAt,
                captain: t.captain ? {
                    id: t.captain.id,
                    username: t.captain.username,
                    rating: t.captain.rating ?? 0,
                    email: t.captain.email,
                } : undefined,
                problemScores: t.problemScores,
            })),
            participants: (room.participants || []).map((p: any) => {
                const u = p.user;
                return {
                    userId: p.userId,
                    roomId: p.roomId,
                    teamId: p.teamId,
                    participantCode: p.participantCode,
                    joinedAt: p.joinedAt,
                    isReady: p.isReady,
                    score: p.score,
                    rank: p.rank,
                    solvedAt: p.solvedAt,
                    solvedProblemIds: p.solvedProblemIds,
                    user: u ? {
                        id: u.id,
                        username: u.username,
                        rating: u.rating ?? 0,
                        email: u.email,
                    } : undefined,
                    username: u?.username || p.username || undefined,
                    rating: u?.rating ?? p.rating ?? 0,
                };
            }),
        };
    }

    async createRoom(input: CreateBattleRoomInput): Promise<BattleRoomEntity> {
        const isSquad = input.battleMode === "SQUAD_BATTLE";
        const squadSize = input.squadSize || 2;
        const maxPlayers = isSquad ? squadSize * 2 : (input.maxPlayers ?? 2);

        const room = await prisma.$transaction(async (tx: any) => {
            const created = await tx.battleRoom.create({
                data: {
                    roomCode: input.roomCode,
                    hostId: input.hostId,
                    battleMode: input.battleMode || "DUEL_1V1",
                    squadSize: isSquad ? squadSize : null,
                    maxPlayers,
                    timeLimitMinutes: input.timeLimitMinutes ?? 15,
                    difficulty: input.difficulty,
                    questionCount: input.questionCount,
                    isFriendly: input.isFriendly ?? false,
                    problems: {
                        connect: input.problemIds.map(id => ({ id }))
                    },
                    status: "WAITING",
                },
            });

            let alphaTeamId: string | null = null;
            if (isSquad) {
                const alphaTeam = await tx.battleTeam.create({
                    data: {
                        battleRoomId: created.id,
                        teamSide: "ALPHA",
                        captainUserId: input.hostId,
                        invitationCodeHash: input.alphaCodeHash || "default_alpha_hash",
                        score: 0,
                    },
                });
                alphaTeamId = alphaTeam.id;

                await tx.battleTeam.create({
                    data: {
                        battleRoomId: created.id,
                        teamSide: "BETA",
                        captainUserId: input.hostId, // Initialized placeholder until Beta captain claims
                        invitationCodeHash: input.betaCodeHash || "default_beta_hash",
                        score: 0,
                    },
                });
            }

            // Only register host as a competing participant if not explicitly hosting as a VIEWER
            if (input.hostRole !== "VIEWER") {
                await tx.battleParticipant.create({
                    data: {
                        roomId: created.id,
                        userId: input.hostId,
                        teamId: alphaTeamId,
                        participantCode: isSquad ? "A-01" : null,
                        isReady: true, // Host participant is ready by default
                    },
                });
            }

            return tx.battleRoom.findUniqueOrThrow({
                where: { id: created.id },
                include: battleRoomInclude,
            });
        });

        return this.mapToEntity(room);
    }

    async getRoomById(roomId: string): Promise<BattleRoomEntity | null> {
        const room = await prisma.battleRoom.findUnique({
            where: { id: roomId },
            include: battleRoomInclude,
        });
        return room ? this.mapToEntity(room) : null;
    }

    async getRoomByCode(roomCode: string): Promise<BattleRoomEntity | null> {
        const room = await prisma.battleRoom.findFirst({
            where: {
                roomCode: {
                    equals: roomCode,
                    mode: "insensitive"
                }
            },
            include: battleRoomInclude,
        });
        return room ? this.mapToEntity(room) : null;
    }

    async joinRoom(roomId: string, userId: string): Promise<BattleRoomEntity> {
        const room = await prisma.$transaction(async (tx: any) => {
            const targetRoom = await tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: { participants: true },
            });

            if (targetRoom.status !== "WAITING" && targetRoom.status !== "READY") {
                throw new Error("Cannot join battle room: Battle is not in waiting state");
            }

            if (targetRoom.participants.length >= targetRoom.maxPlayers) {
                throw new Error("Cannot join battle room: Room is full");
            }

            const alreadyJoined = targetRoom.participants.some((p: any) => p.userId === userId);
            if (!alreadyJoined) {
                await tx.battleParticipant.create({
                    data: {
                        roomId,
                        userId,
                        isReady: false,
                    },
                });

                if (targetRoom.status === "READY") {
                    await tx.battleRoom.update({
                        where: { id: roomId },
                        data: { status: "WAITING" },
                    });
                }
            }

            return tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: battleRoomInclude,
            });
        });

        return this.mapToEntity(room);
    }

    async leaveRoom(roomId: string, userId: string): Promise<{ wasHost: boolean; remainingCount: number; newHostId?: string }> {
        return prisma.$transaction(async (tx: any) => {
            const room = await tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: { participants: true },
            });

            const wasHost = room.hostId === userId;

            await tx.battleParticipant.deleteMany({
                where: { roomId, userId },
            });

            const remaining = await tx.battleParticipant.findMany({
                where: { roomId },
                orderBy: { joinedAt: "asc" },
            });

            let newHostId: string | undefined = undefined;

            if (remaining.length === 0) {
                // Only cancel the room if NO participants remain in the room
                await tx.battleRoom.update({
                    where: { id: roomId },
                    data: { status: "CANCELLED" },
                });
            } else if (wasHost) {
                // Host left, but room has other participants: persist room & migrate host to the next earliest participant
                newHostId = remaining[0].userId;
                const nextStatus = room.status === "RUNNING" ? "RUNNING" : (
                    remaining.length >= 2 && remaining.every((p: any) => p.isReady) ? "READY" : "WAITING"
                );

                await tx.battleRoom.update({
                    where: { id: roomId },
                    data: {
                        hostId: newHostId,
                        status: nextStatus,
                    },
                });
            } else if (room.status === "READY") {
                const allReady = remaining.length >= 2 && remaining.every((p: any) => p.isReady);
                if (!allReady) {
                    await tx.battleRoom.update({
                        where: { id: roomId },
                        data: { status: "WAITING" },
                    });
                }
            }

            return {
                wasHost,
                remainingCount: remaining.length,
                newHostId,
            };
        });
    }

    async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<BattleRoomEntity> {
        const room = await prisma.$transaction(async (tx: any) => {
            await tx.battleParticipant.update({
                where: { roomId_userId: { roomId, userId } },
                data: { isReady },
            });

            const participants = await tx.battleParticipant.findMany({
                where: { roomId },
            });

            const currentRoom = await tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
            });

            const allReady = participants.length >= 2 && participants.every((p: any) => p.isReady);

            // Auto-transition WAITING <-> READY
            let newStatus = currentRoom.status;
            if (currentRoom.status === "WAITING" && allReady) {
                newStatus = "READY";
            } else if (currentRoom.status === "READY" && !allReady) {
                newStatus = "WAITING";
            }

            if (newStatus !== currentRoom.status) {
                await tx.battleRoom.update({
                    where: { id: roomId },
                    data: { status: newStatus },
                });
            }

            return tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: battleRoomInclude,
            });
        });

        return this.mapToEntity(room);
    }

    async startBattle(roomId: string): Promise<BattleRoomEntity> {
        const room = await prisma.battleRoom.update({
            where: { id: roomId },
            data: {
                status: "RUNNING",
                startedAt: new Date(),
            },
            include: battleRoomInclude,
        });
        return this.mapToEntity(room);
    }


    async finishBattle(roomId: string): Promise<BattleRoomEntity> {
        const room = await prisma.battleRoom.update({
            where: { id: roomId },
            data: {
                status: "FINISHED",
                endedAt: new Date(),
            },
            include: battleRoomInclude,
        });

        return this.mapToEntity(room);
    }

    async updateParticipantRank(roomId: string, userId: string, rank: number): Promise<void> {
        await prisma.battleParticipant.update({
            where: { roomId_userId: { roomId, userId } },
            data: { rank },
        });
    }

    async recordParticipantScore(
        roomId: string,
        userId: string,
        score: number,
        isSolved: boolean,
    ): Promise<void> {
        await prisma.battleParticipant.update({
            where: { roomId_userId: { roomId, userId } },
            data: {
                score,
                solvedAt: isSolved ? new Date() : undefined,
            },
        });
    }

    async getExpiredRooms(): Promise<BattleRoomEntity[]> {
        const runningRooms = await prisma.battleRoom.findMany({
            where: { status: "RUNNING", startedAt: { not: null } },
            include: { participants: true },
        });

        const now = Date.now();
        const expired = runningRooms.filter((room: any) => {
            const expiryTime = room.startedAt!.getTime() + room.timeLimitMinutes * 60 * 1000;
            return now > expiryTime;
        });

        return expired.map((r: any) => this.mapToEntity(r));
    }

    async getOpenWaitingRooms(limit = 20): Promise<BattleRoomEntity[]> {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000); // Exclude stale rooms older than 30 mins
        const rooms = await prisma.battleRoom.findMany({
            where: {
                status: "WAITING",
                createdAt: {
                    gte: cutoff,
                },
                participants: {
                    some: {},
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
            include: battleRoomInclude,
        });

        return rooms.map((r: any) => this.mapToEntity(r));
    }

    async getActiveRunningRooms(limit = 10): Promise<BattleRoomEntity[]> {
        const runningRooms = await prisma.battleRoom.findMany({
            where: {
                status: "RUNNING",
                startedAt: { not: null },
            },
            orderBy: {
                startedAt: "desc",
            },
            take: limit,
            include: battleRoomInclude,
        });

        const now = Date.now();
        const nonExpired = runningRooms.filter((r: any) => {
            if (!r.startedAt) return false;
            const elapsed = now - new Date(r.startedAt).getTime();
            const maxDuration = (r.timeLimitMinutes || 15) * 60 * 1000;
            return elapsed < maxDuration;
        });

        return nonExpired.map((r: any) => this.mapToEntity(r));
    }
}
