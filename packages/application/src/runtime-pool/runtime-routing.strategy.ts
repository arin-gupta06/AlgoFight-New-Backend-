import { RuntimeInstance, SubmissionRoutingContext } from "./runtime.types";
import { logger } from "@algofight/logger";

export interface RuntimeRoutingStrategy {
    selectRuntime(
        context: SubmissionRoutingContext,
        availableRuntimes: RuntimeInstance[],
        redisClient?: any,
    ): Promise<string>;
}

/**
 * Strategy A: Least-Load / Fewest In-Flight Executions
 * Selects the healthy runtime that currently has the lowest active jobs.
 */
export class LeastLoadStrategy implements RuntimeRoutingStrategy {
    async selectRuntime(
        _context: SubmissionRoutingContext,
        availableRuntimes: RuntimeInstance[],
        redisClient?: any,
    ): Promise<string> {
        const healthyPool = availableRuntimes.filter((r) => r.status === "HEALTHY");
        if (healthyPool.length === 0) {
            // Fallback to any runtime if all are draining
            const fallback = availableRuntimes[0]?.url || "http://localhost:2000";
            return fallback;
        }

        // If Redis client is provided, query atomic load counters
        if (redisClient && typeof redisClient.get === "function") {
            try {
                let minLoad = Infinity;
                let bestUrl = healthyPool[0].url;

                for (const runtime of healthyPool) {
                    const loadKey = `{runtime:${runtime.id}}:load`;
                    const rawVal = await redisClient.get(loadKey);
                    const currentLoad = rawVal ? parseInt(rawVal, 10) : runtime.activeJobs;

                    if (currentLoad < minLoad) {
                        minLoad = currentLoad;
                        bestUrl = runtime.url;
                    }
                }
                return bestUrl;
            } catch (err) {
                logger.warn({ err }, "Failed to read Redis load counters, falling back to in-memory count");
            }
        }

        // In-memory sort by lowest activeJobs
        healthyPool.sort((a, b) => a.activeJobs - b.activeJobs);
        return healthyPool[0].url;
    }
}

/**
 * Strategy B: Language Affinity
 * Routes heavy compiled languages (C++, Java) to high-spec runtimes
 * and lightweight interpreted scripts (Python, JS) to fast containers.
 */
export class LanguageAffinityStrategy implements RuntimeRoutingStrategy {
    private leastLoad = new LeastLoadStrategy();

    async selectRuntime(
        context: SubmissionRoutingContext,
        availableRuntimes: RuntimeInstance[],
        redisClient?: any,
    ): Promise<string> {
        const healthyPool = availableRuntimes.filter((r) => r.status === "HEALTHY");
        if (healthyPool.length <= 1) {
            return healthyPool[0]?.url || "http://localhost:2000";
        }

        // If workload is HEAVY, prefer containers with port 2001 or marked for compiled
        if (context.workload === "HEAVY") {
            const heavyCandidate = healthyPool.find((r) => r.port === 2001) || healthyPool[0];
            return heavyCandidate.url;
        }

        // For LIGHT workloads, route to secondary containers (e.g. 2002+) to avoid competing with C++
        const lightCandidates = healthyPool.filter((r) => r.port !== 2001);
        if (lightCandidates.length > 0) {
            return this.leastLoad.selectRuntime(context, lightCandidates, redisClient);
        }

        return this.leastLoad.selectRuntime(context, healthyPool, redisClient);
    }
}

/**
 * Strategy C: Priority Tier Strategy
 * Prioritizes live 1v1 battles over casual playground test runs.
 */
export class PriorityTierStrategy implements RuntimeRoutingStrategy {
    private leastLoad = new LeastLoadStrategy();

    async selectRuntime(
        context: SubmissionRoutingContext,
        availableRuntimes: RuntimeInstance[],
        redisClient?: any,
    ): Promise<string> {
        const healthyPool = availableRuntimes.filter((r) => r.status === "HEALTHY");
        if (healthyPool.length === 0) {
            return "http://localhost:2000";
        }

        // For live matches or HIGH priority, pick the absolute lowest load instance
        if (context.isLiveBattle || context.priority === "HIGH") {
            return this.leastLoad.selectRuntime(context, healthyPool, redisClient);
        }

        // Casual runs use standard least load
        return this.leastLoad.selectRuntime(context, healthyPool, redisClient);
    }
}
