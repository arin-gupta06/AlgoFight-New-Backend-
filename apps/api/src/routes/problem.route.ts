import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaProblemRepository, prisma } from "@algofight/database";
import { ProblemController } from "../controllers/problem.controller";
import { problemSchema, ProblemInput, bulkProblemsSchema } from "../schema/problem.schema";
import { requireAuth } from "../plugins/auth.plugin";
import { isAdminEmail } from "../constants/admins";

const repository = new PrismaProblemRepository();
const controller = new ProblemController(repository);

const requireFacultyOrAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.user.id) {
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication required." });
    }
    const isExplicitAdmin =
        request.user.role === "ADMIN" ||
        isAdminEmail(request.user.email) ||
        request.headers["x-admin-key"] === process.env.ADMIN_SECRET_KEY;
    if (isExplicitAdmin) return;

    try {
        const user = await prisma.user.findUnique({
            where: { id: request.user.id },
            select: { userType: true, email: true },
        });
        if (user?.userType === "FACULTY" || isAdminEmail(user?.email)) return;
    } catch {}

    return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Only verified faculty or administrators can add problems to the archive.",
    });
};

export async function problemRoutes(app: FastifyInstance) {
    // 1. Create Problem (Admin or Verified Faculty)
    app.post(
        "/problems",
        { preHandler: [requireFacultyOrAdmin] },
        async (request) => {
            const body: ProblemInput = problemSchema.parse(request.body);
            return controller.createProblem({
                ...body,
                creatorId: request.user?.id,
                creatorRole: request.user?.role === "ADMIN" ? "ADMIN" : "FACULTY",
            });
        },
    );

    // 1b. Bulk Create / Import Problems (Admin or Verified Faculty)
    app.post(
        "/problems/bulk",
        { preHandler: [requireFacultyOrAdmin] },
        async (request) => {
            const raw = request.body as any;
            const items = Array.isArray(raw) ? raw : (raw?.problems || []);
            const parsed = bulkProblemsSchema.parse({ problems: items });
            const created = await controller.bulkCreateProblems(
                parsed.problems,
                request.user?.id,
                request.user?.role === "ADMIN" ? "ADMIN" : "FACULTY"
            );
            return {
                success: true,
                count: created.length,
                problems: created,
            };
        },
    );

    // 2. Categories List
    app.get("/problems/categories", async () => {
        return [
            "Arrays & Hashing",
            "Two Pointers",
            "Sliding Window",
            "Stack & Queues",
            "Binary Search",
            "Linked Lists",
            "Trees",
            "Dynamic Programming",
            "Graphs",
            "Greedy",
            "Math"
        ];
    });

    // 3. List Paginated Problems
    app.get("/problems", async (request) => {
        const query = request.query as any;
        return controller.getProblems({
            page: query.page ? parseInt(query.page, 10) : 1,
            limit: query.limit ? parseInt(query.limit, 10) : 20,
            difficulty: query.difficulty,
            category: query.category || query.tags,
            tags: query.tags,
        });
    });

    // 4. Get Single Problem by ID
    app.get("/problems/:id", async (request) => {
        const { id } = request.params as { id: string };
        return controller.getProblemById(id);
    });

    // 5. Practice Progress Record (Persisted in PostgreSQL - AF-021)
    app.post(
        "/users/:uid/practice-progress",
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const { uid } = request.params as { uid: string };
            if (request.user?.id !== uid && request.user?.role !== "ADMIN") {
                return reply.status(403).send({
                    error: "FORBIDDEN",
                    message: "Cannot modify practice progress of another user.",
                });
            }
            const body = request.body as any;
            const userRepo = new (await import("@algofight/database")).PrismaUserRepository();
            const progress = await userRepo.getPracticeProgress(uid);

            return {
                newlySolved: Boolean(body.passed),
                progress: {
                    practiceSubmissionCount: progress.practiceSubmissionCount + (body.passed ? 1 : 0),
                    practiceSolvedProblemIds: body.passed && !progress.practiceSolvedProblemIds.includes(body.problemId)
                        ? [...progress.practiceSolvedProblemIds, body.problemId]
                        : progress.practiceSolvedProblemIds,
                },
            };
        },
    );
}
