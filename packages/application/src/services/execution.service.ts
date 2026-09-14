import {
    SubmissionRepository,
    ProblemRepository,
    BattleRoomRepository,
} from "@algofight/database";
import { logger } from "@algofight/logger";
import { BattleService } from "../battle/services/battle.service";
import { EvaluationServiceContract, SubmissionStatus, Verdict } from "@algofight/types";
import {
    SubmissionNotFoundError,
    ProblemNotFoundError,
} from "@algofight/error-handling";
import { createRedisClient } from "../utils/redis.client";
import { PipelineProgressEvent } from "../judge/models/execute-request";

export class ExecutionService {
    private redisPublisher = createRedisClient();

    constructor(
        private readonly submissionRepository: SubmissionRepository,
        private readonly evaluationService: EvaluationServiceContract,
        private readonly problemRepository: ProblemRepository,
        private readonly battleRoomRepository?: BattleRoomRepository,
        private readonly battleService?: BattleService,
    ) { }

    async processSubmission(
        submissionId: string,
        mode: "SAMPLE" | "SUBMIT" = "SUBMIT",
        targetRuntimeUrl?: string,
    ): Promise<void> {
        try {
            logger.info({ submissionId, mode, targetRuntimeUrl }, "Starting submission processing");

            const submission = await this.submissionRepository.getSubmissionById(submissionId);
            if (!submission) {
                throw new SubmissionNotFoundError(submissionId);
            }

            const problem =
                (await this.problemRepository.getProblemWithAllTestCases(submission.problemId)) ??
                (await this.problemRepository.getProblemById(submission.problemId));

            if (!problem) {
                throw new ProblemNotFoundError(submission.problemId);
            }

            // Step through strict state machine transitions
            await this.submissionRepository.updateStatus(submissionId, SubmissionStatus.COMPILING);
            
            const onProgress = (event: PipelineProgressEvent) => {
                this.redisPublisher.publish(
                    `execution:stream:${submission.userId}`,
                    JSON.stringify({
                        event: "execution_progress",
                        data: {
                            roomId: submission.roomId,
                            problemId: submission.problemId,
                            ...event
                        }
                    })
                );
            };

            const evalResult = await this.evaluationService.evaluateSubmission({
                submissionId,
                language: submission.language,
                code: submission.code,
                testCases: problem.testCases.map((tc) => ({
                    id: tc.id,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                })),
                timeLimitMs: problem.timeLimit,
                memoryLimitBytes: problem.memoryLimit,
                targetRuntimeUrl,
            } as any, onProgress, mode);

            const passedCount = evalResult.testCases?.filter((tc) => tc.passed).length || 0;
            const failedCount = evalResult.testCases?.filter((tc) => !tc.passed).length || 0;
            const isAccepted = evalResult.verdict === Verdict.ACCEPTED;

            await this.submissionRepository.completeSubmission(submissionId, {
                status: SubmissionStatus.FINALIZED,
                stdout: null,
                stderr: evalResult.compilation?.error || null,
                executionTime: evalResult.resourceUsage?.totalTime || 0,
                exitCode: 0,
                passedCount,
                failedCount,
                verdict: evalResult.verdict,
                memoryUsage: evalResult.resourceUsage?.maxMemory || 0,
                compileTime: evalResult.compilation?.timeMs || 0,
            });

            // If this submission belongs to a battle and passed all test cases, award score
            if (submission.roomId && isAccepted && this.battleRoomRepository) {
                await this.battleRoomRepository.recordParticipantScore(
                    submission.roomId,
                    submission.userId,
                    100,
                    true,
                );

                if (this.battleService) {
                    await this.battleService.processEvaluationResult(
                        submission.roomId,
                        submission.userId,
                        submission.problemId,
                        true,
                        100
                    );
                }

                logger.info(
                    {
                        submissionId,
                        userId: submission.userId,
                        problemId: submission.problemId,
                        language: submission.language,
                        executionTimeMs: evalResult.resourceUsage?.totalTime || 0,
                        peakMemoryKb: evalResult.resourceUsage?.maxMemory || 0,
                        verdict: "ACCEPTED",
                        passCount: passedCount,
                        totalTestcases: problem.testCases.length,
                    },
                    "Battle participant solved problem and score was recorded",
                );
            }

            logger.info({ submissionId }, "Submission processing completed");
        } catch (error: any) {
            logger.error({ submissionId, error: error.message || error }, "Submission processing failed");

            // AF-009: Ensure submission is finalized in DB with SYSTEM_ERROR to prevent permanent COMPILING lockout
            try {
                await this.submissionRepository.completeSubmission(submissionId, {
                    status: SubmissionStatus.FINALIZED,
                    stdout: null,
                    stderr: error?.message || "Execution engine encountered an unexpected error.",
                    executionTime: 0,
                    exitCode: 1,
                    passedCount: 0,
                    failedCount: 0,
                    verdict: Verdict.SYSTEM_ERROR,
                    memoryUsage: 0,
                    compileTime: 0,
                });
            } catch (dbErr: any) {
                logger.error({ submissionId, error: dbErr.message }, "Failed to finalize failed submission in DB");
            }

            // Re-throw to let BullMQ worker register the failed job
            throw error;
        }
    }
}
