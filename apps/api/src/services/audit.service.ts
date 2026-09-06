// apps/api/src/services/audit.service.ts
import crypto from "crypto";
import { prisma } from "@algofight/database";
import { linuxTelemetryBridge } from "./linux-telemetry-bridge.service";

export type AuditCategory =
    | "AUTH"
    | "SECURITY"
    | "SUBMISSION"
    | "BATTLE"
    | "ADMIN"
    | "FLEET"
    | "LINUX_TELEMETRY"
    | "SYSTEM";

export type AuditSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    category: AuditCategory;
    severity: AuditSeverity;
    action: string;
    actor: string;
    details: string;
    metadata?: Record<string, any>;
}

export class AuditService {
    private static instance: AuditService;
    private static readonly MAX_BUFFER_SIZE = 300;
    private readonly entries: AuditLogEntry[] = [];
    private isBootstrapped = false;

    private constructor() {}

    public static getInstance(): AuditService {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService();
        }
        return AuditService.instance;
    }

    /**
     * Record a live audit event into the circular ring buffer
     */
    public recordEvent(event: Omit<AuditLogEntry, "id" | "timestamp"> & { timestamp?: string }): AuditLogEntry {
        const entry: AuditLogEntry = {
            id: `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
            timestamp: event.timestamp || new Date().toISOString(),
            category: event.category,
            severity: event.severity,
            action: event.action,
            actor: event.actor,
            details: event.details,
            metadata: event.metadata,
        };

        if (this.entries.length >= AuditService.MAX_BUFFER_SIZE) {
            this.entries.shift(); // Evict oldest
        }
        this.entries.push(entry);
        return entry;
    }

    /**
     * Bootstrap historical records from the database on initial start
     */
    public async bootstrapFromDatabase(): Promise<void> {
        if (this.isBootstrapped) return;
        this.isBootstrapped = true;

        try {
            const [recentSubmissions, recentUsers, recentBroadcasts, recentRooms] = await Promise.all([
                prisma.submission.findMany({
                    take: 15,
                    orderBy: { createdAt: "desc" },
                    include: { user: { select: { username: true, platformCode: true } } },
                }).catch(() => []),
                prisma.user.findMany({
                    take: 10,
                    orderBy: { createdAt: "desc" },
                    select: { username: true, platformCode: true, userType: true, institutionName: true, createdAt: true },
                }).catch(() => []),
                prisma.systemBroadcast.findMany({
                    take: 10,
                    orderBy: { createdAt: "desc" },
                }).catch(() => []),
                prisma.battleRoom.findMany({
                    take: 10,
                    orderBy: { createdAt: "desc" },
                    include: { host: { select: { username: true } } },
                }).catch(() => []),
            ]);

            // Add historical user registrations
            for (const u of recentUsers) {
                this.entries.push({
                    id: `aud_hist_usr_${u.createdAt.getTime()}`,
                    timestamp: u.createdAt.toISOString(),
                    category: "AUTH",
                    severity: "INFO",
                    action: "USER_REGISTERED",
                    actor: u.username,
                    details: `New ${u.userType} combatant registered (${u.platformCode || "Individual"}${u.institutionName ? ` - ${u.institutionName}` : ""})`,
                });
            }

            // Add historical submissions
            for (const s of recentSubmissions) {
                const isSuccess = s.verdict === "ACCEPTED";
                this.entries.push({
                    id: `aud_hist_sub_${s.id}`,
                    timestamp: s.createdAt.toISOString(),
                    category: "SUBMISSION",
                    severity: isSuccess ? "INFO" : "WARN",
                    action: "SUBMISSION_EVALUATED",
                    actor: s.user?.username || "Combatant",
                    details: `Language: ${s.language.toUpperCase()} | Verdict: ${s.verdict || s.status} | Execution: ${s.executionTime ? `${s.executionTime}ms` : "N/A"}`,
                    metadata: { submissionId: s.id, language: s.language, verdict: s.verdict },
                });
            }

            // Add historical broadcasts
            for (const b of recentBroadcasts) {
                this.entries.push({
                    id: `aud_hist_bc_${b.id}`,
                    timestamp: b.createdAt.toISOString(),
                    category: "ADMIN",
                    severity: b.type === "WARNING" ? "WARN" : "INFO",
                    action: "SYSTEM_BROADCAST_DISPATCHED",
                    actor: b.createdBy,
                    details: `"${b.title}" [${b.type}] (Expires: ${new Date(b.expiresAt).toLocaleDateString()})`,
                    metadata: { broadcastId: b.id, type: b.type },
                });
            }

            // Add historical rooms
            for (const r of recentRooms) {
                this.entries.push({
                    id: `aud_hist_room_${r.id}`,
                    timestamp: r.createdAt.toISOString(),
                    category: "BATTLE",
                    severity: "INFO",
                    action: "BATTLE_ROOM_HOSTED",
                    actor: r.host?.username || "Host",
                    details: `Room Code: ${r.roomCode} | Status: ${r.status} | Capacity: ${r.maxPlayers}`,
                    metadata: { roomId: r.id, roomCode: r.roomCode },
                });
            }

            // Sort newest first
            this.entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch {
            // Non-blocking initialization
        }
    }

    /**
     * Retrieve audit entries with optional filters and WSL Linux log fusion
     */
    public async getLogs(filter: {
        category?: string;
        severity?: string;
        limit?: number;
        search?: string;
        includeLinuxLogs?: boolean;
    }): Promise<{ logs: AuditLogEntry[]; total: number; categories: string[] }> {
        if (!this.isBootstrapped) {
            await this.bootstrapFromDatabase();
        }

        let combined = [...this.entries];

        // Fuse WSL Linux structured logs if requested or searching all
        if (filter.includeLinuxLogs !== false) {
            const linuxLogs = await linuxTelemetryBridge.queryLinuxLogs({
                limit: 30,
                q: filter.search,
            });

            for (const ll of linuxLogs) {
                const sev: AuditSeverity = ll.level >= 50 ? "ERROR" : ll.level >= 40 ? "WARN" : "INFO";
                combined.push({
                    id: `aud_linux_${ll.id || ll.time}`,
                    timestamp: new Date(ll.time * 1000).toISOString(),
                    category: "LINUX_TELEMETRY",
                    severity: sev,
                    action: ll.name ? `WSL_${ll.name.toUpperCase()}` : "WSL_LOG",
                    actor: "WSL_Host",
                    details: ll.msg || "Linux host execution log entry",
                    metadata: { pid: ll.pid, level: ll.level_name },
                });
            }
        }

        // Re-sort newest first
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Apply filters
        const categoryFilter = filter.category?.toUpperCase();
        if (categoryFilter && categoryFilter !== "ALL") {
            combined = combined.filter((e) => e.category === categoryFilter);
        }

        const severityFilter = filter.severity?.toUpperCase();
        if (severityFilter && severityFilter !== "ALL") {
            combined = combined.filter((e) => e.severity === severityFilter);
        }

        const search = filter.search?.toLowerCase().trim();
        if (search) {
            combined = combined.filter(
                (e) =>
                    e.action.toLowerCase().includes(search) ||
                    e.actor.toLowerCase().includes(search) ||
                    e.details.toLowerCase().includes(search)
            );
        }

        const limit = Math.min(100, Math.max(1, filter.limit || 50));
        const paged = combined.slice(0, limit);

        const categories = [
            "ALL",
            "AUTH",
            "SECURITY",
            "SUBMISSION",
            "BATTLE",
            "ADMIN",
            "FLEET",
            "LINUX_TELEMETRY",
            "SYSTEM",
        ];

        return {
            logs: paged,
            total: combined.length,
            categories,
        };
    }
}

export const auditService = AuditService.getInstance();
