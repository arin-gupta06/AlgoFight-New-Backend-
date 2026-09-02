import {
    BattleRoomRepository,
    BattleRoomEntity,
    ProblemRepository,
} from "@algofight/database";
import { RoomCodeGenerator } from "../utils/room-code.generator";
import { RatingService, EloResult } from "./rating.service";

export interface CreateRoomDto {
    hostId: string;
    maxPlayers?: number;
    timeLimitMinutes?: number;
    difficulty?: string;
    questionCount?: number;
}


export class BattleRoomService {
    constructor(
        private readonly battleRoomRepository: BattleRoomRepository,
        private readonly problemRepository?: ProblemRepository,
        private readonly ratingService?: RatingService,
    ) { }

    async createRoom(dto: CreateRoomDto): Promise<BattleRoomEntity> {
        const roomCode = RoomCodeGenerator.generate();

        let selectedProblems: any[] = [];
        if (this.problemRepository) {
            const allResult = await this.problemRepository.getProblems({ limit: 100 });
            const problems = allResult.problems;

            const qCount = dto.questionCount ?? 3;
            const diff = (dto.difficulty || "MIX").toUpperCase();

            if (diff === "MIX") {
                const hardCount = Math.max(1, Math.floor(qCount * 0.3));
                const easyCount = Math.max(1, Math.floor(qCount * 0.2));
                const medCount = Math.max(0, qCount - hardCount - easyCount);

                selectedProblems = [
                    ...problems.filter((p: any) => p.difficulty === "HARD").slice(0, hardCount),
                    ...problems.filter((p: any) => p.difficulty === "MEDIUM").slice(0, medCount),
                    ...problems.filter((p: any) => p.difficulty === "EASY").slice(0, easyCount)
                ];
            } else {
                selectedProblems = problems.filter((p: any) => p.difficulty === diff).slice(0, qCount);
            }

            if (selectedProblems.length === 0) selectedProblems = problems.slice(0, qCount);
        }

        return this.battleRoomRepository.createRoom({
            hostId: dto.hostId,
            roomCode,
            maxPlayers: dto.maxPlayers ?? 2,
            timeLimitMinutes: dto.timeLimitMinutes ?? 15,
            difficulty: dto.difficulty || "MIX",
            questionCount: dto.questionCount ?? 3,
            problemIds: selectedProblems.map(p => p.id),
            status: "WAITING",
        });
    }


    async getRoom(roomIdOrCode: string): Promise<BattleRoomEntity> {
        const room = roomIdOrCode.startsWith("BTL-")
            ? await this.battleRoomRepository.getRoomByCode(roomIdOrCode)
            : await this.battleRoomRepository.getRoomById(roomIdOrCode);

        if (!room) {
            throw new Error(`Battle room not found: ${roomIdOrCode}`);
        }
        return room;
    }

    async joinRoom(roomIdOrCode: string, userId: string): Promise<BattleRoomEntity> {
        const room = await this.getRoom(roomIdOrCode);

        if (room.status !== "WAITING") {
            throw new Error("Cannot join: Battle has already started or finished");
        }

        if (room.participants.length >= room.maxPlayers) {
            throw new Error("Cannot join: Room is at maximum capacity");
        }

        return this.battleRoomRepository.joinRoom(room.id, userId);
    }

    async leaveRoom(roomIdOrCode: string, userId: string): Promise<{ wasHost: boolean; remainingCount: number }> {
        const room = await this.getRoom(roomIdOrCode);
        return this.battleRoomRepository.leaveRoom(room.id, userId);
    }

    async kickPlayer(roomIdOrCode: string, hostId: string, targetUserId: string): Promise<{ remainingCount: number }> {
        const room = await this.getRoom(roomIdOrCode);
        if (room.hostId !== hostId) {
            throw new Error("Only the room host can remove players from the lobby");
        }

        if (hostId === targetUserId) {
            throw new Error("Host cannot kick themselves from the lobby");
        }

        if (room.status !== "WAITING") {
            throw new Error("Cannot kick players after battle has started");
        }

        const isTargetInRoom = room.participants.some(p => p.userId === targetUserId);
        if (!isTargetInRoom) {
            throw new Error("Target player is not in this lobby");
        }

        const result = await this.battleRoomRepository.leaveRoom(room.id, targetUserId);
        return { remainingCount: result.remainingCount };
    }

    async setPlayerReady(roomIdOrCode: string, userId: string, isReady: boolean): Promise<BattleRoomEntity> {
        const room = await this.getRoom(roomIdOrCode);
        return this.battleRoomRepository.setPlayerReady(room.id, userId, isReady);
    }

    async startBattle(roomIdOrCode: string, hostId: string, problemId?: string): Promise<BattleRoomEntity> {
        const room = await this.getRoom(roomIdOrCode);
        if (!room) {
            throw new Error("Room not found");
        }

        if (room.hostId !== hostId) {
            throw new Error("Only the room host can start the battle");
        }

        if (room.participants.length < 2) {
            throw new Error("Cannot start battle with fewer than 2 participants");
        }

        return this.battleRoomRepository.startBattle(room.id);
    }

    async finishBattle(roomId: string, forfeitedUserId?: string): Promise<{ room: BattleRoomEntity; eloResults?: Record<string, EloResult> }> {
        const room = await this.battleRoomRepository.getRoomById(roomId);
        if (!room) {
            throw new Error("Room not found");
        }

        // 🛡️ AF-015: Deterministic battle ranking
        // 1. Solved first (earliest solve timestamp)
        // 2. Highest score/points
        // 3. Lowest user ID tiebreak (deterministic)
        let sorted = [...room.participants].sort((a, b) => {
            if (a.solvedAt && b.solvedAt) {
                const timeDiff = a.solvedAt.getTime() - b.solvedAt.getTime();
                if (timeDiff !== 0) return timeDiff;
            }
            if (a.solvedAt && !b.solvedAt) return -1;
            if (!a.solvedAt && b.solvedAt) return 1;

            if (b.score !== a.score) {
                return b.score - a.score;
            }

            return a.userId.localeCompare(b.userId);
        });
        
        if (forfeitedUserId) {
            const forfeitedIdx = sorted.findIndex(p => p.userId === forfeitedUserId);
            if (forfeitedIdx > -1) {
                const forfeitedPlayer = sorted.splice(forfeitedIdx, 1)[0];
                sorted.push(forfeitedPlayer);
            }
        }

        // Persist authoritative ranks in PostgreSQL
        for (let i = 0; i < sorted.length; i++) {
            await this.battleRoomRepository.updateParticipantRank(roomId, sorted[i].userId, i + 1);
        }

        let eloResults: Record<string, EloResult> | undefined;

        if (this.ratingService) {
            if (sorted.length >= 2) {
                const shouldApplyElo = forfeitedUserId || sorted.some(p => p.score > 0 || p.solvedAt);
                if (shouldApplyElo) {
                    const totalProblems = room.questionCount || room.problems?.length || 1;
                    const totalTimeSeconds = (room.timeLimitMinutes || 15) * 60;
                    
                    const participantInputs = sorted.map((p, index) => {
                        const solvedCount = p.solvedProblemIds?.length || (p.solvedAt ? 1 : 0);
                        const timeTakenSeconds = (room.startedAt && p.solvedAt) 
                            ? Math.max(0, Math.round((p.solvedAt.getTime() - room.startedAt.getTime()) / 1000))
                            : totalTimeSeconds;

                        return {
                            userId: p.userId,
                            rank: index + 1,
                            score: p.score ?? 0,
                            solvedCount,
                            totalProblems,
                            timeTakenSeconds,
                            totalTimeSeconds,
                        };
                    });

                    eloResults = await this.ratingService.applyBattleResolution(roomId, participantInputs);
                }
            }
        }

        const finishedRoom = await this.battleRoomRepository.finishBattle(roomId);
        return { room: finishedRoom, eloResults };
    }
}
