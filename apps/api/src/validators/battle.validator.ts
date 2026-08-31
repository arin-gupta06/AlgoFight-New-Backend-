import { z } from "zod";

export const CreateBattleRoomSchema = z.object({
    hostId: z.string(),
    maxPlayers: z.number().int().min(2).max(100).optional().default(2),
    timeLimitMinutes: z.number().int().min(1).max(60).optional().default(15),
    difficulty: z.string().optional().default("Mix"),
    questionCount: z.number().int().min(1).max(10).optional().default(3),
});

export const JoinRoomSchema = z.object({
    userId: z.string(),
});

export const LeaveRoomSchema = z.object({
    userId: z.string(),
});

export const ReadyRoomSchema = z.object({
    userId: z.string(),
    isReady: z.boolean(),
});

export const KickPlayerSchema = z.object({
    hostId: z.string(),
    targetUserId: z.string(),
});

export const ApproveJoinSchema = z.object({
    hostId: z.string(),
    targetUserId: z.string(),
});

export const RejectJoinSchema = z.object({
    hostId: z.string(),
    targetUserId: z.string(),
});

export const StartBattleSchema = z.object({
    hostId: z.string(),
    problemId: z.string().uuid().optional(),
});
