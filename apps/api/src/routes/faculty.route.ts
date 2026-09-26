// apps/api/src/routes/faculty.route.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { FacultyController } from "../controllers/faculty.controller";
import { prisma } from "@algofight/database";
import { isAdminEmail } from "../constants/admins";

const facultyController = new FacultyController();

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
            select: { userType: true, institutionName: true, department: true, email: true },
        });
        if (user?.userType === "FACULTY" || isAdminEmail(user?.email)) {
            (request as any).facultyRecord = user;
            return;
        }
    } catch {}

    return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Only verified faculty members or administrators can access the Faculty Hub.",
    });
};

export async function facultyRoutes(app: FastifyInstance) {
    // 1. Get student roster with eligibility filtering
    app.get("/faculty/students", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const query = req.query as any;
        return facultyController.getStudents(
            {
                department: query.department,
                branch: query.branch,
                batchYear: query.batchYear,
                search: query.search,
                page: query.page ? parseInt(query.page, 10) : 1,
                limit: query.limit ? parseInt(query.limit, 10) : 50,
            },
            req.user
        );
    });

    // 1b. Directory of registered faculties (for Super Admin overview)
    app.get("/faculty/faculties", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const query = req.query as any;
        return facultyController.listFaculties({
            search: query?.search,
            department: query?.department,
        });
    });

    // 2. Dispatch reminder or announcement
    app.post("/faculty/reminders", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const body = req.body as any;
        return facultyController.dispatchReminder(body, req.user);
    });

    // 3. Get dispatched reminders
    app.get("/faculty/reminders", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const query = req.query as any;
        const targetFacultyId = query?.targetFacultyId || query?.facultyId;
        return facultyController.getReminders(req.user, targetFacultyId);
    });

    // 3b. Delete reminder
    app.delete("/faculty/reminders/:id", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const { id } = req.params as { id: string };
        return facultyController.deleteReminder(id, req.user);
    });

    // 4. Create Quiz / Assessment
    app.post("/faculty/quizzes", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const body = req.body as any;
        return facultyController.createQuiz(body, req.user);
    });

    // 5. Get Quizzes
    app.get("/faculty/quizzes", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const query = req.query as any;
        const targetFacultyId = query?.targetFacultyId || query?.facultyId;
        return facultyController.getQuizzes(req.user, targetFacultyId);
    });

    // 5b. Delete Quiz
    app.delete("/faculty/quizzes/:id", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const { id } = req.params as { id: string };
        return facultyController.deleteQuiz(id, req.user);
    });

    // 6. Get Faculty Dashboard Stats
    app.get("/faculty/stats", { preHandler: [requireFacultyOrAdmin] }, async (req) => {
        const query = req.query as any;
        const targetFacultyId = query?.targetFacultyId || query?.facultyId;
        return facultyController.getFacultyStats(req.user, targetFacultyId);
    });
}
