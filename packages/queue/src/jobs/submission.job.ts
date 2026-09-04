import { submissionQueue } from "../queues/submission.queue";
import { submissionLightQueue, submissionHeavyQueue } from "../queues/submission-workload.queue";
import { JOB_NAMES } from "../constants/queue.constants";
import { SubmissionJobPayload } from "../types/submission-job.type";
import { logger } from "@algofight/logger";

export const enqueueSubmissionJob = async (
  payload: SubmissionJobPayload,
) => {
  logger.info(
      {
          submissionId: payload.submissionId,
          workload: payload.workload || "DEFAULT",
          targetRuntimeUrl: payload.targetRuntimeUrl,
      },
      "Enqueueing submission job",
  );

  try {
    let targetQueue = submissionQueue;
    let jobName: string = JOB_NAMES.SUBMISSION;

    if (payload.workload === "LIGHT") {
        targetQueue = submissionLightQueue;
        jobName = JOB_NAMES.SUBMISSION_LIGHT;
    } else if (payload.workload === "HEAVY") {
        targetQueue = submissionHeavyQueue;
        jobName = JOB_NAMES.SUBMISSION_HEAVY;
    }

    const job = await targetQueue.add(
        jobName,
        payload,
        {
          priority: payload.priority === "HIGH" ? 1 : 2,
        },
    );

    logger.info(
      {
        submissionId: payload.submissionId,
        jobId: job.id,
        queue: targetQueue.name,
      },
      "Submission job enqueued successfully into target queue lane",
    );

    return job;
  } catch (error) {
    logger.error(
      {
        submissionId: payload.submissionId,
        error,
      },
      "Failed to enqueue submission job",
    );

    throw error;
  }
};