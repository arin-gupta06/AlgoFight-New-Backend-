import { ProblemNotFoundError } from "@algofight/error-handling";
import { enqueueSubmissionJob } from "@algofight/queue";
import { SubmissionInput, TestRunInput, PracticeEvaluateInput, ExecuteDirectInput } from "../schema/submission.schema";
import { SubmissionRepository, ProblemRepository } from "@algofight/database";
import { SubmissionStatus } from "@algofight/types";
import { EvaluationService, SandboxExecutor, WorkloadClassifier, RuntimePoolManager, PistonAdapter } from "@algofight/application";
import { logger } from "@algofight/logger";

export class SubmissionController {
    private readonly sandboxExecutor = new SandboxExecutor();
    private readonly pistonAdapter = new PistonAdapter();

    constructor(
        private readonly submissionRepository: SubmissionRepository,
        private readonly problemRepository: ProblemRepository,
    ) { }

    async submit(body: SubmissionInput, authenticatedUserId: string) {
        const problem = await this.problemRepository.getProblemById(body.problemId);
        if (!problem) {
            throw new ProblemNotFoundError(body.problemId);
        }

        // 🔐 Bind author strictly to authenticated session
        const submission = await this.submissionRepository.createSubmission({
            userId: authenticatedUserId,
            problemId: body.problemId,
            roomId: body.roomId,
            language: body.language,
            code: body.code,
        });

        // 🛡️ AF-002: Transition state to QUEUED *before* enqueuing into BullMQ
        await this.submissionRepository.updateStatus(
            submission.id,
            SubmissionStatus.QUEUED,
        );

        // 1. Workload Classification (LIGHT vs HEAVY)
        const workload = WorkloadClassifier.classify({
            language: body.language,
            sourceCode: body.code,
            timeLimitMs: problem.timeLimit,
            memoryLimitBytes: problem.memoryLimit,
        });

        // 2. Intelligent Runtime Routing Strategy (or explicit REST API override)
        let targetRuntimeUrl: string;
        if (body.targetRuntimeUrl) {
            targetRuntimeUrl = body.targetRuntimeUrl;
        } else if (body.runtimePort) {
            targetRuntimeUrl = `http://localhost:${body.runtimePort}`;
        } else {
            targetRuntimeUrl = await RuntimePoolManager.getInstance().routeSubmission({
                submissionId: submission.id,
                language: body.language,
                sourceCode: body.code,
                workload,
                isLiveBattle: !!body.roomId,
                priority: body.roomId ? "HIGH" : "NORMAL",
            });
        }

        try {
            await enqueueSubmissionJob({
                submissionId: submission.id,
                mode: "SUBMIT",
                workload,
                targetRuntimeUrl,
                priority: body.roomId ? "HIGH" : "NORMAL",
                language: body.language,
                userId: authenticatedUserId,
                problemId: body.problemId,
            });
        } catch (enqueueError: any) {
            logger.error({ error: enqueueError.message, submissionId: submission.id }, "Failed to enqueue submission to BullMQ");
            await this.submissionRepository.updateStatus(
                submission.id,
                SubmissionStatus.FINALIZED,
            ).catch(() => {});
            throw new Error(`Failed to enqueue submission: ${enqueueError.message}`);
        }

        return submission;
    }

    async evaluatePractice(body: PracticeEvaluateInput) {
        const problem = body.mode === "test"
            ? await this.problemRepository.getProblemById(body.problemId)
            : await this.problemRepository.getProblemWithAllTestCases(body.problemId);

        if (!problem) throw new ProblemNotFoundError(body.problemId);

        const testCases = problem.testCases || [];
        if (testCases.length === 0) {
            return {
                passed: false,
                output: "This problem has no test cases available to judge against yet.",
                passedTestCases: 0,
                totalTestCases: 0,
                executionTime: 0,
                verdict: "INTERNAL_ERROR",
                testCaseResults: [],
            };
        }

        let targetRuntimeUrl = body.targetRuntimeUrl;
        if (!targetRuntimeUrl && body.runtimePort) {
            targetRuntimeUrl = `http://localhost:${body.runtimePort}`;
        }

        try {
            const result = await this.sandboxExecutor.execute({
                submissionId: `practice-${Date.now()}`,
                language: body.language,
                code: body.code,
                testCases: testCases.map((tc) => ({
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                })),
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit,
                targetRuntimeUrl,
            });

            const passed = result.failedCount === 0;

            return {
                passed,
                output: result.stdout || (passed ? "All test cases passed successfully!" : result.stderr || "Output mismatch."),
                passedTestCases: result.passedCount,
                totalTestCases: result.passedCount + result.failedCount,
                executionTime: result.executionTime,
                verdict: result.verdict || (passed ? "ACCEPTED" : "WRONG_ANSWER"),
                testCaseResults: result.individualExecutions || [],
            };
        } catch (err: any) {
            return {
                passed: false,
                output: `Execution error: ${err.message || "Failed to evaluate code"}`,
                passedTestCases: 0,
                totalTestCases: testCases.length,
                executionTime: 0,
                verdict: "SYSTEM_ERROR",
                testCaseResults: [],
            };
        }
    }

    async getAllSubmission(requestingUserId?: string) {
        const submissions = await this.submissionRepository.getAllSubmission();
        
        // 🔐 Public DTO Projection: Strip private source code and internal stderr
        return submissions.map(s => ({
            id: s.id,
            userId: s.userId,
            problemId: s.problemId,
            language: s.language,
            status: s.status,
            executionTime: s.executionTime,
            createdAt: s.createdAt,
            // Only include source code if requesting user owns it
            code: requestingUserId && s.userId === requestingUserId ? s.code : undefined,
        }));
    }

    async getSubmissionById(submissionId: string, requestingUserId?: string, userRole?: string) {
        const submission = await this.submissionRepository.getSubmissionById(submissionId);
        if (!submission) return null;

        const isOwner = requestingUserId && submission.userId === requestingUserId;
        const isAdmin = userRole === "ADMIN";

        // 🔐 If owner or admin, return full source code and execution data
        if (isOwner || isAdmin) {
            return submission;
        }

        // 🔐 Otherwise return sanitized public summary DTO
        return {
            id: submission.id,
            userId: submission.userId,
            problemId: submission.problemId,
            language: submission.language,
            status: submission.status,
            executionTime: submission.executionTime,
            createdAt: submission.createdAt,
        };
    }

    async test(body: TestRunInput) {
        let targetRuntimeUrl = body.targetRuntimeUrl;
        if (!targetRuntimeUrl && body.runtimePort) {
            targetRuntimeUrl = `http://localhost:${body.runtimePort}`;
        }

        const evaluationService = new EvaluationService();
        const result = await evaluationService.evaluateSubmission({
            submissionId: "test-run",
            language: body.language,
            code: body.code,
            testCases: body.testCases as any,
            timeLimitMs: 2000,
            memoryLimitBytes: 256 * 1024 * 1024,
            targetRuntimeUrl,
        } as any, () => { }, "SAMPLE");
        return result;
    }

    /**
     * Direct Code Execution across any active Piston container (prewarmed baseline or dynamic extended).
     * Bypasses the queue for immediate synchronous REST response.
     */
    async executeDirect(body: ExecuteDirectInput) {
        const poolManager = RuntimePoolManager.getInstance();
        let targetRuntimeUrl = body.targetRuntimeUrl;
        if (!targetRuntimeUrl && body.runtimePort) {
            targetRuntimeUrl = `http://localhost:${body.runtimePort}`;
        }

        let allocatedSlot = false;
        if (!targetRuntimeUrl) {
            targetRuntimeUrl = await poolManager.routeSubmission({
                submissionId: `direct-${Date.now()}`,
                language: body.language,
                sourceCode: body.code,
                workload: body.code.length > 8192 ? "HEAVY" : "LIGHT",
            });
            allocatedSlot = true;
        }

        const startTime = Date.now();
        try {
            const result = await this.pistonAdapter.executeCode(
                body.language,
                body.code,
                body.stdin || "",
                body.timeLimitMs || 3000,
                body.memoryLimitBytes || 256 * 1024 * 1024,
                targetRuntimeUrl
            );
            const totalTime = Date.now() - startTime;

            const runtimeInstance = poolManager.getRuntime(targetRuntimeUrl);
            const port = runtimeInstance?.port || (targetRuntimeUrl.includes(":") ? parseInt(targetRuntimeUrl.split(":").pop()!, 10) : undefined);

            return {
                success: true,
                targetRuntime: {
                    url: targetRuntimeUrl,
                    port,
                    id: runtimeInstance?.id || `piston-port-${port}`,
                    type: runtimeInstance?.isBaseline ? "PREWARMED_BASELINE" : "EXTENDED_EPHEMERAL",
                    status: runtimeInstance?.status || "HEALTHY",
                },
                executionTimeMs: totalTime,
                compile: result.compile,
                run: result.run,
            };
        } finally {
            if (allocatedSlot && targetRuntimeUrl) {
                await poolManager.releaseExecutionSlot(targetRuntimeUrl).catch(() => {});
            }
        }
    }

    /**
     * Retrieves real-time status and live health probes for all active prewarmed and extended runtimes.
     */
    async getRuntimePoolStatus() {
        const poolManager = RuntimePoolManager.getInstance();
        const runtimesWithHealth = await poolManager.probeAllRuntimes();
        const snapshot = poolManager.getSnapshot();

        return {
            activeCount: snapshot.activeCount,
            scalingState: snapshot.scalingState,
            cooldownRemainingSeconds: snapshot.cooldownRemainingSeconds,
            runtimes: runtimesWithHealth.map((r) => ({
                id: r.id,
                port: r.port,
                url: r.url,
                status: r.status,
                type: r.isBaseline ? "PREWARMED_BASELINE" : "EXTENDED_EPHEMERAL",
                isBaseline: r.isBaseline,
                activeJobs: r.activeJobs,
                reachable: r.reachable,
                latencyMs: r.latencyMs,
                createdAt: r.createdAt,
            })),
        };
    }
}
