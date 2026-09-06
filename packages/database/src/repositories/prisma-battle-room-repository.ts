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
            maxPlayers: room.maxPlayers,
            status: room.status,
            difficulty: room.difficulty,
            questionCount: room.questionCount,
            problems: room.problems,
            timeLimitMinutes: room.timeLimitMinutes,
            startedAt: room.startedAt,
            endedAt: room.endedAt,
            createdAt: room.createdAt,
            participants: (room.participants || []).map((p: any) => {
                const u = p.user;
                return {
                    userId: p.userId,
                    roomId: p.roomId,
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
        const room = await prisma.$transaction(async (tx) => {
            const created = await tx.battleRoom.create({
                data: {
                    roomCode: input.roomCode,
                    hostId: input.hostId,
                    maxPlayers: input.maxPlayers ?? 2,
                    timeLimitMinutes: input.timeLimitMinutes ?? 15,
                    difficulty: input.difficulty,
                    questionCount: input.questionCount,
                    problems: {
                        connect: input.problemIds.map(id => ({ id }))
                    },

                    status: "WAITING",
                },
            });

            await tx.battleParticipant.create({
                data: {
                    roomId: created.id,
                    userId: input.hostId,
                    isReady: true, // Host is ready by default
                },
            });

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
        const room = await prisma.battleRoom.findUnique({
            where: { roomCode },
            include: battleRoomInclude,
        });
        return room ? this.mapToEntity(room) : null;
    }

    async joinRoom(roomId: string, userId: string): Promise<BattleRoomEntity> {
        const room = await prisma.$transaction(async (tx) => {
            const targetRoom = await tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: { participants: true },
            });

            if (targetRoom.status !== "WAITING") {
                throw new Error("Cannot join battle room: Battle is not in waiting state");
            }

            if (targetRoom.participants.length >= targetRoom.maxPlayers) {
                throw new Error("Cannot join battle room: Room is full");
            }

            const alreadyJoined = targetRoom.participants.some((p) => p.userId === userId);
            if (!alreadyJoined) {
                await tx.battleParticipant.create({
                    data: {
                        roomId,
                        userId,
                        isReady: false,
                    },
                });
            }

            return tx.battleRoom.findUniqueOrThrow({
                where: { id: roomId },
                include: battleRoomInclude,
            });
        });

        return this.mapToEntity(room);
    }

    async leaveRoom(roomId: string, userId: string): Promise<{ wasHost: boolean; remainingCount: number }> {
        return prisma.$transaction(async (tx) => {
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
            });

            if (remaining.length === 0 || wasHost) {
                await tx.battleRoom.update({
                    where: { id: roomId },
                    data: { status: "CANCELLED" },
                });
            }

            return {
                wasHost,
                remainingCount: remaining.length,
            };
        });
    }

    async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<BattleRoomEntity> {
        const room = await prisma.$transaction(async (tx) => {
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

            const allReady = participants.length >= 2 && participants.every((p) => p.isReady);

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
        const expired = runningRooms.filter((room) => {
            const expiryTime = room.startedAt!.getTime() + room.timeLimitMinutes * 60 * 1000;
            return now > expiryTime;
        });

        return expired.map((r) => this.mapToEntity(r));
    }
}
