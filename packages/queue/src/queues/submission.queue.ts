import {Queue} from "bullmq";
import {redisConnection} from "../client/redis";
import { QUEUE_NAMES } from "../constants/queue.constants";
import { logger } from "@algofight/logger";
export const submissionQueue = new Queue(
    QUEUE_NAMES.SUBMISSION,
    {
        connection: redisConnection,

        defaultJobOptions: {
            attempts: 3,
            
            backoff: {
                type: "exponential",
                delay: 2000,
            },

            removeOnComplete: 100,

            removeOnFail: 500,
        },
    },
);

logger.info(
    {
        queue: QUEUE_NAMES.SUBMISSION,
        attempts: 3,
    },
    "Submission queue initialized",
);