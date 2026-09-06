export interface BattleParticipantEntity {
    userId: string;
    roomId: string;
    joinedAt: Date;
    isReady: boolean;
    score: number;
    rank: number | null;
    solvedAt: Date | null;
    solvedProblemIds: string[];
    user?: {
        id: string;
        username: string;
        rating: number;
        email?: string | null;
    };
    username?: string;
    rating?: number;
}