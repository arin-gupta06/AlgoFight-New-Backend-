import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminController } from "../controllers/admin.controller";
import { SystemBroadcastService } from "../services/system-broadcast.service";
import { config } from "@algofight/config";

const controller = new AdminController();
const ADMIN_SECRET = config.adminSecretKey || process.env.ADMIN_SECRET_KEY;

// Auth Hook to enforce SuperAdmin Clearance
const verifyAdminAccess = async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = request.headers["x-admin-key"];
    if (adminKey !== ADMIN_SECRET) {
        return reply.status(403).send({
            error: "ACCESS_DENIED",
            message: "Level 5 SuperAdmin Clearance Required. Invalid or missing admin key.",
        });
    }
};

export async function adminRoutes(app: FastifyInstance) {
    // 1. Verify Passkey Endpoint (used by frontend login gate)
    app.post("/admin/auth/verify", async (request, reply) => {
        const { key } = (request.body as any) || {};
        if (key === ADMIN_SECRET) {
            return { success: true, message: "SuperAdmin clearance granted." };
        }
        return reply.status(401).send({ success: false, message: "Invalid SuperAdmin Passkey." });
    });

    // 2. Protected Telemetry & Master Metrics
    app.get("/admin/metrics", { preHandler: [verifyAdminAccess] }, async () => {
        return controller.getSystemMetrics();
    });

    // 3. Protected User & Institutional Code Registry
    app.get("/admin/users", { preHandler: [verifyAdminAccess] }, async (request) => {
        const query = request.query as any;
        return controller.listPlatformUsers({
            search: query.search,
            limit: query.limit ? parseInt(query.limit, 10) : 50,
        });
    });

    // 4. System Broadcast Dispatcher Endpoints
    // 4a. Dispatch new time-bound broadcast
    app.post("/admin/broadcast", { preHandler: [verifyAdminAccess] }, async (request, reply) => {
        try {
            const body = (request.body as any) || {};
            const broadcast = await SystemBroadcastService.createBroadcast({
                title: body.title,
                message: body.message,
                type: body.type,
                expiresAt: body.expiresAt,
                flashBanner: body.flashBanner !== false,
                createdBy: "SuperAdmin",
                content: body.content,
                action: body.action,
            });
            return { success: true, broadcast };
        } catch (err: any) {
            return reply.status(400).send({
                error: "INVALID_BROADCAST",
                message: err.message || "Failed to create system broadcast.",
            });
        }
    });

    // 4b. List all broadcasts (Active, Expired, Revoked) for Control Hub management
    app.get("/admin/broadcasts", { preHandler: [verifyAdminAccess] }, async () => {
        const broadcasts = await SystemBroadcastService.getAllAdminBroadcasts();
        return { broadcasts };
    });

    // 4c. Revoke / delete a broadcast
    app.delete("/admin/broadcast/:id", { preHandler: [verifyAdminAccess] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (!id) {
            return reply.status(400).send({ error: "MISSING_ID", message: "Broadcast ID is required." });
        }
        const success = await SystemBroadcastService.revokeBroadcast(id);
        return { success, message: "Broadcast revoked and purged from active clients." };
    });

    // 4d. Upload broadcast media (Images, Videos, Documents)
    app.post("/admin/media", { preHandler: [verifyAdminAccess] }, async (request, reply) => {
        try {
            const body = (request.body as any) || {};
            const { url, name, type, mimeType, size, base64 } = body;

            if (!url && !base64) {
                return reply.status(400).send({ error: "MISSING_MEDIA", message: "Media URL or Base64 is required." });
            }

            const mediaUrl = url || base64; // In production this maps to storage/CDN
            const mediaType = (type || "IMAGE").toUpperCase();

            return {
                success: true,
                media: {
                    type: mediaType,
                    url: mediaUrl,
                    name: name || `media_${Date.now()}`,
                    mimeType: mimeType || (mediaType === "IMAGE" ? "image/png" : "application/octet-stream"),
                    size: size || 0,
                },
            };
        } catch (err: any) {
            return reply.status(400).send({ error: "MEDIA_UPLOAD_FAILED", message: err.message });
        }
    });

    // 5. Proxy for Linux Telemetry Health (Bypasses Ad-Blockers)
    app.get("/admin/linux-status", async (request, reply) => {
        const rawTelemetryUrl = process.env.LINUX_TELEMETRY_URL || "http://localhost:8000";
        const linuxBaseUrl = rawTelemetryUrl.replace(/\/dashboard\/?$/, "").replace(/\/$/, "");
        
        try {
            const res = await fetch(`${linuxBaseUrl}/healthz`, {
                signal: AbortSignal.timeout(2500),
            });
            if (res.ok) {
                return { status: "ONLINE", online: true };
            }
            return { status: "OFFLINE", online: false };
        } catch (err) {
            return { status: "OFFLINE", online: false };
        }
    });
}

