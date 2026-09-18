// apps/api/src/gateway/session/user-session.ts
import crypto from "crypto";
import { redisConnection } from "@algofight/queue";
import { logger } from "@algofight/logger";

export interface UserSession {
    readonly sessionId: string;
    readonly userId: string;
    readonly gatewayId: string;
    readonly contextId: string;
    readonly createdAt: number;
    readonly lastActiveAt: number;
    readonly expiresAt: number;
    readonly ip: string;
    readonly userAgent?: string;
    readonly email?: string;
    readonly username?: string;
    readonly role?: "ADMIN" | "USER";
    readonly platformCode?: string;
    readonly institutionName?: string;
    readonly status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

export interface UserActivitySession {
    type: "BATTLE" | "EXAM" | "QUIZ";
    activityId: string;
    joinedAt: number;
    disconnectedAt?: number;
    status: "ACTIVE" | "DISCONNECTED" | "COMPLETED";
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days rolling session

export class UserSessionStore {
    private readonly localSessions = new Map<string, UserSession>();
    private readonly userToSession = new Map<string, string>();

    public async createSession(params: {
        userId: string;
        gatewayId?: string;
        contextId?: string;
        ip?: string;
        userAgent?: string;
        email?: string;
        username?: string;
        role?: "ADMIN" | "USER";
        platformCode?: string;
        institutionName?: string;
    }): Promise<UserSession> {
        const sessionId = `af_sess_${crypto.randomBytes(24).toString("hex")}`;
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_SECONDS * 1000;

        const session: UserSession = {
            sessionId,
            userId: params.userId,
            gatewayId: params.gatewayId || "gw_default",
            contextId: params.contextId || "ctx_default",
            createdAt: now,
            lastActiveAt: now,
            expiresAt,
            ip: params.ip || "unknown",
            userAgent: params.userAgent,
            email: params.email,
            username: params.username,
            role: params.role || "USER",
            platformCode: params.platformCode,
            institutionName: params.institutionName,
            status: "ACTIVE",
        };

        // 1. Write to local fallback
        this.localSessions.set(sessionId, session);
        this.userToSession.set(params.userId, sessionId);

        // 2. Persist to Redis (fast path)
        try {
            const key = `af_sess:${sessionId}`;
            const userKey = `user_sessions:${params.userId}`;
            await redisConnection.set(key, JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
            await redisConnection.sadd(userKey, sessionId);
            await redisConnection.expire(userKey, SESSION_TTL_SECONDS);
        } catch (err: any) {
            logger.warn({ error: err.message }, "Redis session write fallback to memory");
        }

        return session;
    }

    public async getSession(sessionId: string): Promise<UserSession | null> {
        if (!sessionId) return null;

        // Try Redis first
        try {
            const key = `af_sess:${sessionId}`;
            const raw = await redisConnection.get(key);
            if (raw) {
                const session: UserSession = JSON.parse(raw);
                if (session.status === "ACTIVE" && session.expiresAt > Date.now()) {
                    this.localSessions.set(sessionId, session);
                    return session;
                }
            }
        } catch (err: any) {
            logger.debug({ error: err.message }, "Redis session read fallback to memory");
        }

        // Fallback to local memory
        const local = this.localSessions.get(sessionId);
        if (local && local.status === "ACTIVE" && local.expiresAt > Date.now()) {
            return local;
        }

        return null;
    }

    public async getSessionByUserId(userId: string): Promise<UserSession | null> {
        if (!userId) return null;

        try {
            const userKey = `user_sessions:${userId}`;
            const sessionIds = await redisConnection.smembers(userKey);
            if (sessionIds && sessionIds.length > 0) {
                // Return latest active session
                for (let i = sessionIds.length - 1; i >= 0; i--) {
                    const sess = await this.getSession(sessionIds[i]);
                    if (sess) return sess;
                }
            }
        } catch (err: any) {
            logger.debug({ error: err.message }, "Redis getSessionByUserId fallback");
        }

        const localId = this.userToSession.get(userId);
        return localId ? this.getSession(localId) : null;
    }

    public async touchSession(sessionId: string): Promise<void> {
        if (!sessionId) return;
        const now = Date.now();
        const newExpiresAt = now + SESSION_TTL_SECONDS * 1000;

        const local = this.localSessions.get(sessionId);
        if (local) {
            (local as any).lastActiveAt = now;
            (local as any).expiresAt = newExpiresAt;
        }

        try {
            const key = `af_sess:${sessionId}`;
            const raw = await redisConnection.get(key);
            if (raw) {
                const session: UserSession = JSON.parse(raw);
                (session as any).lastActiveAt = now;
                (session as any).expiresAt = newExpiresAt;
                await redisConnection.set(key, JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
            }
        } catch (err: any) {
            logger.debug({ error: err.message }, "Redis touchSession error");
        }
    }

    public async invalidateSession(sessionId: string): Promise<void> {
        const local = this.localSessions.get(sessionId);
        if (local) {
            this.userToSession.delete(local.userId);
            this.localSessions.delete(sessionId);
        }

        try {
            const key = `af_sess:${sessionId}`;
            const raw = await redisConnection.get(key);
            if (raw) {
                const session: UserSession = JSON.parse(raw);
                await redisConnection.srem(`user_sessions:${session.userId}`, sessionId);
            }
            await redisConnection.del(key);
        } catch (err: any) {
            logger.warn({ error: err.message }, "Redis invalidateSession error");
        }
    }

    // 🛡️ Activity Session Management (Issue 2)
    public async setActiveActivity(userId: string, activity: UserActivitySession): Promise<void> {
        try {
            const key = `user_active_activity:${userId}`;
            await redisConnection.set(key, JSON.stringify(activity), "EX", 1800); // 30 mins
        } catch (err: any) {
            logger.warn({ error: err.message }, "Failed to set active activity");
        }
    }

    public async getActiveActivity(userId: string): Promise<UserActivitySession | null> {
        try {
            const key = `user_active_activity:${userId}`;
            const raw = await redisConnection.get(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    public async clearActiveActivity(userId: string): Promise<void> {
        try {
            await redisConnection.del(`user_active_activity:${userId}`);
        } catch {
            // Ignored
        }
    }
}

export const userSessionStore = new UserSessionStore();
