import { ExecuteRequest, PipelineProgressEvent } from "../models/execute-request";
import { EvaluationResult, TestCaseResult, Verdict } from "@algofight/types";
import { WorkerPool } from "./worker-pool";
import { PistonAdapter } from "../../services/piston.adapter";

export type PipelineEventCallback = (event: PipelineProgressEvent) => void;

export class ExecutionPipeline {
    private pistonAdapter = new PistonAdapter();
    private workerPool = new WorkerPool(4); // Bounded concurrency limit

    async execute(request: ExecuteRequest, onProgress?: PipelineEventCallback): Promise<EvaluationResult> {
        const { submissionId, language, code, testCases, timeLimitMs, memoryLimitBytes, mode, targetRuntimeUrl } = request;
        
        onProgress?.({ submissionId, stage: "PREPARE" });

        // Phase 1: Compile/First Run (used for compilation check)
        onProgress?.({ submissionId, stage: "COMPILE" });
        
        if (testCases.length === 0) {
            return {
                submissionId,
                verdict: Verdict.SYSTEM_ERROR,
                resourceUsage: { maxMemory: 0, totalTime: 0 }
            };
        }

        const firstTestCase = testCases[0];
        const firstExecution = await this.pistonAdapter.executeCode(
            language,
            code,
            firstTestCase.input,
            timeLimitMs,
            memoryLimitBytes,
            targetRuntimeUrl
        );

        const compilationResult = {
            success: firstExecution.compile.success,
            output: firstExecution.compile.output,
            error: firstExecution.compile.error,
        };

        if (!compilationResult.success) {
            const errorResult: EvaluationResult = {
                submissionId,
                verdict: Verdict.COMPILATION_ERROR,
                compilation: compilationResult,
                testCases: [],
                resourceUsage: { maxMemory: 0, totalTime: 0 }
            };
            onProgress?.({ 
                submissionId, 
                stage: "FINISHED", 
                compilationResult 
            });
            return errorResult;
        }

        onProgress?.({ submissionId, stage: "TEST_STARTED" });

        // Phase 2: Fan-out test cases with bounded worker pool
        let overallVerdict = Verdict.ACCEPTED;
        let maxMemory = 0;
        let totalTime = 0;
        let passedCount = 0;
        
        const testCaseResults: TestCaseResult[] = [];
        const executionPromises = testCases.map(async (testCase, index) => {
            return this.workerPool.add(async () => {
                let execution = firstExecution;
                // Don't re-run the first test case unless it was just compilation
                if (index !== 0) {
                    execution = await this.pistonAdapter.executeCode(
                        language,
                        code,
                        testCase.input,
                        timeLimitMs,
                        memoryLimitBytes,
                        targetRuntimeUrl
                    );
                }

                const { run } = execution;
                let status = Verdict.ACCEPTED;
                let currentError = undefined;
                let passed = false;

                if (run.isTimeout) {
                    status = Verdict.TIME_LIMIT_EXCEEDED;
                    currentError = "Time Limit Exceeded";
                } else if (run.isMemoryLimit) {
                    status = Verdict.MEMORY_LIMIT_EXCEEDED;
                    currentError = "Memory Limit Exceeded";
                } else if (run.isRuntimeError || !run.success) {
                    status = Verdict.RUNTIME_ERROR;
                    currentError = run.stderr || "Runtime Error";
                } else {
                    const actual = run.stdout.trim();
                    const expected = testCase.expectedOutput.trim();
                    if (actual === expected) {
                        passed = true;
                        status = Verdict.ACCEPTED;
                    } else {
                        passed = false;
                        status = Verdict.WRONG_ANSWER;
                        currentError = "Wrong Answer";
                    }
                }

                const result: TestCaseResult = {
                    testCaseId: testCase.id,
                    status,
                    passed,
                    // Hide sensitive data if in SUBMIT mode
                    expectedOutput: mode === "SAMPLE" ? testCase.expectedOutput : undefined,
                    actualOutput: mode === "SAMPLE" ? run.stdout : undefined,
                    error: currentError,
                    metrics: { 
                        executionTime: run.timeMs || 0, 
                        memoryUsage: run.memoryBytes || 0, 
                        exitCode: run.code, 
                        signal: run.signal, 
                        stdout: mode === "SAMPLE" ? run.stdout : undefined, 
                        stderr: mode === "SAMPLE" ? run.stderr : undefined 
                    }
                };

                return { index, result };
            });
        });

        // Fan-in: wait for all to complete but process results as they come in via the Promise map
        const resolvedResults = await Promise.all(executionPromises.map(async p => {
            const res = await p;
            
            // Streaming event per test case completion
            maxMemory = Math.max(maxMemory, res.result.metrics?.memoryUsage || 0);
            totalTime += (res.result.metrics?.executionTime || 0);
            if (res.result.passed) passedCount++;
            
            if (!res.result.passed && overallVerdict === Verdict.ACCEPTED) {
                overallVerdict = res.result.status;
            }

            onProgress?.({ 
                submissionId, 
                stage: "TEST_COMPLETED", 
                testCaseIndex: res.index,
                testCaseResult: res.result,
                metrics: {
                    passed: passedCount,
                    total: testCases.length
                }
            });

            return res;
        }));

        resolvedResults.sort((a, b) => a.index - b.index);
        resolvedResults.forEach(r => testCaseResults.push(r.result));

        const finalResult: EvaluationResult = {
            submissionId,
            verdict: overallVerdict,
            compilation: compilationResult,
            testCases: testCaseResults,
            resourceUsage: { maxMemory, totalTime }
        };

        onProgress?.({ submissionId, stage: "FINISHED", metrics: { passed: passedCount, total: testCases.length } });

        return finalResult;
    }
}
