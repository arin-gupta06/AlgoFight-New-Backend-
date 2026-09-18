// apps/api/src/services/access-protection.service.ts
import { redisConnection } from "@algofight/queue";
import { logger } from "@algofight/logger";

export interface AccessProtectionConfig {
    maxAttempts: number;
    windowSeconds: number;
    cooldownSeconds: number;
}

const DEFAULT_CONFIG: Record<string, AccessProtectionConfig> = {
    BATTLE_ACCESS: { maxAttempts: 5, windowSeconds: 180, cooldownSeconds: 60 },
    AUTH_LOGIN: { maxAttempts: 5, windowSeconds: 300, cooldownSeconds: 120 },
    ROOM_JOIN: { maxAttempts: 6, windowSeconds: 180, cooldownSeconds: 90 },
};

export class AccessProtectionService {
    private getKeys(context: string, ip: string, userId?: string, resourceId?: string) {
        // Multi-signal composite identifier to avoid blanket IP jailing in college labs
        const identityPart = userId ? `u_${userId}` : `ip_${ip}`;
        const resourcePart = resourceId ? `r_${resourceId}` : "global";
        const counterKey = `abuse_cnt:${context}:${identityPart}:${resourcePart}`;
        const cooldownKey = `abuse_cd:${context}:${identityPart}:${resourcePart}`;
        return { counterKey, cooldownKey };
    }

    public async checkRestriction(
        context: string,
        ip: string,
        userId?: string,
        resourceId?: string
    ): Promise<{ isRestricted: boolean; retryAfterSeconds: number }> {
        const { cooldownKey } = this.getKeys(context, ip, userId, resourceId);

        try {
            const ttl = await redisConnection.ttl(cooldownKey);
            if (ttl > 0) {
                return { isRestricted: true, retryAfterSeconds: ttl };
            }
        } catch (err: any) {
            logger.debug({ error: err.message }, "AccessProtection check fallback");
        }

        return { isRestricted: false, retryAfterSeconds: 0 };
    }

    public async recordFailure(
        context: string,
        ip: string,
        userId?: string,
        resourceId?: string
    ): Promise<{ isRestricted: boolean; retryAfterSeconds: number }> {
        const config = DEFAULT_CONFIG[context] || { maxAttempts: 5, windowSeconds: 180, cooldownSeconds: 60 };
        const { counterKey, cooldownKey } = this.getKeys(context, ip, userId, resourceId);

        try {
            const count = await redisConnection.incr(counterKey);
            if (count === 1) {
                await redisConnection.expire(counterKey, config.windowSeconds);
            }

            if (count >= config.maxAttempts) {
                await redisConnection.set(cooldownKey, "1", "EX", config.cooldownSeconds);
                await redisConnection.del(counterKey); // reset counter once cooldown is applied
                logger.warn({ context, ip, userId, resourceId, cooldown: config.cooldownSeconds }, "Access protection cooldown triggered");
                return { isRestricted: true, retryAfterSeconds: config.cooldownSeconds };
            }
        } catch (err: any) {
            logger.debug({ error: err.message }, "AccessProtection recordFailure fallback");
        }

        return { isRestricted: false, retryAfterSeconds: 0 };
    }

    public async resetFailures(context: string, ip: string, userId?: string, resourceId?: string): Promise<void> {
        const { counterKey, cooldownKey } = this.getKeys(context, ip, userId, resourceId);
        try {
            await redisConnection.del(counterKey, cooldownKey);
        } catch {
            // Ignored
        }
    }
}

export const accessProtectionService = new AccessProtectionService();
