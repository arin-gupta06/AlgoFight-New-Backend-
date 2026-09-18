// apps/api/src/gateway/admission/admission.controller.ts
import { Gateway, GatewayRequest, UserIdentity, AdmissionResult } from "../contracts/gateway";
import { UserTrustContext, TrustContextSigner } from "../session/trust-context";
import { userSessionStore } from "../session/user-session";
import { revocationStore } from "../session/revocation-store";
import { ipJail } from "../policies/ip-jail";
import { gatewayRateLimiter } from "../policies/rate-limiter";
import { admissionPolicyEngine } from "./admission-policy";

export class AdmissionController {
    public async processAdmission(
        gateway: Gateway,
        identity: UserIdentity | null,
        request: GatewayRequest
    ): Promise<{ admitted: boolean; statusCode: number; reason?: string; trustContext?: UserTrustContext }> {
        // 1. Check IP Jail
        if (ipJail.isJailed(request.ip)) {
            return {
                admitted: false,
                statusCode: 429,
                reason: "IP address is temporarily throttled due to excessive failed attempts.",
            };
        }

        // 2. IP Rate Limit
        const ipLimit = gatewayRateLimiter.checkRateLimit(
            `ip:${request.ip}`,
            gateway.context.policy.ipRateLimit.maxRequestsPerMinute,
            gateway.context.policy.ipRateLimit.burstLimit
        );
        if (!ipLimit.allowed) {
            return {
                admitted: false,
                statusCode: 429,
                reason: `IP rate limit exceeded. Retry in ${ipLimit.retryAfterSeconds}s.`,
            };
        }

        // 3. Unauthenticated requests allowed for public endpoints
        if (!identity) {
            return { admitted: true, statusCode: 200 };
        }

        // 4. Check Revocation
        if (revocationStore.isRevoked({ userId: identity.id, token: identity.rawToken })) {
            return {
                admitted: false,
                statusCode: 401,
                reason: "User session has been revoked or invalidated.",
            };
        }

        // 5. User-level Rate Limit
        const userLimit = gatewayRateLimiter.checkRateLimit(
            `user:${identity.id}`,
            gateway.context.policy.userRateLimit.maxRequestsPerMinute,
            gateway.context.policy.userRateLimit.burstLimit
        );
        if (!userLimit.allowed) {
            return {
                admitted: false,
                statusCode: 429,
                reason: `User rate limit exceeded. Retry in ${userLimit.retryAfterSeconds}s.`,
            };
        }

        // 6. Traffic Priority Classification & Load Shedding
        const tier = admissionPolicyEngine.classifyTraffic(request.path, request.method);
        const metrics = gateway.getMetrics();
        if (!admissionPolicyEngine.shouldAdmit(tier, metrics.utilization)) {
            return {
                admitted: false,
                statusCode: 503,
                reason: `Gateway under high load. Low-priority request temporarily shed.`,
            };
        }

        // 7. Gateway Admission Call
        const admission: AdmissionResult = await gateway.admit(identity, request);
        if (!admission.admitted) {
            return {
                admitted: false,
                statusCode: admission.statusCode || 429,
                reason: admission.reason || "Gateway admission rejected.",
            };
        }

        // 8. Establish Session & UserTrustContext
        let session = await userSessionStore.getSessionByUserId(identity.id);
        if (!session) {
            session = await userSessionStore.createSession({
                userId: identity.id,
                gatewayId: gateway.id,
                contextId: gateway.context.contextId,
                ip: request.ip,
                userAgent: request.headers["user-agent"] as string,
                email: identity.email,
                username: identity.username,
                role: identity.role,
                platformCode: identity.platformCode,
                institutionName: identity.institutionName,
            });
        } else {
            await userSessionStore.touchSession(session.sessionId);
        }

        const now = Math.floor(Date.now() / 1000);
        const unsignedContext: Omit<UserTrustContext, "signature"> = {
            userId: identity.id,
            sessionId: session.sessionId,
            gatewayId: gateway.id,
            contextId: gateway.context.contextId,
            issuedAt: now,
            expiresAt: now + 3600, // 1 hour TTL
            role: identity.role,
            email: identity.email,
            username: identity.username,
            platformCode: identity.platformCode,
            institutionName: identity.institutionName,
            assignedTier: tier,
        };

        const signature = TrustContextSigner.sign(unsignedContext);
        const trustContext: UserTrustContext = {
            ...unsignedContext,
            signature,
        };

        return {
            admitted: true,
            statusCode: 200,
            trustContext,
        };
    }
}

export const admissionController = new AdmissionController();
