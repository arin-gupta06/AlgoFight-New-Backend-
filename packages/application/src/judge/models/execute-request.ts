import { TestCase, Verdict, ExecutionMetrics, TestCaseResult, EvaluationResult } from "@algofight/types";

export type ExecutionMode = "SAMPLE" | "SUBMIT";

export interface ExecuteRequest {
    submissionId: string;
    language: string;
    code: string;
    testCases: TestCase[];
    timeLimitMs: number;
    memoryLimitBytes: number;
    mode: ExecutionMode;
    targetRuntimeUrl?: string;
}

export interface PipelineProgressEvent {
    submissionId: string;
    stage: "PREPARE" | "COMPILE" | "TEST_STARTED" | "TEST_COMPLETED" | "FINISHED";
    testCaseIndex?: number;
    testCaseResult?: TestCaseResult;
    compilationResult?: EvaluationResult["compilation"];
    error?: string;
    metrics?: {
        passed: number;
        total: number;
    }
}
