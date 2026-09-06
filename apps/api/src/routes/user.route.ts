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
            githubUrl: body.githubUrl,
            linkedinUrl: body.linkedinUrl,
        });
    });

    // 2. Get User Profile by ID or Email
    app.get("/users/:id", async (req) => {
        const { id } = req.params as { id: string };
        return userController.getUserById(id, (req as any).user);
    });

    // 3. Available Players
    app.get("/players/available", async (req) => {
        const query = AvailablePlayersQuerySchema.parse(req.query);
        return userController.getAvailablePlayers(query.excludeUserId, query.limit, query.search);
    });

    // 4. Global Leaderboard
    app.get("/leaderboard", async () => {
        return userController.getLeaderboard();
    });
}
