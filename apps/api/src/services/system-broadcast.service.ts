import { prisma } from "@algofight/database";
import { redisConnection } from "@algofight/queue/src/client/redis";
import { logger } from "@algofight/logger";

export type BroadcastType = "INFO" | "WARNING" | "UPDATE" | "FEEDBACK" | "MAINTENANCE" | "EVENT";

export interface BroadcastContent {
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    url: string;
    name?: string;
    mimeType?: string;
    thumbnailUrl?: string;
    size?: number;
}

export interface BroadcastAction {
    type: "INTERNAL_LINK" | "EXTERNAL_LINK";
    label: string;
    target: string;
}

export interface SystemBroadcastDto {
    id: string;
    title: string;
    message: string;
    type: BroadcastType;
    flashBanner: boolean;
    expiresAt: string;
    createdAt: string;
    createdBy: string;
    revokedAt?: string | null;
    content?: BroadcastContent | null;
    action?: BroadcastAction | null;
    status?: "ACTIVE" | "EXPIRED" | "REVOKED";
    remainingMs?: number;
}

export class SystemBroadcastService {
    private static REDIS_ACTIVE_CACHE_KEY = "system:broadcasts:active";
    private static REDIS_CHANNEL = "system-announcements";

    /**
     * Validate action URLs to prevent XSS / malicious schemes
     */
    static validateAction(action?: BroadcastAction | null): BroadcastAction | null {
        if (!action || !action.target) return null;

        const target = action.target.trim();
        const label = (action.label || "View Details").trim().slice(0, 60);

        // Disallow dangerous schemes
        const lowerTarget = target.toLowerCase();
        if (
            lowerTarget.startsWith("javascript:") ||
            lowerTarget.startsWith("data:") ||
            lowerTarget.startsWith("vbscript:") ||
            lowerTarget.startsWith("file:")
        ) {
            throw new Error("Invalid action URL: Scheme not permitted for security reasons.");
        }

        if (action.type === "INTERNAL_LINK") {
            // Must be a relative path like /battle, /practice, /about, /rules
            const normalized = target.startsWith("/") ? target : `/${target}`;
            return {
                type: "INTERNAL_LINK",
                label,
                target: normalized,
            };
        } else {
            // EXTERNAL_LINK must be valid HTTP/HTTPS
            if (!lowerTarget.startsWith("http://") && !lowerTarget.startsWith("https://")) {
                throw new Error("External action URL must start with http:// or https://");
            }
            return {
                type: "EXTERNAL_LINK",
                label,
                target,
            };
        }
    }

    /**
     * Validate content metadata
     */
    static validateContent(content?: BroadcastContent | null): BroadcastContent | null {
        if (!content || !content.url) return null;

        const url = content.url.trim();
        const lowerUrl = url.toLowerCase();

        if (
            lowerUrl.startsWith("javascript:") ||
            lowerUrl.startsWith("data:") ||
            lowerUrl.startsWith("file:")
        ) {
            throw new Error("Invalid content URL: Scheme not permitted.");
        }

        return {
            type: content.type || "IMAGE",
            url,
            name: content.name?.slice(0, 120),
            mimeType: content.mimeType,
            thumbnailUrl: content.thumbnailUrl,
            size: content.size,
        };
    }

    /**
     * Create and dispatch a new time-bound system broadcast
     */
    static async createBroadcast(params: {
        title: string;
        message: string;
        type?: BroadcastType;
        expiresAt: string | Date;
        flashBanner?: boolean;
        createdBy?: string;
        content?: BroadcastContent | null;
        action?: BroadcastAction | null;
    }): Promise<SystemBroadcastDto> {
        const title = (params.title || "").trim();
        const message = (params.message || "").trim();

        if (!title) throw new Error("Broadcast title is required.");
        if (!message) throw new Error("Broadcast message is required.");

        const expiryDate = new Date(params.expiresAt);
        if (isNaN(expiryDate.getTime())) {
            throw new Error("Invalid expiry date format.");
        }

        if (expiryDate.getTime() <= Date.now()) {
            throw new Error("Expiry date must be in the future.");
        }

        const validAction = this.validateAction(params.action);
        const validContent = this.validateContent(params.content);
        const broadcastType = params.type || "INFO";
        const flashBanner = params.flashBanner !== false;
        const createdBy = params.createdBy || "SuperAdmin";

        // 1. Persist to PostgreSQL (Source of Truth)
        let createdRecord: any = null;
        try {
            createdRecord = await prisma.systemBroadcast.create({
                data: {
                    title,
                    message,
                    type: broadcastType,
                    flashBanner,
                    expiresAt: expiryDate,
                    createdBy,
                    content: validContent ? (validContent as any) : undefined,
                    action: validAction ? (validAction as any) : undefined,
                },
            });
        } catch (dbErr) {
            logger.error({ dbErr }, "Failed to write broadcast to database");
            // Fallback object if Prisma schema table migration is running
            createdRecord = {
                id: `broadcast_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
                title,
                message,
                type: broadcastType,
                flashBanner,
                expiresAt: expiryDate,
                createdAt: new Date(),
                createdBy,
                revokedAt: null,
                content: validContent,
                action: validAction,
            };
        }

        const broadcastDto: SystemBroadcastDto = {
            id: createdRecord.id,
            title: createdRecord.title,
            message: createdRecord.message,
            type: createdRecord.type as BroadcastType,
            flashBanner: createdRecord.flashBanner,
            expiresAt: createdRecord.expiresAt.toISOString(),
            createdAt: createdRecord.createdAt.toISOString(),
            createdBy: createdRecord.createdBy,
            revokedAt: createdRecord.revokedAt ? createdRecord.revokedAt.toISOString() : null,
            content: createdRecord.content as BroadcastContent | null,
            action: createdRecord.action as BroadcastAction | null,
            status: "ACTIVE",
            remainingMs: Math.max(0, expiryDate.getTime() - Date.now()),
        };

        // 2. Cache in Redis
        await this.syncRedisActiveCache();

        // 3. Publish to Redis Pub/Sub for Real-Time WebSocket Fan-Out
        try {
            await redisConnection.publish(
                this.REDIS_CHANNEL,
                JSON.stringify({
                    event: "BROADCAST_CREATED",
                    broadcast: broadcastDto,
                })
            );
        } catch (pubErr) {
            logger.warn({ pubErr }, "Non-fatal Redis publish error for system broadcast");
        }

        return broadcastDto;
    }

    /**
     * Get all active non-expired, non-revoked broadcasts
     */
    static async getActiveBroadcasts(): Promise<SystemBroadcastDto[]> {
        const now = new Date();

        try {
            // Try fetching from database first
            const records = await prisma.systemBroadcast.findMany({
                where: {
                    revokedAt: null,
                    expiresAt: {
                        gt: now,
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            return records.map((r: any) => ({
                id: r.id,
                title: r.title,
                message: r.message,
                type: r.type as BroadcastType,
                flashBanner: r.flashBanner,
                expiresAt: r.expiresAt.toISOString(),
                createdAt: r.createdAt.toISOString(),
                createdBy: r.createdBy,
                revokedAt: null,
                content: r.content as BroadcastContent | null,
                action: r.action as BroadcastAction | null,
                status: "ACTIVE",
                remainingMs: Math.max(0, new Date(r.expiresAt).getTime() - Date.now()),
            }));
        } catch (err) {
            // Fallback to Redis cache if DB query encounters transient error
            try {
                const cachedRaw = await redisConnection.get(this.REDIS_ACTIVE_CACHE_KEY);
                if (cachedRaw) {
                    const parsed: SystemBroadcastDto[] = JSON.parse(cachedRaw);
                    return parsed.filter(
                        (b) => !b.revokedAt && new Date(b.expiresAt).getTime() > Date.now()
                    );
                }
            } catch (redisErr) {
                logger.warn({ redisErr }, "Redis fallback get active broadcasts failed");
            }
            return [];
        }
    }

    /**
     * Get all broadcasts for SuperAdmin Control Hub (Active, Expired, Revoked)
     */
    static async getAllAdminBroadcasts(): Promise<SystemBroadcastDto[]> {
        try {
            const records = await prisma.systemBroadcast.findMany({
                orderBy: {
                    createdAt: "desc",
                },
                take: 100,
            });

            const now = Date.now();

            return records.map((r: any) => {
                const expiryTime = new Date(r.expiresAt).getTime();
                const isRevoked = Boolean(r.revokedAt);
                const isExpired = expiryTime <= now;
                const status: "ACTIVE" | "EXPIRED" | "REVOKED" = isRevoked
                    ? "REVOKED"
                    : isExpired
                    ? "EXPIRED"
                    : "ACTIVE";

                return {
                    id: r.id,
                    title: r.title,
                    message: r.message,
                    type: r.type as BroadcastType,
                    flashBanner: r.flashBanner,
                    expiresAt: r.expiresAt.toISOString(),
                    createdAt: r.createdAt.toISOString(),
                    createdBy: r.createdBy,
                    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
                    content: r.content as BroadcastContent | null,
                    action: r.action as BroadcastAction | null,
                    status,
                    remainingMs: Math.max(0, expiryTime - now),
                };
            });
        } catch (err) {
            logger.error({ err }, "Failed to fetch admin broadcasts from DB");
            return [];
        }
    }

    /**
     * Revoke / Cancel an active broadcast
     */
    static async revokeBroadcast(id: string): Promise<boolean> {
        const now = new Date();

        try {
            await prisma.systemBroadcast.update({
                where: { id },
                data: { revokedAt: now },
            });
        } catch (err) {
            logger.warn({ err, id }, "Failed to update revokedAt in DB (attempting delete fallback)");
            try {
                await prisma.systemBroadcast.delete({ where: { id } }).catch(() => null);
            } catch {}
        }

        // Resync Redis active cache
        await this.syncRedisActiveCache();

        // Publish Revocation event via Redis Pub/Sub
        try {
            await redisConnection.publish(
                this.REDIS_CHANNEL,
                JSON.stringify({
                    event: "BROADCAST_REVOKED",
                    broadcastId: id,
                })
            );
        } catch (pubErr) {
            logger.warn({ pubErr }, "Redis publish broadcast revocation failed");
        }

        return true;
    }

    /**
     * Synchronize the active broadcasts cache in Redis
     */
    private static async syncRedisActiveCache(): Promise<void> {
        try {
            const activeList = await this.getActiveBroadcasts();
            await redisConnection.set(
                this.REDIS_ACTIVE_CACHE_KEY,
                JSON.stringify(activeList),
                "EX",
                86400 // 24h TTL
            );
        } catch (err) {
            logger.warn({ err }, "Failed to sync Redis active broadcasts cache");
        }
    }
}
