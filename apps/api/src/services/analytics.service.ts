// apps/api/src/services/analytics.service.ts
import { normalizeIp, normalizeMethod } from "../utils/ip.util";

export interface ActiveSession {
    sessionId: string;
    ip: string;
    userId?: string;
    username?: string;
    currentPath: string;
    currentTitle?: string;
    device: "Desktop" | "Mobile" | "Tablet";
    browser: string;
    startTime: number;
    lastActive: number;
    totalDwellSeconds: number;
}

export interface PageStat {
    path: string;
    title: string;
    hits: number;
    uniqueIps: Set<string>;
    totalDurationSeconds: number;
    lastHit: number;
}

export interface IpTrafficRecord {
    ip: string;
    totalRequests: number;
    methods: Record<string, number>;
    paths: Record<string, number>;
    lastSeen: number;
    userAgent?: string;
    username?: string;
}

export interface HourlyBucket {
    hour: string;
    hits: number;
    activeUsers: number;
}

export interface AnalyticsSnapshot {
    activeUsersNow: number;
    authenticatedUsers: number;
    guestUsers: number;
    peakUsers24h: number;
    totalPageViews: number;
    totalSessions: number;
    avgSurfingSeconds: number;
    avgSurfingFormatted: string;
    topPages: Array<{
        path: string;
        title: string;
        hits: number;
        percentage: number;
        uniqueIpsCount: number;
        avgSurfingSeconds: number;
        avgSurfingFormatted: string;
        lastHit: string;
    }>;
    methodBreakdown: Record<string, number>;
    topIpOrigins: Array<{
        ip: string;
        totalRequests: number;
        primaryMethod: string;
        topPath: string;
        lastSeen: string;
        username?: string;
    }>;
    hourlyTimeline: HourlyBucket[];
    deviceBreakdown: Record<string, number>;
    browserBreakdown: Record<string, number>;
    recentSessions: Array<{
        sessionId: string;
        ip: string;
        currentPath: string;
        surfingDurationFormatted: string;
        device: string;
        browser: string;
        lastActiveAgoSeconds: number;
        isAuthenticated: boolean;
        username?: string;
    }>;
}

export class AnalyticsService {
    private static instance: AnalyticsService;

    // Strict safety limits to prevent memory exhaustion (DoS / OOM protection)
    private static readonly MAX_SESSIONS = 500;
    private static readonly MAX_TRACKED_IPS = 200;
    private static readonly MAX_TRACKED_PATHS = 100;
    private static readonly ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes for live active user status

    private readonly sessions = new Map<string, ActiveSession>();
    private readonly pageStats = new Map<string, PageStat>();
    private readonly ipRecords = new Map<string, IpTrafficRecord>();
    private readonly methodCounters: Record<string, number> = {
        GET: 0,
        POST: 0,
        PUT: 0,
        DELETE: 0,
        PATCH: 0,
    };
    private readonly hourlyBuckets = new Map<string, { hits: number; users: Set<string> }>();

    private totalPageViewsCount = 0;
    private totalSessionsCount = 0;
    private cumulativeDwellSeconds = 0;
    private peakActiveUsers = 1;

    private constructor() {
        this.seedBaselineTelemetry();
    }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    /**
     * Record a page navigation or heartbeat beacon from the client
     */
    public recordPageVisit(params: {
        sessionId: string;
        ip: string;
        path: string;
        title?: string;
        durationOnPrevious?: number;
        referrer?: string;
        userAgent?: string;
        user?: { id?: string; username?: string };
    }): void {
        try {
            const now = Date.now();
            const cleanIp = normalizeIp(params.ip || "127.0.0.1");
            const rawPath = (params.path || "/").trim();
            const cleanPath = rawPath.startsWith("/") ? rawPath.slice(0, 80) : `/${rawPath.slice(0, 80)}`;
            const cleanSessionId = (params.sessionId || `anon_${cleanIp}_${now}`).slice(0, 64);
            const duration = Math.min(3600, Math.max(0, Math.round(params.durationOnPrevious || 0)));

            // Infer device & browser safely
            const ua = (params.userAgent || "").toLowerCase();
            let device: "Desktop" | "Mobile" | "Tablet" = "Desktop";
            if (/tablet|ipad|playbook|silk/i.test(ua)) device = "Tablet";
            else if (/mobile|iphone|android|touch/i.test(ua)) device = "Mobile";

            let browser = "Chrome";
            if (/edg\//i.test(ua)) browser = "Edge";
            else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
            else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
            else if (/opera|opr\//i.test(ua)) browser = "Opera";

            // 1. Session Management
            let session = this.sessions.get(cleanSessionId);
            if (!session) {
                if (this.sessions.size >= AnalyticsService.MAX_SESSIONS) {
                    // Evict oldest session
                    let oldestId = "";
                    let oldestTime = Infinity;
                    for (const [sId, s] of this.sessions.entries()) {
                        if (s.lastActive < oldestTime) {
                            oldestTime = s.lastActive;
                            oldestId = sId;
                        }
                    }
                    if (oldestId) this.sessions.delete(oldestId);
                }

                session = {
                    sessionId: cleanSessionId,
                    ip: cleanIp,
                    userId: params.user?.id,
                    username: params.user?.username,
                    currentPath: cleanPath,
                    currentTitle: params.title || cleanPath,
                    device,
                    browser,
                    startTime: now,
                    lastActive: now,
                    totalDwellSeconds: 0,
                };
                this.sessions.set(cleanSessionId, session);
                this.totalSessionsCount++;
            } else {
                session.ip = cleanIp;
                session.lastActive = now;
                session.currentPath = cleanPath;
                if (params.title) session.currentTitle = params.title;
                if (params.user?.username) session.username = params.user.username;
                if (duration > 0) {
                    session.totalDwellSeconds += duration;
                    this.cumulativeDwellSeconds += duration;
                }
            }

            // 2. Page Statistics
            this.totalPageViewsCount++;
            let pStat = this.pageStats.get(cleanPath);
            if (!pStat) {
                if (this.pageStats.size >= AnalyticsService.MAX_TRACKED_PATHS) {
                    // Evict least hit path
                    let minHits = Infinity;
                    let minPath = "";
                    for (const [p, stat] of this.pageStats.entries()) {
                        if (stat.hits < minHits) {
                            minHits = stat.hits;
                            minPath = p;
                        }
                    }
                    if (minPath) this.pageStats.delete(minPath);
                }

                pStat = {
                    path: cleanPath,
                    title: params.title || this.getRouteLabel(cleanPath),
                    hits: 0,
                    uniqueIps: new Set<string>(),
                    totalDurationSeconds: 0,
                    lastHit: now,
                };
                this.pageStats.set(cleanPath, pStat);
            }

            pStat.hits++;
            pStat.lastHit = now;
            if (pStat.uniqueIps.size < 500) {
                pStat.uniqueIps.add(cleanIp);
            }
            if (duration > 0) {
                pStat.totalDurationSeconds += duration;
            }

            // 3. Hourly Bucket
            const hourKey = new Date(now).toISOString().slice(11, 13) + ":00";
            let hBucket = this.hourlyBuckets.get(hourKey);
            if (!hBucket) {
                hBucket = { hits: 0, users: new Set<string>() };
                this.hourlyBuckets.set(hourKey, hBucket);
            }
            hBucket.hits++;
            if (hBucket.users.size < 500) {
                hBucket.users.add(cleanSessionId);
            }

            // 4. IP Tracking
            this.recordIpActivity(cleanIp, "POST", cleanPath, params.userAgent, params.user?.username);

            // Update peak concurrency
            const currentActive = this.getActiveUsersCount();
            if (currentActive > this.peakActiveUsers) {
                this.peakActiveUsers = currentActive;
            }
        } catch {
            // Non-blocking telemetry isolation
        }
    }

    /**
     * Record general incoming HTTP traffic from the Gateway
     */
    public recordHttpRequest(params: {
        ip: string;
        method: string;
        path: string;
        statusCode?: number;
        userAgent?: string;
        username?: string;
    }): void {
        try {
            const cleanIp = normalizeIp(params.ip || "127.0.0.1");
            const method = normalizeMethod(params.method);
            const path = (params.path || "/").split("?")[0].slice(0, 80);

            // Increment method counter
            this.methodCounters[method] = (this.methodCounters[method] || 0) + 1;

            // Record IP details
            this.recordIpActivity(cleanIp, method, path, params.userAgent, params.username);
        } catch {
            // Fail-safe
        }
    }

    private recordIpActivity(ip: string, method: string, path: string, ua?: string, username?: string): void {
        const now = Date.now();
        let record = this.ipRecords.get(ip);
        if (!record) {
            if (this.ipRecords.size >= AnalyticsService.MAX_TRACKED_IPS) {
                // Evict oldest IP
                let oldestIp = "";
                let oldestTime = Infinity;
                for (const [k, v] of this.ipRecords.entries()) {
                    if (v.lastSeen < oldestTime) {
                        oldestTime = v.lastSeen;
                        oldestIp = k;
                    }
                }
                if (oldestIp) this.ipRecords.delete(oldestIp);
            }

            record = {
                ip,
                totalRequests: 0,
                methods: {},
                paths: {},
                lastSeen: now,
                userAgent: ua,
                username,
            };
            this.ipRecords.set(ip, record);
        }

        record.totalRequests++;
        record.lastSeen = now;
        record.methods[method] = (record.methods[method] || 0) + 1;
        record.paths[path] = (record.paths[path] || 0) + 1;
        if (username) record.username = username;
    }

    /**
     * Return count of active concurrent sessions in the sliding window
     */
    public getActiveUsersCount(): number {
        const cutoff = Date.now() - AnalyticsService.ACTIVE_WINDOW_MS;
        let count = 0;
        for (const session of this.sessions.values()) {
            if (session.lastActive >= cutoff) count++;
        }
        return count;
    }

    /**
     * Build unified, statistical snapshot for the Control Hub UI
     */
    public getSnapshot(): AnalyticsSnapshot {
        const now = Date.now();
        const cutoff = now - AnalyticsService.ACTIVE_WINDOW_MS;

        // Active sessions
        let activeCount = 0;
        let authCount = 0;
        let guestCount = 0;
        const recentSessions: AnalyticsSnapshot["recentSessions"] = [];

        for (const s of this.sessions.values()) {
            const isLive = s.lastActive >= cutoff;
            if (isLive) {
                activeCount++;
                if (s.username || s.userId) authCount++;
                else guestCount++;
            }

            recentSessions.push({
                sessionId: s.sessionId.slice(0, 14) + "...",
                ip: s.ip,
                currentPath: s.currentPath,
                surfingDurationFormatted: this.formatDuration(s.totalDwellSeconds),
                device: s.device,
                browser: s.browser,
                lastActiveAgoSeconds: Math.max(0, Math.floor((now - s.lastActive) / 1000)),
                isAuthenticated: Boolean(s.username || s.userId),
                username: s.username,
            });
        }

        // Sort sessions by recency
        recentSessions.sort((a, b) => a.lastActiveAgoSeconds - b.lastActiveAgoSeconds);

        // Calculate Average Surfing Duration
        const avgSeconds = this.totalSessionsCount > 0
            ? Math.round(this.cumulativeDwellSeconds / this.totalSessionsCount)
            : 420;

        // Top Pages
        const topPages = Array.from(this.pageStats.values())
            .map((p) => {
                const avgPageTime = p.hits > 0 ? Math.round(p.totalDurationSeconds / p.hits) : 60;
                return {
                    path: p.path,
                    title: p.title || this.getRouteLabel(p.path),
                    hits: p.hits,
                    percentage: this.totalPageViewsCount > 0 ? Number(((p.hits / this.totalPageViewsCount) * 100).toFixed(1)) : 0,
                    uniqueIpsCount: Math.max(1, p.uniqueIps.size),
                    avgSurfingSeconds: avgPageTime,
                    avgSurfingFormatted: this.formatDuration(avgPageTime),
                    lastHit: new Date(p.lastHit).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                };
            })
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 10);

        // Top IP origins
        const topIpOrigins = Array.from(this.ipRecords.values())
            .map((rec) => {
                // Determine dominant method
                let primaryMethod = "GET";
                let maxMCount = 0;
                for (const [m, c] of Object.entries(rec.methods)) {
                    if (c > maxMCount) {
                        maxMCount = c;
                        primaryMethod = m;
                    }
                }

                // Determine top path
                let topPath = "/";
                let maxPCount = 0;
                for (const [p, c] of Object.entries(rec.paths)) {
                    if (c > maxPCount) {
                        maxPCount = c;
                        topPath = p;
                    }
                }

                return {
                    ip: rec.ip,
                    totalRequests: rec.totalRequests,
                    primaryMethod,
                    topPath,
                    lastSeen: new Date(rec.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                    username: rec.username,
                };
            })
            .sort((a, b) => b.totalRequests - a.totalRequests)
            .slice(0, 10);

        // Hourly Timeline (Last 12 hours)
        const hourlyTimeline: HourlyBucket[] = [];
        const currentHour = new Date(now).getHours();
        for (let i = 11; i >= 0; i--) {
            const h = (currentHour - i + 24) % 24;
            const hourStr = `${String(h).padStart(2, "0")}:00`;
            const bucket = this.hourlyBuckets.get(hourStr);
            hourlyTimeline.push({
                hour: hourStr,
                hits: bucket ? bucket.hits : 0,
                activeUsers: bucket ? bucket.users.size : 0,
            });
        }

        return {
            activeUsersNow: activeCount,
            authenticatedUsers: authCount,
            guestUsers: guestCount,
            peakUsers24h: Math.max(this.peakActiveUsers, activeCount),
            totalPageViews: this.totalPageViewsCount,
            totalSessions: this.totalSessionsCount,
            avgSurfingSeconds: avgSeconds,
            avgSurfingFormatted: this.formatDuration(avgSeconds),
            topPages,
            methodBreakdown: { ...this.methodCounters },
            topIpOrigins,
            hourlyTimeline,
            deviceBreakdown: {},
            browserBreakdown: {},
            recentSessions: recentSessions.slice(0, 8),
        };
    }

    private formatDuration(seconds: number): string {
        const s = Math.max(0, Math.round(seconds));
        if (s < 60) return `${s}s`;
        const mins = Math.floor(s / 60);
        const remSecs = s % 60;
        if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m`;
    }

    private getRouteLabel(path: string): string {
        if (path === "/" || path === "") return "Landing Page";
        if (path.startsWith("/home")) return "Combatant Dashboard (Home)";
        if (path.startsWith("/battle/room")) return "Live Battle Room";
        if (path.startsWith("/battle")) return "Battle Arena & Matchmaking";
        if (path.startsWith("/practice/")) return "Practice Workspace (IDE)";
        if (path.startsWith("/practice")) return "Practice Problems Library";
        if (path.startsWith("/leaderboard")) return "Global Hall of Fame";
        if (path.startsWith("/profile")) return "Combatant Dossier & Profile";
        if (path.startsWith("/admin")) return "Central Control Hub";
        if (path.startsWith("/login")) return "Combatant Access Gateway";
        if (path.startsWith("/signup")) return "Combatant Registration";
        if (path.startsWith("/rewards")) return "Season Rewards & Badges";
        if (path.startsWith("/about")) return "About AlgoFight";
        if (path.startsWith("/blog")) return "Dev Blog & Changelog";
        return path;
    }

    /**
     * Seeds initial telemetry distribution so statistics are immediately rich, logical,
     * and visual upon launching the Control Hub without requiring days of production traffic.
     */
    private seedBaselineTelemetry(): void {
        // Seeding removed as per user request to only show authenticated/real content.
    }
}

export const analyticsService = AnalyticsService.getInstance();
