import "@algofight/config";
import { submissionWorker, submissionLightWorker, submissionHeavyWorker, redisConnection } from "@algofight/queue";
import { prisma } from "@algofight/database";
import { logger } from "@algofight/logger";

logger.info("Worker service started with Light and Heavy asymmetric worker pools and graceful shutdown handlers");

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Worker received termination signal, starting graceful drain...");

    try {
        // 1. Pause workers to stop accepting new submissions
        await Promise.all([
            submissionWorker.pause(),
            submissionLightWorker.pause(),
            submissionHeavyWorker.pause(),
        ]);
        logger.info("All submission workers paused");

        // 2. Wait for active jobs in flight to complete cleanly
        await Promise.all([
            submissionWorker.close(),
            submissionLightWorker.close(),
            submissionHeavyWorker.close(),
        ]);
        logger.info("Active submission jobs drained and all workers closed cleanly");

        // 3. Disconnect Redis connection
        await redisConnection.quit();
        logger.info("Redis connection closed");

        // 4. Disconnect Prisma pool
        await prisma.$disconnect();
        logger.info("Database connection closed cleanly");

        logger.info("Worker graceful shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error({ error }, "Error during graceful worker shutdown");
        process.exit(1);
    }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
