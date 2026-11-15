import "@algofight/config";
import { runStaleSubmissionJob } from "./jobs/stale-submission.job";
import { runBattleExpirationJob } from "./jobs/battle-expiration.job";
import { SCHEDULER_INTERVALS } from "./constants/scheduler.constants";
import { logger } from "@algofight/logger";

logger.info(
    {
        staleInterval: SCHEDULER_INTERVALS.STALE_CHECK,
        battleInterval: SCHEDULER_INTERVALS.BATTLE_EXPIRATION_CHECK,
    },
    "Scheduler service has started",
);

// 1. Periodic stale submission check
const staleInterval = setInterval(async () => {
    try {
        await runStaleSubmissionJob();
    } catch (error) {
        logger.error({ error }, "Stale submission job failed");
    }
}, SCHEDULER_INTERVALS.STALE_CHECK);

// 2. Periodic battle expiration check
const expirationInterval = setInterval(async () => {
    try {
        await runBattleExpirationJob();
    } catch (error) {
        logger.error({ error }, "Battle expiration job failed");
    }
}, SCHEDULER_INTERVALS.BATTLE_EXPIRATION_CHECK);

const shutdown = () => {
    logger.info("Scheduler shutting down");
    clearInterval(staleInterval);
    clearInterval(expirationInterval);
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
