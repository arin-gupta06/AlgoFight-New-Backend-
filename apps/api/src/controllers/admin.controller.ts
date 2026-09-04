import { prisma } from "@algofight/database";
import { redisConnection } from "@algofight/queue/src/client/redis";
import { RuntimePoolManager } from "@algofight/application";
import { submissionLightQueue, submissionHeavyQueue } from "@algofight/queue";

const probeService = async (probeFn: () => Promise<any>): Promise<"ONLINE" | "OFFLINE"> => {
    try {
        const res = await probeFn();
        return res === false ? "OFFLINE" : "ONLINE";
    } catch {
        return "OFFLINE";
    }
};

export class AdminController {
    async getSystemMetrics() {
        const uptimeSeconds = Math.max(1, Math.floor(process.uptime()));

        const [
            totalUsers,
            studentUsers,
            facultyUsers,
            totalProblems,
            totalSubmissions,
            totalRooms,
            redisStatus,
            pistonStatus,
            collegeStats,
            recentSubmissionsCount,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { userType: "STUDENT" } }),
            prisma.user.count({ where: { userType: "FACULTY" } }),
            prisma.problem.count(),
            prisma.submission.count(),
            prisma.battleRoom.count(),
            probeService(() => redisConnection.ping()),
            probeService(async () => {
                const res = await fetch("http://localhost:2000/api/v2/runtimes", { signal: AbortSignal.timeout(800) });
                return res.ok;
            }),
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
            })
        ]);

        const memoryUsageMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
        const reqRate = (recentSubmissionsCount / 60).toFixed(1);

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
                    min: 2,
                    max: 4,
                },
                scalingState: snapshot.scalingState,
                cooldownRemainingSeconds: snapshot.cooldownRemainingSeconds,
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
        } catch {
            // runtime pool not initialized or standalone probe
        }

        return {
            services: {
                apiGateway: { status: "ONLINE", uptime: uptimeSeconds, latency: "<1ms" },
                websocketGateway: { status: "ONLINE", port: 8080, protocol: "WSS/WS" },
                database: { status: "ONLINE", engine: "PostgreSQL 16", pool: "Active" },
                redisCluster: { status: redisStatus, host: "localhost:6379" },
                pistonSandbox: { status: pistonStatus, endpoint: "http://localhost:2000" },
            },
            traffic: {
                fanInRate: `${reqRate} req/s`,
                fanOutRate: `${Math.max(1, totalRooms * 2)} events/s`,
                activeGateways: 1,
                activeSocketNodes: 1,
                peakBandwidth: `${memoryUsageMb} MB RSS`,
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
}
