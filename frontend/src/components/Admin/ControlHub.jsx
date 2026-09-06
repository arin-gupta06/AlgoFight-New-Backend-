import React, { useState, useEffect, useCallback, useRef } from "react";
import "./ControlHub.css";
import { motion, AnimatePresence } from "framer-motion";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import {
    toApiUrl,
    fetchAdminBroadcasts,
    dispatchAdminBroadcast,
    deleteAdminBroadcast,
    uploadBroadcastMedia,
    fetchAdminAuditLogs,
    probeAdminFleet,
    scaleAdminFleet,
} from "../../services/api.js";
import SystemBroadcastCard from "../Common/broadcasts/SystemBroadcastCard.jsx";
import { generatePdfThumbnail } from "../../utils/pdfThumbnail.js";

const SERVICE_NAMES = {
    apiGateway: "API Gateway",
    websocketGateway: "WebSocket Gateway",
    database: "PostgreSQL Database",
    redisCluster: "Redis Cluster",
    pistonSandbox: "Piston Sandbox",
};

const STAT_LABELS = {
    uptime: "Uptime",
    latency: "Latency",
    avgLatency: "Avg Latency",
    p95Latency: "P95 Latency",
    port: "Port",
    protocol: "Protocol",
    engine: "Engine",
    pool: "Pool Status",
    host: "Host",
    endpoint: "Endpoint",
    activeSockets: "Active Sockets",
    activeRooms: "Active Rooms",
    totalRequests: "Total Requests",
    runtimesAvailable: "Available Runtimes",
};

export default function ControlHub() {
    const [adminKey, setAdminKey] = useState(sessionStorage.getItem("af_admin_key") || "");
    const [isUnlocked, setIsUnlocked] = useState(Boolean(sessionStorage.getItem("af_admin_key")));
    const [passInput, setPassInput] = useState("");
    const [authError, setAuthError] = useState("");

    const [metrics, setMetrics] = useState(null);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const { notify } = useNotification();

    // Live Sync & Telemetry State
    const [refreshInterval, setRefreshInterval] = useState(5); // 5s default
    const [isSyncing, setIsSyncing] = useState(false);
    const [secondsSinceSync, setSecondsSinceSync] = useState(0);

    // Active Navigation Tabs
    const [activeTab, setActiveTab] = useState("overview"); // "overview" | "audit_trail" | "linux_telemetry"
    const [linuxStatus, setLinuxStatus] = useState("CHECKING");

    // Audit Trail State
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditCategory, setAuditCategory] = useState("ALL");
    const [auditSeverity, setAuditSeverity] = useState("ALL");
    const [auditSearch, setAuditSearch] = useState("");
    const [auditLoading, setAuditLoading] = useState(false);
    const [expandedAuditId, setExpandedAuditId] = useState(null);

    // Fleet Diagnostics & Probe State
    const [isProbingFleet, setIsProbingFleet] = useState(false);
    const [probeResults, setProbeResults] = useState(null);
    const [isProbeModalOpen, setIsProbeModalOpen] = useState(false);
    const [isScalingFleet, setIsScalingFleet] = useState(false);

    // System Broadcast State
    const [adminBroadcasts, setAdminBroadcasts] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [isDispatching, setIsDispatching] = useState(false);
    const [includeMediaOrAction, setIncludeMediaOrAction] = useState(true);

    const [broadcastForm, setBroadcastForm] = useState({
        title: "Hey Coders! 👋",
        message: "AlgoFight is currently in its Alpha Testing Phase until September 10, 2026. If you find a bug, have a suggestion, or want to share feedback, let us know!",
        type: "FEEDBACK",
        expiryDate: "2026-09-10",
        expiryTime: "23:59",
        flashBanner: true,
        contentType: "NONE",
        contentUrl: "",
        contentName: "",
        thumbnailUrl: "",
        pageCount: null,
        contentSize: null,
        actionType: "EXTERNAL_LINK",
        actionLabel: "Share Your Feedback",
        actionTarget: "https://docs.google.com/forms/d/e/1FAIpQLSe-example/viewform",
    });

    const rawTelemetryUrl = import.meta.env.VITE_LINUX_TELEMETRY_URL || "http://localhost:8000";
    const linuxBaseUrl = rawTelemetryUrl.replace(/\/dashboard\/?$/, "").replace(/\/$/, "");
    const linuxTelemetryUrl = `${linuxBaseUrl}/dashboard`;

    // 🔒 SuperAdmin Authentication
    const handleUnlock = async (e) => {
        e.preventDefault();
        setAuthError("");

        try {
            const res = await fetch(toApiUrl("/api/admin/auth/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: passInput.trim() }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                sessionStorage.setItem("af_admin_key", passInput.trim());
                setAdminKey(passInput.trim());
                setIsUnlocked(true);
                notify({ type: "success", title: "ACCESS GRANTED", message: "SuperAdmin Level 5 Clearance Verified." });
            } else {
                setAuthError(data.message || "Invalid SuperAdmin Passkey.");
            }
        } catch {
            setAuthError("Could not reach authentication gateway.");
        }
    };

    const handleLock = () => {
        sessionStorage.removeItem("af_admin_key");
        setAdminKey("");
        setIsUnlocked(false);
        setPassInput("");
    };

    // 📡 Telemetry Fetch
    const fetchTelemetry = useCallback(async () => {
        if (!adminKey) return;
        try {
            const res = await fetch(toApiUrl("/api/admin/metrics"), {
                headers: { "x-admin-key": adminKey },
            });
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
                setSecondsSinceSync(0);
            }
        } catch (err) {
            console.error("Telemetry fetch failed", err);
        }
    }, [adminKey]);

    // 👥 Users Registry Fetch
    const fetchUsers = useCallback(async (query = "") => {
        if (!adminKey) return;
        try {
            const path = query ? `/api/admin/users?search=${encodeURIComponent(query)}` : "/api/admin/users";
            const res = await fetch(toApiUrl(path), {
                headers: { "x-admin-key": adminKey },
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Users fetch failed", err);
        }
    }, [adminKey]);

    // 📢 Broadcasts Fetch
    const fetchBroadcasts = useCallback(async () => {
        if (!adminKey) return;
        try {
            const data = await fetchAdminBroadcasts(adminKey);
            setAdminBroadcasts(data?.broadcasts || []);
        } catch (err) {
            console.error("Broadcasts fetch failed", err);
        }
    }, [adminKey]);

    // 🛡️ Audit Logs Fetch
    const fetchAuditLogs = useCallback(async (cat = auditCategory, sev = auditSeverity, q = auditSearch) => {
        if (!adminKey) return;
        setAuditLoading(true);
        try {
            const data = await fetchAdminAuditLogs(adminKey, {
                category: cat,
                severity: sev,
                search: q,
                limit: 60,
            });
            setAuditLogs(data?.logs || []);
            setAuditTotal(data?.total || 0);
        } catch (err) {
            console.error("Audit logs fetch failed", err);
        } finally {
            setAuditLoading(false);
        }
    }, [adminKey, auditCategory, auditSeverity, auditSearch]);

    // 🖥️ Linux Status Probe
    const checkLinuxStatus = useCallback(async () => {
        try {
            const res = await fetch(toApiUrl("/api/admin/linux-status"));
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                setLinuxStatus(data.status === "ONLINE" || data.online ? "ONLINE" : "OFFLINE");
            } else {
                setLinuxStatus("OFFLINE");
            }
        } catch {
            setLinuxStatus("OFFLINE");
        }
    }, []);

    // ⚡ Manual Unified Sync
    const handleManualSync = async () => {
        setIsSyncing(true);
        await Promise.all([
            fetchTelemetry(),
            fetchBroadcasts(),
            fetchAuditLogs(),
            checkLinuxStatus(),
        ]);
        setTimeout(() => setIsSyncing(false), 500);
        notify({ type: "info", title: "METRICS SYNCHRONIZED", message: "Live telemetry and audit records updated." });
    };

    // 🚀 Fleet Diagnostics Probe
    const handleRunFleetProbe = async () => {
        setIsProbingFleet(true);
        try {
            const data = await probeAdminFleet(adminKey, {
                language: "python",
                code: "import sys, time; time.sleep(0.01); print(f'AlgoFight Piston Engine Online: Python {sys.version.split()[0]}')",
            });
            setProbeResults(data);
            setIsProbeModalOpen(true);
            notify({ type: "success", title: "PROBE COMPLETED", message: `Tested ${data?.totalActiveRuntimes || 1} runtime container(s).` });
            fetchTelemetry();
            fetchAuditLogs();
        } catch (err) {
            notify({ type: "error", title: "PROBE FAILED", message: err.message || "Failed to execute runtime probe." });
        } finally {
            setIsProbingFleet(false);
        }
    };

    // ⚖️ Fleet Scaling Trigger
    const handleScaleFleet = async (direction) => {
        const actionLabel = direction === "out" ? "Scale-Out (+1 Container)" : "Scale-In (-1 Container)";
        if (!window.confirm(`Are you sure you want to trigger manual ${actionLabel}?`)) return;

        setIsScalingFleet(true);
        try {
            const res = await scaleAdminFleet(adminKey, direction, `Admin manual trigger: ${direction}`);
            if (res.success) {
                notify({ type: "success", title: "FLEET SCALED", message: `Successfully executed ${actionLabel}.` });
                fetchTelemetry();
                fetchAuditLogs();
            } else {
                notify({ type: "warning", title: "SCALING LIMITED", message: res.message || "Pool already at capacity threshold or hysteresis active." });
            }
        } catch (err) {
            notify({ type: "error", title: "SCALING FAILED", message: err.message });
        } finally {
            setIsScalingFleet(false);
        }
    };

    // ⏱️ Auto-Refresh & Seconds Counter Effects
    useEffect(() => {
        if (!isUnlocked || !adminKey) return;

        fetchTelemetry();
        fetchUsers();
        fetchBroadcasts();
        fetchAuditLogs();
        checkLinuxStatus();

        // Seconds counter
        const secTimer = setInterval(() => {
            setSecondsSinceSync((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(secTimer);
    }, [isUnlocked, adminKey, fetchTelemetry, fetchUsers, fetchBroadcasts, fetchAuditLogs, checkLinuxStatus]);

    useEffect(() => {
        if (!isUnlocked || !adminKey || refreshInterval <= 0) return;

        const syncTimer = setInterval(() => {
            fetchTelemetry();
            if (activeTab === "audit_trail") fetchAuditLogs();
            checkLinuxStatus();
        }, refreshInterval * 1000);

        return () => clearInterval(syncTimer);
    }, [isUnlocked, adminKey, refreshInterval, activeTab, fetchTelemetry, fetchAuditLogs, checkLinuxStatus]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers(search);
    };

    const handleApplyPreset = (preset) => {
        if (preset === "ALPHA") {
            setIncludeMediaOrAction(true);
            setBroadcastForm({
                title: "Hey Coders! 👋",
                message: "AlgoFight is currently in its Alpha Testing Phase until September 10, 2026. We are actively refining platform telemetry and match performance. If you discover a bug or have suggestions, share your feedback!",
                type: "FEEDBACK",
                expiryDate: "2026-09-10",
                expiryTime: "23:59",
                flashBanner: true,
                contentType: "NONE",
                contentUrl: "",
                contentName: "",
                thumbnailUrl: "",
                pageCount: null,
                contentSize: null,
                actionType: "EXTERNAL_LINK",
                actionLabel: "Share Your Feedback",
                actionTarget: "https://docs.google.com/forms/d/e/1FAIpQLSe-example/viewform",
            });
        } else if (preset === "24H") {
            const now = new Date();
            now.setDate(now.getDate() + 1);
            setBroadcastForm((prev) => ({
                ...prev,
                expiryDate: now.toISOString().split("T")[0],
                expiryTime: now.toTimeString().slice(0, 5),
            }));
        } else if (preset === "7D") {
            const now = new Date();
            now.setDate(now.getDate() + 7);
            setBroadcastForm((prev) => ({
                ...prev,
                expiryDate: now.toISOString().split("T")[0],
                expiryTime: now.toTimeString().slice(0, 5),
            }));
        }
    };

    const handleMediaFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 8 * 1024 * 1024) {
            notify({ type: "error", title: "FILE TOO LARGE", message: "Media files must be under 8MB." });
            return;
        }

        let inferredType = "DOCUMENT";
        if (file.type.startsWith("image/")) inferredType = "IMAGE";
        else if (file.type.startsWith("video/")) inferredType = "VIDEO";

        const reader = new FileReader();
        reader.onload = async () => {
            const base64Data = reader.result;
            try {
                const res = await uploadBroadcastMedia(adminKey, {
                    base64: base64Data,
                    name: file.name,
                    type: inferredType,
                    mimeType: file.type,
                    size: file.size,
                });

                if (res.success && res.media) {
                    let thumbnail = "";
                    let pages = null;
                    if (file.type === "application/pdf") {
                        const pdfInfo = await generatePdfThumbnail(base64Data);
                        thumbnail = pdfInfo.thumbnailUrl;
                        pages = pdfInfo.pageCount;
                    }

                    setBroadcastForm((prev) => ({
                        ...prev,
                        contentType: inferredType,
                        contentUrl: res.media.url,
                        contentName: res.media.name,
                        thumbnailUrl: thumbnail,
                        pageCount: pages,
                        contentSize: file.size,
                    }));
                    notify({ type: "success", title: "MEDIA ATTACHED", message: `Successfully attached ${file.name}` });
                }
            } catch (err) {
                notify({ type: "error", title: "UPLOAD FAILED", message: err.message || "Failed to process media file." });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDispatchBroadcast = async (e) => {
        e.preventDefault();
        setIsDispatching(true);

        try {
            const expiresAt = new Date(`${broadcastForm.expiryDate}T${broadcastForm.expiryTime}:00`).toISOString();
            const payload = {
                title: broadcastForm.title.trim(),
                message: broadcastForm.message.trim(),
                type: broadcastForm.type,
                expiresAt,
                flashBanner: broadcastForm.flashBanner,
                content:
                    includeMediaOrAction && broadcastForm.contentType !== "NONE" && broadcastForm.contentUrl
                        ? {
                              type: broadcastForm.contentType,
                              url: broadcastForm.contentUrl,
                              name: broadcastForm.contentName || "Attachment",
                              thumbnailUrl: broadcastForm.thumbnailUrl || null,
                              pageCount: broadcastForm.pageCount || null,
                              size: broadcastForm.contentSize || null,
                          }
                        : null,
                action:
                    includeMediaOrAction && broadcastForm.actionType !== "NONE" && broadcastForm.actionTarget
                        ? {
                              type: broadcastForm.actionType,
                              label: broadcastForm.actionLabel || "Action",
                              target: broadcastForm.actionTarget,
                          }
                        : null,
            };

            const res = await dispatchAdminBroadcast(adminKey, payload);
            if (res.success) {
                notify({
                    type: "success",
                    title: "BROADCAST DISPATCHED",
                    message: "Time-bound system announcement is now live across the combat network.",
                });
                fetchBroadcasts();
                fetchAuditLogs();
            } else {
                notify({
                    type: "error",
                    title: "DISPATCH FAILED",
                    message: res.message || "Failed to dispatch broadcast.",
                });
            }
        } catch (err) {
            notify({
                type: "error",
                title: "DISPATCH ERROR",
                message: err.message || "Could not communicate with admin API.",
            });
        } finally {
            setIsDispatching(false);
        }
    };

    const handleRevokeBroadcast = async (broadcastId) => {
        if (!window.confirm("Are you sure you want to revoke this broadcast? It will instantly disappear from all user screens and inboxes.")) {
            return;
        }

        try {
            const res = await deleteAdminBroadcast(adminKey, broadcastId);
            if (res.success) {
                notify({ type: "warning", title: "BROADCAST REVOKED", message: "Broadcast purged from active clients." });
                fetchBroadcasts();
                fetchAuditLogs();
            }
        } catch (err) {
            notify({ type: "error", title: "REVOCATION FAILED", message: err.message || "Failed to revoke." });
        }
    };

    const formatRemaining = (expiresAt, status) => {
        if (status === "REVOKED") return "Revoked";
        const diff = new Date(expiresAt).getTime() - Date.now();
        if (diff <= 0) return "Expired";
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} day${days > 1 ? "s" : ""} left`;
        if (hours > 0) return `${hours} hr${hours > 1 ? "s" : ""} left`;
        const mins = Math.floor(diff / (1000 * 60));
        return `${mins} min${mins > 1 ? "s" : ""} left`;
    };

    // 🔒 Render Security Clearance Gate if locked
    if (!isUnlocked) {
        return (
            <div className="admin-lock-screen">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="lock-terminal"
                >
                    <div className="pre-heading">RESTRICTED ACCESS</div>
                    <h2>SuperAdmin Clearance</h2>
                    <p>Authenticate with your master administrative credentials to access platform telemetry and fleet controls.</p>

                    <form onSubmit={handleUnlock} className="lock-form">
                        <div className="lock-input-wrap">
                            <input
                                type="password"
                                placeholder="Enter SuperAdmin Passkey..."
                                value={passInput}
                                onChange={(e) => setPassInput(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {authError && <p className="lock-error">{authError}</p>}
                        <button type="submit" className="lock-btn">
                            Verify Clearance
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    // 🎛️ Render Full SuperAdmin Control Hub once unlocked
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="admin-control-hub"
        >
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-title">
                    <div className="pre-heading">ADMINISTRATION CONSOLE</div>
                    <h1>Central Control & <span className="text-cyan-gradient">Telemetry Hub</span></h1>
                    <p className="admin-subtext">Real-time infrastructure monitoring, fan-in/fan-out telemetry, live audit trails & college sub-batches</p>
                </div>
                <div className="admin-header-actions">
                    <button className="lock-hub-btn" onClick={handleLock}>
                        🔒 Lock Terminal
                    </button>
                </div>
            </div>

            {/* 🔴 Live Telemetry Control Bar Ribbon */}
            <div className="telemetry-control-bar glass-panel">
                <div className="sync-status-group">
                    <div className="pulse-indicator online" />
                    <span className="sync-status-text">FLEET STATUS: OPTIMAL • TELEMETRY SYNCHRONIZED</span>
                    <span className="last-sync-badge">Updated: {secondsSinceSync}s ago</span>
                </div>

                <div className="sync-actions-group">
                    <div className="interval-selector-wrap">
                        <span className="interval-label">Auto-Sync:</span>
                        <select
                            value={refreshInterval}
                            onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            className="sync-select"
                        >
                            <option value={3}>3s (High-Frequency)</option>
                            <option value={5}>5s (Default)</option>
                            <option value={10}>10s (Relaxed)</option>
                            <option value={30}>30s (Low-Bandwidth)</option>
                            <option value={0}>Manual Only</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        className={`manual-sync-btn ${isSyncing ? "is-spinning" : ""}`}
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        title="Force immediate telemetry & audit sync"
                    >
                        🔄 {isSyncing ? "Syncing..." : "Sync Now"}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="admin-tabs-bar">
                <button
                    className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    ⚡ Platform Fleet & Registry
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === "audit_trail" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("audit_trail");
                        fetchAuditLogs();
                    }}
                >
                    🛡️ Live Audit Trail & Logs ({auditTotal || auditLogs.length})
                </button>
                <button
                    className={`admin-tab-btn ${activeTab === "linux_telemetry" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("linux_telemetry");
                        checkLinuxStatus();
                    }}
                >
                    🖥️ Linux Host Telemetry Live
                    <span className={`linux-status-pill ${linuxStatus.toLowerCase()}`}>
                        {linuxStatus === "ONLINE" ? "🟢 LIVE" : "🔴 OFFLINE"}
                    </span>
                </button>
            </div>

            {/* Tab 1: Platform Fleet & Registry Overview */}
            {activeTab === "overview" && (
                <>
                    {/* 1. Microservice Fleet Grid */}
                    <div className="admin-section">
                        <h3 className="section-title">Infrastructure Fleet & Services</h3>
                        <div className="fleet-grid">
                            {metrics?.services && Object.entries(metrics.services).map(([key, s]) => (
                                <div key={key} className="fleet-card">
                                    <div className="fleet-card-header">
                                        <span className="fleet-name">{SERVICE_NAMES[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
                                        <span className={`status-pill ${s.status?.toLowerCase()}`}>{s.status}</span>
                                    </div>
                                    <div className="fleet-details">
                                        {Object.entries(s).filter(([k]) => k !== "status").map(([k, v]) => (
                                            <div key={k} className="stat-row">
                                                <span className="stat-label">{STAT_LABELS[k] || k}</span>
                                                <span className="stat-value">{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Real Ingress & Egress Telemetry Deck */}
                    <div className="admin-metrics-row">
                        {/* Traffic Throughput */}
                        <div className="telemetry-card">
                            <div className="card-header">
                                <div>
                                    <h3>Gateway Traffic & Throughput</h3>
                                    <span className="telemetry-subtext">Live rolling window traffic from Gateway Telemetry Engine</span>
                                </div>
                                <span className="telemetry-tag">REAL-TIME</span>
                            </div>
                            <div className="telemetry-stats">
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Ingress Rate (Fan-In)</span>
                                    <span className="telemetry-num cyan">{metrics?.traffic?.ingressRps !== undefined ? `${metrics.traffic.ingressRps} req/s` : "0.0 req/s"}</span>
                                    <span className="telemetry-hint">HTTP API Requests handled</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Broadcast Rate (Fan-Out)</span>
                                    <span className="telemetry-num purple">{metrics?.traffic?.egressEventsSec !== undefined ? `${metrics.traffic.egressEventsSec} events/s` : "0.0 events/s"}</span>
                                    <span className="telemetry-hint">WebSocket Room Emissions</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Active Combatants</span>
                                    <span className="telemetry-num green">{metrics?.services?.websocketGateway?.activeSockets ?? 0} Connected</span>
                                    <span className="telemetry-hint">{metrics?.services?.websocketGateway?.activeRooms ?? 0} active battle rooms</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Process Memory</span>
                                    <span className="telemetry-num gold">{metrics?.traffic?.memoryRssMb || "0 MB"}</span>
                                    <span className="telemetry-hint">Heap: {metrics?.traffic?.heapUsedMb || "0 MB"}</span>
                                </div>
                            </div>

                            {/* Admission Controller SLA Bar */}
                            <div className="admission-sla-bar-wrap">
                                <div className="sla-labels">
                                    <span>Gateway Security & Admission SLA</span>
                                    <strong style={{ color: '#4ade80' }}>
                                        {metrics?.traffic?.admissionRatePercent !== undefined ? `${metrics.traffic.admissionRatePercent}% Admitted` : "100% Admitted"}
                                    </strong>
                                </div>
                                <div className="sla-progress-track">
                                    <div
                                        className="sla-progress-fill"
                                        style={{ width: `${metrics?.traffic?.admissionRatePercent ?? 100}%` }}
                                    />
                                </div>
                                <div className="sla-counts-row">
                                    <span>Lifetime Processed: <strong>{metrics?.traffic?.totalRequests ?? 0}</strong></span>
                                    <span>Rejections: <strong>{metrics?.traffic?.rejectionsTotal ?? 0}</strong></span>
                                    <span>Active Gateways: <strong>{metrics?.traffic?.activeGateways ?? 1} Cluster</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Latency SLA & Linux Host Matrix Deck */}
                        <div className="telemetry-card">
                            <div className="card-header">
                                <div>
                                    <h3>Latency SLA & Host Matrix</h3>
                                    <span className="telemetry-subtext">Round-trip SLA response times & WSL Linux host vitals</span>
                                </div>
                                <span className={`telemetry-tag ${metrics?.linuxTelemetry?.status === "ONLINE" ? "tag-online" : "tag-offline"}`}>
                                    {metrics?.linuxTelemetry?.status === "ONLINE" ? "WSL SYNCED" : "WSL IDLE"}
                                </span>
                            </div>

                            <div className="telemetry-stats">
                                <div className="telemetry-box">
                                    <span className="telemetry-label">API Gateway SLA</span>
                                    <span className="telemetry-num cyan">{metrics?.services?.apiGateway?.avgLatency || "<1ms"}</span>
                                    <span className="telemetry-hint">P95: {metrics?.services?.apiGateway?.p95Latency || "<1ms"}</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">PostgreSQL 16 SLA</span>
                                    <span className="telemetry-num green">{metrics?.services?.database?.latency || "<1ms"}</span>
                                    <span className="telemetry-hint">Engine: {metrics?.services?.database?.pool || "Active"}</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Redis Cache Bus</span>
                                    <span className="telemetry-num purple">{metrics?.services?.redisCluster?.latency || "<1ms"}</span>
                                    <span className="telemetry-hint">Cluster Status: {metrics?.services?.redisCluster?.status || "ONLINE"}</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Piston Sandbox SLA</span>
                                    <span className="telemetry-num gold">{metrics?.services?.pistonSandbox?.latency || "<1ms"}</span>
                                    <span className="telemetry-hint">{metrics?.services?.pistonSandbox?.runtimesAvailable || 0} runtimes ready</span>
                                </div>
                            </div>

                            {/* Linux Host Vitals Widget */}
                            <div className="linux-vitals-widget">
                                <div className="vitals-header">
                                    <span className="vitals-title">WSL Host Vitals (localhost:8000)</span>
                                    <span className={`vitals-pill ${metrics?.linuxTelemetry?.status === "ONLINE" ? "online" : "offline"}`}>
                                        {metrics?.linuxTelemetry?.status === "ONLINE" ? "🟢 ONLINE" : "⚪ STANDBY"}
                                    </span>
                                </div>
                                {metrics?.linuxTelemetry?.vitals ? (
                                    <div className="vitals-grid">
                                        <div className="vital-item">
                                            <span className="vital-label">Host CPU</span>
                                            <strong className="vital-value">{metrics.linuxTelemetry.vitals.cpuUsagePercent}%</strong>
                                        </div>
                                        <div className="vital-item">
                                            <span className="vital-label">Host RAM</span>
                                            <strong className="vital-value">{metrics.linuxTelemetry.vitals.memoryUsagePercent}%</strong>
                                        </div>
                                        <div className="vital-item">
                                            <span className="vital-label">Load Avg</span>
                                            <strong className="vital-value">{metrics.linuxTelemetry.vitals.loadAvg?.slice(0, 2).join(", ") || "0.0"}</strong>
                                        </div>
                                        <div className="vital-item">
                                            <span className="vital-label">Cached Traces</span>
                                            <strong className="vital-value">{metrics.linuxTelemetry.vitals.cachedExecutionsCount || 0}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="vitals-standby-hint">
                                        <span>WSL Linux Telemetry service at <code>http://localhost:8000</code> is in standby mode. Start it to see host CPU/RAM vitals.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3. Elastic Sandbox Fleet & Workload Queue Lanes */}
                    <div className="admin-section" style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h3 className="section-title" style={{ margin: 0 }}>⚡ Elastic Sandbox Fleet & Workload Queue Lanes</h3>
                                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
                                    Asymmetric BullMQ dispatch (Light Concurrency 4 vs Heavy Concurrency 2) + Programmatic Dynamic Scaling
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="fleet-action-btn probe-btn"
                                    onClick={handleRunFleetProbe}
                                    disabled={isProbingFleet}
                                >
                                    🔍 {isProbingFleet ? "Probing Fleet..." : "Run Fleet Diagnostics"}
                                </button>
                                <button
                                    type="button"
                                    className="fleet-action-btn scale-out-btn"
                                    onClick={() => handleScaleFleet("out")}
                                    disabled={isScalingFleet}
                                >
                                    ➕ Scale Out
                                </button>
                                <button
                                    type="button"
                                    className="fleet-action-btn scale-in-btn"
                                    onClick={() => handleScaleFleet("in")}
                                    disabled={isScalingFleet}
                                >
                                    ➖ Scale In
                                </button>
                            </div>
                        </div>

                        {/* Asymmetric Queue Lanes Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {/* Light Lane */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(0, 0, 0, 0.4))', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        ⚡ LIGHT LANE
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                        Fast-Track Script Runner
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'Space Grotesk, sans-serif' }}>
                                            {metrics?.runtimePool?.queues?.lightLane?.depth ?? 0}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Jobs in Queue</div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#cbd5e1' }}>
                                        <div>Concurrency: <strong style={{ color: '#38bdf8' }}>4 Workers</strong></div>
                                        <div style={{ color: '#94a3b8' }}>Python / JS / TS (&lt;8KB)</div>
                                    </div>
                                </div>
                            </div>

                            {/* Heavy Lane */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(0, 0, 0, 0.4))', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '14px', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        🛡️ HEAVY LANE
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                        Isolated Compiler Sandbox
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'Space Grotesk, sans-serif' }}>
                                            {metrics?.runtimePool?.queues?.heavyLane?.depth ?? 0}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Jobs in Queue</div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#cbd5e1' }}>
                                        <div>Concurrency: <strong style={{ color: '#f59e0b' }}>2 Workers</strong></div>
                                        <div style={{ color: '#94a3b8' }}>C++ / Java / Heavy (&gt;8KB)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Real Piston Fleet or Baseline Sandbox Status */}
                        {metrics?.runtimePool?.activeInstances?.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                                {metrics.runtimePool.activeInstances.map((inst, i) => (
                                    <div key={inst.id || i} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                                                📦 {inst.id || `piston-${i + 1}`}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: inst.healthy ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: inst.healthy ? '#4ade80' : '#ef4444' }}>
                                                {inst.state || (inst.healthy ? "ONLINE" : "OFFLINE")}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span>Type:</span>
                                            <strong style={{ color: inst.type === "DYNAMIC_EPHEMERAL" ? '#f59e0b' : '#38bdf8' }}>
                                                {inst.type === "DYNAMIC_EPHEMERAL" ? "⚡ Dynamic Scaled" : "🔒 Prewarmed"}
                                            </strong>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span>Endpoint:</span>
                                            <code style={{ color: '#cbd5e1' }}>:{inst.port}</code>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Active Load:</span>
                                            <strong style={{ color: (inst.activeJobs || 0) > 2 ? '#f59e0b' : '#4ade80' }}>
                                                {inst.activeJobs || 0} job(s)
                                            </strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="standalone-sandbox-card glass-panel">
                                <div className="standalone-header">
                                    <div>
                                        <h4 style={{ margin: '0 0 4px', color: '#f8fafc', fontSize: '0.95rem' }}>
                                            🔒 Standalone Baseline Sandbox Active
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                                            Operating in zero-cost baseline mode. Dynamic ephemeral containers will spawn automatically under burst workload pressure.
                                        </p>
                                    </div>
                                    <span className="status-pill online">BASELINE READY</span>
                                </div>
                                <div className="standalone-meta-row">
                                    <span>Primary Endpoint: <code>{metrics?.runtimePool?.standaloneEndpoint || "http://127.0.0.1:2000"}</code></span>
                                    <span>Available Runtimes: <strong style={{ color: '#38bdf8' }}>{metrics?.runtimePool?.runtimesAvailable || 15} Language Engines</strong></span>
                                    <span>Scaling Status: <strong style={{ color: '#4ade80' }}>Autonomous Idle</strong></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. User Identity Breakdown */}
                    <div className="admin-section" style={{ marginTop: '24px' }}>
                        <div className="telemetry-card">
                            <div className="card-header">
                                <h3>Combatant Identity & Community Distribution</h3>
                                <span className="telemetry-tag">TOTAL: {metrics?.users?.total || 0} COMBATANTS</span>
                            </div>
                            <div className="user-ratio-grid">
                                <div className="ratio-box">
                                    <span className="role-icon">🎓</span>
                                    <span className="role-count">{metrics?.users?.students || 0}</span>
                                    <span className="role-label">College Students</span>
                                </div>
                                <div className="ratio-box">
                                    <span className="role-icon">🏛️</span>
                                    <span className="role-count">{metrics?.users?.faculty || 0}</span>
                                    <span className="role-label">Faculty / Instructors</span>
                                </div>
                                <div className="ratio-box">
                                    <span className="role-icon">💻</span>
                                    <span className="role-count">{metrics?.users?.independent || 0}</span>
                                    <span className="role-label">Independent Coders</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Student Sub-Batches & Institutions */}
                    <div className="admin-section" style={{ marginTop: '24px' }}>
                        <h3 className="section-title">Top Registered Institutions & Sub-Batches</h3>
                        <div className="institutions-grid">
                            {metrics?.subBatches?.length > 0 ? (
                                metrics.subBatches.map((inst, i) => (
                                    <div key={i} className="institution-card">
                                        <div className="inst-badge">BATCH SUB-GROUP #{i + 1}</div>
                                        <div className="inst-name">{inst.institution || "Independent Affiliation"}</div>
                                        <div className="inst-count">
                                            <span>{inst.count}</span> Active Enrolled Students
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-data-notice">No institution batches registered yet.</div>
                            )}
                        </div>
                    </div>

                    {/* 6. System Broadcast Dispatcher Suite */}
                    <div className="admin-section broadcast-dispatcher-section" style={{ marginTop: '24px' }}>
                        <div className="dispatcher-header">
                            <div>
                                <h3 className="section-title">Global System Broadcast Dispatcher</h3>
                                <p className="section-subtitle">
                                    Create, preview, and dispatch temporary time-bound announcements across all connected combatants with interactive CTAs, media attachments, and auto-expiry.
                                </p>
                            </div>
                            <div className="dispatcher-quick-presets">
                                <span className="preset-label">Quick Presets:</span>
                                <button type="button" className="preset-btn preset-alpha" onClick={() => handleApplyPreset("ALPHA")}>
                                    ⭐ Alpha Testing (10 Sep 2026)
                                </button>
                                <button type="button" className="preset-btn" onClick={() => handleApplyPreset("24H")}>
                                    +24 Hours
                                </button>
                                <button type="button" className="preset-btn" onClick={() => handleApplyPreset("7D")}>
                                    +7 Days
                                </button>
                            </div>
                        </div>

                        <form className="broadcast-composer-form" onSubmit={handleDispatchBroadcast}>
                            <div className="composer-card">
                                <div className="composer-card-header">
                                    <span className="card-step-badge">01</span>
                                    <h4>Announcement Message</h4>
                                </div>
                                <div className="composer-card-body">
                                    <div className="composer-row-2">
                                        <div className="form-group flex-2">
                                            <label>Broadcast Title *</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Hey Coders! 👋 / Alpha Testing Notice"
                                                value={broadcastForm.title}
                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group flex-1">
                                            <label>Category / Type *</label>
                                            <select
                                                value={broadcastForm.type}
                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                                            >
                                                <option value="INFO">INFO (General Announcement)</option>
                                                <option value="FEEDBACK">FEEDBACK (Alpha / Survey)</option>
                                                <option value="UPDATE">UPDATE (New Feature / Changelog)</option>
                                                <option value="WARNING">WARNING (Critical Notice)</option>
                                                <option value="MAINTENANCE">MAINTENANCE (Downtime)</option>
                                                <option value="EVENT">EVENT (Tournament / Contest)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Announcement Message *</label>
                                        <textarea
                                            rows={3}
                                            placeholder="Enter announcement message body displayed in user notifications and flash banner..."
                                            value={broadcastForm.message}
                                            onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="composer-card">
                                <div className="composer-card-header">
                                    <span className="card-step-badge">02</span>
                                    <h4>Schedule & Display Configuration</h4>
                                </div>
                                <div className="composer-card-body">
                                    <div className="composer-row-3">
                                        <div className="form-group">
                                            <label>Expiry Date *</label>
                                            <input
                                                type="date"
                                                value={broadcastForm.expiryDate}
                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, expiryDate: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Expiry Time *</label>
                                            <input
                                                type="time"
                                                value={broadcastForm.expiryTime}
                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, expiryTime: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group toggle-field-group">
                                            <label>Flash On-Screen</label>
                                            <label className="cyber-toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={broadcastForm.flashBanner}
                                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, flashBanner: e.target.checked })}
                                                />
                                                <span className="cyber-toggle-slider" />
                                                <span className="toggle-text">
                                                    {broadcastForm.flashBanner ? "⚡ Flash Banner Active" : "Inbox Only"}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`composer-card optional-card ${!includeMediaOrAction ? 'is-collapsed' : ''}`}>
                                <div className="composer-card-header has-toggle">
                                    <div className="card-header-main">
                                        <span className="card-step-badge">03</span>
                                        <h4>Interactive Action & Media Attachment <small>(Optional)</small></h4>
                                    </div>
                                    <label className="cyber-toggle-label mini-toggle">
                                        <input
                                            type="checkbox"
                                            checked={includeMediaOrAction}
                                            onChange={(e) => setIncludeMediaOrAction(e.target.checked)}
                                        />
                                        <span className="cyber-toggle-slider" />
                                        <span className="toggle-text">
                                            {includeMediaOrAction ? "Attach Media / Link: ON" : "Attach Media / Link: OFF"}
                                        </span>
                                    </label>
                                </div>

                                {includeMediaOrAction && (
                                    <div className="composer-card-body">
                                        <div className="composer-subgrid-2">
                                            <div className="sub-panel">
                                                <div className="sub-panel-title">Media Content</div>
                                                <div className="form-group">
                                                    <label>Content Type</label>
                                                    <select
                                                        value={broadcastForm.contentType}
                                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, contentType: e.target.value })}
                                                    >
                                                        <option value="NONE">None (No Media)</option>
                                                        <option value="IMAGE">Image (URL or Upload)</option>
                                                        <option value="VIDEO">Video (Direct Stream URL)</option>
                                                        <option value="DOCUMENT">Document (PDF / Doc Link)</option>
                                                    </select>
                                                </div>

                                                {broadcastForm.contentType !== "NONE" && (
                                                    <div className="form-group">
                                                        <label>Resource URL or File Upload</label>
                                                        <div className="media-input-row">
                                                            <input
                                                                type="text"
                                                                placeholder="https://example.com/asset.png or upload"
                                                                value={broadcastForm.contentUrl}
                                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, contentUrl: e.target.value })}
                                                            />
                                                            <label className="file-upload-btn">
                                                                <span>Upload</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*,video/mp4,application/pdf"
                                                                    style={{ display: "none" }}
                                                                    onChange={handleMediaFileUpload}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="sub-panel">
                                                <div className="sub-panel-title">Interactive Action (CTA)</div>
                                                <div className="form-group">
                                                    <label>Action Destination</label>
                                                    <select
                                                        value={broadcastForm.actionType}
                                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, actionType: e.target.value })}
                                                    >
                                                        <option value="NONE">None (No Button)</option>
                                                        <option value="EXTERNAL_LINK">External Link (Google Form, Website)</option>
                                                        <option value="INTERNAL_LINK">Internal Route (/battle, /practice)</option>
                                                    </select>
                                                </div>

                                                {broadcastForm.actionType !== "NONE" && (
                                                    <div className="composer-row-2">
                                                        <div className="form-group flex-1">
                                                            <label>Button Label *</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Share Your Feedback"
                                                                value={broadcastForm.actionLabel}
                                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, actionLabel: e.target.value })}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="form-group flex-2">
                                                            <label>Target URL / Route *</label>
                                                            <input
                                                                type="text"
                                                                placeholder="https://forms.gle/... or /battle"
                                                                value={broadcastForm.actionTarget}
                                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, actionTarget: e.target.value })}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Live Preview */}
                            {showPreview && (
                                <div className="broadcast-live-preview-box">
                                    <div className="preview-label">
                                        <span>LIVE BROADCAST PREVIEW</span>
                                    </div>
                                    <div className="preview-card-container">
                                        <SystemBroadcastCard
                                            isPreview={true}
                                            broadcast={{
                                                title: broadcastForm.title || "Preview Title",
                                                message: broadcastForm.message || "Preview Message",
                                                type: broadcastForm.type,
                                                createdAt: new Date().toISOString(),
                                                expiresAt: `${broadcastForm.expiryDate}T${broadcastForm.expiryTime}:00`,
                                                content: includeMediaOrAction && broadcastForm.contentType !== "NONE" && broadcastForm.contentUrl ? {
                                                    type: broadcastForm.contentType,
                                                    url: broadcastForm.contentUrl,
                                                    name: broadcastForm.contentName || "Attachment",
                                                } : null,
                                                action: includeMediaOrAction && broadcastForm.actionType !== "NONE" && broadcastForm.actionTarget ? {
                                                    type: broadcastForm.actionType,
                                                    label: broadcastForm.actionLabel || "Action",
                                                    target: broadcastForm.actionTarget,
                                                } : null,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="composer-action-bar">
                                <button
                                    type="button"
                                    className={`preview-toggle-btn ${showPreview ? "active" : ""}`}
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    {showPreview ? "👁️ Hide Preview" : "👁️ Show Live Preview"}
                                </button>
                                <button type="submit" className="broadcast-dispatch-btn" disabled={isDispatching}>
                                    {isDispatching ? "⚡ Broadcasting..." : "🚀 Dispatch Global Broadcast"}
                                </button>
                            </div>
                        </form>

                        {/* Broadcasts Registry Table */}
                        <div className="active-broadcasts-management" style={{ marginTop: '24px' }}>
                            <div className="active-broadcasts-header">
                                <h4>Active & Historical Broadcasts ({adminBroadcasts.length})</h4>
                                <button type="button" className="refresh-btn" onClick={fetchBroadcasts}>
                                    Refresh
                                </button>
                            </div>

                            {adminBroadcasts.length === 0 ? (
                                <div className="no-broadcasts-notice">No broadcasts dispatched yet.</div>
                            ) : (
                                <div className="broadcasts-table-wrapper">
                                    <table className="broadcasts-table">
                                        <thead>
                                            <tr>
                                                <th>Title & Type</th>
                                                <th>Message</th>
                                                <th>Content / Action</th>
                                                <th>Flash</th>
                                                <th>Expiry Date</th>
                                                <th>Remaining</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {adminBroadcasts.map((b) => (
                                                <tr key={b.id}>
                                                    <td>
                                                        <div className="b-title-cell">
                                                            <strong>{b.title}</strong>
                                                            <span className={`b-type-tag type-${(b.type || "INFO").toLowerCase()}`}>
                                                                {b.type}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="b-msg-cell">{b.message}</td>
                                                    <td>
                                                        <div className="b-meta-chips">
                                                            {b.content?.type && <span className="meta-chip chip-content">{b.content.type}</span>}
                                                            {b.action?.type && <span className="meta-chip chip-action">{b.action.type === "EXTERNAL_LINK" ? "EXT LINK" : "INT ROUTE"}</span>}
                                                            {!b.content?.type && !b.action?.type && <span className="meta-chip-none">—</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`flash-indicator ${b.flashBanner ? "flash-on" : "flash-off"}`}>
                                                            {b.flashBanner ? "ON" : "OFF"}
                                                        </span>
                                                    </td>
                                                    <td className="expiry-cell">
                                                        {new Date(b.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                    </td>
                                                    <td className="remaining-cell">{formatRemaining(b.expiresAt, b.status)}</td>
                                                    <td>
                                                        <span className={`status-pill pill-${b.status?.toLowerCase() || "active"}`}>
                                                            {b.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {b.status === "ACTIVE" && (
                                                            <button
                                                                type="button"
                                                                className="revoke-btn"
                                                                onClick={() => handleRevokeBroadcast(b.id)}
                                                            >
                                                                Revoke
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 7. Combatant Code & User Registry Search */}
                    <div className="admin-section" style={{ marginTop: '24px' }}>
                        <div className="registry-header">
                            <h3 className="section-title">Combatant Code & User Registry</h3>
                            <form className="registry-search" onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    placeholder="Search by Platform Code, Username, or Email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit">Search</button>
                            </form>
                        </div>

                        <div className="registry-table-wrapper">
                            <table className="registry-table">
                                <thead>
                                    <tr>
                                        <th>Platform Code</th>
                                        <th>Username</th>
                                        <th>Role</th>
                                        <th>Institution</th>
                                        <th>Primary Email</th>
                                        <th>Elo Rating</th>
                                        <th>Record (W/L)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td><span className="code-chip">{u.platformCode || `AF-USR-${u.id.slice(0, 5)}`}</span></td>
                                            <td className="user-cell"><strong>{u.username}</strong></td>
                                            <td>
                                                <span className={`role-badge ${u.userType?.toLowerCase() || "individual"}`}>
                                                    {u.userType || "INDIVIDUAL"}
                                                </span>
                                            </td>
                                            <td>{u.institutionName || "—"}</td>
                                            <td>{u.primaryEmail || u.email}</td>
                                            <td className="rating-cell">{u.rating}</td>
                                            <td>{u.wins}W - {u.losses}L</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Tab 2: Dedicated Live Audit Trail & Telemetry Logs */}
            {activeTab === "audit_trail" && (
                <div className="admin-audit-section">
                    <div className="audit-header-panel glass-panel">
                        <div className="audit-title-wrap">
                            <h3>🛡️ Platform Event Audit Trail & Telemetry Stream</h3>
                            <p>Real-time chronological telemetry logs across authentication, battles, submissions, and fleet orchestration.</p>
                        </div>
                        <div className="audit-controls-wrap">
                            <input
                                type="text"
                                className="audit-search-input"
                                placeholder="Search actions, actors, or details..."
                                value={auditSearch}
                                onChange={(e) => {
                                    setAuditSearch(e.target.value);
                                    fetchAuditLogs(auditCategory, auditSeverity, e.target.value);
                                }}
                            />
                            <button
                                type="button"
                                className="refresh-btn"
                                onClick={() => fetchAuditLogs()}
                                disabled={auditLoading}
                            >
                                {auditLoading ? "Refreshing..." : "Refresh Audit"}
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="audit-filters-bar">
                        <div className="filter-group">
                            <span className="filter-group-label">Category:</span>
                            {["ALL", "AUTH", "SECURITY", "SUBMISSION", "BATTLE", "ADMIN", "FLEET", "LINUX_TELEMETRY"].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`audit-filter-pill ${auditCategory === cat ? "active" : ""}`}
                                    onClick={() => {
                                        setAuditCategory(cat);
                                        fetchAuditLogs(cat, auditSeverity, auditSearch);
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="filter-group">
                            <span className="filter-group-label">Severity:</span>
                            {["ALL", "INFO", "WARN", "ERROR", "CRITICAL"].map((sev) => (
                                <button
                                    key={sev}
                                    type="button"
                                    className={`audit-filter-pill sev-${sev.toLowerCase()} ${auditSeverity === sev ? "active" : ""}`}
                                    onClick={() => {
                                        setAuditSeverity(sev);
                                        fetchAuditLogs(auditCategory, sev, auditSearch);
                                    }}
                                >
                                    {sev}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Audit Stream Table */}
                    <div className="audit-table-wrapper glass-panel">
                        {auditLogs.length === 0 ? (
                            <div className="no-audit-notice">
                                <span>No audit records found matching the current filters.</span>
                            </div>
                        ) : (
                            <table className="audit-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Category</th>
                                        <th>Severity</th>
                                        <th>Action</th>
                                        <th>Actor</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map((entry) => (
                                        <React.Fragment key={entry.id}>
                                            <tr
                                                className={`audit-row ${expandedAuditId === entry.id ? "is-expanded" : ""}`}
                                                onClick={() => setExpandedAuditId(expandedAuditId === entry.id ? null : entry.id)}
                                            >
                                                <td className="audit-time-cell">
                                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                                <td>
                                                    <span className={`cat-chip cat-${entry.category.toLowerCase()}`}>
                                                        {entry.category}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`sev-badge sev-${entry.severity.toLowerCase()}`}>
                                                        {entry.severity}
                                                    </span>
                                                </td>
                                                <td className="audit-action-cell">
                                                    <strong>{entry.action}</strong>
                                                </td>
                                                <td className="audit-actor-cell">{entry.actor}</td>
                                                <td className="audit-detail-cell">{entry.details}</td>
                                            </tr>
                                            {expandedAuditId === entry.id && entry.metadata && (
                                                <tr className="audit-meta-row">
                                                    <td colSpan={6}>
                                                        <div className="audit-meta-card">
                                                            <strong>Metadata Payload:</strong>
                                                            <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 3: Dedicated Linux Telemetry Live Console Embed */}
            {activeTab === "linux_telemetry" && (
                <div className="admin-linux-telemetry-wrapper">
                    <div className="linux-toolbar glass-panel">
                        <div className="toolbar-info">
                            <h4>Linux Host Telemetry & Stress Server</h4>
                            <span className="target-pill">Target: http://localhost:8000/dashboard</span>
                        </div>
                        <div className="toolbar-actions">
                            <button type="button" className="retry-probe-btn" onClick={checkLinuxStatus}>
                                🔄 Check Connectivity
                            </button>
                            <a
                                href={linuxTelemetryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="external-window-btn"
                            >
                                Open in New Window ↗
                            </a>
                        </div>
                    </div>

                    {linuxStatus === "ONLINE" ? (
                        <div className="linux-iframe-container">
                            <iframe
                                src={linuxTelemetryUrl}
                                title="AlgoFight Linux Host Telemetry Dashboard"
                                className="linux-telemetry-iframe"
                            />
                        </div>
                    ) : (
                        <div className="linux-offline-guide-card glass-panel">
                            <div className="guide-icon">🖥️</div>
                            <h3>WSL Linux Telemetry Service is Offline</h3>
                            <p>
                                The dedicated FastAPI Telemetry and Evaluation Service (<code>AlgoFight_Linux</code>) is not running on <code>http://localhost:8000</code>.
                            </p>

                            <div className="guide-command-box">
                                <span className="command-label">To launch inside WSL Ubuntu terminal, run:</span>
                                <pre><code>wsl -d Ubuntu -e bash -c "cd /home/arin/AlgoFight_Linux && python3 run_server.py"</code></pre>
                            </div>

                            <p className="guide-path-hint">
                                Directory location: <code>\\wsl.localhost\Ubuntu\home\arin\AlgoFight_Linux</code>
                            </p>

                            <button type="button" className="retry-btn-large" onClick={checkLinuxStatus}>
                                🔄 Reconnect to Service
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Fleet Diagnostics Modal */}
            <AnimatePresence>
                {isProbeModalOpen && probeResults && (
                    <motion.div
                        className="fleet-modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsProbeModalOpen(false)}
                    >
                        <motion.div
                            className="fleet-modal-content glass-panel"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h4>🔍 Fleet Diagnostics Probe Results</h4>
                                <button type="button" className="modal-close-btn" onClick={() => setIsProbeModalOpen(false)}>
                                    ✕
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="probe-summary-row">
                                    <span>Total Probed: <strong>{probeResults.totalActiveRuntimes}</strong></span>
                                    <span>Timestamp: <strong>{new Date(probeResults.probedAt).toLocaleTimeString()}</strong></span>
                                </div>
                                <div className="probe-results-list">
                                    {probeResults.results?.map((res) => (
                                        <div key={res.id} className={`probe-result-card ${res.status.toLowerCase()}`}>
                                            <div className="probe-card-head">
                                                <strong>📦 {res.id} ({res.url})</strong>
                                                <span className={`status-pill ${res.status.toLowerCase()}`}>{res.status} ({res.latencyMs}ms)</span>
                                            </div>
                                            {res.output && (
                                                <div className="probe-stdout-box">
                                                    <span className="box-label">Output (Stdout):</span>
                                                    <pre>{res.output}</pre>
                                                </div>
                                            )}
                                            {res.error && (
                                                <div className="probe-stderr-box">
                                                    <span className="box-label">Error:</span>
                                                    <pre>{res.error}</pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
