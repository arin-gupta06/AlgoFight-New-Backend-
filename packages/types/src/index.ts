export enum SubmissionStatus {
    CREATED = "CREATED",
    QUEUED = "QUEUED",
    COMPILING = "COMPILING",
    RUNNING = "RUNNING",
    EVALUATING = "EVALUATING",
    FINALIZED = "FINALIZED",
}

export enum SystemEvent {
    SUBMISSION_CREATED = "submission.created",
    SUBMISSION_QUEUED = "submission.queued",
    SUBMISSION_PROCESSING = "submission.processing",
    SUBMISSION_COMPLETED = "submission.completed",
    SUBMISSION_FAILED = "submission.failed",
    SUBMISSION_RETRYING = "submission.retrying",
    SUBMISSION_STALE = "submission.stale",
    WORKER_HEARTBEAT = "worker.heartbeat",
    SYSTEM_ALERT = "system.alert",
}

export enum Verdict {
    QUEUED = "QUEUED",
    COMPILING = "COMPILING",
    COMPILATION_ERROR = "COMPILATION_ERROR",
    RUNNING = "RUNNING",
    ACCEPTED = "ACCEPTED",
    WRONG_ANSWER = "WRONG_ANSWER",
    RUNTIME_ERROR = "RUNTIME_ERROR",
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED",
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED",
    OUTPUT_LIMIT_EXCEEDED = "OUTPUT_LIMIT_EXCEEDED",
    SYSTEM_ERROR = "SYSTEM_ERROR",
}

export type UUID = string;

export interface ExecutionMetrics {
    executionTime: number;
    memoryUsage: number;
    cpuUsage?: number;
    exitCode?: number | null;
    signal?: string | null;
    stdout?: string;
    stderr?: string;
    compilationTime?: number;
}

export interface TestCaseResult {
    testCaseId: string;
    status: Verdict;
    passed: boolean;
    expectedOutput?: string;
    actualOutput?: string;
    error?: string;
    metrics?: ExecutionMetrics;
}

export interface EvaluationResult {
    submissionId: string;
    verdict: Verdict;
    compilation?: {
        output: string;
        error?: string;
        success: boolean;
        timeMs?: number;
    };
    testCases?: TestCaseResult[];
    execution?: ExecutionMetrics;
    resourceUsage?: {
        maxMemory: number;
        totalTime: number;
    };
    metadata?: Record<string, any>;
}

export interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
}

export interface SubmissionPayload {
    submissionId: string;
    language: string;
    code: string;
    testCases: TestCase[];
    timeLimitMs?: number;
    memoryLimitBytes?: number;
}

export interface EvaluationServiceContract {
    evaluateSubmission(payload: SubmissionPayload, onProgress?: any, mode?: "SAMPLE" | "SUBMIT"): Promise<EvaluationResult>;
}

export type RankTierKey = "ROOKIE" | "EXPERT" | "MASTER" | "GRANDMASTER" | "LEGEND" | "SUPREME";

export interface RankTierDefinition {
    key: RankTierKey;
    name: string;
    minRating: number;
    maxRating: number;
    color: string;
    gradient: string;
    glowColor: string;
    description: string;
}

export const RANK_TIERS: RankTierDefinition[] = [
    {
        key: "ROOKIE",
        name: "Rookie",
        minRating: 0,
        maxRating: 399,
        color: "#94a3b8",
        gradient: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
        glowColor: "rgba(148, 163, 184, 0.4)",
        description: "Initiate fighting in the algorithmic proving grounds.",
    },
    {
        key: "EXPERT",
        name: "Expert",
        minRating: 400,
        maxRating: 799,
        color: "#06b6d4",
        gradient: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
        glowColor: "rgba(6, 182, 212, 0.4)",
        description: "Proven competitor with sharp execution and solid algorithmic grasp.",
    },
    {
        key: "MASTER",
        name: "Master",
        minRating: 800,
        maxRating: 1199,
        color: "#a855f7",
        gradient: "linear-gradient(135deg, #7e22ce 0%, #c084fc 100%)",
        glowColor: "rgba(168, 85, 247, 0.4)",
        description: "Advanced tactician capable of resolving complex systems under pressure.",
    },
    {
        key: "GRANDMASTER",
        name: "Grandmaster",
        minRating: 1200,
        maxRating: 1599,
        color: "#ef4444",
        gradient: "linear-gradient(135deg, #b91c1c 0%, #f87171 100%)",
        glowColor: "rgba(239, 68, 68, 0.45)",
        description: "Elite problem solver dominating high-tier ranked lobbies.",
    },
    {
        key: "LEGEND",
        name: "Legend",
        minRating: 1600,
        maxRating: 1999,
        color: "#f59e0b",
        gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
        glowColor: "rgba(245, 158, 11, 0.5)",
        description: "Champion of the arena whose mastery commands universal respect.",
    },
    {
        key: "SUPREME",
        name: "Supreme",
        minRating: 2000,
        maxRating: Infinity,
        color: "#ec4899",
        gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #38bdf8 100%)",
        glowColor: "rgba(236, 72, 153, 0.6)",
        description: "Peak competitive supremacy. The pinnacle of AlgoFight mastery.",
    },
];

export function getRankTierFromRating(rating: number): RankTierDefinition {
    const r = Math.max(0, Number(rating) || 0);
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (r >= RANK_TIERS[i].minRating) {
            return RANK_TIERS[i];
        }
    }
    return RANK_TIERS[0];
}

export function getRankKeyFromRating(rating: number): RankTierKey {
    return getRankTierFromRating(rating).key;
}

