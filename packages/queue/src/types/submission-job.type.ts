export interface SubmissionJobPayload {
    submissionId: string;
    mode?: "RUN" | "SUBMIT";
    workload?: "LIGHT" | "HEAVY";
    targetRuntimeUrl?: string;
    priority?: "HIGH" | "NORMAL";
    language?: string;
    userId?: string;
    problemId?: string;
}