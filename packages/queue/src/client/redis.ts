import IORedis, { Redis } from "ioredis";

export function createRedisClient(): Redis {
    const rawUrl =
        process.env.REDIS_URL ||
        process.env.REDIS_PRIVATE_URL ||
        (process.env.REDIS_HOST?.startsWith("redis://") ||
        process.env.REDIS_HOST?.startsWith("valkey://") ||
        process.env.REDIS_HOST?.startsWith("rediss://")
            ? process.env.REDIS_HOST
            : null);

    const isTls = rawUrl ? rawUrl.startsWith("rediss://") : process.env.REDIS_TLS === "true";

    const client = rawUrl
        ? new IORedis(rawUrl, {
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              tls: isTls ? { rejectUnauthorized: false } : undefined,
              retryStrategy(time) {
                  return Math.min(time * 50, 2000);
              },
          })
        : new IORedis({
              host: process.env.REDIS_HOST || "localhost",
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
              tls: isTls ? { rejectUnauthorized: false } : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              retryStrategy(time) {
                  return Math.min(time * 50, 2000);
              },
          });

    client.on("error", (err: any) => {
        // Log non-fatal error to avoid uncaught exception
        if (process.env.NODE_ENV !== "test") {
            console.warn(`[Redis Client Warning]: ${err?.message || err}`);
        }
    });

    return client;
}

export const redisConnection = createRedisClient();