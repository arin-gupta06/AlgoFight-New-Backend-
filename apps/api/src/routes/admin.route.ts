import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminController } from "../controllers/admin.controller";
import { SystemBroadcastService } from "../services/system-broadcast.service";
import { linuxTelemetryBridge } from "../services/linux-telemetry-bridge.service";
import { auditService } from "../services/audit.service";
import { config } from "@algofight/config";

const controller = new AdminController();
const ADMIN_SECRET = config.adminSecretKey || process.env.ADMIN_SECRET_KEY;

// Auth Hook to enforce SuperAdmin Clearance
const verifyAdminAccess = async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = request.headers["x-admin-key"];
    if (adminKey !== ADMIN_SECRET) {
        auditService.recordEvent({
            category: "SECURITY",
            severity: "WARN",
            action: "UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT",
            actor: request.ip || "Unknown IP",
            details: `Failed admin access attempt on ${request.url}`,
        });

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
            auditService.recordEvent({
                category: "AUTH",
                severity: "INFO",
                action: "ADMIN_CLEARANCE_GRANTED",
                actor: "SuperAdmin",
                details: `SuperAdmin successfully authenticated from ${request.ip}`,
            });
            return { success: true, message: "SuperAdmin clearance granted." };
        }

        auditService.recordEvent({
            category: "SECURITY",
            severity: "WARN",
            action: "INVALID_PASSKEY_SUBMITTED",
            actor: request.ip || "Unknown IP",
            details: "Invalid administrative passkey submitted",
        });

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

    // 4. Live Platform Audit Logs
    app.get("/admin/audit-logs", { preHandler: [verifyAdminAccess] }, async (request) => {
        const query = request.query as any;
        return controller.getAuditLogs({
            category: query.category,
            severity: query.severity,
            limit: query.limit ? parseInt(query.limit, 10) : 50,
            search: query.search,
        });
    });

    // 5. System Broadcast Dispatcher Endpoints
    // 5a. Dispatch new time-bound broadcast
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

            auditService.recordEvent({
                category: "ADMIN",
                severity: "INFO",
                action: "BROADCAST_DISPATCHED",
                actor: "SuperAdmin",
                details: `"${broadcast.title}" [${broadcast.type}] flash=${broadcast.flashBanner}`,
                metadata: { broadcastId: broadcast.id, expiresAt: broadcast.expiresAt },
            });

            return { success: true, broadcast };
        } catch (err: any) {
            return reply.status(400).send({
                error: "INVALID_BROADCAST",
                message: err.message || "Failed to create system broadcast.",
            });
        }
    });

    // 5b. List all broadcasts (Active, Expired, Revoked) for Control Hub management
    app.get("/admin/broadcasts", { preHandler: [verifyAdminAccess] }, async () => {
        const broadcasts = await SystemBroadcastService.getAllAdminBroadcasts();
        return { broadcasts };
    });

    // 5c. Revoke / delete a broadcast
    app.delete("/admin/broadcast/:id", { preHandler: [verifyAdminAccess] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        if (!id) {
            return reply.status(400).send({ error: "MISSING_ID", message: "Broadcast ID is required." });
        }
        const success = await SystemBroadcastService.revokeBroadcast(id);

        if (success) {
            auditService.recordEvent({
                category: "ADMIN",
                severity: "WARN",
                action: "BROADCAST_REVOKED",
                actor: "SuperAdmin",
                details: `Revoked broadcast ${id}`,
                metadata: { broadcastId: id },
            });
        }

        return { success, message: "Broadcast revoked and purged from active clients." };
    });

    // 5d. Upload broadcast media (Images, Videos, Documents)
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

    // 6. Resilient Proxy for Linux Telemetry Health
    app.get("/admin/linux-status", async () => {
        const health = await linuxTelemetryBridge.checkHealth();
        return {
            status: health.status,
            online: health.online,
            latencyMs: health.latencyMs,
            endpoint: health.endpoint,
        };
    });

    // 7. Runtime Pool Elastic Orchestration & Probing via REST API
    app.post("/admin/runtime-pool/scale-out", { preHandler: [verifyAdminAccess] }, async (request) => {
        const body = (request.body as any) || {};
        return controller.scaleOutRuntime(body.reason);
    });

    app.post("/admin/runtime-pool/scale-in", { preHandler: [verifyAdminAccess] }, async () => {
        return controller.scaleInRuntime();
    });

    app.post("/admin/runtime-pool/probe-all", { preHandler: [verifyAdminAccess] }, async (request) => {
        const body = (request.body as any) || {};
        return controller.probeAllRuntimes(body);
    });
}
