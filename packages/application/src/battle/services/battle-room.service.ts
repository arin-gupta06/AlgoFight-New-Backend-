import {
    BattleRoomRepository,
    BattleRoomEntity,
    ProblemRepository,
    prisma,
} from "@algofight/database";
import { RoomCodeGenerator } from "../utils/room-code.generator";
import { RatingService, EloResult } from "./rating.service";

export interface CreateRoomDto {
    hostId: string;
    maxPlayers?: number;
    timeLimitMinutes?: number;
    difficulty?: string;
    questionCount?: number;
    isFriendly?: boolean;
    problemIds?: string[];
    battleMode?: "DUEL_1V1" | "SQUAD_BATTLE" | "PRACTICE_SOLO";
    squadSize?: number;
    hostRole?: "PARTICIPANT" | "VIEWER";
}

function shuffleArray<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export class BattleRoomService {
    constructor(
        private readonly battleRoomRepository: BattleRoomRepository,
        private readonly problemRepository?: ProblemRepository,
        private readonly ratingService?: RatingService,
    ) { }

    async createRoom(dto: CreateRoomDto): Promise<BattleRoomEntity> {
        const roomCode = RoomCodeGenerator.generate();

        let selectedProblemIds: string[] = [];
        let finalDifficulty = dto.difficulty || "MIX";
        let finalQuestionCount = dto.questionCount ?? 3;

        if (dto.problemIds && dto.problemIds.length > 0) {
            selectedProblemIds = dto.problemIds;
            finalQuestionCount = selectedProblemIds.length;
            finalDifficulty = "CUSTOM";
        } else if (this.problemRepository) {
            const allResult = await this.problemRepository.getProblems({ limit: 100 });
            const problems = allResult.problems;

            const qCount = dto.questionCount ?? 3;
            const diff = (dto.difficulty || "MIX").toUpperCase();

            const hardPool = shuffleArray(problems.filter((p: any) => p.difficulty === "HARD"));
            const medPool = shuffleArray(problems.filter((p: any) => p.difficulty === "MEDIUM"));
            const easyPool = shuffleArray(problems.filter((p: any) => p.difficulty === "EASY"));

            let selectedProblems: any[] = [];
            if (diff === "MIX") {
                const hardCount = Math.max(1, Math.floor(qCount * 0.3));
                const easyCount = Math.max(1, Math.floor(qCount * 0.2));
                const medCount = Math.max(0, qCount - hardCount - easyCount);

                selectedProblems = [
                    ...hardPool.slice(0, hardCount),
                    ...medPool.slice(0, medCount),
                    ...easyPool.slice(0, easyCount)
                ];
            } else {
                const pool = shuffleArray(problems.filter((p: any) => p.difficulty === diff));
                selectedProblems = pool.slice(0, qCount);
            }

            if (selectedProblems.length === 0) selectedProblems = shuffleArray(problems).slice(0, qCount);
            selectedProblemIds = selectedProblems.map(p => p.id);
        }

        let alphaCode: string | undefined;
        let betaCode: string | undefined;
        let alphaCodeHash: string | undefined;
        let betaCodeHash: string | undefined;

        if (dto.battleMode === "SQUAD_BATTLE") {
            const squadCodes = RoomCodeGenerator.generateSquadCodes();
            alphaCode = squadCodes.alphaCode;
            betaCode = squadCodes.betaCode;
            alphaCodeHash = squadCodes.alphaHash;
            betaCodeHash = squadCodes.betaHash;
        }

        const room = await this.battleRoomRepository.createRoom({
            hostId: dto.hostId,
            roomCode,
            maxPlayers: dto.battleMode === "SQUAD_BATTLE" ? (dto.squadSize || 2) * 2 : (dto.maxPlayers ?? 2),
            timeLimitMinutes: dto.timeLimitMinutes ?? 15,
            difficulty: finalDifficulty,
            questionCount: finalQuestionCount,
            problemIds: selectedProblemIds,
            isFriendly: dto.isFriendly,
            battleMode: dto.battleMode,
            squadSize: dto.squadSize,
            alphaCodeHash,
            betaCodeHash,
            status: "WAITING",
            hostRole: dto.hostRole || "PARTICIPANT",
        });

        (room as any).hostRole = dto.hostRole || "PARTICIPANT";

        if (dto.battleMode === "SQUAD_BATTLE") {
            (room as any).alphaInvitationCode = alphaCode;
            (room as any).betaInvitationCode = betaCode;
        }

        return room;
    }


    async getRoom(roomIdOrCode: string): Promise<BattleRoomEntity> {
        let room = await this.battleRoomRepository.getRoomByCode(roomIdOrCode);
        if (!room) {
            room = await this.battleRoomRepository.getRoomById(roomIdOrCode);
        }

        if (!room) {
            throw new Error(`Battle room not found: ${roomIdOrCode}`);
        }
        return room;
    }

    async joinRoom(roomIdOrCode: string, userId: string): Promise<BattleRoomEntity> {
        const room = await this.getRoom(roomIdOrCode);

        // 1. If user is already a registered participant (e.g., reconnecting or refreshing tab), return room immediately
        const alreadyJoined = room.participants.some((p) => p.userId === userId);
        if (alreadyJoined) {
            return room;
        }

        // 2. Allow joining in WAITING, READY, or RUNNING states (to support re-entry into active matches)
        if (room.status !== "WAITING" && room.status !== "READY" && room.status !== "RUNNING") {
            throw new Error("Cannot join: Battle has already finished or cancelled");
        }

        // 3. Check capacity
        if (room.participants.length >= room.maxPlayers) {
            throw new Error("Cannot join: Room is at maximum capacity");
        }

        return this.battleRoomRepository.joinRoom(room.id, userId);
    }

    async leaveRoom(roomIdOrCode: string, userId: string): Promise<{ wasHost: boolean; remainingCount: number; newHostId?: string }> {
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

        if (room.status !== "WAITING" && room.status !== "READY") {
            throw new Error("Cannot kick players after battle has started");
        }

        const isTargetInRoom = room.participants.some(p => p.userId === targetUserId);
        if (!isTargetInRoom) {
            throw new Error("Target player is not in this lobby");
        }

        const result = await this.battleRoomRepository.leaveRoom(room.id, targetUserId);
        return { remainingCount: result.remainingCount };
    }

    async joinSquadTeam(userId: string, teamCode: string): Promise<{ room: BattleRoomEntity; team: any; participantCode: string }> {
        const codeHash = RoomCodeGenerator.hashTeamCode(teamCode);
        const team = await prisma.battleTeam.findFirst({
            where: { invitationCodeHash: codeHash },
            include: {
                battleRoom: {
                    include: {
                        participants: true,
                        teams: true,
                    },
                },
                participants: true,
            },
        });

        if (!team) {
            throw new Error("Invalid squad invitation code");
        }

        const room = team.battleRoom;
        if (room.status !== "WAITING" && room.status !== "READY") {
            throw new Error("Cannot join squad: Battle has already started or concluded");
        }

        const squadCap = room.squadSize || 2;
        const existingInThisTeam = team.participants.find((p: any) => p.userId === userId);
        if (existingInThisTeam) {
            const fullRoom = await this.getRoom(room.id);
            return {
                room: fullRoom,
                team,
                participantCode: existingInThisTeam.participantCode || (team.teamSide === "ALPHA" ? "A-01" : "B-01"),
            };
        }

        const inOtherTeam = room.participants.find((p: any) => p.userId === userId && p.teamId !== team.id);
        if (inOtherTeam) {
            throw new Error("You are already registered on the opposing squad in this battle");
        }

        if (team.participants.length >= squadCap) {
            throw new Error(`Squad ${team.teamSide === "ALPHA" ? "Alpha" : "Beta"} is at full capacity (${squadCap}/${squadCap})`);
        }

        const prefix = team.teamSide === "ALPHA" ? "A" : "B";
        const isFirstInBeta = team.teamSide === "BETA" && team.participants.length === 0;
        let participantCode: string;

        if (isFirstInBeta) {
            participantCode = `${prefix}-01`;
            await prisma.battleTeam.update({
                where: { id: team.id },
                data: {
                    captainUserId: userId,
                    isApproved: false,
                },
            });
        } else {
            const nextIdx = team.participants.length + 1;
            participantCode = `${prefix}-0${nextIdx}`;
        }

        await prisma.$transaction([
            prisma.battleParticipant.create({
                data: {
                    roomId: room.id,
                    userId,
                    teamId: team.id,
                    participantCode,
                    isReady: false,
                },
            }),
            prisma.battleRoom.update({
                where: { id: room.id },
                data: {
                    rosterVersion: { increment: 1 },
                },
            }),
            prisma.battleTeam.updateMany({
                where: { battleRoomId: room.id },
                data: { isApproved: false },
            }),
        ]);

        const fullRoom = await this.getRoom(room.id);
        return {
            room: fullRoom,
            team,
            participantCode,
        };
    }

    async setSquadCaptainApproval(roomIdOrCode: string, captainUserId: string, isApproved: boolean): Promise<{ success: boolean; alphaApproved: boolean; betaApproved: boolean; canStart: boolean; rosterVersion: number }> {
        const room = await this.getRoom(roomIdOrCode);
        if (room.status !== "WAITING" && room.status !== "READY") {
            throw new Error("Cannot modify approval: Battle is not in lobby state");
        }

        const team = (room.teams || []).find((t: any) => t.captainUserId === captainUserId);
        if (!team) {
            throw new Error("Only an authorized squad captain may approve the match");
        }

        const rosterVer = room.rosterVersion || 1;

        await prisma.battleTeam.update({
            where: { id: team.id },
            data: {
                isApproved,
                approvedVersion: isApproved ? rosterVer : 0,
                approvedAt: isApproved ? new Date() : null,
            },
        });

        const updatedTeams = await prisma.battleTeam.findMany({
            where: { battleRoomId: room.id },
        });

        const alphaTeam = updatedTeams.find((t: any) => t.teamSide === "ALPHA");
        const betaTeam = updatedTeams.find((t: any) => t.teamSide === "BETA");

        const alphaApproved = Boolean(alphaTeam?.isApproved && alphaTeam?.approvedVersion === rosterVer);
        const betaApproved = Boolean(betaTeam?.isApproved && betaTeam?.approvedVersion === rosterVer);

        const squadCap = room.squadSize || 2;
        const alphaCount = (room.participants || []).filter((p: any) => p.teamId === alphaTeam?.id).length;
        const betaCount = (room.participants || []).filter((p: any) => p.teamId === betaTeam?.id).length;
        const teamsFull = alphaCount === squadCap && betaCount === squadCap;

        const canStart = alphaApproved && betaApproved && teamsFull;

        return {
            success: true,
            alphaApproved,
            betaApproved,
            canStart,
            rosterVersion: rosterVer,
        };
    }

    async kickSquadMember(roomIdOrCode: string, captainUserId: string, targetUserId: string): Promise<{ remainingCount: number; teamSide: string }> {
        const room = await this.getRoom(roomIdOrCode);
        if (room.status !== "WAITING" && room.status !== "READY") {
            throw new Error("Cannot kick players after battle has started");
        }

        const captainTeam = (room.teams || []).find((t: any) => t.captainUserId === captainUserId);
        if (!captainTeam) {
            throw new Error("Only an authorized squad captain can remove players from their team");
        }

        if (captainUserId === targetUserId) {
            throw new Error("Captain cannot kick themselves from their squad");
        }

        const targetParticipant = room.participants.find(p => p.userId === targetUserId);
        if (!targetParticipant) {
            throw new Error("Target player is not in this battle");
        }

        if (targetParticipant.teamId !== captainTeam.id) {
            throw new Error("Captains can only kick players from their own squad");
        }

        await prisma.$transaction([
            prisma.battleParticipant.delete({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: targetUserId,
                    },
                },
            }),
            prisma.battleRoom.update({
                where: { id: room.id },
                data: {
                    rosterVersion: { increment: 1 },
                },
            }),
            prisma.battleTeam.updateMany({
                where: { battleRoomId: room.id },
                data: { isApproved: false },
            }),
        ]);

        const updatedRoom = await this.getRoom(room.id);
        return {
            remainingCount: updatedRoom.participants.length,
            teamSide: captainTeam.teamSide,
        };
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

        const isRatedMatch = !room.isFriendly && (room as any).roomType !== "UNRATED";

        if (this.ratingService) {
            if (sorted.length >= 2 && isRatedMatch) {
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

                    // Process Battle Rewards & Consistency for Rated Matches
                    try {
                        const {
                            PointLedgerService,
                            IntegrityService,
                            BattleRewardService,
                            ConsistencyRewardService,
                            AchievementRewardService
                        } = await import("../../rewards/index.js");

                        const ledger = new PointLedgerService();
                        const integrity = new IntegrityService();
                        const battleReward = new BattleRewardService(ledger, integrity);
                        const consistency = new ConsistencyRewardService(ledger);
                        const achievements = new AchievementRewardService(ledger);

                        for (const input of participantInputs) {
                            if (input.userId && input.userId !== "bot") {
                                const userResult = eloResults?.[input.userId];
                                const opponentIds = participantInputs.filter(other => other.userId !== input.userId).map(other => other.userId);
                                const opponentRatings = opponentIds.map(opId => eloResults?.[opId]?.oldRating ?? 0);

                                await battleReward.processBattleReward({
                                    roomId,
                                    userId: input.userId,
                                    userRating: userResult?.oldRating ?? 0,
                                    opponentRatings,
                                    opponentIds,
                                    placement: input.rank,
                                    totalParticipants: participantInputs.length,
                                    performanceScore: userResult?.performanceScore ?? 0.5,
                                    isFriendly: false,
                                    roomType: "RATED",
                                    solvedCount: input.solvedCount,
                                    timeTakenSeconds: input.timeTakenSeconds,
                                });

                                await consistency.recordActiveDay(input.userId, "RATED_BATTLE");
                                await achievements.checkAndUnlockAchievements(input.userId);
                            }
                        }
                    } catch (e) {
                        console.error("[BattleRoomService] Error processing battle rewards:", e);
                    }
                }
            }
        }

        const finishedRoom = await this.battleRoomRepository.finishBattle(roomId);
        return { room: finishedRoom, eloResults };
    }

    async getOpenWaitingRooms(limit = 20): Promise<BattleRoomEntity[]> {
        return this.battleRoomRepository.getOpenWaitingRooms(limit);
    }

    async getActiveRunningRooms(limit = 10): Promise<BattleRoomEntity[]> {
        return this.battleRoomRepository.getActiveRunningRooms(limit);
    }
}
