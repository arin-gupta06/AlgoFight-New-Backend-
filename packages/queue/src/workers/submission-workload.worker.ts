import { Worker } from "bullmq";
import {
    ExecutionService,
    EvaluationService,
    BattleService,
    RuntimePoolManager,
} from "@algofight/application";
import { logger } from "@algofight/logger";
import {
    PrismaSubmissionRepository,
    PrismaProblemRepository,
    PrismaBattleRoomRepository,
} from "@algofight/database";
import { redisConnection } from "../client/redis";
import { QUEUE_NAMES } from "../constants/queue.constants";
import { submissionLightQueue, submissionHeavyQueue } from "../queues/submission-workload.queue";

const submissionRepository = new PrismaSubmissionRepository();
const problemRepository = new PrismaProblemRepository();
const battleRoomRepository = new PrismaBattleRoomRepository();
const evaluationService = new EvaluationService();
const battleService = new BattleService();
const executionService = new ExecutionService(
    submissionRepository,
    evaluationService,
    problemRepository,
    battleRoomRepository,
    battleService,
);

let activeLightWorkers = 0;
let activeHeavyWorkers = 0;

// 1. Light Submission Worker (High Concurrency: 4)
export const submissionLightWorker = new Worker(
    QUEUE_NAMES.SUBMISSION_LIGHT,
    async (job) => {
        activeLightWorkers++;
        try {
            logger.info({ submissionId: job.data.submissionId, workload: "LIGHT" }, "Processing light submission");
            await executionService.processSubmission(job.data.submissionId, job.data.mode || "SUBMIT", job.data.targetRuntimeUrl);
        } finally {
            activeLightWorkers = Math.max(0, activeLightWorkers - 1);
            if (job.data.targetRuntimeUrl) {
                await RuntimePoolManager.getInstance().releaseExecutionSlot(job.data.targetRuntimeUrl);
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 4, // 4 parallel fast scripts (Python, JS)
    },
);

// 2. Heavy Submission Worker (Bounded Concurrency: 2)
export const submissionHeavyWorker = new Worker(
    QUEUE_NAMES.SUBMISSION_HEAVY,
    async (job) => {
        activeHeavyWorkers++;
        try {
            logger.info({ submissionId: job.data.submissionId, workload: "HEAVY" }, "Processing heavy submission");
            await executionService.processSubmission(job.data.submissionId, job.data.mode || "SUBMIT", job.data.targetRuntimeUrl);
        } finally {
            activeHeavyWorkers = Math.max(0, activeHeavyWorkers - 1);
            if (job.data.targetRuntimeUrl) {
                await RuntimePoolManager.getInstance().releaseExecutionSlot(job.data.targetRuntimeUrl);
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 2, // 2 parallel heavy compilations (C++, Java) prevents host freeze
    },
);

submissionLightWorker.on("completed", (job) => {
    logger.info(`[Light Queue] Submission ${job.data.submissionId} completed`);
});
submissionLightWorker.on("failed", (job, error) => {
    logger.error({ error }, `[Light Queue] Submission ${job?.data?.submissionId} failed`);
});

submissionHeavyWorker.on("completed", (job) => {
    logger.info(`[Heavy Queue] Submission ${job.data.submissionId} completed`);
});
submissionHeavyWorker.on("failed", (job, error) => {
    logger.error({ error }, `[Heavy Queue] Submission ${job?.data?.submissionId} failed`);
});

/**
 * Background Heartbeat to feed queue depths into the Observer for autonomous scaling.
 */
setInterval(async () => {
    try {
        const [lightDepth, heavyDepth] = await Promise.all([
            submissionLightQueue.count(),
            submissionHeavyQueue.count(),
        ]);

        const poolManager = RuntimePoolManager.getInstance();
        const observer = poolManager.getObserver();
        await observer.onQueueTick({
            lightDepth,
            heavyDepth,
            lightWorkersBusy: activeLightWorkers,
            heavyWorkersBusy: activeHeavyWorkers,
            activeWorkersTotal: activeLightWorkers + activeHeavyWorkers,
            timestamp: Date.now(),
        });

        // Continuous sync to WSL Linux Telemetry Service
        const snapshot = poolManager.getSnapshot();
        const telemetryUrl = process.env.TELEMETRY_URL || process.env.TELEMETRY_SERVICE_URL || "http://localhost:8000";
        fetch(`${telemetryUrl}/api/v1/telemetry/runtime-pool`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                active_runtimes_count: snapshot.activeCount,
                runtimes: snapshot.runtimes.map(r => ({
                    id: r.id,
                    url: r.url,
                    port: r.port,
                    status: r.status,
                    active_jobs: r.activeJobs,
                    is_baseline: r.isBaseline,
                })),
                scaling_state: snapshot.scalingState,
                cooldown_seconds_remaining: snapshot.cooldownRemainingSeconds,
                light_queue_depth: lightDepth,
                heavy_queue_depth: heavyDepth,
                light_workers_busy: activeLightWorkers,
                heavy_workers_busy: activeHeavyWorkers,
                timestamp: Date.now() / 1000,
            }),
        }).catch(() => {});
    } catch {
        // Non-blocking telemetry error
    }
}, 3000);

logger.info("Asymmetric Submission Workers initialized: Light (concurrency 4), Heavy (concurrency 2)");
