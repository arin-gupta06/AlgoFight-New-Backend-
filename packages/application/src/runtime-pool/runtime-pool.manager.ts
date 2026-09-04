import { RuntimeInstance, RuntimeSpec, SubmissionRoutingContext } from "./runtime.types";
import { AbstractRuntimeFactory, PistonRuntimeFactoryProvider } from "./piston-runtime.factory";
import { RuntimeRoutingStrategy, LanguageAffinityStrategy } from "./runtime-routing.strategy";
import { SaturationAutoscalingObserver, RedisBroadcastObserver } from "./runtime-pool.observer";
import { logger } from "@algofight/logger";

export interface RuntimePoolSnapshot {
    activeCount: number;
    runtimes: RuntimeInstance[];
    scalingState: "STABLE" | "SCALING_OUT" | "COOLDOWN_DRAIN";
    cooldownRemainingSeconds: number;
}

export class RuntimePoolManager {
    private static instance: RuntimePoolManager;

    private readonly BASELINE_PORTS = [2001, 2002];
    private readonly MAX_POOL_CAPACITY = 4;

    private runtimes: Map<string, RuntimeInstance> = new Map();
    private factory: AbstractRuntimeFactory;
    private routingStrategy: RuntimeRoutingStrategy;
    private scalingObserver: SaturationAutoscalingObserver;
    private broadcastObserver?: RedisBroadcastObserver;
    private redisClient?: any;

    private scalingState: "STABLE" | "SCALING_OUT" | "COOLDOWN_DRAIN" = "STABLE";

    constructor(options?: {
        factory?: AbstractRuntimeFactory;
        strategy?: RuntimeRoutingStrategy;
        redisClient?: any;
    }) {
        this.factory = options?.factory || PistonRuntimeFactoryProvider.getFactory();
        this.routingStrategy = options?.strategy || new LanguageAffinityStrategy();
        this.redisClient = options?.redisClient;

        if (this.redisClient) {
            this.broadcastObserver = new RedisBroadcastObserver(this.redisClient);
        }

        this.scalingObserver = new SaturationAutoscalingObserver({
            scaleOut: (reason) => this.scaleOut(reason),
            scaleIn: () => this.scaleIn(),
            getRuntimesCount: () => this.runtimes.size,
        });

        this.initBaselineRuntimes();
    }

    public static getInstance(options?: any): RuntimePoolManager {
        if (!RuntimePoolManager.instance) {
            RuntimePoolManager.instance = new RuntimePoolManager(options);
        }
        return RuntimePoolManager.instance;
    }

    private initBaselineRuntimes(): void {
        for (const port of this.BASELINE_PORTS) {
            const url = `http://localhost:${port}`;
            const id = `piston-baseline-${port}`;
            this.runtimes.set(url, {
                id,
                url,
                port,
                status: "HEALTHY",
                activeJobs: 0,
                isBaseline: true,
                createdAt: Date.now(),
                lastHeartbeat: Date.now(),
            });
        }
        logger.info(
            { baselinePorts: this.BASELINE_PORTS },
            "Runtime Pool Manager initialized with 2 prewarmed baseline instances",
        );
    }

    /**
     * Routing Step: Selects the target Piston runtime for a submission using Strategy Pattern.
     * Supports direct target override if targetRuntimeUrl or targetPort is explicitly provided.
     */
    public async routeSubmission(context: SubmissionRoutingContext): Promise<string> {
        let explicitTargetUrl: string | undefined = context.targetRuntimeUrl;
        if (!explicitTargetUrl && context.targetPort) {
            explicitTargetUrl = `http://localhost:${context.targetPort}`;
        }

        if (explicitTargetUrl) {
            const runtime = this.runtimes.get(explicitTargetUrl);
            if (runtime) {
                runtime.activeJobs++;
            }
            if (this.redisClient && typeof this.redisClient.incr === "function") {
                try {
                    await this.redisClient.incr(`{runtime:${runtime?.id || "piston"}}:load`);
                } catch {
                    // Non-blocking error
                }
            }
            return explicitTargetUrl;
        }

        const pool = Array.from(this.runtimes.values());
        const selectedUrl = await this.routingStrategy.selectRuntime(context, pool, this.redisClient);

        // Track load in-memory and atomically in Redis
        const runtime = this.runtimes.get(selectedUrl);
        if (runtime) {
            runtime.activeJobs++;
        }

        if (this.redisClient && typeof this.redisClient.incr === "function") {
            try {
                await this.redisClient.incr(`{runtime:${runtime?.id || "piston"}}:load`);
            } catch {
                // Non-blocking error
            }
        }

        return selectedUrl;
    }

    /**
     * Execution Complete Step: Releases active execution slot.
     */
    public async releaseExecutionSlot(runtimeUrl: string): Promise<void> {
        const runtime = this.runtimes.get(runtimeUrl);
        if (runtime) {
            runtime.activeJobs = Math.max(0, runtime.activeJobs - 1);
        }

        if (this.redisClient && typeof this.redisClient.decr === "function") {
            try {
                await this.redisClient.decr(`{runtime:${runtime?.id || "piston"}}:load`);
            } catch {
                // Non-blocking error
            }
        }

        // If runtime is DRAINING and active jobs reached 0, terminate it
        if (runtime && runtime.status === "DRAINING" && runtime.activeJobs === 0) {
            await this.finalizeRuntimeDestruction(runtimeUrl);
        }
    }

    /**
     * Scale-Out: Spawns an additional Piston container via Factory Method if below max capacity.
     */
    public async scaleOut(reason: string): Promise<RuntimeInstance | null> {
        if (this.runtimes.size >= this.MAX_POOL_CAPACITY) {
            logger.warn({ current: this.runtimes.size, max: this.MAX_POOL_CAPACITY }, "Scale-out rejected: Max capacity ceiling reached");
            return null;
        }

        this.scalingState = "SCALING_OUT";
        const nextPort = 2000 + this.runtimes.size + 1;
        const spec: RuntimeSpec = {
            id: `piston-elastic-${nextPort}`,
            port: nextPort,
            type: "GENERAL",
        };

        try {
            logger.info({ reason, port: nextPort }, "RuntimePoolManager: Triggering Factory to scale out...");
            const newInstance = await this.factory.createRuntime(spec);
            this.runtimes.set(newInstance.url, newInstance);
            this.scalingState = "STABLE";
            return newInstance;
        } catch (err) {
            logger.error({ err, port: nextPort }, "Scale-out failed to instantiate runtime");
            this.scalingState = "STABLE";
            return null;
        }
    }

    /**
     * Scale-In: Marks the newest non-baseline runtime as DRAINING, then safely destroys it.
     */
    public async scaleIn(): Promise<string | null> {
        const candidates = Array.from(this.runtimes.values()).filter((r) => !r.isBaseline && r.status === "HEALTHY");
        if (candidates.length === 0) {
            return null;
        }

        // Pick the newest instance to retire
        const target = candidates[candidates.length - 1];
        logger.info({ url: target.url }, "RuntimePoolManager: Commencing graceful scale-in for runtime...");

        this.scalingState = "COOLDOWN_DRAIN";
        target.status = "DRAINING";

        // If it has 0 active jobs, destroy immediately; otherwise let releaseExecutionSlot finalize it
        if (target.activeJobs === 0) {
            await this.finalizeRuntimeDestruction(target.url);
        }

        this.scalingState = "STABLE";
        return target.url;
    }

    private async finalizeRuntimeDestruction(runtimeUrl: string): Promise<void> {
        await this.factory.destroyRuntime(runtimeUrl);
        this.runtimes.delete(runtimeUrl);
        logger.info({ runtimeUrl }, "RuntimePoolManager: Runtime successfully drained and removed from active pool");
    }

    public getRuntime(urlOrPort: string | number): RuntimeInstance | undefined {
        if (typeof urlOrPort === "number") {
            return Array.from(this.runtimes.values()).find((r) => r.port === urlOrPort);
        }
        const normalized = urlOrPort.endsWith("/") ? urlOrPort.slice(0, -1) : urlOrPort;
        return this.runtimes.get(normalized) || Array.from(this.runtimes.values()).find((r) => r.url === normalized);
    }

    public getActiveRuntimes(): RuntimeInstance[] {
        return Array.from(this.runtimes.values());
    }

    public async checkRuntimeHealth(url: string): Promise<boolean> {
        try {
            const res = await fetch(`${url}/api/v2/runtimes`, { signal: AbortSignal.timeout(1200) });
            const runtime = this.runtimes.get(url);
            if (runtime) {
                runtime.status = res.ok ? "HEALTHY" : "OFFLINE";
                runtime.lastHeartbeat = Date.now();
            }
            return res.ok;
        } catch {
            const runtime = this.runtimes.get(url);
            if (runtime) {
                runtime.status = "OFFLINE";
            }
            return false;
        }
    }

    public async probeAllRuntimes(): Promise<Array<RuntimeInstance & { reachable: boolean; latencyMs: number }>> {
        const runtimes = Array.from(this.runtimes.values());
        const results = await Promise.all(
            runtimes.map(async (runtime) => {
                const start = Date.now();
                let reachable = false;
                try {
                    const res = await fetch(`${runtime.url}/api/v2/runtimes`, { signal: AbortSignal.timeout(1500) });
                    reachable = res.ok;
                    runtime.status = reachable ? "HEALTHY" : "OFFLINE";
                } catch {
                    reachable = false;
                    runtime.status = "OFFLINE";
                }
                const latencyMs = Date.now() - start;
                runtime.lastHeartbeat = Date.now();
                return {
                    ...runtime,
                    reachable,
                    latencyMs,
                };
            })
        );
        return results;
    }

    public getSnapshot(): RuntimePoolSnapshot {
        return {
            activeCount: this.runtimes.size,
            runtimes: Array.from(this.runtimes.values()),
            scalingState: this.scalingState,
            cooldownRemainingSeconds: this.scalingObserver.getCooldownRemainingSeconds(),
        };
    }

    public getObserver(): SaturationAutoscalingObserver {
        return this.scalingObserver;
    }

    public getBroadcastObserver(): RedisBroadcastObserver | undefined {
        return this.broadcastObserver;
    }
}
