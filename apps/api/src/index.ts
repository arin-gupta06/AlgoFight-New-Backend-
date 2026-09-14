import { config } from "@algofight/config";
import { logger } from "@algofight/logger";
import fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";

import gatewayPlugin from "./plugins/gateway.plugin";
import authPlugin from "./plugins/auth.plugin";
import websocketPlugin from "./plugins/websocket.plugin";
import studentIdentityPlugin from "./plugins/student-identity.plugin";
import { registerErrorHandler } from "./plugins/error-handler";
import { healthRoutes } from "./routes/health.route";
import { submissionRoutes } from "./routes/submission.route";
import { problemRoutes } from "./routes/problem.route";
import { userRoutes } from "./routes/user.route";
import { battleRoutes } from "./routes/battle.route";
import { matchmakingRoutes } from "./routes/matchmaking.route";
import { adminRoutes } from "./routes/admin.route";
import { notificationRoutes } from "./routes/notification.route";
import { analyticsRoutes } from "./routes/analytics.route";
import { facultyRoutes } from "./routes/faculty.route";

const app = fastify({
    bodyLimit: 1048576, // 1 MB Request Body Limit
});

const start = async () => {
    try {
        // 1. CORS with secure origin matching
        const allowedProdDomains = [
            "https://algofight-arena.vercel.app",
            "https://algofight.com",
            "https://www.algofight.com",
        ];

        await app.register(cors, {
            origin: (origin, cb) => {
                if (!origin) return cb(null, true);
                
                const isAllowed =
                    !config.isProduction ||
                    allowedProdDomains.includes(origin) ||
                    config.allowedOrigins.some(o => origin === o || origin.startsWith(o)) ||
                    origin.includes("localhost") ||
                    origin.includes("127.0.0.1");

                cb(null, isAllowed);
            },
            credentials: true,
            maxAge: 86400, // Cache preflight checks for 24 hours to eliminate repetitive OPTIONS spam
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "x-admin-key",
                "x-api-key",
                "x-request-id",
                "x-context-id",
                "Accept",
            ],
            exposedHeaders: ["x-request-id", "x-gateway-id", "x-context-id", "x-gateway-latency-ms"],
        });

        // 1b. Compression Plugin (Brotli & Gzip for responses >= 1KB)
        await app.register(compress, {
            threshold: 1024,
            encodings: ["gzip", "deflate"],
        });

        // Parse text/plain bodies (used by lightweight telemetry beacons to bypass CORS preflight)
        app.addContentTypeParser(["text/plain"], { parseAs: "string" }, (_req, body, done) => {
            done(null, body);
        });

        // 2. Global Rate Limiter Plugin
        await app.register(rateLimit, {
            max: 120,
            timeWindow: "1 minute",
            errorResponseBuilder: (_req, context) => ({
                statusCode: 429,
                error: "TOO_MANY_REQUESTS",
                message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
            }),
        });

        // 3. Gateway Plugin (Logical Admission, Filtering, Identity, Rate Limiter)
        await app.register(gatewayPlugin);

        // 3. Auth Plugin (Authorization & RBAC)
        await app.register(authPlugin);

        // 4. Centralized Error Handler
        await registerErrorHandler(app);

        // Register WebSocket Plugin
        await app.register(websocketPlugin);

        // Attachable Student Identity Plugin (MITS & Institutional Profiles)
        await app.register(studentIdentityPlugin);

        // 5. Route Registrar Helper
        const registerAllRoutes = (instance: any) => {
            instance.register(healthRoutes);
            instance.register(submissionRoutes);
            instance.register(problemRoutes);
            instance.register(userRoutes);
            instance.register(battleRoutes);
            instance.register(matchmakingRoutes);
            instance.register(adminRoutes);
            instance.register(notificationRoutes);
            instance.register(analyticsRoutes);
            instance.register(facultyRoutes);
        };

        // Register both under /api and root
        app.register(async (api) => registerAllRoutes(api), { prefix: "/api" });
        registerAllRoutes(app);

        // Root health check
        app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

        // 🌐 Bind to 0.0.0.0 for reliable localhost/IPv4 resolution on Windows
        await app.listen({
            port: config.port,
            host: "0.0.0.0",
        });

        logger.info({ port: config.port, env: config.environment }, "API server running at http://localhost:3000");

        // 🚀 Embedded Submission Worker for single-process deployments (Render, Railway, VPS)
        if (process.env.STANDALONE_WORKER !== "true") {
            try {
                await import("@algofight/queue");
                logger.info("Embedded BullMQ submission worker pool successfully attached to API server");
            } catch (wErr: any) {
                logger.warn({ error: wErr.message }, "Could not attach embedded worker, assuming external worker pool");
            }
        }
    } catch (error) {
        logger.error({ error }, "Failed to start API server");
        process.exit(1);
    }
};

// 🛡️ Global Process Resilience - Prevent Unhandled Errors from Crashing Server
process.on("unhandledRejection", (reason: any) => {
    logger.warn({ error: reason?.message || reason }, "Non-fatal unhandled promise rejection caught");
});

process.on("uncaughtException", (error: Error) => {
    logger.error({ error: error.message, stack: error.stack }, "Uncaught exception intercepted by process guard");
});

start();
