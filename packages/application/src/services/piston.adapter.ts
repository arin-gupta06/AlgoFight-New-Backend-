import { Verdict } from "@algofight/types";

// Types matching Piston's API format
interface PistonExecuteRequest {
    language: string;
    version: string;
    files: {
        name?: string;
        content: string;
    }[];
    stdin?: string;
    args?: string[];
    compile_timeout?: number;
    run_timeout?: number;
    compile_memory_limit?: number;
    run_memory_limit?: number;
}

interface PistonStageResult {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    output: string;
    memory?: number;
    message?: string | null;
    status?: string | null;
    cpu_time?: number;
    wall_time?: number;
}

interface PistonExecuteResponse {
    language: string;
    version: string;
    compile?: PistonStageResult;
    run: PistonStageResult;
    message?: string;
}

export interface NormalizedExecutionResult {
    compile: {
        success: boolean;
        output: string;
        error?: string;
    };
    run: {
        success: boolean;
        stdout: string;
        stderr: string;
        code: number | null;
        signal: string | null;
        isTimeout: boolean;
        isMemoryLimit: boolean;
        isRuntimeError: boolean;
        timeMs?: number;
        memoryBytes?: number;
    };
}

export class PistonAdapter {
    private readonly PISTON_URL = process.env.PISTON_URL || "http://127.0.0.1:2001";

    // Maps AlgoFight languages to Piston (language, version)
    private languageMap: Record<string, { language: string; version: string; fileExtension: string }> = {
        javascript: { language: "javascript", version: "*", fileExtension: "js" },
        js: { language: "javascript", version: "*", fileExtension: "js" },
        node: { language: "javascript", version: "*", fileExtension: "js" },
        typescript: { language: "typescript", version: "*", fileExtension: "ts" },
        ts: { language: "typescript", version: "*", fileExtension: "ts" },
        python: { language: "python", version: "*", fileExtension: "py" },
        py: { language: "python", version: "*", fileExtension: "py" },
        python3: { language: "python", version: "*", fileExtension: "py" },
        cpp: { language: "c++", version: "*", fileExtension: "cpp" },
        "c++": { language: "c++", version: "*", fileExtension: "cpp" },
        c: { language: "c", version: "*", fileExtension: "c" },
        java: { language: "java", version: "*", fileExtension: "java" }
    };

    /**
     * Executes the provided code on the Piston engine and normalizes the response.
     */
    async executeCode(
        language: string,
        code: string,
        stdin: string,
        timeLimitMs: number = 3000,
        memoryLimitBytes: number = -1, // Use Piston default if -1
        targetUrl?: string
    ): Promise<NormalizedExecutionResult> {
        const pistonLang = this.languageMap[language.toLowerCase()];
        if (!pistonLang) {
            throw new Error(`Unsupported language: ${language}`);
        }

        const safeRunTimeout = Math.min(Math.max(100, timeLimitMs), 3000);

        const requestBody: PistonExecuteRequest = {
            language: pistonLang.language,
            version: pistonLang.version,
            files: [
                {
                    name: `main.${pistonLang.fileExtension}`,
                    content: code,
                },
            ],
            stdin: stdin,
            run_timeout: safeRunTimeout,
            compile_timeout: 10000,
            run_memory_limit: memoryLimitBytes,
        };

        try {
            const controller = new AbortController();
            // A bit more than Piston's run_timeout to allow network travel
            const id = setTimeout(() => controller.abort(), timeLimitMs + 5000); 

            const endpoint = targetUrl || this.PISTON_URL;
            let url = `${endpoint}/api/v2/execute`;
            if (endpoint === "https://emkc.org") {
                url = `https://emkc.org/api/v2/piston/execute`;
            } else if (endpoint === "https://emkc.org/api/v2/piston" || endpoint.endsWith("/execute") === false) {
                // If it already contains the full path, just append /execute if missing
                url = endpoint.endsWith("/execute") ? endpoint : `${endpoint}/execute`;
                // Fallback for standard local docker which expects /api/v2/execute
                if (!endpoint.includes("emkc") && !endpoint.includes("api/v2")) {
                    url = `${endpoint}/api/v2/execute`;
                }
            }

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(id);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Piston API Error (${response.status}): ${text}`);
            }

            const data: PistonExecuteResponse = await response.json();
            
            // Check if Piston returned an error message
            if (data.message) {
                throw new Error(`Piston Error: ${data.message}`);
            }

            return this.normalizeResponse(data, timeLimitMs, memoryLimitBytes);
        } catch (error: any) {
            if (error.name === "AbortError") {
                // Client side abort, likely a catastrophic timeout
                return this.createErrorResult(Verdict.TIME_LIMIT_EXCEEDED, "Request to execution engine timed out completely.");
            }
            // System-level errors (network down, piston crash)
            throw error;
        }
    }

    private normalizeResponse(
        response: PistonExecuteResponse,
        timeLimitMs: number,
        memoryLimitBytes: number = -1
    ): NormalizedExecutionResult {
        const hasCompile = !!response.compile;
        const compileSuccess = hasCompile ? response.compile!.code === 0 : true;

        const run = response.run;
        const isExplicitTimeout =
            run.status === "TO" ||
            run.signal === "SIGXCPU" ||
            (run.message?.toLowerCase().includes("time limit") ?? false);

        const isMemoryLimit =
            run.status === "MLE" ||
            (run.message?.toLowerCase().includes("memory limit") ?? false) ||
            (!isExplicitTimeout && (
                (run.code === 137 && (run.stderr?.includes("Killed") || run.output?.includes("Killed"))) ||
                (memoryLimitBytes > 0 && (run.memory ?? 0) >= memoryLimitBytes)
            ));

        const isTimeout = isExplicitTimeout || (!isMemoryLimit && run.signal === "SIGKILL");
        const isRuntimeError = !compileSuccess ? false : (run.code !== 0 && !isTimeout && !isMemoryLimit);

        return {
            compile: {
                success: compileSuccess,
                output: hasCompile ? response.compile!.output : "",
                error: !compileSuccess ? response.compile!.stderr || response.compile!.output : undefined,
            },
            run: {
                success: run.code === 0 && !isTimeout && !isMemoryLimit,
                stdout: run.stdout,
                stderr: run.stderr,
                code: run.code,
                signal: run.signal,
                isTimeout,
                isMemoryLimit,
                isRuntimeError,
                timeMs: run.wall_time ?? run.cpu_time ?? 0,
                memoryBytes: run.memory ?? 0,
            }
        };
    }

    private createErrorResult(verdict: Verdict, message: string): NormalizedExecutionResult {
        return {
            compile: {
                success: true,
                output: "",
            },
            run: {
                success: false,
                stdout: "",
                stderr: message,
                code: -1,
                signal: null,
                isTimeout: verdict === Verdict.TIME_LIMIT_EXCEEDED,
                isMemoryLimit: verdict === Verdict.MEMORY_LIMIT_EXCEEDED,
                isRuntimeError: verdict === Verdict.RUNTIME_ERROR || verdict === Verdict.SYSTEM_ERROR,
                timeMs: 0,
                memoryBytes: 0,
            }
        };
    }
}
