import { Queue } from "bullmq";
import { redisConnection } from "../client/redis";
import { QUEUE_NAMES } from "../constants/queue.constants";
import { logger } from "@algofight/logger";

const queueOptions = {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1500,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
    },
};

export const submissionLightQueue = new Queue(QUEUE_NAMES.SUBMISSION_LIGHT, queueOptions);
export const submissionHeavyQueue = new Queue(QUEUE_NAMES.SUBMISSION_HEAVY, queueOptions);

logger.info(
    {
        lightQueue: QUEUE_NAMES.SUBMISSION_LIGHT,
        heavyQueue: QUEUE_NAMES.SUBMISSION_HEAVY,
    },
    "Workload-segregated submission queues initialized (Light/Heavy)",
);
