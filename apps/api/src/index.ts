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
import { authRoutes } from "./routes/auth.route";
import { feedbackRoutes } from "./routes/feedback.route";
import { rewardRoutes } from "./routes/reward.route";
import { intelRoutes } from "./routes/intel.route";
import { extractClientIp } from "./utils/ip.util";
import { auditService, AuditCategory, AuditSeverity } from "./services/audit.service";

const app = fastify({
    bodyLimit: 1048576, // 1 MB Request Body Limit
    trustProxy: true, // Respect X-Forwarded-For and X-Real-IP behind reverse proxies (Nginx / Cloudflare)
});

const start = async () => {
    try {
        // 1. CORS with secure origin matching
        const allowedProdDomains = [
            "https://algofight-arena.vercel.app",
            "https://algofight.com",
            "https://www.algofight.com",
            "https://algo.mitsgwalior.in",
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

        // 1b. Strict Security Headers (HSTS, CSP, Anti-Clickjacking, Mime Sniff Protection)
        app.addHook("onSend", async (_request, reply, payload) => {
            reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
            reply.header("X-Content-Type-Options", "nosniff");
            reply.header("X-Frame-Options", "DENY");
            reply.header("X-XSS-Protection", "1; mode=block");
            reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
            reply.header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https: wss: ws: http://localhost:* ws://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
            );
            reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
            return payload;
        });

        // 1c. Compression Plugin (Brotli & Gzip for responses >= 1KB)
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
            max: config.rateLimitMax || 300,
            timeWindow: "1 minute",
            keyGenerator: (req) => extractClientIp(req),
            errorResponseBuilder: (req, context) => {
                const clientIp = extractClientIp(req);
                auditService.recordEvent({
                    category: "SECURITY",
                    severity: "WARN",
                    action: "RATE_LIMIT_EXCEEDED",
                    actor: (req as any).user?.username || clientIp,
                    ip: clientIp,
                    method: req.method,
                    details: `Rate limit exceeded on ${req.method} ${req.url}. Window: 1m, Retry in ${Math.ceil(context.ttl / 1000)}s`,
                    metadata: { path: req.url, ttl: context.ttl },
                });
                return {
                    statusCode: 429,
                    error: "TOO_MANY_REQUESTS",
                    message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
                };
            },
        });

        // 2b. Global HTTP Traffic Logging Hook (Captures completed requests cleanly)
        app.addHook("onResponse", async (request, reply) => {
            const url = request.url;
            const statusCode = reply.statusCode;

            // 1. Ignore static assets
            if (url.startsWith("/favicon") || url.startsWith("/@") || url.startsWith("/node_modules")) return;

            // 2. Suppress high-frequency internal telemetry/status read polls when successful (prevents self-logging loop)
            const isInternalTelemetryPoll =
                statusCode < 400 &&
                (url.startsWith("/api/admin/audit-logs") ||
                 url.startsWith("/api/admin/metrics") ||
                 url.startsWith("/api/admin/analytics") ||
                 url.startsWith("/api/admin/linux-status") ||
                 url === "/health" ||
                 url === "/metrics");
            if (isInternalTelemetryPoll) return;

            // 3. Skip if this request failure was already recorded in error-handler
            if ((request as any)._auditLogged) return;

            const durationMs = reply.elapsedTime ? Math.round(reply.elapsedTime) : 0;
            const clientIp = extractClientIp(request);
            const adminSecret = config.adminSecretKey || process.env.ADMIN_SECRET_KEY;
            const isAdmin = Boolean(adminSecret && request.headers["x-admin-key"] === adminSecret);
            const user = (request as any).user || (request as any).trustContext;
            const body = (request.body as any) || {};
            const query = (request.query as any) || {};

            const actor =
                user?.username ||
                user?.displayName ||
                body.username ||
                body.name ||
                (typeof body.email === "string" ? body.email.split("@")[0] : null) ||
                query.username ||
                (isAdmin ? "SuperAdmin" : (user?.id ? `user_${user.id.slice(0, 8)}` : (clientIp === "127.0.0.1" ? "LocalHost" : `Guest (${clientIp})`)));

            let category: AuditCategory = "HTTP_TRAFFIC";
            let action = `HTTP_${request.method}_${statusCode}`;
            let details = `${request.method} ${url} -> ${statusCode} (${durationMs}ms)`;

            if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
                category = "SECURITY";
                action = statusCode === 429 ? "RATE_LIMIT_BLOCKED" : statusCode === 403 ? "ACCESS_FORBIDDEN" : "AUTH_UNAUTHORIZED";
                details = `${statusCode === 429 ? "Rate limit throttled" : "Unauthorized request"} on ${request.method} ${url} [${statusCode}] (${durationMs}ms)`;
            } else if (url.includes("/auth/login")) {
                category = "AUTH";
                action = statusCode < 400 ? "USER_LOGIN_SUCCESS" : "USER_LOGIN_FAILED";
                details = statusCode < 400 ? `Combatant ${actor} authenticated successfully` : `Login attempt failed for ${actor} [${statusCode}]`;
            } else if (url.includes("/auth/register") || url.includes("/auth/signup")) {
                category = "AUTH";
                action = statusCode < 400 ? "USER_REGISTERED" : "USER_REGISTRATION_FAILED";
                details = statusCode < 400 ? `New combatant account created for ${actor}` : `Registration failed for ${actor} [${statusCode}]`;
            } else if (url.includes("/auth/logout")) {
                category = "AUTH";
                action = "USER_LOGGED_OUT";
                details = `User ${actor} logged out`;
            } else if (url.includes("/submissions/execute-direct")) {
                category = "SUBMISSION";
                action = "CODE_EXECUTE_DIRECT";
                details = `Direct code run in ${(body.language || "code").toUpperCase()} by ${actor} (${durationMs}ms)`;
            } else if (url.includes("/submissions/submit") || url.includes("/submissions/evaluate-practice")) {
                category = "SUBMISSION";
                action = url.includes("practice") ? "PRACTICE_EVALUATION" : "BATTLE_SUBMISSION";
                details = `Code evaluated on Problem #${body.problemId || query.problemId || "N/A"} in ${(body.language || "code").toUpperCase()} by ${actor} (${durationMs}ms)`;
            } else if (url.includes("/battle/create-room")) {
                category = "BATTLE";
                action = "BATTLE_ROOM_CREATED";
                details = `New battle room created by ${actor}`;
            } else if (url.includes("/battle/room")) {
                category = "BATTLE";
                action = "BATTLE_ROOM_QUERY";
                details = `${request.method} room query on ${url} by ${actor}`;
            } else if (url.includes("/feedback")) {
                category = "SYSTEM";
                action = "FEEDBACK_SUBMITTED";
                details = `Platform review submitted by ${actor} (${body.rating ? `${body.rating} stars` : "feedback"})`;
            } else if (url.includes("/admin/broadcast")) {
                category = "ADMIN";
                action = "BROADCAST_MODIFIED";
                details = `Broadcast action performed by ${actor} on ${url}`;
            } else if (url.includes("/admin/fleet") || url.includes("/admin/scale")) {
                category = "FLEET";
                action = "FLEET_ORCHESTRATION";
                details = `Fleet scaling/orchestration trigger by ${actor}`;
            } else if (url.includes("/admin")) {
                category = "ADMIN";
                action = `ADMIN_${request.method}`;
                details = `Admin management action on ${url} by ${actor}`;
            } else if (url.includes("/ws")) {
                category = "WEBSOCKET";
                action = "WS_REQUEST";
            } else if (url.includes("/analytics")) {
                category = "PAGE_VIEW";
                action = "ANALYTICS_EVENT";
                details = `Analytics ingestion on ${url} by ${actor}`;
            } else if (url.includes("/problems")) {
                category = "SYSTEM";
                action = request.method === "GET" ? "PROBLEM_QUERY" : "PROBLEM_UPDATE";
                details = `${request.method} Problem repository on ${url}`;
            } else if (url.includes("/notifications")) {
                category = "SYSTEM";
                action = "NOTIFICATIONS_QUERY";
            }

            let severity: AuditSeverity = "INFO";
            if (statusCode >= 500) severity = "ERROR";
            else if (statusCode >= 400) severity = "WARN";

            auditService.recordEvent({
                category,
                severity,
                action,
                actor,
                ip: clientIp,
                method: request.method,
                details,
                metadata: {
                    statusCode,
                    durationMs,
                    path: url,
                    ip: clientIp,
                    actor,
                    userAgent: request.headers["user-agent"],
                    requestId: (request as any).requestId,
                    problemId: body.problemId || query.problemId,
                    language: body.language,
                    rating: body.rating,
                    roomId: body.roomId || query.roomId,
                },
            });
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
            instance.register(authRoutes);
            instance.register(submissionRoutes);
            instance.register(problemRoutes);
            instance.register(userRoutes);
            instance.register(battleRoutes);
            instance.register(matchmakingRoutes);
            instance.register(adminRoutes);
            instance.register(notificationRoutes);
            instance.register(analyticsRoutes);
            instance.register(facultyRoutes);
            instance.register(feedbackRoutes);
            instance.register(rewardRoutes);
            instance.register(intelRoutes);
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
    try {
        auditService.recordEvent({
            category: "SYSTEM",
            severity: "WARN",
            action: "UNHANDLED_PROMISE_REJECTION",
            actor: "Node_Process",
            ip: "127.0.0.1",
            method: "EVENT",
            details: String(reason?.message || reason).slice(0, 300),
        });
    } catch {}
});

process.on("uncaughtException", (error: Error) => {
    logger.error({ error: error.message, stack: error.stack }, "Uncaught exception intercepted by process guard");
    try {
        auditService.recordEvent({
            category: "SYSTEM",
            severity: "CRITICAL",
            action: "UNCAUGHT_EXCEPTION",
            actor: "Node_Process",
            ip: "127.0.0.1",
            method: "EVENT",
            details: String(error.message).slice(0, 300),
            metadata: { stack: error.stack },
        });
    } catch {}
});

start();
