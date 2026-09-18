// frontend/src/services/analytics/core.js
import { createCanonicalEvent, AnalyticsPriority, EventCategory } from "./canonicalEvent.js";
import { AlgoFightAdapter } from "./adapters/algoFightAdapter.js";

class UnifiedAnalyticsCore {
    constructor() {
        this.sessionId = this.getOrCreateSessionId();
        this.anonymousId = this.getOrCreateAnonymousId();
        this.userId = null;
        this.currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
        this.pageStartTime = Date.now();

        // In-memory buffering & batching
        this.buffer = [];
        this.bufferFlushTimer = null;
        this.maxBufferSize = 10;
        this.flushIntervalMs = 20000; // 20s batch flush window

        // Deduplication set (holds recent event IDs to prevent duplicate transmissions)
        this.seenEventIds = new Set();
        this.maxSeenCache = 200;

        this.isInitialized = false;
    }

    getOrCreateSessionId() {
        if (typeof window === "undefined") return "ssr_session";
        try {
            let sId = sessionStorage.getItem("af_session_id");
            if (!sId) {
                sId = `af_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                sessionStorage.setItem("af_session_id", sId);
            }
            return sId;
        } catch {
            return `af_sess_${Date.now()}`;
        }
    }

    getOrCreateAnonymousId() {
        if (typeof window === "undefined") return "ssr_anon";
        try {
            let aId = localStorage.getItem("af_anon_id");
            if (!aId) {
                aId = `af_anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                localStorage.setItem("af_anon_id", aId);
            }
            return aId;
        } catch {
            return `af_anon_${Date.now()}`;
        }
    }

    setUserId(uid) {
        this.userId = uid;
    }

    init() {
        if (this.isInitialized || typeof window === "undefined") return;
        this.isInitialized = true;

        // Periodic batch flush timer
        this.bufferFlushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                this.flush();
            }
        }, this.flushIntervalMs);

        // Low-frequency heartbeat every 45s for active visibility dwell tracking
        this.heartbeatTimer = setInterval(() => {
            if (typeof document !== "undefined" && document.visibilityState === "visible") {
                this.sendHeartbeat();
            }
        }, 45000);

        // Visibility & exit lifecycle listeners
        const handleExit = () => {
            const dwellSeconds = Math.max(1, Math.round((Date.now() - this.pageStartTime) / 1000));
            // Push final page exit metric
            this.track(
                "page_exit",
                {
                    path: this.currentPath,
                    duration: dwellSeconds,
                },
                { priority: AnalyticsPriority.CRITICAL }
            );
            this.flush({ useBeacon: true });
        };

        window.addEventListener("pagehide", handleExit);
        window.addEventListener("beforeunload", handleExit);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                this.flush({ useBeacon: true });
            }
        });
    }

    /**
     * Primary Tracking Method (Implementation Plan Specification Section 4)
     * All components call analytics.track(eventName, properties, options)
     */
    track(eventName, properties = {}, options = {}) {
        const canonical = createCanonicalEvent(eventName, properties, {
            ...options,
            sessionId: this.sessionId,
            anonymousId: this.anonymousId,
            userId: this.userId,
        });

        // Deduplication check
        if (this.seenEventIds.has(canonical.event_id)) {
            return;
        }
        this.seenEventIds.add(canonical.event_id);
        if (this.seenEventIds.size > this.maxSeenCache) {
            const oldest = this.seenEventIds.values().next().value;
            this.seenEventIds.delete(oldest);
        }

        // Route to AlgoFight Buffer according to priority
        if (options.priority === AnalyticsPriority.CRITICAL) {
            // Bypass buffer, transmit immediately
            AlgoFightAdapter.sendBatch([canonical]);
        } else {
            this.buffer.push(canonical);
            if (this.buffer.length >= this.maxBufferSize) {
                this.flush();
            }
        }
    }

    /**
     * Route transition tracking
     */
    trackPageView(newPath, title) {
        if (!newPath || typeof window === "undefined") return;

        const now = Date.now();
        const durationOnPrevious = Math.max(0, Math.round((now - this.pageStartTime) / 1000));
        const previousPath = this.currentPath;

        this.currentPath = newPath;
        this.pageStartTime = now;

        this.track(
            "page_view",
            {
                path: newPath,
                title: title || (typeof document !== "undefined" ? document.title : ""),
                durationOnPrevious: previousPath !== newPath ? durationOnPrevious : 0,
                referrer: typeof document !== "undefined" ? document.referrer : "",
            },
            {
                priority: AnalyticsPriority.HIGH,
                category: EventCategory.PRODUCT,
            }
        );
    }

    /**
     * Periodic live heartbeat
     */
    sendHeartbeat() {
        const dwellSeconds = Math.max(0, Math.round((Date.now() - this.pageStartTime) / 1000));
        this.track(
            "heartbeat",
            {
                path: this.currentPath,
                duration: dwellSeconds,
            },
            {
                priority: AnalyticsPriority.LOW,
                category: EventCategory.PERFORMANCE,
            }
        );
    }

    /**
     * Flush buffered events to backend
     */
    flush({ useBeacon = false } = {}) {
        if (this.buffer.length === 0) return;

        const batch = [...this.buffer];
        this.buffer = [];

        if (useBeacon) {
            AlgoFightAdapter.sendBeacon(batch);
        } else {
            AlgoFightAdapter.sendBatch(batch);
        }
    }

    destroy() {
        if (this.bufferFlushTimer) clearInterval(this.bufferFlushTimer);
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.flush({ useBeacon: true });
        this.isInitialized = false;
    }
}

export const unifiedAnalytics = new UnifiedAnalyticsCore();
