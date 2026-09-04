import { CodeExecutor, ExecutionPayload } from "../contracts/code-executor";
import { SubmissionResult } from "@algofight/database";
import { JudgeService } from "../judge/services/judge.service";
import { SubmissionStatus, Verdict } from "@algofight/types";
import { logger } from "@algofight/logger";
import { RuntimePoolManager } from "../runtime-pool/runtime-pool.manager";

const PISTON_URL = process.env.PISTON_URL || "http://127.0.0.1:2000";
const MAX_OUTPUT_BYTES = 512 * 1024; // 512 KB Output Limit

type SandboxResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
    signal: string | null;
    timedOut: boolean;
    memoryLimitExceeded: boolean;
    outputLimitExceeded: boolean;
    compilationError: boolean;
    memoryUsed: number;
    cpuTime: number;
};

export class SandboxExecutor implements CodeExecutor {
    private readonly judgeService = new JudgeService();

    async execute(payload: ExecutionPayload): Promise<SubmissionResult> {
        const startTime = Date.now();
        const {
            submissionId,
            language,
            code,
            testCases,
            timeLimit = 2000,
            memoryLimit = 256, // In MB
        } = payload;

        const memoryLimitBytes = memoryLimit * 1024 * 1024;

        logger.info(
            {
                submissionId,
                language,
                testCasesCount: testCases.length,
                timeLimitMs: timeLimit,
                memoryLimitMb: memoryLimit,
            },
            "Dispatching code to hardened Piston sandbox",
        );

        let targetRuntimeUrl = payload.targetRuntimeUrl;
        if (!targetRuntimeUrl && payload.runtimePort) {
            targetRuntimeUrl = `http://localhost:${payload.runtimePort}`;
        }
        let dynamicallyAllocated = false;
        if (!targetRuntimeUrl) {
            try {
                targetRuntimeUrl = await RuntimePoolManager.getInstance().routeSubmission({
                    submissionId: payload.submissionId,
                    language: payload.language,
                    sourceCode: payload.code,
                    workload: payload.code.length > 8192 ? "HEAVY" : "LIGHT",
                });
                dynamicallyAllocated = true;
            } catch {
                targetRuntimeUrl = PISTON_URL;
            }
        }

        const individualExecutions: any[] = [];
        const judgeInputs: any[] = [];
        let combinedStdout = "";
        let combinedStderr: string | null = null;
        let anyError = false;
        let peakMemoryUsed = 0;

        // Bounded parallel execution: execute in concurrency chunks of 3
        const CONCURRENCY = 3;
        let shortCircuit = false;

        try {
            for (let i = 0; i < testCases.length; i += CONCURRENCY) {
                if (shortCircuit) break;

                const chunk = testCases.slice(i, i + CONCURRENCY);
                const chunkPromises = chunk.map(async (tc, chunkIdx) => {
                    const globalIdx = i + chunkIdx;
                    const tcStart = Date.now();

                    const res = await this.executeInSandbox(
                        language,
                        code,
                        tc.input,
                        timeLimit,
                        memoryLimitBytes,
                        targetRuntimeUrl,
                    );

                    const tcTime = Math.max(res.cpuTime || 1, Date.now() - tcStart);
                    return { globalIdx, tc, res, tcTime };
                });

                const chunkResults = await Promise.all(chunkPromises);

                for (const item of chunkResults) {
                    const { globalIdx, tc, res, tcTime } = item;

                    if (globalIdx === 0) {
                        combinedStdout = res.stdout;
                    }
                    if (res.stderr && !combinedStderr) {
                        combinedStderr = res.stderr;
                    }

                    if (res.memoryUsed > peakMemoryUsed) {
                        peakMemoryUsed = res.memoryUsed;
                    }

                    if (res.exitCode !== 0 || res.timedOut || res.memoryLimitExceeded || res.outputLimitExceeded || res.compilationError) {
                        anyError = true;
                    }

                    // Short-circuit on compilation error (no need to run remaining tests)
                    if (res.compilationError) {
                        shortCircuit = true;
                    }

                    const isMatch =
                        res.exitCode === 0 &&
                        !res.timedOut &&
                        !res.memoryLimitExceeded &&
                        !res.outputLimitExceeded &&
                        !res.compilationError &&
                        (res.stdout || "").trim() === (tc.expectedOutput || "").trim();

                    let tcVerdict = Verdict.ACCEPTED;
                    if (res.compilationError) tcVerdict = Verdict.COMPILATION_ERROR;
                    else if (res.timedOut) tcVerdict = Verdict.TIME_LIMIT_EXCEEDED;
                    else if (res.outputLimitExceeded) tcVerdict = Verdict.OUTPUT_LIMIT_EXCEEDED;
                    else if (res.memoryLimitExceeded) tcVerdict = Verdict.MEMORY_LIMIT_EXCEEDED;
                    else if (res.exitCode !== 0) tcVerdict = Verdict.RUNTIME_ERROR;
                    else if (!isMatch) tcVerdict = Verdict.WRONG_ANSWER;

                    judgeInputs.push({
                        testcaseId: `tc-${globalIdx + 1}`,
                        expectedOutput: tc.expectedOutput,
                        actualOutput: res.exitCode === 0 && !res.timedOut && !res.compilationError ? res.stdout : "",
                        executionTime: tcTime,
                        memoryUsed: res.memoryUsed,
                        exitCode: res.exitCode,
                        timeLimitExceededError: res.timedOut,
                        memoryLimitExceededError: res.memoryLimitExceeded,
                        outputLimitExceededError: res.outputLimitExceeded,
                        runtimeError: res.exitCode !== 0 && !res.timedOut && !res.memoryLimitExceeded && !res.outputLimitExceeded && !res.compilationError,
                        compilationError: res.compilationError,
                    });

                    individualExecutions.push({
                        testCaseId: `tc-${globalIdx + 1}`,
                        input: tc.input,
                        expectedOutput: tc.expectedOutput,
                        actualOutput: res.stdout,
                        passed: isMatch,
                        verdict: tcVerdict,
                        executionTime: tcTime,
                        memoryUsage: res.memoryUsed,
                        error: res.stderr || (res.timedOut ? "Time Limit Exceeded" : res.outputLimitExceeded ? "Output Limit Exceeded" : res.memoryLimitExceeded ? "Memory Limit Exceeded" : !isMatch ? "Wrong Answer" : undefined),
                    });
                }
            }
        } finally {
            if (dynamicallyAllocated && targetRuntimeUrl) {
                await RuntimePoolManager.getInstance().releaseExecutionSlot(targetRuntimeUrl).catch(() => {});
            }
        }

        const judgeResult = this.judgeService.judge({
            testcases: judgeInputs,
        });

        const totalExecutionTime = Date.now() - startTime;
        const isAccepted = judgeResult.verdict === Verdict.ACCEPTED;

        logger.info(
            {
                submissionId,
                verdict: judgeResult.verdict,
                passed: judgeResult.passedCount,
                total: testCases.length,
                peakMemoryBytes: peakMemoryUsed,
                targetRuntimeUrl,
            },
            "Hardened sandbox judging completed",
        );

        return {
            stdout:
                combinedStdout ||
                (isAccepted ? "All test cases passed successfully!" : "Output mismatch on testcase."),
            stderr: combinedStderr,
            executionTime: totalExecutionTime,
            exitCode: anyError ? 1 : 0,
            status: SubmissionStatus.FINALIZED,
            passedCount: judgeResult.passedCount,
            failedCount: judgeResult.failedCount,
            verdict: judgeResult.verdict,
            memoryUsage: peakMemoryUsed,
            individualExecutions: individualExecutions as any,
        };
    }

    private async executeInSandbox(
        language: string,
        code: string,
        stdinInput: string,
        timeoutMs: number,
        memoryLimitBytes: number,
        targetRuntimeUrl?: string,
    ): Promise<SandboxResult> {
        const langMap: Record<string, string> = {
            javascript: "javascript",
            js: "javascript",
            typescript: "typescript",
            ts: "typescript",
            python: "python",
            py: "python",
            python3: "python",
            cpp: "c++",
            "c++": "c++",
            c: "c",
            java: "java",
        };

        const targetLang = langMap[language.toLowerCase()];
        if (!targetLang) {
            throw new Error(`Unsupported language: ${language}`);
        }

        const wrappedCode = this.wrapCodeForLanguage(targetLang, code);

        const requestBody = {
            language: targetLang,
            version: "*",
            files: [
                {
                    content: wrappedCode,
                },
            ],
            stdin: stdinInput,
            run_timeout: timeoutMs,
            compile_timeout: 10000,
            run_memory_limit: memoryLimitBytes,
        };

        const baseUrl = targetRuntimeUrl || PISTON_URL;

        try {
            const res = await fetch(`${baseUrl}/api/v2/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(timeoutMs + 3000),
            });

            if (!res.ok) {
                const errorText = await res.text().catch(() => "");
                throw new Error(`Sandbox service error (${res.status}): ${errorText}`);
            }

            const data = (await res.json()) as any;

            // 1. Check Compilation Failure
            if (data.compile && (data.compile.code !== 0 || data.compile.status)) {
                return {
                    stdout: "",
                    stderr: (data.compile.message || data.compile.stderr || data.compile.output || "Compilation error").trim(),
                    exitCode: data.compile.code || 1,
                    signal: data.compile.signal || null,
                    timedOut: data.compile.status === "TO",
                    memoryLimitExceeded: data.compile.status === "MLE",
                    outputLimitExceeded: false,
                    compilationError: true,
                    memoryUsed: data.compile.memory || 0,
                    cpuTime: 0,
                };
            }

            const run = data.run || {};
            let stdout = (run.stdout || "").trim();
            let stderr = (run.stderr || "").trim();
            let outputTruncated = false;

            // 2. Enforce Output Capping (OLE)
            if (stdout.length > MAX_OUTPUT_BYTES || stderr.length > MAX_OUTPUT_BYTES) {
                stdout = stdout.slice(0, MAX_OUTPUT_BYTES);
                stderr = stderr.slice(0, MAX_OUTPUT_BYTES) + "\n[Output limit exceeded. Truncated.]";
                outputTruncated = true;
            }

            const timedOut = run.status === "TO" || run.signal === "SIGXCPU";
            const memoryLimitExceeded = run.status === "MLE" || (run.signal === "SIGKILL" && !timedOut);
            const outputLimitExceeded = outputTruncated || run.status === "OLE";

            return {
                stdout,
                stderr,
                exitCode: run.code ?? (timedOut || memoryLimitExceeded || outputLimitExceeded ? 1 : 0),
                signal: run.signal || null,
                timedOut,
                memoryLimitExceeded,
                outputLimitExceeded,
                compilationError: false,
                memoryUsed: Number(run.memory || 0),
                cpuTime: Number(run.cpu_time || 0),
            };
        } catch (err: any) {
            logger.warn(
                { error: err.message, PISTON_URL, language: targetLang },
                "Piston sandbox unreachable, attempting in-process isolated runner fallback",
            );

            // In-process fallback for JavaScript / TypeScript
            if (targetLang === "javascript" || targetLang === "typescript") {
                return this.runLocalVm(wrappedCode, stdinInput, timeoutMs);
            }

            return {
                stdout: "",
                stderr: `Sandbox execution engine for ${targetLang} is unavailable (${err.message}). Please check PISTON_URL or select JavaScript.`,
                exitCode: 1,
                signal: null,
                timedOut: false,
                memoryLimitExceeded: false,
                outputLimitExceeded: false,
                compilationError: false,
                memoryUsed: 0,
                cpuTime: 0,
            };
        }
    }

    private runLocalVm(code: string, stdinInput: string, timeoutMs: number): SandboxResult {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        const customConsole = {
            log: (...args: any[]) => {
                stdoutBuffer += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
            },
            error: (...args: any[]) => {
                stderrBuffer += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
            },
            warn: (...args: any[]) => {
                stderrBuffer += args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ") + "\n";
            },
        };

        const customFs = {
            readFileSync: (_fd: any, _enc?: string) => stdinInput,
        };

        const sandbox = {
            console: customConsole,
            require: (mod: string) => {
                if (mod === "fs") return customFs;
                return {};
            },
            Buffer,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            process: {
                stdin: {
                    read: () => stdinInput,
                },
                stdout: {
                    write: (chunk: string) => {
                        stdoutBuffer += chunk;
                    },
                },
                stderr: {
                    write: (chunk: string) => {
                        stderrBuffer += chunk;
                    },
                },
            },
        };

        const start = Date.now();
        try {
            const vm = require("vm");
            const context = vm.createContext(sandbox);
            const script = new vm.Script(code);
            script.runInContext(context, { timeout: timeoutMs });
            const cpuTime = Date.now() - start;

            let stdout = stdoutBuffer.trim();
            let stderr = stderrBuffer.trim();

            if (stdout.length > MAX_OUTPUT_BYTES) {
                stdout = stdout.slice(0, MAX_OUTPUT_BYTES);
            }

            return {
                stdout,
                stderr,
                exitCode: 0,
                signal: null,
                timedOut: false,
                memoryLimitExceeded: false,
                outputLimitExceeded: false,
                compilationError: false,
                memoryUsed: 12 * 1024 * 1024,
                cpuTime,
            };
        } catch (err: any) {
            const timedOut = err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT";
            return {
                stdout: stdoutBuffer.trim(),
                stderr: (stderrBuffer + "\n" + (timedOut ? "Time Limit Exceeded" : err.message)).trim(),
                exitCode: 1,
                signal: timedOut ? "SIGXCPU" : null,
                timedOut,
                memoryLimitExceeded: false,
                outputLimitExceeded: false,
                compilationError: false,
                memoryUsed: 12 * 1024 * 1024,
                cpuTime: Date.now() - start,
            };
        }
    }

    private wrapCodeForLanguage(language: string, rawCode: string): string {
        switch (language) {
            case "javascript":
            case "typescript":
                return `
const fs = require("fs");
const input = fs.readFileSync(0, "utf-8");

${rawCode}

if (typeof solution === "function") {
    const raw = input.trim();
    const lines = raw.split("\\n").map(l => l.trim()).filter(Boolean);
    let res;
    if (lines.length > 1) {
        const args = lines.map(l => {
            try { return JSON.parse(l); } catch { return l.includes(" ") ? l.split(" ").map(Number) : l; }
        });
        res = solution(...args);
    } else if (raw.includes(" ")) {
        const nums = raw.split(" ").map(n => isNaN(Number(n)) ? n : Number(n));
        res = solution(...nums);
    } else {
        let single = raw;
        try { single = JSON.parse(raw); } catch {}
        res = solution(single);
    }
    if (res !== undefined) {
        console.log(typeof res === "object" ? JSON.stringify(res) : res);
    }
}
`;
            case "python":
                return `
import sys, json

${rawCode}

if __name__ == '__main__':
    raw_input = sys.stdin.read().strip()
    if 'solution' in globals() and callable(globals()['solution']):
        lines = [l.strip() for l in raw_input.split('\\n') if l.strip()]
        if len(lines) > 1:
            parsed_args = []
            for l in lines:
                try: parsed_args.append(json.loads(l))
                except: parsed_args.append([int(x) if x.isdigit() else x for x in l.split()] if ' ' in l else l)
            res = solution(*parsed_args)
        elif ' ' in raw_input:
            nums = [int(x) if x.lstrip('-').isdigit() else x for x in raw_input.split()]
            res = solution(*nums)
        else:
            try: single = json.loads(raw_input)
            except: single = raw_input
            res = solution(single)
        if res is not None:
            print(json.dumps(res) if isinstance(res, (list, dict)) else res)
`;
            default:
                // For C++, Java, or user code that already has main(), execute as-is
                return rawCode;
        }
    }
}
