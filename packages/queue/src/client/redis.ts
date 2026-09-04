import IORedis, { Redis, Cluster } from "ioredis";

export type RedisClient = Redis | Cluster;

export function createRedisClient(): Redis {
    // 1. Check if Redis Cluster nodes are specified
    const clusterNodes = process.env.REDIS_CLUSTER_NODES;
    if (clusterNodes) {
        const nodes = clusterNodes.split(",").map((endpoint) => {
            const [host, port] = endpoint.trim().split(":");
            return { host, port: Number(port) || 6379 };
        });

        const cluster = new IORedis.Cluster(nodes, {
            redisOptions: {
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            },
            scaleReads: "slave",
            clusterRetryStrategy(times) {
                return Math.min(times * 100, 3000);
            },
        });

        cluster.on("error", (err: any) => {
            if (process.env.NODE_ENV !== "test") {
                console.warn(`[Redis Cluster Warning]: ${err?.message || err}`);
            }
        });

        return cluster as unknown as Redis;
    }

    // 2. Fallback to Standalone Redis
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
        if (process.env.NODE_ENV !== "test") {
            console.warn(`[Redis Client Warning]: ${err?.message || err}`);
        }
    });

    return client;
}

/**
 * Utility to format Redis keys with Hash Tags for cluster slot affinity.
 * Example: toClusterKey("runtime:piston-1", "load") => "{runtime:piston-1}:load"
 */
export function toClusterKey(hashTag: string, subKey: string): string {
    return `{${hashTag}}:${subKey}`;
}

export const redisConnection = createRedisClient();