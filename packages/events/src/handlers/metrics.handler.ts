// packages/events/src/handlers/metrics.handler.ts
import { DomainEvent } from "../contracts/domain-event";

const TELEMETRY_URL =
    process.env.TELEMETRY_URL || process.env.TELEMETRY_SERVICE_URL || "http://localhost:8000";

export class MetricsHandler {
    async handle(event: DomainEvent): Promise<void> {
        const { eventName, payload } = event as any;

        try {
            if (eventName === "execution.completed" || eventName === "submission.completed") {
                await fetch(`${TELEMETRY_URL}/api/v1/telemetry/ingest`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        submission_id: payload.submissionId,
                        user_id: payload.userId || "unknown",
                        problem_id: payload.problemId,
                        language: payload.language || "cpp",
                        compile_time_ms: payload.compileTimeMs || 0,
                        execution_time_ms: payload.executionTimeMs || payload.durationMs || 0,
                        cpu_time_ms: payload.cpuTimeMs || 0,
                        peak_memory_kb: payload.peakMemoryKb || payload.memoryKb || 0,
                        verdict: payload.verdict || "ACCEPTED",
                        pass_count: payload.passCount || 0,
                        total_testcases: payload.totalTestcases || 0,
                    }),
                });
            } else if (eventName === "battle.finished") {
                await fetch(`${TELEMETRY_URL}/api/v1/telemetry/battle`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else if (eventName === "runtime.pool.state" || eventName === "autoscaler.event") {
                await fetch(`${TELEMETRY_URL}/api/v1/telemetry/runtime-pool`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        active_runtimes_count: payload.activeCount || 0,
                        runtimes: payload.runtimes || [],
                        scaling_state: payload.scalingState || "STABLE",
                        cooldown_seconds_remaining: payload.cooldownRemainingSeconds || 0,
                        light_queue_depth: payload.lightDepth || 0,
                        heavy_queue_depth: payload.heavyDepth || 0,
                        light_workers_busy: payload.lightWorkersBusy || 0,
                        heavy_workers_busy: payload.heavyWorkersBusy || 0,
                        timestamp: Date.now() / 1000,
                    }),
                });
            }
        } catch (err) {
            // Non-blocking error handling
        }
    }
}
