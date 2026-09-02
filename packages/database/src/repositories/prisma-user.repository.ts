// packages/database/src/repositories/prisma-user.repository.ts
import { prisma } from "../client/prisma";
import { CreateUserInput, UserRepository } from "../contracts/user.repository";
import { UserEntity } from "../entities/user.entity";
import { generatePlatformCode } from "../utils/platform-code";

export class PrismaUserRepository implements UserRepository {
    async createUser(input: CreateUserInput): Promise<UserEntity> {
        return prisma.user.create({
            data: {
                id: input.id,
                username: input.username,
                email: input.email,
                userType: (input.userType as any) || "INDIVIDUAL",
                primaryEmail: input.primaryEmail || input.email,
                secondaryEmail: input.secondaryEmail || null,
                institutionName: input.institutionName || null,
                department: input.department || null,
                batchYear: input.batchYear || null,
                platformCode: input.platformCode || generatePlatformCode(input.userType),
                githubUrl: input.githubUrl || null,
                linkedinUrl: input.linkedinUrl || null,
            },
        });
    }

    async upsertUser(input: CreateUserInput): Promise<UserEntity> {
        let existing = input.id ? await prisma.user.findUnique({ where: { id: input.id } }) : null;
        
        if (!existing && input.email) {
            existing = await prisma.user.findUnique({ where: { email: input.email } });
        }

        let finalUsername = input.username;

        if (existing) {
            if (input.username && input.username !== existing.username) {
                const usernameConflict = await prisma.user.findUnique({ where: { username: input.username } });
                if (usernameConflict && usernameConflict.id !== existing.id) {
                    finalUsername = `${input.username}_${Math.floor(1000 + Math.random() * 9000)}`;
                }
            }

            let finalEmail = input.email;
            if (finalEmail && finalEmail !== existing.email) {
                const emailConflict = await prisma.user.findUnique({ where: { email: finalEmail } });
                if (emailConflict && emailConflict.id !== existing.id) {
                    finalEmail = existing.email;
                }
            }

            return prisma.user.update({
                where: { id: existing.id },
                data: {
                    username: finalUsername,
                    email: finalEmail,
                    institutionName: input.institutionName || existing.institutionName,
                    secondaryEmail: input.secondaryEmail || existing.secondaryEmail,
                    githubUrl: input.githubUrl || existing.githubUrl,
                    linkedinUrl: input.linkedinUrl || existing.linkedinUrl,
                },
            });
        }

        const usernameConflict = await prisma.user.findUnique({ where: { username: input.username } });
        if (usernameConflict) {
            finalUsername = `${input.username}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        try {
            return await this.createUser({ ...input, username: finalUsername });
        } catch (error: any) {
            // Handle race condition where another request created the user just after we checked
            if (error?.code === "P2002") {
                const retryExisting = await prisma.user.findUnique({ where: { id: input.id } });
                if (retryExisting) {
                    return prisma.user.update({
                        where: { id: retryExisting.id },
                        data: {
                            email: input.email,
                            institutionName: input.institutionName || retryExisting.institutionName,
                            secondaryEmail: input.secondaryEmail || retryExisting.secondaryEmail,
                            githubUrl: input.githubUrl || retryExisting.githubUrl,
                            linkedinUrl: input.linkedinUrl || retryExisting.linkedinUrl,
                        },
                    });
                }
            }
            throw error;
        }
    }

    async getTopUsers(limit: number = 20): Promise<UserEntity[]> {
        return prisma.user.findMany({
            take: limit,
            orderBy: { rating: "desc" },
        });
    }

    async getUserById(identifier: string): Promise<UserEntity | null> {
        if (!identifier) return null;
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: identifier },
                    { email: identifier },
                    { username: identifier },
                    { platformCode: identifier },
                ],
            },
        });
        if (user && !user.platformCode) {
            const newCode = generatePlatformCode(user.userType as any);
            return prisma.user.update({
                where: { id: user.id },
                data: { platformCode: newCode },
            });
        }
        return user;
    }

    async getUserByUsername(username: string): Promise<UserEntity | null> {
        return prisma.user.findUnique({
            where: { username },
        });
    }

    async updateRating(userId: string, newRating: number, isWin: boolean): Promise<UserEntity> {
        return prisma.user.update({
            where: { id: userId },
            data: {
                rating: newRating,
                wins: isWin ? { increment: 1 } : undefined,
                losses: !isWin ? { increment: 1 } : undefined,
            },
        });
    }

    async updateRatingWithAudit(input: {
        userId: string;
        battleRoomId?: string;
        ratingBefore: number;
        ratingAfter: number;
        ratingDelta: number;
        performanceScore: number;
        ewmaBefore: number;
        ewmaAfter: number;
        isWin?: boolean;
        highestRank?: string;
        metadata?: Record<string, any>;
    }): Promise<UserEntity> {
        return prisma.$transaction(async (tx) => {
            const currentUser = await tx.user.findUnique({
                where: { id: input.userId },
                select: { highestRating: true, highestRank: true },
            });

            const newHighestRating = Math.max(currentUser?.highestRating ?? 0, input.ratingAfter);

            const updatedUser = await tx.user.update({
                where: { id: input.userId },
                data: {
                    rating: input.ratingAfter,
                    ewma: input.ewmaAfter,
                    highestRating: newHighestRating,
                    highestRank: input.highestRank || currentUser?.highestRank || "ROOKIE",
                    wins: input.isWin === true ? { increment: 1 } : undefined,
                    losses: input.isWin === false ? { increment: 1 } : undefined,
                },
            });

            await tx.ratingHistory.create({
                data: {
                    userId: input.userId,
                    battleRoomId: input.battleRoomId || null,
                    ratingBefore: input.ratingBefore,
                    ratingAfter: input.ratingAfter,
                    ratingDelta: input.ratingDelta,
                    performanceScore: input.performanceScore,
                    ewmaBefore: input.ewmaBefore,
                    ewmaAfter: input.ewmaAfter,
                    metadata: input.metadata || {},
                },
            });

            return updatedUser;
        });
    }

    async getAvailablePlayers(excludeUserId?: string, limit = 50, search?: string): Promise<UserEntity[]> {
        const whereClause: any = {};
        const conditions: any[] = [];

        if (excludeUserId) {
            conditions.push({ id: { not: excludeUserId } });
        }

        if (search && search.trim()) {
            const query = search.trim();
            conditions.push({
                OR: [
                    { username: { contains: query, mode: "insensitive" } },
                    { platformCode: { contains: query, mode: "insensitive" } },
                    { institutionName: { contains: query, mode: "insensitive" } },
                ],
            });
        }

        if (conditions.length > 0) {
            whereClause.AND = conditions;
        }

        return prisma.user.findMany({
            where: whereClause,
            take: limit,
            orderBy: { rating: "desc" },
        });
    }

    async getPracticeProgress(userId: string): Promise<{ practiceSubmissionCount: number; practiceSolvedProblemIds: string[] }> {
        const submissions = await prisma.submission.findMany({
            where: { userId },
            select: { problemId: true, verdict: true },
        });

        const solvedProblemIds = Array.from(
            new Set(
                submissions
                    .filter((s) => s.verdict === "ACCEPTED")
                    .map((s) => s.problemId)
            )
        );

        return {
            practiceSubmissionCount: submissions.length,
            practiceSolvedProblemIds: solvedProblemIds,
        };
    }
}
