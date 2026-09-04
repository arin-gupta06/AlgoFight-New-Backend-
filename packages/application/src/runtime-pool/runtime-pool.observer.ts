import { logger } from "@algofight/logger";

export interface QueueTelemetrySnapshot {
    lightDepth: number;
    heavyDepth: number;
    lightWorkersBusy?: number;
    heavyWorkersBusy?: number;
    activeWorkersTotal: number;
    timestamp: number;
}

export interface PipelineStageEvent {
    submissionId: string;
    stage: "PREPARE" | "COMPILE" | "TEST_STARTED" | "TEST_CASE" | "FINISHED";
    matchId?: string;
    verdict?: string;
    data?: any;
    timestamp: number;
}

export interface PoolTelemetryObserver {
    onQueueTick?(snapshot: QueueTelemetrySnapshot): Promise<void>;
    onStageChange?(event: PipelineStageEvent): Promise<void>;
}

/**
 * Observer 1: Saturation & Cooldown Autoscaling Observer
 * Detects queue spikes to command scale-out, and observes sustained idle cooldown to command scale-in.
 */
export class SaturationAutoscalingObserver implements PoolTelemetryObserver {
    private static readonly SCALE_OUT_QUEUE_THRESHOLD = 4;
    private static readonly COOLDOWN_DURATION_MS = 60 * 1000; // 60 seconds

    private lastActivityTimestamp = Date.now();
    private consecutiveSaturationTicks = 0;
    private isCooldownActive = false;

    constructor(private poolManager: {
        scaleOut: (reason: string) => Promise<any>;
        scaleIn: () => Promise<any>;
        getRuntimesCount: () => number;
    }) {}

    async onQueueTick(snapshot: QueueTelemetrySnapshot): Promise<void> {
        const totalPending = snapshot.lightDepth + snapshot.heavyDepth;

        if (totalPending > 0) {
            this.lastActivityTimestamp = Date.now();
            this.isCooldownActive = false;
        }

        // 1. Check for queue saturation spike (Scale-Out condition)
        if (totalPending >= SaturationAutoscalingObserver.SCALE_OUT_QUEUE_THRESHOLD) {
            this.consecutiveSaturationTicks++;

            // Trigger scale-out if queue is backlogged across consecutive heartbeats
            if (this.consecutiveSaturationTicks >= 2) {
                logger.warn(
                    { lightDepth: snapshot.lightDepth, heavyDepth: snapshot.heavyDepth },
                    "Observer Pattern: Queue saturation threshold exceeded! Commanding scale-out...",
                );
                this.consecutiveSaturationTicks = 0;
                await this.poolManager.scaleOut("Queue saturation spike");
            }
        } else {
            this.consecutiveSaturationTicks = 0;
        }

        // 2. Check for sustained idle cooldown (Scale-In condition)
        const idleDuration = Date.now() - this.lastActivityTimestamp;
        if (totalPending === 0 && idleDuration >= SaturationAutoscalingObserver.COOLDOWN_DURATION_MS) {
            if (this.poolManager.getRuntimesCount() > 2) { // Only scale down if above baseline
                logger.info(
                    { idleSeconds: Math.floor(idleDuration / 1000) },
                    "Observer Pattern: 60s cooldown elapsed with zero pending queue. Commanding graceful scale-in...",
                );
                this.lastActivityTimestamp = Date.now(); // Reset cooldown timer
                await this.poolManager.scaleIn();
            }
        }
    }

    public getCooldownRemainingSeconds(): number {
        const elapsed = Date.now() - this.lastActivityTimestamp;
        const remaining = Math.max(0, SaturationAutoscalingObserver.COOLDOWN_DURATION_MS - elapsed);
        return Math.floor(remaining / 1000);
    }
}

/**
 * Observer 2: Redis Pub/Sub Telemetry Broadcaster
 * Streams step-by-step pipeline progression events to Redis for WebSocket fan-out.
 */
export class RedisBroadcastObserver implements PoolTelemetryObserver {
    constructor(private redisPublisher: any) {}

    async onStageChange(event: PipelineStageEvent): Promise<void> {
        if (!this.redisPublisher || typeof this.redisPublisher.publish !== "function") {
            return;
        }

        try {
            const channel = event.matchId ? `battle:events:${event.matchId}` : `submission:${event.submissionId}`;
            await this.redisPublisher.publish(channel, JSON.stringify(event));
        } catch (err) {
            logger.warn({ err, submissionId: event.submissionId }, "Failed to broadcast stage event via Redis Pub/Sub");
        }
    }
}
