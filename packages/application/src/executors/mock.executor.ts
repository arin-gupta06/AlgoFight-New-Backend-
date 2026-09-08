import {
    CodeExecutor,
    ExecutionPayload,
} from "../contracts/code-executor";

import { SubmissionResult }
    from "@algofight/database";

import { logger }
    from "@algofight/logger";

import { SubmissionStatus }
    from "@algofight/types";

import { Verdict } from "@algofight/types";

const MOCK_EXECUTION_TIME = 500;

export class MockExecutor
    implements CodeExecutor {

    async execute(
        payload: ExecutionPayload,
    ): Promise<SubmissionResult> {

        const start = Date.now();

        logger.info(
            {
                submissionId:
                    payload.submissionId,

                language:
                    payload.language,
            },
            "Mock execution started",
        );

        if (
            payload.code.includes(
                "MOCK_FAILURE",
            )
        ) {
            throw new Error(
                "Mock execution failed",
            );
        }

        await new Promise(
            (resolve) =>
                setTimeout(
                    resolve,
                    MOCK_EXECUTION_TIME,
                ),
        );

        const executionTime =
            Date.now() - start;

        logger.info(
            {
                submissionId:
                    payload.submissionId,
            },
            "Mock execution completed",
        );

        return {
            stdout: "Hello AlgoFight",
            stderr: null,
            executionTime,
            exitCode: 0,
            status: SubmissionStatus.FINALIZED,
            passedCount: payload.testCases.length,
            failedCount: 0,

            // --- NEW AGGREGATE METRICS ---
            verdict: Verdict.ACCEPTED as any,
            cpuUsage: 45.2,
            memoryUsage: 12.5,
            compileTime: 300,

            // --- NEW INDIVIDUAL TEST CASE METRICS ---
            individualExecutions: payload.testCases.map((tc, index) => ({
                testCaseId: "mock-tc-" + index,
                verdict: Verdict.ACCEPTED as any,
                executionTime: 40 + (Math.random() * 10),
                compileTime: 0,
                cpuUsage: 45.0 + Math.random(),
                memoryUsage: 12.0 + Math.random(),
            }))
        };

    }
}
