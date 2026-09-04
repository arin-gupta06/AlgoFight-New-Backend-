import { EvaluationResult, EvaluationServiceContract, SubmissionPayload } from "@algofight/types";
import { ExecutionPipeline, PipelineEventCallback } from "../judge/pipeline/execution-pipeline";
import { ExecuteRequest } from "../judge/models/execute-request";

export class EvaluationService implements EvaluationServiceContract {
    private pipeline = new ExecutionPipeline();

    async evaluateSubmission(
        payload: SubmissionPayload, 
        onProgress?: PipelineEventCallback, 
        mode: "SAMPLE" | "SUBMIT" = "SUBMIT"
    ): Promise<EvaluationResult> {
        
        const request: ExecuteRequest = {
            submissionId: payload.submissionId,
            language: payload.language,
            code: payload.code,
            testCases: payload.testCases,
            timeLimitMs: payload.timeLimitMs || 2000,
            memoryLimitBytes: payload.memoryLimitBytes || 256 * 1024 * 1024,
            mode,
            targetRuntimeUrl: (payload as any).targetRuntimeUrl,
        };

        return await this.pipeline.execute(request, onProgress);
    }
}

