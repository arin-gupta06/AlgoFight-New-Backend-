import { z } from "zod";

export const testCaseSchema = z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isHidden: z.boolean().optional().default(true),
});

export const problemSchema = z.object({
    title: z.string().min(1),
    statement: z.string().min(1),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    category: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    timeLimit: z.number().int().positive().optional().default(2000),
    memoryLimit: z.number().int().positive().optional().default(256),
    creatorId: z.string().optional().nullable(),
    creatorRole: z.string().optional().nullable(),
    testCases: z.array(testCaseSchema).optional().default([]),
});

export const bulkProblemsSchema = z.object({
    problems: z.array(problemSchema).min(1),
});

export type ProblemInput = z.infer<typeof problemSchema>;
export type BulkProblemsInput = z.infer<typeof bulkProblemsSchema>;