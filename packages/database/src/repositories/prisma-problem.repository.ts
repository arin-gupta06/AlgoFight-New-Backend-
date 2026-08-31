import { prisma } from "../client/prisma"; // 👈 Use configured client
import {
    CreateProblemInput,
    ProblemRepository,
} from "../contracts/problem.repository";
import { ProblemEntity } from "../entities/problem.entity";
export interface GetProblemQuery {
    page?: number,
    limit?: number,
    difficulty?: string,
    category?: string,
    tags?: string
}


export class PrismaProblemRepository implements ProblemRepository {
    async createProblem(input: CreateProblemInput): Promise<ProblemEntity> {
        const problem = await prisma.problem.create({
            data: {
                title: input.title,
                statement: input.statement,
                difficulty: input.difficulty,
                timeLimit: input.timeLimit,
                memoryLimit: input.memoryLimit,
            },
            include: {
                testCases: true,
            },
        });
        return problem;
    }

    async getProblems(query: GetProblemQuery = {}) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.max(1, query.limit || 20);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.difficulty && query.difficulty.toUpperCase() !== "ALL") {
            where.difficulty = query.difficulty.toUpperCase();
        }
        const orConditions = [];
        if (query.category && query.category.toUpperCase() !== "ALL") {
            orConditions.push({ category: { contains: query.category, mode: "insensitive" } });
        }
        if (query.tags && query.tags.toUpperCase() !== "ALL") {
            orConditions.push({ tags: { has: query.tags } });
        }

        if (orConditions.length > 0) {
            where.OR = orConditions;
        }


        const [problems, total] = await Promise.all([
            prisma.problem.findMany({
                where,
                skip,
                take: limit,
                include: {
                    testCases: {
                        where: { isHidden: false },
                    },
                },
                orderBy: { createdAt: "asc" },
            }),
            prisma.problem.count({ where }),
        ]);

        return {
            problems,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            },
        };
    }

    // Public view: Filters out isHidden = true so hidden tests are NEVER leaked
    async getProblemById(problemId: string): Promise<ProblemEntity | null> {
        return prisma.problem.findUnique({
            where: { id: problemId },
            include: {
                testCases: {
                    where: { isHidden: false },
                },
            },
        });
    }

    // Internal worker query: Includes all test cases for sandbox evaluation
    async getProblemWithAllTestCases(problemId: string): Promise<ProblemEntity | null> {
        return prisma.problem.findUnique({
            where: { id: problemId },
            include: {
                testCases: true,
            },
        });
    }
}
