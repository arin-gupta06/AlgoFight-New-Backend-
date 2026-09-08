import { prisma } from "../client/prisma";
import {
  SubmissionRepository,
  SubmissionResult,
  CreateSubmissionInput,
} from "../contracts/submission.repository";
import { SubmissionStatus } from "@algofight/types";
import { canTransition } from "@algofight/state-machine";
import {
  InvalidTransitionError,
  SubmissionNotFoundError,
} from "@algofight/error-handling";
import { toSubmissionEntity } from "../mappers/submission.mapper";
import { SubmissionEntity } from "../entities/submission.entity";

export class PrismaSubmissionRepository implements SubmissionRepository {
  async incrementRetryCount(submissionId: string) {
    return prisma.submission.update({
      where: { id: submissionId },
      data: { retryCount: { increment: 1 } },
    });
  }

  async markAsStale(submissionId: string) {
    return this.updateStatus(submissionId, SubmissionStatus.FINALIZED);
  }

  async getStaleSubmissions(thresholdMs: number): Promise<string[]> {
    const thresholdDate = new Date(Date.now() - thresholdMs);
    const submissions = await prisma.submission.findMany({
      where: {
        status: SubmissionStatus.RUNNING as any,
        updatedAt: { lt: thresholdDate },
      },
      select: { id: true },
    });
    return submissions.map((s: any) => s.id);
  }

  async findById(submissionId: string) {
    return prisma.submission.findUnique({
      where: { id: submissionId },
    });
  }

  async createSubmission(input: CreateSubmissionInput) {
    const submission = await prisma.submission.create({
      data: {
        userId: input.userId,
        problemId: input.problemId,
        roomId: input.roomId,
        language: input.language,
        code: input.code,
      },
    });
    return toSubmissionEntity(submission);
  }

  private async validateTransition(submissionId: string, nextStatus: SubmissionStatus) {
    const submission = await this.getSubmissionById(submissionId);
    if (!submission) {
      throw new SubmissionNotFoundError(submissionId);
    }
    if (!canTransition(submission.status, nextStatus)) {
      throw new InvalidTransitionError(submission.status, nextStatus);
    }
  }

  // 🛡️ Atomic Conditional Status Transition
  async updateStatus(submissionId: string, status: SubmissionStatus, expectedCurrentStatus?: SubmissionStatus) {
    if (expectedCurrentStatus) {
      const updateResult = await prisma.submission.updateMany({
        where: {
          id: submissionId,
          status: expectedCurrentStatus as any,
        },
        data: {
          status: status as any,
        },
      });
      if (updateResult.count === 0) {
        const current = await this.getSubmissionById(submissionId);
        if (!current) throw new SubmissionNotFoundError(submissionId);
        throw new InvalidTransitionError(current.status, status);
      }
      const updated = await this.getSubmissionById(submissionId);
      return updated!;
    }

    await this.validateTransition(submissionId, status);
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: { status: status as any },
    });
    return toSubmissionEntity(submission);
  }

  async completeSubmission(
    submissionId: string,
    result: SubmissionResult
  ): Promise<SubmissionEntity> {
    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: result.status as any,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime,
        exitCode: result.exitCode,
        verdict: result.verdict as any,
        cpuUsage: result.cpuUsage,
        memoryUsage: result.memoryUsage,
        compileTime: result.compileTime,
      },
    });
    return toSubmissionEntity(updated);
  }

  async getSubmissionById(submissionId: string) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) return null;
    return toSubmissionEntity(submission);
  }

  async getAllSubmission() {
    const submissions = await prisma.submission.findMany({
      orderBy: { createdAt: "desc" }
    });
    return submissions.map(toSubmissionEntity);
  }
}
