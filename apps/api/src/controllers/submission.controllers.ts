import { ProblemNotFoundError } from "@algofight/error-handling";
import { enqueueSubmissionJob } from "@algofight/queue";
import { SubmissionInput, TestRunInput, PracticeEvaluateInput, ExecuteDirectInput } from "../schema/submission.schema";
import { SubmissionRepository, ProblemRepository } from "@algofight/database";
import { SubmissionStatus } from "@algofight/types";
import { EvaluationService, SandboxExecutor, WorkloadClassifier, RuntimePoolManager, PistonAdapter } from "@algofight/application";
import { logger } from "@algofight/logger";
import { auditService } from "../services/audit.service";

export class SubmissionController {
    private readonly sandboxExecutor = new SandboxExecutor();
    private readonly evaluationService = new EvaluationService();
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
        const memoryLimitBytes = (problem.memoryLimit || 256) * 1024 * 1024;
        const workload = WorkloadClassifier.classify({
            language: body.language,
            sourceCode: body.code,
            timeLimitMs: problem.timeLimit,
            memoryLimitBytes,
        });

        // 2. Intelligent Runtime Routing Strategy (or explicit allowlisted REST override)
        let targetRuntimeUrl: string;
        if (body.targetRuntimeUrl && this.isSafeRuntimeTarget(body.targetRuntimeUrl)) {
            targetRuntimeUrl = body.targetRuntimeUrl;
        } else if (body.runtimePort && process.env.NODE_ENV !== "production") {
            const pistonHost = (process.env.PISTON_HOST || "localhost").trim();
            targetRuntimeUrl = `http://${pistonHost}:${body.runtimePort}`;
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

    async evaluatePractice(body: PracticeEvaluateInput, userId?: string) {
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

        let targetRuntimeUrl: string | undefined = undefined;
        if (body.targetRuntimeUrl && this.isSafeRuntimeTarget(body.targetRuntimeUrl)) {
            targetRuntimeUrl = body.targetRuntimeUrl;
        } else if (body.runtimePort && body.runtimePort > 0 && body.runtimePort < 65536 && process.env.NODE_ENV !== "production") {
            const pistonHost = (process.env.PISTON_HOST || "localhost").trim();
            targetRuntimeUrl = `http://${pistonHost}:${body.runtimePort}`;
        }

        try {
            const evalResult = await this.evaluationService.evaluateSubmission({
                submissionId: `practice-${Date.now()}`,
                language: body.language,
                code: body.code,
                testCases: testCases.map((tc, i) => ({
                    id: tc.id || `tc-${i + 1}`,
                    input: tc.input,
                    expectedOutput: tc.expectedOutput,
                })),
                timeLimitMs: problem.timeLimit,
                memoryLimitBytes: (problem.memoryLimit || 256) * 1024 * 1024,
                targetRuntimeUrl,
            } as any, undefined, body.mode === "submit" ? "SUBMIT" : "SAMPLE");

            const tcs = evalResult.testCases || [];
            const passed = evalResult.verdict === "ACCEPTED";
            const passedCount = tcs.filter((tc: any) => tc.passed).length;
            const totalCount = tcs.length;

            const firstFailed = tcs.find((tc: any) => !tc.passed);
            const activeError = evalResult.error || firstFailed?.structuredError || null;

            // Log structured server-side diagnostic entry
            logger.info({
                submissionId: evalResult.submissionId,
                problemId: body.problemId,
                language: body.language,
                status: evalResult.verdict,
                errorType: activeError?.type || (passed ? null : "UNKNOWN_ERROR"),
                line: activeError?.line || null,
                column: activeError?.column || null,
                executionTime: evalResult.resourceUsage?.totalTime || 0,
                timestamp: new Date().toISOString(),
            }, "Practice execution completed");

            const sanitizedTestCaseResults = tcs.map((tc: any, idx: number) => {
                const realActual = tc.actualOutput !== undefined ? tc.actualOutput : (tc.metrics?.stdout ?? "");
                const realInput = body.mode === "submit" && !tc.passed ? undefined : (testCases[idx]?.input || tc.input || "");
                const realExpected = body.mode === "submit" && !tc.passed ? undefined : (tc.expectedOutput || testCases[idx]?.expectedOutput || "");
                return {
                    testCaseId: tc.testCaseId,
                    passed: tc.passed,
                    input: realInput,
                    expectedOutput: realExpected,
                    actualOutput: realActual,
                    error: tc.error,
                    structuredError: tc.structuredError || null,
                    metrics: tc.metrics,
                };
            });

            let rewardInfo: { awardedPoints: number; reason: string } | undefined;

            if (passed && body.mode === "submit" && userId) {
                try {
                    const { PointLedgerService } = await import("@algofight/application");
                    const { ProblemRewardService } = await import("@algofight/application");
                    const { ConsistencyRewardService } = await import("@algofight/application");
                    const { AchievementRewardService } = await import("@algofight/application");

                    const ledger = new PointLedgerService();
                    const problemReward = new ProblemRewardService(ledger);
                    const consistency = new ConsistencyRewardService(ledger);
                    const achievements = new AchievementRewardService(ledger);

                    rewardInfo = await problemReward.processProblemSolve({
                        userId,
                        problemId: body.problemId,
                        submissionId: evalResult.submissionId,
                        difficulty: problem.difficulty || "EASY",
                        verdict: evalResult.verdict,
                    });

                    await consistency.recordActiveDay(userId, "ACCEPTED_PROBLEM");
                    await achievements.checkAndUnlockAchievements(userId);
                } catch (rErr) {
                    logger.error({ error: (rErr as any)?.message, userId, problemId: body.problemId }, "Failed to process problem rewards");
                }
            }

            try {
                const isInternalErr = (evalResult.verdict as any) === "INTERNAL_ERROR" || (evalResult.verdict as any) === "SYSTEM_ERROR";
                auditService.recordEvent({
                    category: "SUBMISSION",
                    severity: passed ? "INFO" : isInternalErr ? "ERROR" : "WARN",
                    action: body.mode === "submit" ? "PRACTICE_SUBMISSION_EVALUATED" : "PRACTICE_RUN_EVALUATED",
                    actor: userId || "Combatant",
                    method: "POST",
                    details: `[${evalResult.verdict}] ${problem.title || body.problemId} | ${body.language.toUpperCase()} | ${passedCount}/${totalCount} tests passed (${evalResult.resourceUsage?.totalTime || 0}ms)`,
                    metadata: {
                        problemId: body.problemId,
                        problemTitle: problem.title,
                        difficulty: problem.difficulty,
                        language: body.language,
                        verdict: evalResult.verdict,
                        passed,
                        passedTestCases: passedCount,
                        totalTestCases: totalCount,
                        executionTimeMs: evalResult.resourceUsage?.totalTime,
                        memoryUsageBytes: evalResult.resourceUsage?.maxMemory,
                        error: activeError?.message || activeError?.type || null,
                        mode: body.mode,
                    },
                });
            } catch {}

            return {
                passed,
                output: passed 
                    ? "All test cases passed successfully!" 
                    : (evalResult.compilation?.error || evalResult.compilation?.output || activeError?.rawMessage || activeError?.message || firstFailed?.error || "Output mismatch."),
                passedTestCases: passedCount,
                totalTestCases: totalCount,
                executionTime: evalResult.resourceUsage?.totalTime || 0,
                memoryUsage: evalResult.resourceUsage?.maxMemory || 0,
                verdict: evalResult.verdict,
                error: activeError,
                structuredError: activeError,
                compilation: evalResult.compilation || null,
                testCaseResults: sanitizedTestCaseResults,
                reward: rewardInfo,
            };
        } catch (err: any) {
            logger.error({ error: err.message, problemId: body.problemId }, "Practice evaluation exception");
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
        const poolManager = RuntimePoolManager.getInstance();
        let targetRuntimeUrl: string | undefined = undefined;
        if (body.targetRuntimeUrl && this.isSafeRuntimeTarget(body.targetRuntimeUrl)) {
            targetRuntimeUrl = body.targetRuntimeUrl;
        } else if (body.runtimePort && body.runtimePort > 0 && body.runtimePort < 65536 && process.env.NODE_ENV !== "production") {
            const pistonHost = (process.env.PISTON_HOST || "localhost").trim();
            targetRuntimeUrl = `http://${pistonHost}:${body.runtimePort}`;
        }

        let allocatedSlot = false;
        if (!targetRuntimeUrl) {
            targetRuntimeUrl = await poolManager.routeSubmission({
                submissionId: `test-${Date.now()}`,
                language: body.language,
                sourceCode: body.code,
                workload: body.code.length > 8192 ? "HEAVY" : "LIGHT",
            });
            allocatedSlot = true;
        }

        try {
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
        } finally {
            if (allocatedSlot && targetRuntimeUrl) {
                await poolManager.releaseExecutionSlot(targetRuntimeUrl).catch(() => {});
            }
        }
    }

    /**
     * Direct Code Execution across any active Piston container (prewarmed baseline or dynamic extended).
     * Bypasses the queue for immediate synchronous REST response.
     */
    async executeDirect(body: ExecuteDirectInput) {
        const poolManager = RuntimePoolManager.getInstance();
        let targetRuntimeUrl: string | undefined = undefined;
        if (body.targetRuntimeUrl && this.isSafeRuntimeTarget(body.targetRuntimeUrl)) {
            targetRuntimeUrl = body.targetRuntimeUrl;
        } else if (body.runtimePort && body.runtimePort > 0 && body.runtimePort < 65536 && process.env.NODE_ENV !== "production") {
            const pistonHost = (process.env.PISTON_HOST || "localhost").trim();
            targetRuntimeUrl = `http://${pistonHost}:${body.runtimePort}`;
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

            try {
                const exitCode = result.run?.code ?? (result.compile?.success ? 0 : 1);
                const isErr = !result.run?.success || !result.compile?.success || Boolean(result.run?.stderr || result.compile?.error);
                auditService.recordEvent({
                    category: "SUBMISSION",
                    severity: !isErr ? "INFO" : "WARN",
                    action: "CODE_EXECUTE_DIRECT",
                    actor: "Combatant",
                    method: "POST",
                    details: `Direct execution: ${body.language.toUpperCase()} | Exit: ${exitCode} | Time: ${totalTime}ms | Piston: ${targetRuntimeUrl}`,
                    metadata: {
                        language: body.language,
                        exitCode,
                        executionTimeMs: totalTime,
                        runtimeUrl: targetRuntimeUrl,
                        isTimeout: result.run?.isTimeout || result.run?.signal === "SIGKILL" || false,
                    },
                });
            } catch {}

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

    /**
     * Security Guard: Validates that an explicit runtime target is strictly within the approved Piston cluster allowlist.
     * Prevents SSRF / internal network port scanning.
     */
    private isSafeRuntimeTarget(url?: string): boolean {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            const allowedHosts = ["piston-1", "piston-2", "localhost", "127.0.0.1"];
            return (
                allowedHosts.includes(hostname) ||
                hostname.startsWith("algofight-piston") ||
                hostname.startsWith("piston-")
            );
        } catch {
            return false;
        }
    }
}
