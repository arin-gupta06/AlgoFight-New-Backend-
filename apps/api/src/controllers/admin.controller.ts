import { prisma } from "@algofight/database";
import { redisConnection } from "@algofight/queue/src/client/redis";
import { RuntimePoolManager, PistonAdapter } from "@algofight/application";
import { submissionLightQueue, submissionHeavyQueue } from "@algofight/queue";
import { gatewayTelemetryCollector } from "@algofight/telemetry";
import { connectionManager } from "../plugins/websocket.plugin";
import { gatewayManager } from "../gateway/manager/gateway.manager";
import { linuxTelemetryBridge } from "../services/linux-telemetry-bridge.service";
import { auditService } from "../services/audit.service";
import { config } from "@algofight/config";

export class AdminController {
    async getSystemMetrics() {
        const uptimeSeconds = Math.max(1, Math.floor(process.uptime()));

        // 1. Concurrent Database, Redis, and Piston SLA probes
        const dbStart = performance.now();
        const redisStart = performance.now();
        const pistonStart = performance.now();
        const pistonUrl = process.env.PISTON_URL || config.pistonUrl || "http://127.0.0.1:2000";

        const [
            totalUsers,
            studentUsers,
            facultyUsers,
            totalProblems,
            totalSubmissions,
            totalRooms,
            collegeStats,
            recentSubmissionsCount,
            dbProbe,
            redisProbe,
            pistonProbe,
            linuxVitals,
            linuxHealth,
            gatewayRecords,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { userType: "STUDENT" } }),
            prisma.user.count({ where: { userType: "FACULTY" } }),
            prisma.problem.count(),
            prisma.submission.count(),
            prisma.battleRoom.count(),
            prisma.user.groupBy({
                by: ["institutionName"],
                where: { institutionName: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: "desc" } },
                take: 10,
            }),
            prisma.submission.count({
                where: {
                    createdAt: { gte: new Date(Date.now() - 60000) } // Past 1 minute
                }
            }),
            prisma.$queryRaw`SELECT 1`.then(() => ({
                status: "ONLINE" as const,
                latencyMs: Number((performance.now() - dbStart).toFixed(1)),
            })).catch(() => ({
                status: "OFFLINE" as const,
                latencyMs: 0,
            })),
            redisConnection.ping().then(() => ({
                status: "ONLINE" as const,
                latencyMs: Number((performance.now() - redisStart).toFixed(1)),
            })).catch(() => ({
                status: "OFFLINE" as const,
                latencyMs: 0,
            })),
            fetch(`${pistonUrl}/api/v2/runtimes`, { signal: AbortSignal.timeout(1200) })
                .then(async (res) => {
                    if (res.ok) {
                        const runtimes = await res.json().catch(() => []) as any[];
                        return {
                            status: "ONLINE" as const,
                            latencyMs: Number((performance.now() - pistonStart).toFixed(1)),
                            runtimesCount: runtimes.length,
                        };
                    }
                    return { status: "OFFLINE" as const, latencyMs: 0, runtimesCount: 0 };
                })
                .catch(() => ({ status: "OFFLINE" as const, latencyMs: 0, runtimesCount: 0 })),
            linuxTelemetryBridge.getLinuxVitals(),
            linuxTelemetryBridge.checkHealth(),
            gatewayManager.getRegistry().getAllRecords().catch(() => []),
        ]);

        // 2. Real Gateway & Ingress / Egress Telemetry
        const realIngressRps = gatewayTelemetryCollector.getRequestRate(60000);
        const latencyDist = gatewayTelemetryCollector.getLatencyDistribution(60000);
        const admissionStats = gatewayTelemetryCollector.getAdmissionStats(60000);
        const realFanOutRate = connectionManager.getFanOutRate(60000);
        const activeSockets = connectionManager.getActiveSocketCount();
        const activeRooms = connectionManager.getActiveRoomCount();

        // 3. Process Memory Metrics
        const mem = process.memoryUsage();
        const memoryRssMb = (mem.rss / (1024 * 1024)).toFixed(1);
        const heapUsedMb = (mem.heapUsed / (1024 * 1024)).toFixed(1);
        const heapTotalMb = (mem.heapTotal / (1024 * 1024)).toFixed(1);

        // 4. Runtime Pool & Execution Queue Telemetry
        let runtimePoolData: any = null;
        try {
            const manager = RuntimePoolManager.getInstance();
            const snapshot = manager.getSnapshot();
            const instances = snapshot.runtimes.map((i: any) => ({
                id: i.id,
                port: i.port,
                url: i.url,
                state: i.status,
                type: i.isBaseline ? "STATIC_PREWARMED" : "DYNAMIC_EPHEMERAL",
                activeJobs: i.activeJobs,
                healthy: i.status === "HEALTHY",
            }));

            const [lightCount, heavyCount] = await Promise.all([
                submissionLightQueue.count().catch(() => 0),
                submissionHeavyQueue.count().catch(() => 0),
            ]);

            runtimePoolData = {
                activeInstances: instances,
                capacity: {
                    current: snapshot.activeCount,
                    min: 1,
                    max: 4,
                },
                scalingState: snapshot.scalingState,
                cooldownRemainingSeconds: snapshot.cooldownRemainingSeconds,
                standaloneEndpoint: pistonUrl,
                standaloneStatus: pistonProbe.status,
                runtimesAvailable: pistonProbe.runtimesCount,
                queues: {
                    lightLane: {
                        name: "SUBMISSION_LIGHT",
                        concurrency: 4,
                        depth: lightCount,
                        target: "Python / JS / TS (<8KB)",
                    },
                    heavyLane: {
                        name: "SUBMISSION_HEAVY",
                        concurrency: 2,
                        depth: heavyCount,
                        target: "C++ / Java / Heavy (>8KB)",
                    },
                },
            };

            // Non-blocking sync to WSL Linux Telemetry Service
            linuxTelemetryBridge.pushTelemetryHeartbeat({
                activeCount: snapshot.activeCount,
                runtimes: snapshot.runtimes,
                scalingState: snapshot.scalingState,
                cooldownRemainingSeconds: snapshot.cooldownRemainingSeconds,
                lightDepth: lightCount,
                heavyDepth: heavyCount,
                lightWorkersBusy: 0,
                heavyWorkersBusy: 0,
            }).catch(() => {});
        } catch {
            // Fallback standalone queue status
            const [lightCount, heavyCount] = await Promise.all([
                submissionLightQueue.count().catch(() => 0),
                submissionHeavyQueue.count().catch(() => 0),
            ]);

            runtimePoolData = {
                activeInstances: [],
                capacity: { current: pistonProbe.status === "ONLINE" ? 1 : 0, min: 0, max: 4 },
                scalingState: "STANDALONE_BASELINE",
                cooldownRemainingSeconds: 0,
                standaloneEndpoint: pistonUrl,
                standaloneStatus: pistonProbe.status,
                runtimesAvailable: pistonProbe.runtimesCount,
                queues: {
                    lightLane: { name: "SUBMISSION_LIGHT", concurrency: 4, depth: lightCount, target: "Python / JS / TS (<8KB)" },
                    heavyLane: { name: "SUBMISSION_HEAVY", concurrency: 2, depth: heavyCount, target: "C++ / Java / Heavy (>8KB)" },
                },
            };
        }

        // Redis Host Resolution
        const redisHost = (redisConnection.options as any)?.host || "localhost:6379";

        return {
            services: {
                apiGateway: {
                    status: "ONLINE",
                    uptime: uptimeSeconds,
                    port: config.port,
                    avgLatency: latencyDist.avgMs > 0 ? `${latencyDist.avgMs}ms` : "<1ms",
                    p95Latency: latencyDist.p95Ms > 0 ? `${latencyDist.p95Ms}ms` : "<1ms",
                    totalRequests: gatewayTelemetryCollector.totalRequests,
                },
                websocketGateway: {
                    status: "ONLINE",
                    port: config.port,
                    protocol: "WSS/WS",
                    activeSockets,
                    activeRooms,
                },
                database: {
                    status: dbProbe.status,
                    latency: `${dbProbe.latencyMs}ms`,
                    engine: "PostgreSQL 16",
                    pool: dbProbe.status === "ONLINE" ? "Connected" : "Disconnected",
                },
                redisCluster: {
                    status: redisProbe.status,
                    latency: `${redisProbe.latencyMs}ms`,
                    host: redisHost,
                },
                pistonSandbox: {
                    status: pistonProbe.status,
                    latency: `${pistonProbe.latencyMs}ms`,
                    endpoint: pistonUrl,
                    runtimesAvailable: pistonProbe.runtimesCount,
                },
            },
            traffic: {
                fanInRate: `${realIngressRps} req/s`,
                fanOutRate: `${realFanOutRate} events/s`,
                ingressRps: realIngressRps,
                egressEventsSec: realFanOutRate,
                activeGateways: Math.max(1, gatewayRecords.length),
                activeSocketNodes: activeSockets,
                totalRequests: gatewayTelemetryCollector.totalRequests,
                admissionsTotal: admissionStats.admitted,
                rejectionsTotal: admissionStats.rejected,
                admissionRatePercent: admissionStats.admissionRate,
                memoryRssMb: `${memoryRssMb} MB`,
                heapUsedMb: `${heapUsedMb} MB`,
                heapTotalMb: `${heapTotalMb} MB`,
                // Retain backward-compatible string fields
                peakBandwidth: `${memoryRssMb} MB RSS`,
            },
            linuxTelemetry: {
                status: linuxHealth.status,
                endpoint: linuxHealth.endpoint,
                latencyMs: linuxHealth.latencyMs,
                vitals: linuxVitals,
            },
            runtimePool: runtimePoolData,
            users: {
                total: totalUsers,
                students: studentUsers,
                faculty: facultyUsers,
                independent: totalUsers - (studentUsers + facultyUsers),
            },
            subBatches: collegeStats.map((c: any) => ({
                institution: c.institutionName,
                count: c._count?.id || 0,
            })),
            activity: {
                totalProblems,
                totalSubmissions,
                recentSubmissions1m: recentSubmissionsCount,
                activeBattles: totalRooms,
            },
        };
    }

    async listPlatformUsers(query: { search?: string; limit?: number }) {
        const limit = query.limit || 50;
        const search = query.search?.trim();

        const where: any = {};
        if (search) {
            where.OR = [
                { username: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { platformCode: { contains: search, mode: "insensitive" } },
                { institutionName: { contains: search, mode: "insensitive" } },
            ];
        }

        return prisma.user.findMany({
            where,
            take: limit,
            orderBy: { createdAt: "desc" },
        });
    }

    async getAuditLogs(query: { category?: string; severity?: string; limit?: number; search?: string }) {
        return auditService.getLogs(query);
    }

    async scaleOutRuntime(reason?: string) {
        const manager = RuntimePoolManager.getInstance();
        const instance = await manager.scaleOut(reason || "Admin API scale-out trigger");
        
        auditService.recordEvent({
            category: "FLEET",
            severity: instance ? "INFO" : "WARN",
            action: "SCALE_OUT_EXECUTED",
            actor: "SuperAdmin",
            details: instance ? `Container spawned on port ${instance.port}` : "Scale-out rejected or max capacity reached",
            metadata: { instance, reason },
        });

        return {
            success: !!instance,
            instance,
            snapshot: manager.getSnapshot(),
        };
    }

    async scaleInRuntime() {
        const manager = RuntimePoolManager.getInstance();
        const drainedUrl = await manager.scaleIn();

        auditService.recordEvent({
            category: "FLEET",
            severity: drainedUrl ? "INFO" : "WARN",
            action: "SCALE_IN_EXECUTED",
            actor: "SuperAdmin",
            details: drainedUrl ? `Reclaimed container at ${drainedUrl}` : "Scale-in aborted (at baseline capacity)",
            metadata: { drainedUrl },
        });

        return {
            success: !!drainedUrl,
            drainedUrl,
            snapshot: manager.getSnapshot(),
        };
    }

    async probeAllRuntimes(payload?: { language?: string; code?: string }) {
        const manager = RuntimePoolManager.getInstance();
        let runtimes = manager.getActiveRuntimes();
        const adapter = new PistonAdapter();
        const lang = payload?.language || "python";
        const code = payload?.code || "print('AlgoFight Piston Runtime Probe: OK')";
        const pistonUrl = process.env.PISTON_URL || config.pistonUrl || "http://127.0.0.1:2000";

        // If no dynamic runtimes in pool, probe the baseline standalone Piston URL
        if (runtimes.length === 0) {
            runtimes = [{
                id: "piston-standalone",
                url: pistonUrl,
                port: parseInt(new URL(pistonUrl).port || "2000", 10),
                isBaseline: true,
                status: "HEALTHY",
                activeJobs: 0,
            } as any];
        }

        const results = await Promise.all(
            runtimes.map(async (runtime) => {
                const start = performance.now();
                try {
                    const execResult = await adapter.executeCode(lang, code, "", 3000, 256 * 1024 * 1024, runtime.url);
                    return {
                        id: runtime.id,
                        port: runtime.port,
                        url: runtime.url,
                        type: runtime.isBaseline ? "PREWARMED_BASELINE" : "EXTENDED_EPHEMERAL",
                        status: "HEALTHY",
                        reachable: true,
                        latencyMs: Number((performance.now() - start).toFixed(1)),
                        output: execResult.run.stdout.trim(),
                        stderr: execResult.run.stderr,
                        exitCode: execResult.run.code,
                    };
                } catch (err: any) {
                    return {
                        id: runtime.id,
                        port: runtime.port,
                        url: runtime.url,
                        type: runtime.isBaseline ? "PREWARMED_BASELINE" : "EXTENDED_EPHEMERAL",
                        status: "ERROR",
                        reachable: false,
                        latencyMs: Number((performance.now() - start).toFixed(1)),
                        error: err.message,
                    };
                }
            })
        );

        auditService.recordEvent({
            category: "FLEET",
            severity: "INFO",
            action: "RUNTIME_PROBE_EXECUTED",
            actor: "SuperAdmin",
            details: `Probed ${results.length} runtime(s) with ${lang}. Latency: ${results[0]?.latencyMs || 0}ms`,
            metadata: { total: results.length, language: lang },
        });

        return {
            probedAt: new Date().toISOString(),
            totalActiveRuntimes: results.length,
            results,
        };
    }
}
