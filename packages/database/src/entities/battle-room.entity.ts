import { BattleParticipantEntity } from "./battle-participant.entity";


export type BattleRoomStatusType =
    | "WAITING"
    | "READY"
    | "RUNNING"
    | "FINISHED"
    | "CANCELLED"

export interface BattleRoomEntity {
    id: string;
    roomCode: string;
    hostId: string;
    host?: {
        id: string;
        username: string;
        rating: number;
        email?: string | null;
    };
    maxPlayers: number;
    participants: BattleParticipantEntity[];
    status: BattleRoomStatusType;
    difficulty: string | null;
    questionCount: number;
    problems?: any[],
    timeLimitMinutes: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
}