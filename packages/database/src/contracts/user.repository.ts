import { UserEntity } from "../entities/user.entity";

export interface CreateUserInput {
    id?: string;
    username: string;
    email: string;
    userType?: "STUDENT" | "FACULTY" | "INDIVIDUAL";
    primaryEmail?: string;
    secondaryEmail?: string | null;
    institutionName?: string | null;
    department?: string | null;
    batchYear?: string | null;
    platformCode?: string;
    githubUrl?: string | null;
    linkedinUrl?: string | null;
}

export interface UpdateRatingAuditInput {
    userId: string;
    battleRoomId?: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingDelta: number;
    performanceScore: number;
    ewmaBefore: number;
    ewmaAfter: number;
    isWin?: boolean;
    highestRank?: string;
    metadata?: Record<string, any>;
}

export interface UserRepository {
    createUser(input: CreateUserInput): Promise<UserEntity>;
    upsertUser(input: CreateUserInput): Promise<UserEntity>;
    getUserById(id: string): Promise<UserEntity | null>;
    getUserByUsername(username: string): Promise<UserEntity | null>;
    updateRating(userId: string, newRating: number, isWin: boolean): Promise<UserEntity>;
    updateRatingWithAudit(input: UpdateRatingAuditInput): Promise<UserEntity>;
    getAvailablePlayers(excludeUserId?: string, limit?: number, search?: string): Promise<UserEntity[]>;
    getTopUsers(limit?: number): Promise<UserEntity[]>;
    getPracticeProgress(userId: string): Promise<{ practiceSubmissionCount: number; practiceSolvedProblemIds: string[] }>;
}
