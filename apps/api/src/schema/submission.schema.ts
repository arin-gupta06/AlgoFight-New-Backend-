import { z } from "zod";

export const submissionSchema = z.object({
    userId: z.string().uuid().optional(),
    problemId: z.string().min(1, "problemId is required."),
    roomId: z.string().optional(),
    language: z.string().min(1, "Language is required."),
    code: z.string().min(1, "Code is required.").max(65536,
        "Code exceeds maximum allowed size of 64KB"),
    targetRuntimeUrl: z.string().optional(),
    runtimePort: z.number().int().min(1000).max(65535).optional(),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const testRunSchema = z.object({
    language: z.string().min(1, "language is required"),
    code: z.string().min(1, "code is required").max(65536, "Code exceeds maximum allowed size of 64KB"),
    testCases: z.array(z.object({
        id: z.string(),
        input: z.string().max(32768, "Input exceeds 32KB"),
        expectedOutput: z.string().max(32768, "Expected output exceeds 32KB").default("")
    })).min(1, "At least 1 testcase is required").max(20, "Maximum 20 testcases allowed per test run"),
    targetRuntimeUrl: z.string().optional(),
    runtimePort: z.number().int().min(1000).max(65535).optional(),
});

export type TestRunInput = z.infer<typeof testRunSchema>;

export const practiceEvaluateSchema = z.object({
    problemId: z.string().min(1, "problemId is required"),
    code: z.string().min(1, "code is required").max(65536, "Code exceeds maximum allowed size of 64KB"),
    language: z.string().min(1, "language is required"),
    mode: z.enum(["test", "submit"]).default("test"),
    targetRuntimeUrl: z.string().optional(),
    runtimePort: z.number().int().min(1000).max(65535).optional(),
});

export type PracticeEvaluateInput = z.infer<typeof practiceEvaluateSchema>;

export const executeDirectSchema = z.object({
    language: z.string().min(1, "Language is required"),
    code: z.string().min(1, "Code is required").max(65536, "Code exceeds maximum allowed size of 64KB"),
    stdin: z.string().max(32768, "Stdin exceeds 32KB").optional().default(""),
    targetRuntimeUrl: z.string().optional(),
    runtimePort: z.number().int().min(1000).max(65535).optional(),
    timeLimitMs: z.number().int().min(200).max(30000).optional().default(3000),
    memoryLimitBytes: z.number().int().optional().default(256 * 1024 * 1024),
});

export type ExecuteDirectInput = z.infer<typeof executeDirectSchema>;

