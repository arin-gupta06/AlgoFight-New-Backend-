// packages/telemetry/src/gateway-metrics.ts

export interface GatewayMetricPoint {
    name: string;
    value: number;
    labels?: Record<string, string>;
    timestamp: number;
}

export class GatewayTelemetryCollector {
    // Fixed-capacity circular ring buffer to prevent unbounded RAM growth / OOM crashes
    private static readonly MAX_BUFFER_SIZE = 2000;
    private readonly metrics: GatewayMetricPoint[] = [];

    // Aggregated Counters for permanent high-speed counters
    public totalRequests = 0;
    public totalAdmissions = 0;
    public totalRejections = 0;
    public totalErrors = 0;

    private pushMetric(point: GatewayMetricPoint): void {
        if (this.metrics.length >= GatewayTelemetryCollector.MAX_BUFFER_SIZE) {
            this.metrics.shift(); // Evict oldest point to keep memory strictly constant
        }
        this.metrics.push(point);
    }

    // 1. Request Counter
    public recordRequest(gatewayId: string, contextId: string, method: string, status: number): void {
        this.totalRequests++;
        this.pushMetric({
            name: "gateway_requests_total",
            value: 1,
            labels: {
                gateway_id: gatewayId,
                context_id: contextId,
                method,
                status: String(status),
            },
            timestamp: Date.now(),
        });
    }

    // 2. Admission Counter
    public recordAdmission(gatewayId: string, contextId: string, tier: string): void {
        this.totalAdmissions++;
        this.pushMetric({
            name: "gateway_admissions_total",
            value: 1,
            labels: {
                gateway_id: gatewayId,
                context_id: contextId,
                tier,
            },
            timestamp: Date.now(),
        });
    }

    // 3. Rejection Counter
    public recordRejection(gatewayId: string, contextId: string, reason: string): void {
        this.totalRejections++;
        this.pushMetric({
            name: "gateway_rejections_total",
            value: 1,
            labels: {
                gateway_id: gatewayId,
                context_id: contextId,
                reason,
            },
            timestamp: Date.now(),
        });
    }

    // 4. Request Latency
    public recordLatency(gatewayId: string, durationMs: number): void {
        this.pushMetric({
            name: "gateway_request_duration_seconds",
            value: durationMs / 1000,
            labels: { gateway_id: gatewayId },
            timestamp: Date.now(),
        });
    }

    // 5. Lifecycle Transition Counter
    public recordLifecycleTransition(gatewayId: string, fromState: string, toState: string): void {
        this.pushMetric({
            name: "gateway_lifecycle_transitions_total",
            value: 1,
            labels: {
                gateway_id: gatewayId,
                from_state: fromState,
                to_state: toState,
            },
            timestamp: Date.now(),
        });
    }

    // 6. Gauge Snapshot: Users & Capacity
    public recordGauges(gatewayId: string, contextId: string, activeUsers: number, capacity: number, utilization: number): void {
        const now = Date.now();
        this.pushMetric({
            name: "gateway_active_users",
            value: activeUsers,
            labels: { gateway_id: gatewayId, context_id: contextId },
            timestamp: now,
        });
        this.pushMetric({
            name: "gateway_capacity",
            value: capacity,
            labels: { gateway_id: gatewayId, context_id: contextId },
            timestamp: now,
        });
        this.pushMetric({
            name: "gateway_utilization",
            value: utilization,
            labels: { gateway_id: gatewayId, context_id: contextId },
            timestamp: now,
        });
    }

    public getRecentMetrics(): GatewayMetricPoint[] {
        return [...this.metrics];
    }

    // 7. Dynamic Window Calculations for Real-Time Telemetry
    public getRequestsInWindow(windowMs = 60000): number {
        const cutoff = Date.now() - windowMs;
        let count = 0;
        for (let i = this.metrics.length - 1; i >= 0; i--) {
            const m = this.metrics[i];
            if (m.timestamp < cutoff) break;
            if (m.name === "gateway_requests_total") count++;
        }
        return count;
    }

    public getRequestRate(windowMs = 60000): number {
        const count = this.getRequestsInWindow(windowMs);
        const seconds = Math.max(1, windowMs / 1000);
        return Number((count / seconds).toFixed(2));
    }

    public getLatencyDistribution(windowMs = 60000): { avgMs: number; p95Ms: number; minMs: number; maxMs: number; sampleCount: number } {
        const cutoff = Date.now() - windowMs;
        const latencies: number[] = [];

        for (let i = this.metrics.length - 1; i >= 0; i--) {
            const m = this.metrics[i];
            if (m.timestamp < cutoff) break;
            if (m.name === "gateway_request_duration_seconds") {
                latencies.push(m.value * 1000); // convert back to ms
            }
        }

        if (latencies.length === 0) {
            return { avgMs: 0, p95Ms: 0, minMs: 0, maxMs: 0, sampleCount: 0 };
        }

        latencies.sort((a, b) => a - b);
        const sum = latencies.reduce((acc, v) => acc + v, 0);
        const avgMs = Number((sum / latencies.length).toFixed(1));
        const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
        const p95Ms = Number(latencies[p95Index].toFixed(1));
        const minMs = Number(latencies[0].toFixed(1));
        const maxMs = Number(latencies[latencies.length - 1].toFixed(1));

        return { avgMs, p95Ms, minMs, maxMs, sampleCount: latencies.length };
    }

    public getAdmissionStats(windowMs = 60000): { total: number; admitted: number; rejected: number; admissionRate: number } {
        const cutoff = Date.now() - windowMs;
        let admitted = 0;
        let rejected = 0;

        for (let i = this.metrics.length - 1; i >= 0; i--) {
            const m = this.metrics[i];
            if (m.timestamp < cutoff) break;
            if (m.name === "gateway_admissions_total") admitted++;
            if (m.name === "gateway_rejections_total") rejected++;
        }

        const total = admitted + rejected;
        const admissionRate = total > 0 ? Number(((admitted / total) * 100).toFixed(1)) : 100.0;
        return { total, admitted, rejected, admissionRate };
    }

    public clear(): void {
        this.metrics.length = 0;
    }
}

export const gatewayTelemetryCollector = new GatewayTelemetryCollector();

