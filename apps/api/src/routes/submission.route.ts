import { FastifyInstance } from "fastify";
import { SubmissionController } from "../controllers/submission.controllers";
import {
    PrismaSubmissionRepository,
    PrismaProblemRepository
} from "@algofight/database";
import {
    SubmissionInput,
    submissionSchema,
    TestRunInput,
    testRunSchema
} from "../schema/submission.schema";
import { requireAuth } from "../plugins/auth.plugin";

const submissionRepository = new PrismaSubmissionRepository();
const problemRepository = new PrismaProblemRepository();
const submissionController = new SubmissionController(
    submissionRepository,
    problemRepository
);

export async function submissionRoutes(app: FastifyInstance) {
    // 1. Submit Code (Strict rate limit: 15 req/min, Authenticated)
    app.post(
        "/submit",
        {
            preHandler: [requireAuth],
            config: {
                rateLimit: {
                    max: 15,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request, reply) => {
            const body: SubmissionInput = submissionSchema.parse(request.body);
            const authenticatedUserId = request.user!.id;

            return submissionController.submit(body, authenticatedUserId);
        },
    );

    // 2. Test Code (Rate limit: 30 req/min)
    app.post(
        "/test",
        {
            config: {
                rateLimit: {
                    max: 30,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request) => {
            const body: TestRunInput = testRunSchema.parse(request.body);
            return submissionController.test(body);
        },
    );

    // 3. Practice Evaluate (Rate limit: 15 req/min, Authenticated) - AF-001 & AF-005
    app.post(
        "/practice/evaluate",
        {
            preHandler: [requireAuth],
            config: {
                rateLimit: {
                    max: 15,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request) => {
            const body = request.body as any;
            return submissionController.evaluatePractice(body);
        },
    );


    // 4. Submissions List (Public Summary DTOs)
    app.get(
        "/submissions",
        async (request) => {
            return submissionController.getAllSubmission(request.user?.id);
        },
    );

    // 5. Direct Runtime Code Execution (Callable for both prewarmed baseline & extended instances)
    app.post(
        "/submissions/execute-direct",
        {
            config: {
                rateLimit: {
                    max: 60,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request) => {
            const body = (request.body as any) || {};
            return submissionController.executeDirect(body);
        }
    );

    // Alias: Direct Piston Runtime Execution
    app.post(
        "/runtimes/execute",
        {
            config: {
                rateLimit: {
                    max: 60,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request) => {
            const body = (request.body as any) || {};
            return submissionController.executeDirect(body);
        }
    );

    // 6. Runtime Pool Discovery (Lists all prewarmed baseline and extended Piston instances)
    app.get(
        "/runtimes",
        async () => {
            return submissionController.getRuntimePoolStatus();
        }
    );

    app.get(
        "/submissions/runtimes",
        async () => {
            return submissionController.getRuntimePoolStatus();
        }
    );

    // 7. Submission Details by ID (Object-Level Authorization)
    app.get(
        "/submissions/:id",
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const submission = await submissionController.getSubmissionById(id, request.user?.id, request.user?.role);
            if (!submission) {
                return reply.status(404).send({ error: "NOT_FOUND", message: "Submission not found." });
            }
            return submission;
        }
    );
}
