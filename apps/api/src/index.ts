import { config } from "@algofight/config";
import { logger } from "@algofight/logger";
import fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

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

const app = fastify({
    bodyLimit: 1048576, // 1 MB Request Body Limit
});

const start = async () => {
    try {
        // 1. CORS with dynamic origin matching for Vercel & Production
        await app.register(cors, {
            origin: (origin, cb) => {
                if (!origin) return cb(null, true);
                
                const isAllowed =
                    !config.isProduction ||
                    origin.endsWith(".vercel.app") ||
                    origin.includes("localhost") ||
                    origin.includes("127.0.0.1") ||
                    config.allowedOrigins.some(o => origin.startsWith(o) || o === origin);

                cb(null, isAllowed);
            },
            credentials: true,
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

        // 2. Gateway Plugin (Logical Admission, Filtering, Identity, Rate Limiter)
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
