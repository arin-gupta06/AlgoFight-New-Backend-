import { SubmissionResult } from "@algofight/database";
export interface ExecutionTestCase {
    input: string;
    expectedOutput: string;
}
export interface ExecutionPayload  {
    submissionId: string,
    language: string,
    code: string,
    testCases: ExecutionTestCase[],
    timeLimit: number,
    memoryLimit: number,
    targetRuntimeUrl?: string,
    runtimePort?: number,
};
export interface CodeExecutor {
    execute (
        payload: ExecutionPayload
    ): Promise <SubmissionResult>;
}