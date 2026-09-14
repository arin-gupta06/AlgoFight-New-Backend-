// apps/api/src/controllers/faculty.controller.ts
import { prisma } from "@algofight/database";
import { InboxNotificationService } from "../services/inbox-notification.service";
import { logger } from "@algofight/logger";

export interface FacultyStudentQuery {
    department?: string;
    branch?: string;
    batchYear?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface DispatchReminderPayload {
    title: string;
    message: string;
    type?: "INFO" | "WARNING" | "UPDATE" | "REMINDER" | "EVENT";
    targetDepartment?: string;
    targetBatch?: string;
    flashBanner?: boolean;
    expiresHours?: number;
}

export interface CreateQuizPayload {
    title: string;
    description?: string;
    durationMinutes?: number;
    startTime?: string;
    endTime?: string;
    department?: string;
    batchYear?: string;
    problemIds?: string[];
}

export class FacultyController {
    /**
     * Retrieve student roster for faculty's department/institution with eligibility filtering
     */
    async getStudents(query: FacultyStudentQuery, facultyUser: any) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 50));
        const skip = (page - 1) * limit;

        const where: any = {
            userType: "STUDENT",
        };

        // If faculty belongs to an institution, scope to that institution
        if (facultyUser?.institutionName) {
            where.institutionName = { equals: facultyUser.institutionName, mode: "insensitive" };
        } else if (facultyUser?.institutionDomain) {
            where.institutionDomain = facultyUser.institutionDomain;
        }

        if (query.department && query.department !== "ALL") {
            where.department = { contains: query.department, mode: "insensitive" };
        }

        if (query.branch && query.branch !== "ALL") {
            where.branch = { contains: query.branch, mode: "insensitive" };
        }

        if (query.batchYear && query.batchYear !== "ALL") {
            where.batchYear = query.batchYear;
        }

        if (query.search?.trim()) {
            const s = query.search.trim();
            where.OR = [
                { username: { contains: s, mode: "insensitive" } },
                { email: { contains: s, mode: "insensitive" } },
                { platformCode: { contains: s, mode: "insensitive" } },
                { enrollmentNumber: { contains: s, mode: "insensitive" } },
            ];
        }

        const [students, total, departmentsList, batchesList] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    platformCode: true,
                    institutionName: true,
                    department: true,
                    branch: true,
                    batchYear: true,
                    admissionYear: true,
                    enrollmentNumber: true,
                    rating: true,
                    highestRank: true,
                    wins: true,
                    losses: true,
                    createdAt: true,
                },
                orderBy: { rating: "desc" },
            }),
            prisma.user.count({ where }),
            prisma.user.findMany({
                where: { userType: "STUDENT", department: { not: null } },
                distinct: ["department"],
                select: { department: true },
            }),
            prisma.user.findMany({
                where: { userType: "STUDENT", batchYear: { not: null } },
                distinct: ["batchYear"],
                select: { batchYear: true },
            }),
        ]);

        return {
            students,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit) || 1,
            availableDepartments: departmentsList.map((d) => d.department).filter(Boolean),
            availableBatches: batchesList.map((b) => b.batchYear).filter(Boolean),
        };
    }

    /**
     * Dispatch targeted reminder or announcement to students
     */
    async dispatchReminder(payload: DispatchReminderPayload, facultyUser: any) {
        const expiresHours = payload.expiresHours || 48;
        const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);

        const broadcast = await prisma.systemBroadcast.create({
            data: {
                title: payload.title,
                message: payload.message,
                type: payload.type || "REMINDER",
                flashBanner: payload.flashBanner ?? true,
                expiresAt,
                createdBy: facultyUser.username || facultyUser.email || "Faculty",
                content: {
                    authorId: facultyUser.id,
                    authorName: facultyUser.username || facultyUser.displayName,
                    targetDepartment: payload.targetDepartment || "ALL",
                    targetBatch: payload.targetBatch || "ALL",
                },
            },
        });

        // Push targeted inbox notifications to relevant students
        try {
            const studentWhere: any = { userType: "STUDENT" };
            if (payload.targetDepartment && payload.targetDepartment !== "ALL") {
                studentWhere.department = { contains: payload.targetDepartment, mode: "insensitive" };
            }
            if (payload.targetBatch && payload.targetBatch !== "ALL") {
                studentWhere.batchYear = payload.targetBatch;
            }

            const targetStudents = await prisma.user.findMany({
                where: studentWhere,
                select: { id: true },
                take: 500,
            });

            for (const s of targetStudents) {
                await InboxNotificationService.pushNotification({
                    userId: s.id,
                    type: "SYSTEM",
                    title: payload.title,
                    message: payload.message,
                    metadata: {
                        broadcastId: broadcast.id,
                        broadcastType: payload.type || "REMINDER",
                        fromFaculty: facultyUser.username || "Faculty",
                    },
                }).catch(() => {});
            }
        } catch (err: any) {
            logger.warn({ error: err.message }, "Error pushing inbox notifications for faculty reminder");
        }

        return broadcast;
    }

    /**
     * Retrieve reminders dispatched by the faculty member
     */
    async getReminders(facultyUser: any) {
        const reminders = await prisma.systemBroadcast.findMany({
            where: {
                OR: [
                    { createdBy: facultyUser.username },
                    { createdBy: facultyUser.email },
                    { createdBy: facultyUser.id },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return reminders;
    }

    /**
     * Create a new Quiz or Assessment
     */
    async createQuiz(payload: CreateQuizPayload, facultyUser: any) {
        const quiz = await prisma.quiz.create({
            data: {
                title: payload.title,
                description: payload.description || "",
                creatorId: facultyUser.id,
                institutionName: facultyUser.institutionName || null,
                department: payload.department || "All",
                batchYear: payload.batchYear || "All",
                durationMinutes: payload.durationMinutes || 30,
                startTime: payload.startTime ? new Date(payload.startTime) : new Date(),
                endTime: payload.endTime ? new Date(payload.endTime) : new Date(Date.now() + 7 * 24 * 3600 * 1000),
                status: "SCHEDULED",
                problemIds: payload.problemIds || [],
            },
        });

        return quiz;
    }

    /**
     * Retrieve all quizzes created by this faculty
     */
    async getQuizzes(facultyUser: any) {
        const quizzes = await prisma.quiz.findMany({
            where: {
                creatorId: facultyUser.id,
            },
            orderBy: { createdAt: "desc" },
        });

        // Enrich with problem titles if problems exist
        const allProblemIds = [...new Set(quizzes.flatMap((q) => q.problemIds))];
        const problems = allProblemIds.length > 0
            ? await prisma.problem.findMany({
                where: { id: { in: allProblemIds } },
                select: { id: true, title: true, difficulty: true },
            })
            : [];

        const problemMap = new Map(problems.map((p) => [p.id, p]));

        return quizzes.map((q) => ({
            ...q,
            problems: q.problemIds.map((id) => problemMap.get(id)).filter(Boolean),
        }));
    }

    /**
     * Delete or cancel a quiz
     */
    async deleteQuiz(quizId: string, facultyUser: any) {
        return prisma.quiz.deleteMany({
            where: {
                id: quizId,
                creatorId: facultyUser.id,
            },
        });
    }

    /**
     * Delete a dispatched broadcast/reminder
     */
    async deleteReminder(broadcastId: string, facultyUser: any) {
        return prisma.systemBroadcast.deleteMany({
            where: {
                id: broadcastId,
                OR: [
                    { createdBy: facultyUser.username },
                    { createdBy: facultyUser.email },
                    { createdBy: facultyUser.id },
                ],
            },
        });
    }

    /**
     * Get faculty overview stats
     */
    async getFacultyStats(facultyUser: any) {
        const [studentCount, quizCount, reminderCount] = await Promise.all([
            prisma.user.count({
                where: {
                    userType: "STUDENT",
                    ...(facultyUser.institutionName
                        ? { institutionName: { equals: facultyUser.institutionName, mode: "insensitive" } }
                        : {}),
                },
            }),
            prisma.quiz.count({
                where: { creatorId: facultyUser.id },
            }),
            prisma.systemBroadcast.count({
                where: {
                    OR: [
                        { createdBy: facultyUser.username },
                        { createdBy: facultyUser.email },
                        { createdBy: facultyUser.id },
                    ],
                },
            }),
        ]);

        return {
            studentCount,
            quizCount,
            reminderCount,
            institutionName: facultyUser.institutionName,
            department: facultyUser.department,
        };
    }
}
