// apps/api/src/gateway/implementations/user.gateway.ts
import crypto from "crypto";
import { Gateway, GatewayRequest, GatewayDecision, UserIdentity, AdmissionResult } from "../contracts/gateway";
import { GatewayContext } from "../contracts/gateway-context";
import { GatewayState } from "../state/gateway.state";
import { GatewayStateMachine } from "../state/gateway-state-machine";
import { GatewayMetrics } from "../contracts/gateway-metrics";
import { logger } from "@algofight/logger";
import { isAdminEmail } from "../../constants/admins";

export class UserGateway implements Gateway {
    public readonly id: string;
    public readonly context: GatewayContext;

    private readonly stateMachine: GatewayStateMachine;
    private cachedCerts: Record<string, string> = {};
    private certsExpiry = 0;

    // Metrics counters
    private activeUsers = new Map<string, number>(); // userId -> lastSeenTimestamp (AF-007)
    private activeConnections = 0;
    private totalRequests = 0;
    private totalAdmissions = 0;
    private totalRejections = 0;
    private totalErrors = 0;
    private lastHeartbeat = Date.now();

    constructor(context: GatewayContext) {
        this.id = context.gatewayId;
        this.context = context;
        this.stateMachine = new GatewayStateMachine(this.id, GatewayState.CREATED);
    }

    private pruneInactiveUsers(now = Date.now()): void {
        const ttlMs = (this.context.policy.sessionTtlSeconds || 300) * 1000;
        for (const [userId, lastSeen] of this.activeUsers.entries()) {
            if (now - lastSeen > ttlMs) {
                this.activeUsers.delete(userId);
            }
        }
    }

    public async initialize(context: GatewayContext): Promise<void> {
        this.stateMachine.transition(GatewayState.WARMING, "Initializing gateway & fetching cryptographic certs");
        try {
            await this.refreshPublicKeys();
            this.stateMachine.transition(GatewayState.READY, "Gateway warmed and ready");
        } catch (err: any) {
            this.stateMachine.transition(GatewayState.FAILED, err.message);
            throw err;
        }
    }

    public async activate(): Promise<void> {
        if (this.stateMachine.getState() === GatewayState.READY || this.stateMachine.getState() === GatewayState.DEGRADED) {
            this.stateMachine.transition(GatewayState.ACTIVE, "Activating gateway traffic");
        }
    }

    public async drain(): Promise<void> {
        this.stateMachine.transition(GatewayState.DRAINING, "Draining active connections");
    }

    public async shutdown(): Promise<void> {
        if (this.stateMachine.getState() === GatewayState.DRAINING) {
            this.stateMachine.transition(GatewayState.COMPLETED, "Drain completed");
        }
        this.stateMachine.transition(GatewayState.DESTROYED, "Gateway shut down");
        this.activeUsers.clear();
        this.activeConnections = 0;
    }

    public getState(): GatewayState {
        return this.stateMachine.getState();
    }

    public recordHeartbeat(): void {
        this.lastHeartbeat = Date.now();
    }

    public async filter(request: GatewayRequest): Promise<GatewayDecision> {
        this.totalRequests++;

        // 1. State check
        const state = this.getState();
        if (state !== GatewayState.ACTIVE && state !== GatewayState.READY && state !== GatewayState.DEGRADED) {
            this.totalRejections++;
            return {
                action: "REJECT",
                statusCode: 503,
                reason: `Gateway is currently in ${state} state and not accepting traffic.`,
            };
        }

        // 2. HTTP Method check
        if (!this.context.policy.allowedMethods.includes(request.method.toUpperCase())) {
            this.totalRejections++;
            return {
                action: "REJECT",
                statusCode: 405,
                reason: `Method ${request.method} is not permitted by Gateway policy.`,
            };
        }

        // 3. Payload size check
        if (request.contentLength && request.contentLength > this.context.policy.maxRequestBodySizeBytes) {
            this.totalRejections++;
            return {
                action: "REJECT",
                statusCode: 413,
                reason: `Payload exceeds max allowable size (${this.context.policy.maxRequestBodySizeBytes} bytes).`,
            };
        }

        return { action: "ALLOW" };
    }

    public async authenticate(request: GatewayRequest): Promise<UserIdentity | null> {
        const authHeader = request.headers.authorization;
        const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;

        if (!headerStr || !headerStr.startsWith("Bearer ")) {
            return null;
        }

        const token = headerStr.replace("Bearer ", "").trim();
        if (!token) return null;

        try {
            const certs = await this.refreshPublicKeys();
            const payload = this.verifyTokenSignature(token, certs);

            if (payload) {
                const userId = payload.user_id || payload.uid || payload.sub;
                const isExplicitAdmin = payload.admin || payload.role === "ADMIN" || isAdminEmail(payload.email);
                return {
                    id: String(userId),
                    email: payload.email,
                    username: payload.name || (payload.email ? payload.email.split("@")[0] : `user_${userId}`),
                    role: isExplicitAdmin ? "ADMIN" : "USER",
                    platformCode: payload.platformCode,
                    institutionName: payload.institutionName,
                    rawToken: token,
                };
            }

            // Dev / synthetic fallback when not in strict production
            if (process.env.NODE_ENV !== "production") {
                const parts = token.split(".");
                if (parts.length === 3) {
                    const devPayload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
                    const userId = devPayload.user_id || devPayload.uid || devPayload.sub || devPayload.id;
                    if (userId) {
                        const isDevAdmin = devPayload.role === "ADMIN" || isAdminEmail(devPayload.email);
                        return {
                            id: String(userId),
                            email: devPayload.email,
                            username: devPayload.name || (devPayload.email ? devPayload.email.split("@")[0] : `dev_${userId}`),
                            role: isDevAdmin ? "ADMIN" : "USER",
                            rawToken: token,
                        };
                    }
                }
            }
        } catch (err: any) {
            this.totalErrors++;
            logger.debug({ error: err.message, gatewayId: this.id }, "Token verification failure in UserGateway");
        }

        return null;
    }

    public async admit(identity: UserIdentity, request: GatewayRequest): Promise<AdmissionResult> {
        const now = Date.now();
        this.pruneInactiveUsers(now);

        // Enforce capacity limits per gateway/context (AF-007)
        if (this.activeUsers.size >= this.context.capacity && !this.activeUsers.has(identity.id)) {
            this.totalRejections++;
            return {
                admitted: false,
                statusCode: 429,
                reason: `Gateway capacity limit reached (${this.context.capacity} active users).`,
                retryAfterSeconds: 5,
            };
        }

        this.activeUsers.set(identity.id, now);
        this.totalAdmissions++;
        return {
            admitted: true,
            assignedTier: "TIER_1",
        };
    }

    public getMetrics(): GatewayMetrics {
        this.pruneInactiveUsers();
        const capacity = Math.max(1, this.context.capacity);
        const activeCount = this.activeUsers.size;
        return {
            gatewayId: this.id,
            contextId: this.context.contextId,
            state: this.getState(),
            capacity,
            activeUsers: activeCount,
            activeConnections: this.activeConnections,
            totalRequests: this.totalRequests,
            totalAdmissions: this.totalAdmissions,
            totalRejections: this.totalRejections,
            totalErrors: this.totalErrors,
            utilization: Number((activeCount / capacity).toFixed(4)),
            lastHeartbeat: this.lastHeartbeat,
        };
    }

    private async refreshPublicKeys(): Promise<Record<string, string>> {
        const now = Date.now();
        if (now < this.certsExpiry && Object.keys(this.cachedCerts).length > 0) {
            return this.cachedCerts;
        }

        try {
            const res = await fetch(
                "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
                { signal: AbortSignal.timeout(3000) }
            );
            if (res.ok) {
                this.cachedCerts = await res.json();
                this.certsExpiry = now + 6 * 60 * 60 * 1000; // 6h TTL
            }
        } catch (err: any) {
            logger.warn({ error: err.message }, "Failed to fetch Google Firebase certificates");
        }

        return this.cachedCerts;
    }

    private verifyTokenSignature(token: string, certs: Record<string, string>): any | null {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, sigB64] = parts;
        const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

        if (header.alg !== "RS256" || !header.kid) return null;

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) return null;

        // 🛡️ AF-008: Validate Firebase token claims
        const projectId = process.env.FIREBASE_PROJECT_ID;
        if (projectId) {
            if (payload.aud !== projectId) return null;
            if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
        }
        if (payload.auth_time && payload.auth_time > now + 300) return null;

        const cert = certs[header.kid];
        if (!cert) return null;

        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(`${headerB64}.${payloadB64}`);
        const sig = Buffer.from(sigB64, "base64url");

        return verifier.verify(cert, sig) ? payload : null;
    }
}
