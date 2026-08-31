import { Worker } from "bullmq";
import { ExecutionService, EvaluationService, BattleService } from "@algofight/application";
import { logger } from "@algofight/logger";
import {
  PrismaSubmissionRepository,
  PrismaProblemRepository,
  PrismaBattleRoomRepository,
} from "@algofight/database";
import { redisConnection } from "../client/redis";
import { QUEUE_NAMES } from "../constants/queue.constants";

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

export const submissionWorker = new Worker(
  QUEUE_NAMES.SUBMISSION,
  async (job) => {
    await executionService.processSubmission(job.data.submissionId, job.data.mode || "SUBMIT");
  },
  {
    connection: redisConnection,
    concurrency: 15,
  },
);

submissionWorker.on("completed", (job) => {
  logger.info(`Submission ${job.data.submissionId} completed`);
});

submissionWorker.on("failed", (job, error) => {
  logger.error({ error }, `Submission ${job?.data?.submissionId} failed`);
});

logger.info(
  {
    queue: QUEUE_NAMES.SUBMISSION,
    concurrency: 15,
  },
  "Submission worker initialized",
);
