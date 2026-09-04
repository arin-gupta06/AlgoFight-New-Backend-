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
    private readonly PISTON_URL = process.env.PISTON_URL || "http://localhost:2000";

    // Maps AlgoFight languages to Piston (language, version)
    private languageMap: Record<string, { language: string; version: string; fileExtension: string }> = {
        javascript: { language: "node", version: "*", fileExtension: "js" },
        cpp: { language: "c++", version: "*", fileExtension: "cpp" },
        python: { language: "python", version: "*", fileExtension: "py" },
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
            run_timeout: timeLimitMs,
            compile_timeout: 10000,
            run_memory_limit: memoryLimitBytes,
        };

        try {
            const controller = new AbortController();
            // A bit more than Piston's run_timeout to allow network travel
            const id = setTimeout(() => controller.abort(), timeLimitMs + 5000); 

            const endpoint = targetUrl || this.PISTON_URL;
            const response = await fetch(`${endpoint}/api/v2/execute`, {
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

            return this.normalizeResponse(data, timeLimitMs);
        } catch (error: any) {
            if (error.name === "AbortError") {
                // Client side abort, likely a catastrophic timeout
                return this.createErrorResult(Verdict.SYSTEM_ERROR, "Request to execution engine timed out completely.");
            }
            // System-level errors (network down, piston crash)
            throw error;
        }
    }

    private normalizeResponse(response: PistonExecuteResponse, timeLimitMs: number): NormalizedExecutionResult {
        const hasCompile = !!response.compile;
        const compileSuccess = hasCompile ? response.compile!.code === 0 : true;

        return {
            compile: {
                success: compileSuccess,
                output: hasCompile ? response.compile!.output : "",
                error: !compileSuccess ? response.compile!.stderr || response.compile!.output : undefined,
            },
            run: {
                success: response.run.code === 0,
                stdout: response.run.stdout,
                stderr: response.run.stderr,
                code: response.run.code,
                signal: response.run.signal,
                isTimeout: response.run.signal === "SIGKILL", 
                isMemoryLimit: false, // Piston v2 doesn't cleanly expose OOM natively as a specific flag, usually it's SIGKILL or SIGABRT. We can refine this later if needed.
                isRuntimeError: response.run.code !== 0 && response.run.signal !== "SIGKILL"
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
                isRuntimeError: verdict === Verdict.RUNTIME_ERROR || verdict === Verdict.SYSTEM_ERROR
            }
        };
    }
}
