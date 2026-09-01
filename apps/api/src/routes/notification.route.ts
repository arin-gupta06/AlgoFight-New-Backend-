import { FastifyInstance } from "fastify";
import { NotificationController } from "../controllers/notification.controller";
import { SystemBroadcastService } from "../services/system-broadcast.service";
import { requireAuth } from "../plugins/auth.plugin";

const notificationController = new NotificationController();

export async function notificationRoutes(app: FastifyInstance) {
    // 0. Get active system broadcast announcements (Public/Auth for Flash Banner)
    app.get("/notifications/active-broadcasts", async () => {
        const broadcasts = await SystemBroadcastService.getActiveBroadcasts();
        return { broadcasts };
    });

    // 1. Get notifications for current user (Authenticated)
    app.get("/notifications", { preHandler: [requireAuth] }, async (req) => {
        const query = req.query as { limit?: string; offset?: string };
        const userId = req.user!.id;
        const limit = query.limit ? Math.min(100, parseInt(query.limit, 10)) : 50;
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        return notificationController.getNotifications(userId, limit, offset);
    });

    // 2. Mark single notification as read (Authenticated)
    app.patch("/notifications/:id/read", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        const userId = req.user!.id;
        return notificationController.markAsRead(userId, id);
    });

    // 3. Mark all notifications as read (Authenticated)
    app.patch("/notifications/read-all", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        return notificationController.markAllAsRead(userId);
    });

    // 4. Clear all notifications (Authenticated)
    app.delete("/notifications", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        return notificationController.clearNotifications(userId);
    });
}

