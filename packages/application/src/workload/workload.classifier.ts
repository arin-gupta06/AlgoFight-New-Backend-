export interface WorkloadClassificationInput {
    language: string;
    sourceCode?: string;
    testCasesCount?: number;
    timeLimitMs?: number;
    memoryLimitBytes?: number;
    priority?: "HIGH" | "NORMAL";
}

export class WorkloadClassifier {
    // Languages that always require a compiler toolchain (gcc/g++, javac, rustc)
    private static readonly COMPILED_LANGUAGES = new Set(["cpp", "c", "java", "rust", "csharp"]);

    // Threshold constants for heuristic classification
    private static readonly LARGE_SOURCE_BYTES = 8 * 1024; // 8 KB
    private static readonly HIGH_TEST_COUNT = 15;
    private static readonly EXTENDED_TIME_LIMIT_MS = 3000;

    /**
     * Classifies a submission into 'LIGHT' or 'HEAVY' based on language,
     * compilation requirements, code payload size, test counts, and limits.
     */
    public static classify(input: WorkloadClassificationInput): "LIGHT" | "HEAVY" {
        const lang = (input.language || "").toLowerCase().trim();

        // 1. Check if language inherently requires heavy compiler phase
        if (this.COMPILED_LANGUAGES.has(lang)) {
            return "HEAVY";
        }

        // 2. Check source size (e.g. huge program or bloated templates)
        if (input.sourceCode && Buffer.byteLength(input.sourceCode, "utf8") > this.LARGE_SOURCE_BYTES) {
            return "HEAVY";
        }

        // 3. Check number of test cases to run
        if (input.testCasesCount && input.testCasesCount > this.HIGH_TEST_COUNT) {
            return "HEAVY";
        }

        // 4. Check time limits
        if (input.timeLimitMs && input.timeLimitMs > this.EXTENDED_TIME_LIMIT_MS) {
            return "HEAVY";
        }

        // Default to LIGHT for scripts (Python, JS) with reasonable test cases and code size
        return "LIGHT";
    }
}
