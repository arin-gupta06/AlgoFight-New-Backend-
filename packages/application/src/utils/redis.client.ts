import IORedis, { Redis } from "ioredis";

export function createRedisClient(): Redis {
    const rawUrl =
        process.env.REDIS_URL ||
        (process.env.REDIS_HOST?.startsWith("redis://") ||
        process.env.REDIS_HOST?.startsWith("valkey://") ||
        process.env.REDIS_HOST?.startsWith("rediss://")
            ? process.env.REDIS_HOST
            : null);

    const client = rawUrl
        ? new IORedis(rawUrl, {
              maxRetriesPerRequest: null,
              retryStrategy(time) {
                  return Math.min(time * 50, 2000);
              },
          })
        : new IORedis({
              host: process.env.REDIS_HOST || "127.0.0.1",
              port: Number(process.env.REDIS_PORT) || 6379,
              family: 4,
              maxRetriesPerRequest: null,
              retryStrategy(time) {
                  return Math.min(time * 50, 2000);
              },
          });

    client.on("error", (err: any) => {
        if (process.env.NODE_ENV !== "test") {
            console.warn(`[Redis Client Warning]: ${err?.message || err}`);
        }
    });

    return client;
}
