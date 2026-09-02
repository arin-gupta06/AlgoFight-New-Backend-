import React, { useState, useEffect, useCallback } from "react";
import "./ControlHub.css";
import { motion } from "framer-motion";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import {
    toApiUrl,
    fetchAdminBroadcasts,
    dispatchAdminBroadcast,
    deleteAdminBroadcast,
    uploadBroadcastMedia,
} from "../../services/api.js";
import SystemBroadcastCard from "../Common/SystemBroadcastCard.jsx";

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
    port: "Port",
    protocol: "Protocol",
    engine: "Engine",
    pool: "Pool Status",
    host: "Host",
    endpoint: "Endpoint",
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
        actionType: "EXTERNAL_LINK",
        actionLabel: "Share Your Feedback",
        actionTarget: "https://docs.google.com/forms/d/e/1FAIpQLSe-example/viewform",
    });


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

    const fetchTelemetry = async () => {
        if (!adminKey) return;
        try {
            const res = await fetch(toApiUrl("/api/admin/metrics"), {
                headers: { "x-admin-key": adminKey },
            });
            if (res.ok) {
                const data = await res.json();
                setMetrics(data);
            }
        } catch (err) {
            console.error("Telemetry fetch failed", err);
        }
    };

    const fetchUsers = async (query = "") => {
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
    };

    const fetchBroadcasts = useCallback(async () => {
        if (!adminKey) return;
        try {
            const data = await fetchAdminBroadcasts(adminKey);
            setAdminBroadcasts(data?.broadcasts || []);
        } catch (err) {
            console.error("Broadcasts fetch failed", err);
        }
    }, [adminKey]);

    useEffect(() => {
        if (isUnlocked && adminKey) {
            fetchTelemetry();
            fetchUsers();
            fetchBroadcasts();
            const timer = setInterval(() => {
                fetchTelemetry();
                fetchBroadcasts();
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [isUnlocked, adminKey, fetchBroadcasts]);

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
                actionType: "EXTERNAL_LINK",
                actionLabel: "Share Your Feedback",
                actionTarget: "https://docs.google.com/forms/d/e/1FAIpQLSe-example/viewform",
            });
            notify({ type: "info", title: "PRESET LOADED", message: "Alpha Testing 10 Sep 2026 configuration loaded." });
        } else if (preset === "24H") {
            const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
            setBroadcastForm((prev) => ({
                ...prev,
                expiryDate: d.toISOString().split("T")[0],
                expiryTime: d.toTimeString().slice(0, 5),
            }));
        } else if (preset === "7D") {
            const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            setBroadcastForm((prev) => ({
                ...prev,
                expiryDate: d.toISOString().split("T")[0],
                expiryTime: d.toTimeString().slice(0, 5),
            }));
        }
    };

    const handleMediaFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = "";

        if (file.size > 15 * 1024 * 1024) {
            notify({ type: "error", title: "FILE TOO LARGE", message: "Media attachments must be under 15MB." });
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result;
            try {
                const res = await uploadBroadcastMedia(adminKey, {
                    name: file.name,
                    type: broadcastForm.contentType,
                    mimeType: file.type,
                    size: file.size,
                    base64,
                });
                if (res?.media?.url) {
                    setBroadcastForm((prev) => ({
                        ...prev,
                        contentUrl: res.media.url,
                        contentName: file.name,
                    }));
                    notify({ type: "success", title: "MEDIA ATTACHED", message: `Attached: ${file.name}` });
                }
            } catch (err) {
                notify({ type: "error", title: "UPLOAD FAILED", message: err.message || "Failed to upload media." });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDispatchBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
            notify({ type: "error", title: "MISSING FIELDS", message: "Title and message are required." });
            return;
        }

        const expiryIso = `${broadcastForm.expiryDate}T${broadcastForm.expiryTime}:00`;
        const expiryTime = new Date(expiryIso).getTime();

        if (isNaN(expiryTime) || expiryTime <= Date.now()) {
            notify({ type: "error", title: "INVALID EXPIRY", message: "Expiry date/time must be in the future." });
            return;
        }

        const payload = {
            title: broadcastForm.title.trim(),
            message: broadcastForm.message.trim(),
            type: broadcastForm.type,
            expiresAt: expiryIso,
            flashBanner: broadcastForm.flashBanner,
            content: includeMediaOrAction && broadcastForm.contentType !== "NONE" && broadcastForm.contentUrl ? {
                type: broadcastForm.contentType,
                url: broadcastForm.contentUrl.trim(),
                name: broadcastForm.contentName || "Attachment",
            } : null,
            action: includeMediaOrAction && broadcastForm.actionType !== "NONE" && broadcastForm.actionTarget ? {
                type: broadcastForm.actionType,
                label: broadcastForm.actionLabel.trim() || "View Details",
                target: broadcastForm.actionTarget.trim(),
            } : null,
        };

        setIsDispatching(true);
        try {
            const res = await dispatchAdminBroadcast(adminKey, payload);
            if (res.success && res.broadcast) {
                notify({
                    type: "success",
                    title: "BROADCAST DISPATCHED",
                    message: `Dispatched to all connected combatants. Expires on ${broadcastForm.expiryDate}.`,
                });
                fetchBroadcasts();
                setShowPreview(false);
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



    const [activeTab, setActiveTab] = useState("overview"); // "overview" | "linux_telemetry"
    const [linuxStatus, setLinuxStatus] = useState("CHECKING");
    const rawTelemetryUrl = import.meta.env.VITE_LINUX_TELEMETRY_URL || "http://localhost:8000";
    const linuxBaseUrl = rawTelemetryUrl.replace(/\/dashboard\/?$/, "").replace(/\/$/, "");
    const linuxTelemetryUrl = `${linuxBaseUrl}/dashboard`;

    useEffect(() => {
        if (!isUnlocked) return;

        // Quick health probe to check Linux Telemetry service status
        const checkLinux = async () => {
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
        };
        checkLinux();
        const interval = setInterval(checkLinux, 15000);
        return () => clearInterval(interval);
    }, [isUnlocked, linuxBaseUrl]);

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
                    <p className="admin-subtext">Real-time infrastructure monitoring, fan-in/fan-out telemetry, and college sub-batches</p>
                </div>
                <div className="admin-header-actions">
                    <div className="admin-header-status">
                        <div className="pulse-indicator online"></div>
                        <span>Fleet Status: Optimal</span>
                    </div>
                    <button className="lock-hub-btn" onClick={handleLock}>
                        🔒 Lock Terminal
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
                    className={`admin-tab-btn ${activeTab === "linux_telemetry" ? "active" : ""}`}
                    onClick={() => setActiveTab("linux_telemetry")}
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

                    {/* 2. Traffic & Fan-In / Fan-Out Telemetry */}
                    <div className="admin-metrics-row">
                        <div className="telemetry-card">
                            <div className="card-header">
                                <h3>Ingress & Egress Telemetry</h3>
                                <span className="telemetry-tag">HIGH FREQUENCY</span>
                            </div>
                            <div className="telemetry-stats">
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Ingress Rate (Fan-In)</span>
                                    <span className="telemetry-num cyan">{metrics?.traffic?.fanInRate || "142 req/s"}</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Broadcast Rate (Fan-Out)</span>
                                    <span className="telemetry-num purple">{metrics?.traffic?.fanOutRate || "480 events/s"}</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Active Gateways</span>
                                    <span className="telemetry-num green">{metrics?.traffic?.activeGateways || 1} Node</span>
                                </div>
                                <div className="telemetry-box">
                                    <span className="telemetry-label">Bandwidth Load</span>
                                    <span className="telemetry-num gold">{metrics?.traffic?.peakBandwidth || "18.4 MB/s"}</span>
                                </div>
                            </div>
                        </div>

                        {/* User Identity Breakdown */}
                        <div className="telemetry-card">
                            <div className="card-header">
                                <h3>User Identity Distribution</h3>
                                <span className="telemetry-tag">TOTAL: {metrics?.users?.total || 0}</span>
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

                    {/* 3. Student Sub-Batches & Institutions */}
                    <div className="admin-section">
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

                    {/* 4. Global System Broadcast Dispatcher & Management Suite */}
                    <div className="admin-section broadcast-dispatcher-section">
                        <div className="dispatcher-header">
                            <div>
                                <h3 className="section-title">Global System Broadcast Dispatcher</h3>
                                <p className="section-subtitle">
                                    Create, preview, and dispatch temporary time-bound announcements across all connected combatants with interactive CTAs, media attachments, and auto-expiry.
                                </p>
                            </div>
                            <div className="dispatcher-quick-presets">
                                <span className="preset-label">Quick Presets:</span>
                                <button
                                    type="button"
                                    className="preset-btn preset-alpha"
                                    onClick={() => handleApplyPreset("ALPHA")}
                                >
                                    ⭐ Alpha Testing (10 Sep 2026)
                                </button>
                                <button
                                    type="button"
                                    className="preset-btn"
                                    onClick={() => handleApplyPreset("24H")}
                                >
                                    +24 Hours
                                </button>
                                <button
                                    type="button"
                                    className="preset-btn"
                                    onClick={() => handleApplyPreset("7D")}
                                >
                                    +7 Days
                                </button>
                            </div>
                        </div>

                        {/* Broadcast Dispatcher Form */}
                        <form className="broadcast-composer-form" onSubmit={handleDispatchBroadcast}>
                            {/* Group 1: Core Announcement */}
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

                            {/* Group 2: Schedule, Expiry & Display Targets */}
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

                            {/* Group 3: Optional Media & Interactive Action */}
                            <div className={`composer-card optional-card ${!includeMediaOrAction ? 'is-collapsed' : ''}`}>
                                <div className="composer-card-header has-toggle">
                                    <div className="card-header-main">
                                        <span className="card-step-badge">03</span>
                                        <h4>Interactive Action & Media Attachment <small>(Optional)</small></h4>
                                    </div>

                                    {/* Master Enable/Disable Toggle */}
                                    <label className="cyber-toggle-label mini-toggle" title="Toggle to attach media resources or actionable links">
                                        <input
                                            type="checkbox"
                                            checked={includeMediaOrAction}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setIncludeMediaOrAction(enabled);
                                                if (!enabled) {
                                                    setBroadcastForm(prev => ({
                                                        ...prev,
                                                        contentType: "NONE",
                                                        contentUrl: "",
                                                        contentName: "",
                                                        actionType: "NONE",
                                                        actionLabel: "",
                                                        actionTarget: "",
                                                    }));
                                                } else if (broadcastForm.actionType === "NONE" && broadcastForm.contentType === "NONE") {
                                                    setBroadcastForm(prev => ({
                                                        ...prev,
                                                        actionType: "EXTERNAL_LINK",
                                                        actionLabel: "Share Your Feedback",
                                                        actionTarget: "",
                                                    }));
                                                }
                                            }}
                                        />
                                        <span className="cyber-toggle-slider" />
                                        <span className="toggle-text">
                                            {includeMediaOrAction ? "Attach Media / Link: ON" : "Attach Media / Link: OFF"}
                                        </span>
                                    </label>
                                </div>

                                {includeMediaOrAction ? (
                                    <div className="composer-card-body">
                                        <div className="composer-subgrid-2">
                                            {/* Content Sub-Panel */}
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
                                                        <label>
                                                            {broadcastForm.contentType === "IMAGE" && "Image (URL or Upload)"}
                                                            {broadcastForm.contentType === "VIDEO" && "Video (Direct .mp4, YouTube, Vimeo, or Upload)"}
                                                            {broadcastForm.contentType === "DOCUMENT" && "Document (PDF, Link, or File Upload)"}
                                                        </label>
                                                        <div className="media-input-row">
                                                            <input
                                                                type="text"
                                                                placeholder={
                                                                    broadcastForm.contentType === "IMAGE"
                                                                        ? "https://example.com/asset.png or upload image"
                                                                        : broadcastForm.contentType === "VIDEO"
                                                                            ? "Direct .mp4/.webm URL, YouTube / Vimeo link, or upload video"
                                                                            : "https://example.com/document.pdf, Doc link, or upload document"
                                                                }
                                                                value={broadcastForm.contentUrl}
                                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, contentUrl: e.target.value })}
                                                            />
                                                            <label className="file-upload-btn" title={`Upload ${broadcastForm.contentType} File`}>
                                                                <span>Upload</span>
                                                                <input
                                                                    type="file"
                                                                    accept={
                                                                        broadcastForm.contentType === "IMAGE"
                                                                            ? "image/*"
                                                                            : broadcastForm.contentType === "VIDEO"
                                                                                ? "video/mp4,video/webm,video/ogg"
                                                                                : "application/pdf,.doc,.docx,.txt"
                                                                    }
                                                                    style={{ display: "none" }}
                                                                    onChange={handleMediaFileUpload}
                                                                />
                                                            </label>
                                                        </div>
                                                        {broadcastForm.contentUrl && (
                                                            <div className="media-attached-pill">
                                                                <span>📎 {broadcastForm.contentName || (broadcastForm.contentUrl.startsWith("data:") ? "Uploaded File" : "Resource Attached")}</span>
                                                                <button
                                                                    type="button"
                                                                    className="media-clear-btn"
                                                                    title="Clear attachment"
                                                                    onClick={() => setBroadcastForm((prev) => ({ ...prev, contentUrl: "", contentName: "" }))}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Sub-Panel */}
                                            <div className="sub-panel">
                                                <div className="sub-panel-title">Interactive Action (CTA)</div>
                                                <div className="form-group">
                                                    <label>Action Destination</label>
                                                    <select
                                                        value={broadcastForm.actionType}
                                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, actionType: e.target.value })}
                                                    >
                                                        <option value="NONE">None (No Button)</option>
                                                        <option value="EXTERNAL_LINK">External Link (Google Form, Survey, Website)</option>
                                                        <option value="INTERNAL_LINK">Internal Route (e.g. /battle, /practice)</option>
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
                                                            <label>{broadcastForm.actionType === "EXTERNAL_LINK" ? "Target URL *" : "Internal Route *"}</label>
                                                            <input
                                                                type="text"
                                                                placeholder={broadcastForm.actionType === "EXTERNAL_LINK" ? "https://forms.gle/..." : "/battle"}
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
                                ) : (
                                    <div className="composer-card-collapsed-hint">
                                        <span className="hint-icon">💬</span>
                                        <span>Text-only broadcast. Switch the toggle above <strong>ON</strong> to attach images, videos, documents, or actionable CTA links.</span>
                                    </div>
                                )}
                            </div>

                            {/* Live Preview Box */}
                            {showPreview && (
                                <div className="broadcast-live-preview-box">
                                    <div className="preview-label">
                                        <span>LIVE BROADCAST PREVIEW</span>
                                        <small>(Simulated User Inbox & Flash Banner Rendering)</small>
                                    </div>
                                    <div className="preview-card-container">
                                        <SystemBroadcastCard
                                            isPreview={true}
                                            broadcast={{
                                                title: broadcastForm.title || "Preview Announcement Title",
                                                message: broadcastForm.message || "Your announcement message body will appear here.",
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

                            {/* Action Buttons */}
                            <div className="composer-action-bar">
                                <button
                                    type="button"
                                    className={`preview-toggle-btn ${showPreview ? "active" : ""}`}
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    {showPreview ? "👁️ Hide Preview" : "👁️ Show Live Preview"}
                                </button>
                                <button
                                    type="submit"
                                    className="broadcast-dispatch-btn"
                                    disabled={isDispatching}
                                >
                                    {isDispatching ? "⚡ Broadcasting..." : "🚀 Dispatch Global Broadcast"}
                                </button>
                            </div>
                        </form>

                        {/* Active Broadcasts Registry Table */}
                        <div className="active-broadcasts-management">
                            <div className="active-broadcasts-header">
                                <h4>Active & Historical Broadcasts ({adminBroadcasts.length})</h4>
                                <button
                                    type="button"
                                    className="refresh-btn"
                                    onClick={fetchBroadcasts}
                                >
                                    Refresh
                                </button>
                            </div>

                            {adminBroadcasts.length === 0 ? (
                                <div className="no-broadcasts-notice">
                                    No broadcasts dispatched yet. Create one above to broadcast across the arena.
                                </div>
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
                                                        {new Date(b.expiresAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>
                                                    <td className="remaining-cell">
                                                        {formatRemaining(b.expiresAt, b.status)}
                                                    </td>
                                                    <td>
                                                        <span className={`status-pill pill-${b.status?.toLowerCase() || "active"}`}>
                                                            {b.status === "ACTIVE" ? "🟢 ACTIVE" : b.status === "EXPIRED" ? "🔴 EXPIRED" : "⚪ REVOKED"}
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

                    {/* 5. User & Institutional Code Registry Search */}
                    <div className="admin-section">
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

            {/* Tab 2: Dedicated Linux Telemetry Live Console Embed */}
            {activeTab === "linux_telemetry" && (
                <div className="admin-linux-telemetry-wrapper">
                    <div className="linux-toolbar glass-panel">
                        <div className="toolbar-info">
                            <h4>Linux Host Telemetry & Stress Server</h4>
                            <span className="target-pill">Target: http://localhost:8000/dashboard</span>
                        </div>
                        <div className="toolbar-actions">
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

                    <div className="linux-iframe-container">
                        <iframe
                            src={linuxTelemetryUrl}
                            title="AlgoFight Linux Host Telemetry Dashboard"
                            className="linux-telemetry-iframe"
                        />
                    </div>
                </div>
            )}
        </motion.div>
    );
}
