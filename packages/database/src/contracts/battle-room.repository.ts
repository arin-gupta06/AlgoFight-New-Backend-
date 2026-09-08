import { BattleRoomEntity, BattleRoomStatusType } from "../entities/battle-room.entity";

export type CreateBattleRoomInput = {
    hostId: string;
    roomCode: string;
    maxPlayers: number;
    timeLimitMinutes?: number;
    status: BattleRoomStatusType;
    difficulty: string;
    questionCount: number;
    problemIds: string[];
    isFriendly?: boolean;
};

export interface BattleRoomRepository {
    createRoom(input: CreateBattleRoomInput): Promise<BattleRoomEntity>;
    getRoomById(roomId: string): Promise<BattleRoomEntity | null>;
    getRoomByCode(roomCode: string): Promise<BattleRoomEntity | null>;
    joinRoom(roomId: string, userId: string): Promise<BattleRoomEntity>;
    leaveRoom(roomId: string, userId: string): Promise<{ wasHost: boolean; remainingCount: number }>;
    setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<BattleRoomEntity>;
    startBattle(roomId: string): Promise<BattleRoomEntity>;
    finishBattle(roomId: string): Promise<BattleRoomEntity>;
    updateParticipantRank(roomId: string, userId: string, rank: number): Promise<void>;
    recordParticipantScore(roomId: string, userId: string, score: number, isSolved: boolean): Promise<void>;
    getExpiredRooms(): Promise<BattleRoomEntity[]>;
}
