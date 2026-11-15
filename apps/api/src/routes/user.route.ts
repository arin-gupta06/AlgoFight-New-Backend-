import { FastifyInstance } from "fastify";
import { UserController } from "../controllers/user.controller";
import { AvailablePlayersQuerySchema } from "../validators/user.validator";
import { requireAuth } from "../plugins/auth.plugin";

const userController = new UserController();

export async function userRoutes(app: FastifyInstance) {
    // 1. Sync / Create user (Authenticated)
    app.post("/users", { preHandler: [requireAuth] }, async (req) => {
        const body = req.body as any;
        const authenticatedId = req.user!.id;
        return userController.syncUser({
            id: authenticatedId,
            email: req.user?.email || body.email,
            username: req.user?.username || body.username,
            displayName: body.displayName,
            photoURL: body.photoURL,
            originalPhotoURL: body.originalPhotoURL,
            avatarFrame: body.avatarFrame,
            githubUrl: body.githubUrl,
            linkedinUrl: body.linkedinUrl,
            userType: body.userType,
            institutionName: body.institutionName,
            department: body.department,
            school: body.school,
            designation: body.designation,
            batchYear: body.batchYear,
            themePreference: body.themePreference,
            studentIdentityMetadata: body.studentIdentityMetadata,
        });
    });

    // 1c. Update Theme Preference
    app.put("/users/theme", { preHandler: [requireAuth] }, async (req, reply) => {
        const body = req.body as any;
        const authenticatedId = req.user!.id;
        const themeId = body?.themeId;
        if (!themeId || typeof themeId !== "string") {
            return reply.status(400).send({
                error: "BAD_REQUEST",
                message: "Valid themeId is required.",
            });
        }
        return userController.updateThemePreference(authenticatedId, themeId);
    });

    // 1b. Update Faculty Profile (School/Centre, Department, Designation)
    app.put("/users/faculty-profile", { preHandler: [requireAuth] }, async (req, reply) => {
        const body = req.body as any;
        const authenticatedId = req.user!.id;
        if (!body.school) {
            return reply.status(400).send({
                error: "BAD_REQUEST",
                message: "School or Centre is mandatory for faculty profiles.",
            });
        }
        return userController.updateFacultyProfile(authenticatedId, {
            school: body.school,
            department: body.department,
            designation: body.designation,
            institutionName: body.institutionName,
        });
    });

    // 2. Get User Profile by ID or Email (Authenticated with Strict Projection)
    app.get("/users/:id", { preHandler: [requireAuth] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const profile = await userController.getUserById(id, req.user);
        if (!profile) {
            return reply.status(404).send({
                error: "NOT_FOUND",
                message: "User profile not found.",
            });
        }
        return profile;
    });

    // 3. Available Players (Authenticated only - protects student roster & prevents scraping)
    app.get("/players/available", { preHandler: [requireAuth] }, async (req) => {
        const query = AvailablePlayersQuerySchema.parse(req.query);
        const excludeUserId = query.excludeUserId || req.user?.id;
        return userController.getAvailablePlayers(excludeUserId, query.limit, query.search);
    });

    // 4. Global Leaderboard
    app.get("/leaderboard", async () => {
        return userController.getLeaderboard();
    });

    // 5. Total Platform Coders Stats
    app.get("/platform/stats", async () => {
        return userController.getPlatformStats();
    });
}
