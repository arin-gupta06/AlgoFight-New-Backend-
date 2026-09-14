import { ProblemEntity } from "../entities/problem.entity";

export interface CreateTestCaseInput {
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
}

export interface CreateProblemInput {
    title: string;
    statement: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    category?: string | null;
    tags?: string[];
    timeLimit?: number;
    memoryLimit?: number;
    creatorId?: string | null;
    creatorRole?: string | null;
    testCases?: CreateTestCaseInput[];
}

export interface ProblemRepository {
    createProblem(input: CreateProblemInput): Promise<ProblemEntity>;
    bulkCreateProblems(inputs: CreateProblemInput[]): Promise<ProblemEntity[]>;
    getProblemById(problemId: string): Promise<ProblemEntity | null>;
    getProblemWithAllTestCases(problemId: string): Promise<ProblemEntity | null>;
    getProblems(query?: any): Promise<{ problems: ProblemEntity[], pagination: any }>;
}
