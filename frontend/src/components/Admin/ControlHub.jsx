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
    fetchAdminAnalytics,
    probeAdminFleet,
    scaleAdminFleet,
} from "../../services/api.js";
import SystemBroadcastCard from "../Common/broadcasts/SystemBroadcastCard.jsx";
import { generatePdfThumbnail } from "../../utils/pdfThumbnail.js";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faServer,
    faCubes,
    faUsers,
    faBullhorn,
    faChartColumn,
    faShieldHalved,
    faDesktop,
    faRotate,
    faLock,
    faUnlock,
    faMagnifyingGlass,
    faPlus,
    faMinus,
    faEye,
    faEyeSlash,
    faPaperPlane,
    faBan,
    faClock,
    faMicrochip,
    faGlobe,
    faGraduationCap,
    faBuildingColumns,
    faLaptop,
    faCheck,
    faCopy,
    faTerminal,
    faFire,
    faBolt,
    faArrowUpRightFromSquare,
    faTrophy,
    faChartLine,
    faUser,
    faCircleCheck,
    faCircleXmark,
    faCircleInfo,
    faFileCode,
    faLayerGroup,
    faStar,
    faBox,
} from "@fortawesome/free-solid-svg-icons";

const SERVICE_NAMES = {
    apiGateway: "API Gateway",
    websocketGateway: "WebSocket Gateway",
    database: "PostgreSQL Database",
    redisCluster: "Redis Cluster",
    pistonSandbox: "Piston Sandbox",
};

const SIDEBAR_ITEMS = [
    {
        id: "overview",
        icon: faServer,
        title: "Platform Fleet",
        desc: "Services & Gateway SLAs",
    },
    {
        id: "sandbox",
        icon: faCubes,
        title: "Elastic Sandbox",
        desc: "BullMQ Lanes & Scaling",
    },
    {
        id: "users",
        icon: faUsers,
        title: "Users & Batches",
        desc: "Institutions & Registry",
    },
    {
        id: "broadcasts",
        icon: faBullhorn,
        title: "System Broadcasts",
        desc: "Global Announcer & CTAs",
    },
    {
        id: "analytics",
        icon: faChartColumn,
        title: "Data Analytics",
        desc: "Heatmaps & Origin IPs",
    },
    {
        id: "audit_trail",
        icon: faShieldHalved,
        title: "Audit Stream",
        desc: "Live Event Telemetry Logs",
    },
    {
        id: "linux_telemetry",
        icon: faDesktop,
        title: "Linux Host Live",
        desc: "WSL FastAPI Vitals",
    },
];

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
    const [refreshInterval, setRefreshInterval] = useState(30); // 30s default (reduces network spam)
    const [isSyncing, setIsSyncing] = useState(false);
    const [secondsSinceSync, setSecondsSinceSync] = useState(0);

    // Active Navigation Tabs (Sidebar Page Views)
    const [activeTab, setActiveTab] = useState("overview"); // "overview" | "sandbox" | "users" | "broadcasts" | "analytics" | "audit_trail" | "linux_telemetry"
    const [linuxStatus, setLinuxStatus] = useState("CHECKING");

    const handleTabSwitch = (tabId) => {
        setActiveTab(tabId);
        if (tabId === "analytics") fetchAnalytics();
        if (tabId === "audit_trail") fetchAuditLogs();
        if (tabId === "linux_telemetry") checkLinuxStatus();
        if (tabId === "users") fetchUsers(search);
        if (tabId === "broadcasts") fetchBroadcasts();
    };

    // 📊 Data & Surfing Analytics State
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
    const [copiedIp, setCopiedIp] = useState(null);

    // Audit Trail State
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditCategory, setAuditCategory] = useState("ALL");
    const [auditSeverity, setAuditSeverity] = useState("ALL");
    const [auditMethod, setAuditMethod] = useState("ALL");
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

    // 📊 Data Analytics Fetch
    const fetchAnalytics = useCallback(async () => {
        if (!adminKey) return;
        setIsAnalyticsLoading(true);
        try {
            const data = await fetchAdminAnalytics(adminKey);
            if (data) {
                setAnalyticsData(data);
            }
        } catch (err) {
            console.error("Analytics fetch failed", err);
        } finally {
            setIsAnalyticsLoading(false);
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

    // Ref tracking latest audit filter values to make fetchAuditLogs completely stable
    const auditFilterRef = useRef({
        category: auditCategory,
        severity: auditSeverity,
        method: auditMethod,
        search: auditSearch,
    });
    useEffect(() => {
        auditFilterRef.current = {
            category: auditCategory,
            severity: auditSeverity,
            method: auditMethod,
            search: auditSearch,
        };
    }, [auditCategory, auditSeverity, auditMethod, auditSearch]);

    // 🛡️ Audit Logs Fetch with IP and Method Filtering
    const fetchAuditLogs = useCallback(async (cat, sev, meth, q) => {
        if (!adminKey) return;
        const currentCat = cat !== undefined ? cat : auditFilterRef.current.category;
        const currentSev = sev !== undefined ? sev : auditFilterRef.current.severity;
        const currentMeth = meth !== undefined ? meth : auditFilterRef.current.method;
        const currentQ = q !== undefined ? q : auditFilterRef.current.search;

        setAuditLoading(true);
        try {
            const data = await fetchAdminAuditLogs(adminKey, {
                category: currentCat,
                severity: currentSev,
                method: currentMeth,
                search: currentQ,
                limit: 60,
            });
            setAuditLogs(data?.logs || []);
            setAuditTotal(data?.total || 0);
        } catch (err) {
            console.error("Audit logs fetch failed", err);
        } finally {
            setAuditLoading(false);
        }
    }, [adminKey]);

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
            fetchAnalytics(),
            fetchBroadcasts(),
            fetchAuditLogs(),
            checkLinuxStatus(),
        ]);
        setTimeout(() => setIsSyncing(false), 500);
        notify({ type: "info", title: "METRICS SYNCHRONIZED", message: "Live telemetry, analytics & audit records updated." });
    };

    // 📋 IP Clipboard & Filter Helpers
    const handleCopyIp = (ipToCopy, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard?.writeText(ipToCopy);
        setCopiedIp(ipToCopy);
        notify({ type: "info", title: "IP COPIED", message: `Copied ${ipToCopy} to clipboard.` });
        setTimeout(() => setCopiedIp(null), 2000);
    };

    const handleFilterByIp = (filterIp, e) => {
        if (e) e.stopPropagation();
        setAuditSearch(filterIp);
        setActiveTab("audit_trail");
        fetchAuditLogs(auditCategory, auditSeverity, auditMethod, filterIp);
        notify({ type: "info", title: "FILTERING LOGS", message: `Inspecting origin events for IP ${filterIp}` });
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
    // Run unified initial load only once on terminal unlock
    useEffect(() => {
        if (!isUnlocked || !adminKey) return;

        fetchTelemetry();
        fetchAnalytics();
        fetchUsers();
        fetchBroadcasts();
        fetchAuditLogs();
        checkLinuxStatus();

        // Seconds counter (only increments when page is actively focused/visible)
        const secTimer = setInterval(() => {
            if (typeof document !== "undefined" && !document.hidden) {
                setSecondsSinceSync((prev) => prev + 1);
            }
        }, 1000);

        return () => clearInterval(secTimer);
    }, [isUnlocked, adminKey, fetchTelemetry, fetchAnalytics, fetchUsers, fetchBroadcasts, fetchAuditLogs, checkLinuxStatus]);

    // Keep track of activeTab via ref so changing tabs does not reset interval timer or trigger extra requests
    const activeTabRef = useRef(activeTab);
    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    useEffect(() => {
        if (!isUnlocked || !adminKey || refreshInterval <= 0) return;

        const syncTimer = setInterval(() => {
            // Skip background polling if tab is inactive or hidden
            if (typeof document !== "undefined" && document.hidden) return;

            fetchTelemetry();
            if (activeTabRef.current === "analytics") fetchAnalytics();
            if (activeTabRef.current === "audit_trail") fetchAuditLogs();
            checkLinuxStatus();
        }, refreshInterval * 1000);

        return () => clearInterval(syncTimer);
    }, [isUnlocked, adminKey, refreshInterval, fetchTelemetry, fetchAnalytics, fetchAuditLogs, checkLinuxStatus]);

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
            <BackgroundPaths>
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
                <Footer />
            </BackgroundPaths>
        );
    }

    // 🎛️ Render Full SuperAdmin Control Hub once unlocked
    return (
        <BackgroundPaths>
            <div className="admin-layout-container">
                {/* Left Sidebar Navigation */}
                <aside className="admin-sidebar glass-panel">
                    <div className="sidebar-top-brand">
                        <div className="admin-badge">
                            <span className="shield-icon"><FontAwesomeIcon icon={faShieldHalved} /></span>
                            <span className="badge-text">SUPERADMIN CONSOLE</span>
                        </div>
                        <h2 className="sidebar-title">Control Hub</h2>
                        <div className="sidebar-clearance">
                            <span className="clearance-dot" />
                            <span>LEVEL 5 CLEARANCE</span>
                        </div>
                    </div>

                    {/* Sidebar Navigation Items */}
                    <nav className="sidebar-nav">
                        {SIDEBAR_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`sidebar-nav-btn ${activeTab === item.id ? "active" : ""}`}
                                onClick={() => handleTabSwitch(item.id)}
                            >
                                <span className="nav-icon-wrap">
                                    <FontAwesomeIcon icon={item.icon} className="nav-icon" />
                                </span>
                                <div className="nav-text-group">
                                    <span className="nav-title">{item.title}</span>
                                    <span className="nav-desc">{item.desc}</span>
                                </div>
                                {item.id === "linux_telemetry" && (
                                    <span className={`sidebar-status-pill ${linuxStatus.toLowerCase()}`}>
                                        {linuxStatus === "ONLINE" ? "LIVE" : "OFF"}
                                    </span>
                                )}
                                {item.id === "audit_trail" && (
                                    <span className="sidebar-count-pill">{auditTotal || auditLogs.length}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Sidebar Footer Controls */}
                    <div className="sidebar-footer">
                        <div className="sync-widget">
                            <div className="sync-widget-head">
                                <div className="pulse-indicator online" />
                                <span className="sync-widget-status">FLEET OPTIMAL</span>
                            </div>
                            <span className="sync-widget-time">Updated: {secondsSinceSync}s ago</span>

                            <div className="sidebar-sync-row">
                                <select
                                    value={refreshInterval}
                                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                    className="sidebar-sync-select"
                                >
                                    <option value={10}>10s Sync</option>
                                    <option value={30}>30s Sync</option>
                                    <option value={60}>60s Sync</option>
                                    <option value={0}>Manual</option>
                                </select>
                                <button
                                    type="button"
                                    className={`sidebar-sync-btn ${isSyncing ? "is-spinning" : ""}`}
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    title="Force immediate telemetry & audit sync"
                                >
                                    <FontAwesomeIcon icon={faRotate} className={isSyncing ? "fa-spin" : ""} /> Sync
                                </button>
                            </div>
                        </div>

                        <button type="button" className="sidebar-lock-btn" onClick={handleLock}>
                            <FontAwesomeIcon icon={faLock} /> Lock Terminal
                        </button>
                    </div>
                </aside>

                {/* Main Dashboard Content Area */}
                <main className="admin-main-content">
                    {/* View Header */}
                    <div className="main-view-header glass-panel">
                        <div>
                            <div className="view-preheading">ADMINISTRATION CONSOLE</div>
                            <h1 className="view-title">
                                {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.icon && (
                                    <FontAwesomeIcon
                                        icon={SIDEBAR_ITEMS.find((i) => i.id === activeTab).icon}
                                        className="view-title-icon"
                                    />
                                )}{" "}
                                {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.title}
                            </h1>
                            <p className="view-subtitle">{SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.desc}</p>
                        </div>
                        <div className="view-actions">
                            <span className="live-status-chip">
                                <span className="pulse-indicator online" /> TELEMETRY SYNCHRONIZED ({secondsSinceSync}s)
                            </span>
                        </div>
                    </div>

                    {/* Page Content Rendered per Active Sidebar Tab */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="active-page-view"
                        >
                            {/* Page 1: Infrastructure Fleet & Services */}
                            {activeTab === "overview" && (
                                <div className="page-view-stack">
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
                                        {metrics?.linuxTelemetry?.status === "ONLINE" ? (
                                            <><FontAwesomeIcon icon={faCircleCheck} /> ONLINE</>
                                        ) : (
                                            <><FontAwesomeIcon icon={faClock} /> STANDBY</>
                                        )}
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
                </div>
            )}

            {/* Page 2: Elastic Sandbox Fleet & Workload Queue Lanes */}
            {activeTab === "sandbox" && (
                <div className="page-view-stack">
                    <div className="admin-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h3 className="section-title" style={{ margin: 0 }}>
                                    <FontAwesomeIcon icon={faCubes} className="section-icon" /> Elastic Sandbox Fleet & Workload Queue Lanes
                                </h3>
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
                                    <FontAwesomeIcon icon={isProbingFleet ? faRotate : faMagnifyingGlass} className={isProbingFleet ? "fa-spin" : ""} />{" "}
                                    {isProbingFleet ? "Probing Fleet..." : "Run Fleet Diagnostics"}
                                </button>
                                <button
                                    type="button"
                                    className="fleet-action-btn scale-out-btn"
                                    onClick={() => handleScaleFleet("out")}
                                    disabled={isScalingFleet}
                                >
                                    <FontAwesomeIcon icon={faPlus} /> Scale Out
                                </button>
                                <button
                                    type="button"
                                    className="fleet-action-btn scale-in-btn"
                                    onClick={() => handleScaleFleet("in")}
                                    disabled={isScalingFleet}
                                >
                                    <FontAwesomeIcon icon={faMinus} /> Scale In
                                </button>
                            </div>
                        </div>

                        {/* Asymmetric Queue Lanes Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                            {/* Light Lane */}
                            <div style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(0, 0, 0, 0.4))', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '14px', padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        <FontAwesomeIcon icon={faBolt} /> LIGHT LANE
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
                                        <FontAwesomeIcon icon={faShieldHalved} /> HEAVY LANE
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
                                                <FontAwesomeIcon icon={faCubes} style={{ marginRight: '6px', color: '#38bdf8' }} />
                                                {inst.id || `piston-${i + 1}`}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: inst.healthy ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: inst.healthy ? '#4ade80' : '#ef4444' }}>
                                                {inst.state || (inst.healthy ? "ONLINE" : "OFFLINE")}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span>Type:</span>
                                            <strong style={{ color: inst.type === "DYNAMIC_EPHEMERAL" ? '#f59e0b' : '#38bdf8' }}>
                                                {inst.type === "DYNAMIC_EPHEMERAL" ? (
                                                    <><FontAwesomeIcon icon={faBolt} /> Dynamic Scaled</>
                                                ) : (
                                                    <><FontAwesomeIcon icon={faLock} /> Prewarmed</>
                                                )}
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
                                            <FontAwesomeIcon icon={faLock} style={{ marginRight: '6px', color: '#4ade80' }} />
                                            Standalone Baseline Sandbox Active
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
                </div>
            )}

            {/* Page 3: Users & Batches */}
            {activeTab === "users" && (
                <div className="page-view-stack">
                    {/* User Identity Breakdown */}
                    <div className="admin-section">
                        <div className="telemetry-card">
                            <div className="card-header">
                                <h3>Combatant Identity & Community Distribution</h3>
                                <span className="telemetry-tag">TOTAL: {metrics?.users?.total || 0} COMBATANTS</span>
                            </div>
                            <div className="user-ratio-grid">
                                <div className="ratio-box">
                                    <span className="role-icon"><FontAwesomeIcon icon={faGraduationCap} /></span>
                                    <span className="role-count">{metrics?.users?.students || 0}</span>
                                    <span className="role-label">College Students</span>
                                </div>
                                <div className="ratio-box">
                                    <span className="role-icon"><FontAwesomeIcon icon={faBuildingColumns} /></span>
                                    <span className="role-count">{metrics?.users?.faculty || 0}</span>
                                    <span className="role-label">Faculty / Instructors</span>
                                </div>
                                <div className="ratio-box">
                                    <span className="role-icon"><FontAwesomeIcon icon={faLaptop} /></span>
                                    <span className="role-count">{metrics?.users?.independent || 0}</span>
                                    <span className="role-label">Independent Coders</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Student Sub-Batches & Institutions */}
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

                    {/* Combatant Code & User Registry Search */}
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
                </div>
            )}

            {/* Page 4: System Broadcasts */}
            {activeTab === "broadcasts" && (
                <div className="page-view-stack">
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
                                <button type="button" className="preset-btn preset-alpha" onClick={() => handleApplyPreset("ALPHA")}>
                                    <FontAwesomeIcon icon={faStar} /> Alpha Testing (10 Sep 2026)
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
                                                placeholder="e.g. Hey Coders! / Alpha Testing Notice"
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
                                                    {broadcastForm.flashBanner ? (
                                                        <><FontAwesomeIcon icon={faBolt} /> Flash Banner Active</>
                                                    ) : (
                                                        "Inbox Only"
                                                    )}
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
                                    {showPreview ? (
                                        <><FontAwesomeIcon icon={faEyeSlash} /> Hide Preview</>
                                    ) : (
                                        <><FontAwesomeIcon icon={faEye} /> Show Live Preview</>
                                    )}
                                </button>
                                <button type="submit" className="broadcast-dispatch-btn" disabled={isDispatching}>
                                    {isDispatching ? (
                                        <><FontAwesomeIcon icon={faRotate} spin /> Broadcasting...</>
                                    ) : (
                                        <><FontAwesomeIcon icon={faPaperPlane} /> Dispatch Global Broadcast</>
                                    )}
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
                </div>
            )}

            {/* Page 5: Dedicated Live Data & Surfing Analytics Section */}
            {activeTab === "analytics" && (
                <div className="admin-analytics-section">
                    <div className="analytics-header-panel glass-panel">
                        <div className="analytics-title-wrap">
                            <div className="pre-heading">REAL-TIME TRAFFIC & USER BEHAVIOR INTELLIGENCE</div>
                            <h3><FontAwesomeIcon icon={faChartColumn} /> Live Platform Surfing & Traffic Analytics</h3>
                            <p>Real-time active users, route hit volume, user surfing/dwell times, and origin IP telemetry.</p>
                        </div>
                        <div className="analytics-controls-wrap">
                            <button
                                type="button"
                                className="refresh-btn"
                                onClick={fetchAnalytics}
                                disabled={isAnalyticsLoading}
                            >
                                {isAnalyticsLoading ? (
                                    <><FontAwesomeIcon icon={faRotate} spin /> Syncing...</>
                                ) : (
                                    <><FontAwesomeIcon icon={faRotate} /> Refresh Analytics</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Top 4 KPI Cards */}
                    <div className="analytics-kpi-grid">
                        <div className="analytics-kpi-card glass-panel kpi-active-users">
                            <div className="kpi-card-header">
                                <span className="kpi-label">Current Active Users</span>
                                <div className="pulse-indicator online" />
                            </div>
                            <div className="kpi-value cyan">{analyticsData?.activeUsersNow ?? 1}</div>
                            <div className="kpi-subtext">
                                <strong style={{ color: '#38bdf8' }}>{analyticsData?.authenticatedUsers ?? 1}</strong> Authenticated • <strong style={{ color: '#94a3b8' }}>{analyticsData?.guestUsers ?? 0}</strong> Anonymous
                            </div>
                            <div className="kpi-badge">Peak Today: {analyticsData?.peakUsers24h ?? 1} concurrent</div>
                        </div>

                        <div className="analytics-kpi-card glass-panel kpi-dwell">
                            <div className="kpi-card-header">
                                <span className="kpi-label">Avg Surfing Time</span>
                                <span className="kpi-icon"><FontAwesomeIcon icon={faClock} /></span>
                            </div>
                            <div className="kpi-value emerald">{analyticsData?.avgSurfingFormatted || "9m 42s"}</div>
                            <div className="kpi-subtext">Average session surfing duration</div>
                            <div className="kpi-badge emerald-badge">Live Heartbeat & Dwell Monitored</div>
                        </div>

                        <div className="analytics-kpi-card glass-panel kpi-views">
                            <div className="kpi-card-header">
                                <span className="kpi-label">Total Page Views</span>
                                <span className="kpi-icon"><FontAwesomeIcon icon={faFileCode} /></span>
                            </div>
                            <div className="kpi-value gold">{analyticsData?.totalPageViews?.toLocaleString() || "2,485"}</div>
                            <div className="kpi-subtext">Cumulative route hits tracked</div>
                            <div className="kpi-badge gold-badge">{analyticsData?.totalSessions || 186} Unique Sessions</div>
                        </div>

                        <div className="analytics-kpi-card glass-panel kpi-ips">
                            <div className="kpi-card-header">
                                <span className="kpi-label">Tracked Client IPs</span>
                                <span className="kpi-icon"><FontAwesomeIcon icon={faGlobe} /></span>
                            </div>
                            <div className="kpi-value purple">{analyticsData?.topIpOrigins?.length || 5} Origin Nodes</div>
                            <div className="kpi-subtext">Cloudflare & Proxy-aware resolution</div>
                            <div className="kpi-badge purple-badge">Deployed & Managed Surfers</div>
                        </div>
                    </div>

                    {/* 2-Column Deck: Top Hit Pages + 24H Timeline Chart */}
                    <div className="analytics-deck-row">
                        {/* Column 1: Which Page Hits the Most */}
                        <div className="telemetry-card glass-panel top-pages-card">
                            <div className="card-header">
                                <div>
                                    <h3><FontAwesomeIcon icon={faTrophy} /> Route Hits & Surfing Engagement</h3>
                                    <span className="telemetry-subtext">Ranked platform page visits, percentage share & average dwell time per route</span>
                                </div>
                                <span className="telemetry-tag">PAGE VOLUME</span>
                            </div>

                            <div className="top-pages-list">
                                {analyticsData?.topPages?.map((page, idx) => (
                                    <div key={page.path} className="page-hit-row">
                                        <div className="page-hit-head">
                                            <div className="page-title-group">
                                                <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                                                <strong className="page-title">{page.title}</strong>
                                                <code className="page-path">{page.path}</code>
                                            </div>
                                            <div className="page-count-group">
                                                <strong className="page-hits-num">{page.hits} hits</strong>
                                                <span className="page-percent">({page.percentage}%)</span>
                                            </div>
                                        </div>

                                        <div className="page-progress-track">
                                            <div
                                                className={`page-progress-fill rank-fill-${idx < 3 ? idx + 1 : 'other'}`}
                                                style={{ width: `${Math.max(4, page.percentage)}%` }}
                                            />
                                        </div>

                                        <div className="page-meta-chips">
                                            <span className="meta-chip-item"><FontAwesomeIcon icon={faClock} /> Avg Dwell: <strong style={{ color: '#38bdf8' }}>{page.avgSurfingFormatted}</strong></span>
                                            <span className="meta-chip-item"><FontAwesomeIcon icon={faGlobe} /> Unique IPs: <strong style={{ color: '#a855f7' }}>{page.uniqueIpsCount}</strong></span>
                                            <span className="meta-chip-item"><FontAwesomeIcon icon={faClock} /> Last Hit: {page.lastHit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Column 2: 24h Traffic Timeline Chart + Method Breakdown */}
                        <div className="analytics-right-col">
                            {/* Visual SVG Timeline Chart */}
                            <div className="telemetry-card glass-panel timeline-card">
                                <div className="card-header">
                                    <div>
                                        <h3><FontAwesomeIcon icon={faChartLine} /> 24-Hour Surfing & Traffic Timeline</h3>
                                        <span className="telemetry-subtext">Hourly page hits & active concurrent users distribution</span>
                                    </div>
                                    <span className="telemetry-tag">HOURLY TREND</span>
                                </div>

                                <div className="svg-chart-container">
                                    <svg className="traffic-svg-chart" viewBox="0 0 520 180" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="cyberAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.45" />
                                                <stop offset="65%" stopColor="#0088ff" stopOpacity="0.12" />
                                                <stop offset="100%" stopColor="#0088ff" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Horizontal Grid lines */}
                                        <line x1="20" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                        <line x1="20" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                        <line x1="20" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                        <line x1="20" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.15)" />

                                        {/* Area & Line */}
                                        {(() => {
                                            const timeline = analyticsData?.hourlyTimeline || [];
                                            if (timeline.length === 0) return null;
                                            const maxHits = Math.max(1, ...timeline.map((t) => t.hits));
                                            const points = timeline.map((t, i) => {
                                                const x = 30 + (i * (460 / Math.max(1, timeline.length - 1)));
                                                const y = 140 - ((t.hits / maxHits) * 110);
                                                return { x, y, hit: t.hits, hour: t.hour, users: t.activeUsers };
                                            });

                                            const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
                                            const areaD = `${pathD} L ${points[points.length - 1].x} 150 L ${points[0].x} 150 Z`;

                                            return (
                                                <>
                                                    <path d={areaD} fill="url(#cyberAreaGrad)" />
                                                    <path d={pathD} fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" />
                                                    {points.map((p, idx) => (
                                                        <g key={idx} className="chart-point-group">
                                                            <circle cx={p.x} cy={p.y} r="4" fill="#020912" stroke="#00e5ff" strokeWidth="2" />
                                                            <title>{`${p.hour} - ${p.hit} hits (${p.users} active surfers)`}</title>
                                                        </g>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </svg>

                                    {/* X-axis labels */}
                                    <div className="chart-x-labels">
                                        {(analyticsData?.hourlyTimeline || []).filter((_, i) => i % 2 === 0).map((t) => (
                                            <span key={t.hour} className="x-label">{t.hour}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* HTTP Method Breakdown Deck */}
                            <div className="telemetry-card glass-panel method-breakdown-card">
                                <div className="card-header">
                                    <div>
                                        <h3><FontAwesomeIcon icon={faLayerGroup} /> HTTP Method Platform Breakdown</h3>
                                        <span className="telemetry-subtext">Proportion of API mutations vs static queries</span>
                                    </div>
                                    <span className="telemetry-tag">VERB BREAKDOWN</span>
                                </div>

                                {(() => {
                                    const mb = analyticsData?.methodBreakdown || { GET: 1, POST: 1 };
                                    const total = Object.values(mb).reduce((a, b) => a + b, 0) || 1;
                                    const getPct = ((mb.GET || 0) / total * 100).toFixed(1);
                                    const postPct = ((mb.POST || 0) / total * 100).toFixed(1);
                                    const putPct = ((mb.PUT || 0) / total * 100).toFixed(1);
                                    const delPct = ((mb.DELETE || 0) / total * 100).toFixed(1);

                                    return (
                                        <div className="method-bar-deck">
                                            <div className="multi-segmented-bar">
                                                <div className="segment seg-get" style={{ width: `${getPct}%` }} title={`GET: ${getPct}%`} />
                                                <div className="segment seg-post" style={{ width: `${postPct}%` }} title={`POST: ${postPct}%`} />
                                                <div className="segment seg-put" style={{ width: `${putPct}%` }} title={`PUT: ${putPct}%`} />
                                                <div className="segment seg-delete" style={{ width: `${delPct}%` }} title={`DELETE: ${delPct}%`} />
                                            </div>

                                            <div className="method-chips-grid">
                                                <div className="method-chip-item chip-get">
                                                    <span className="m-tag">GET</span>
                                                    <strong>{mb.GET || 0}</strong>
                                                    <small>({getPct}%)</small>
                                                </div>
                                                <div className="method-chip-item chip-post">
                                                    <span className="m-tag">POST</span>
                                                    <strong>{mb.POST || 0}</strong>
                                                    <small>({postPct}%)</small>
                                                </div>
                                                <div className="method-chip-item chip-put">
                                                    <span className="m-tag">PUT</span>
                                                    <strong>{mb.PUT || 0}</strong>
                                                    <small>({putPct}%)</small>
                                                </div>
                                                <div className="method-chip-item chip-del">
                                                    <span className="m-tag">DELETE</span>
                                                    <strong>{mb.DELETE || 0}</strong>
                                                    <small>({delPct}%)</small>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Deck: Top Origin Client IPs */}
                    <div className="admin-section" style={{ marginTop: '24px' }}>
                        <div className="telemetry-card glass-panel ip-origins-card">
                            <div className="card-header">
                                <div>
                                    <h3><FontAwesomeIcon icon={faGlobe} /> Client Origin IP Distribution</h3>
                                    <span className="telemetry-subtext">Active remote IP addresses surfing deployed & managed nodes, dominant method & latest route</span>
                                </div>
                                <span className="telemetry-tag">ORIGIN TELEMETRY</span>
                            </div>

                            <div className="ip-origins-table-wrap">
                                <table className="ip-origins-table">
                                    <thead>
                                        <tr>
                                            <th>Origin IP Address</th>
                                            <th>Requests / Hits</th>
                                            <th>Dominant Method</th>
                                            <th>Top Visited Route</th>
                                            <th>Last Seen</th>
                                            <th>Combatant Identity</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analyticsData?.topIpOrigins?.map((rec) => (
                                            <tr key={rec.ip}>
                                                <td>
                                                    <span
                                                        className={`ip-chip ${rec.ip === "127.0.0.1" ? "ip-local" : "ip-remote"}`}
                                                        onClick={(e) => handleCopyIp(rec.ip, e)}
                                                        title="Click to copy IP"
                                                    >
                                                        <FontAwesomeIcon icon={faGlobe} /> {rec.ip}
                                                        {copiedIp === rec.ip && <span className="copied-tag"><FontAwesomeIcon icon={faCheck} /></span>}
                                                    </span>
                                                </td>
                                                <td><strong style={{ color: '#00e5ff' }}>{rec.totalRequests}</strong> hits</td>
                                                <td>
                                                    <span className={`method-badge meth-${rec.primaryMethod.toLowerCase()}`}>
                                                        {rec.primaryMethod}
                                                    </span>
                                                </td>
                                                <td><code>{rec.topPath}</code></td>
                                                <td>{rec.lastSeen}</td>
                                                <td>
                                                    {rec.username ? (
                                                        <strong style={{ color: '#4ade80' }}><FontAwesomeIcon icon={faUser} /> {rec.username}</strong>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>Guest Visitor</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="inspect-ip-btn"
                                                        onClick={() => handleFilterByIp(rec.ip)}
                                                    >
                                                        <FontAwesomeIcon icon={faMagnifyingGlass} /> Filter Logs
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Dedicated Live Audit Trail & Telemetry Logs */}
            {activeTab === "audit_trail" && (
                <div className="admin-audit-section">
                    <div className="audit-header-panel glass-panel">
                        <div className="audit-title-wrap">
                            <h3><FontAwesomeIcon icon={faShieldHalved} /> Platform Event Audit Trail & Telemetry Stream</h3>
                            <p>Real-time chronological telemetry logs across authentication, battles, submissions, and fleet orchestration.</p>
                        </div>
                        <div className="audit-controls-wrap">
                            <input
                                type="text"
                                className="audit-search-input"
                                placeholder="Search actions, actors, IP addresses, methods, or details..."
                                value={auditSearch}
                                onChange={(e) => {
                                    setAuditSearch(e.target.value);
                                    fetchAuditLogs(auditCategory, auditSeverity, auditMethod, e.target.value);
                                }}
                            />
                            <button
                                type="button"
                                className="refresh-btn"
                                onClick={() => fetchAuditLogs()}
                                disabled={auditLoading}
                            >
                                {auditLoading ? (
                                    <><FontAwesomeIcon icon={faRotate} spin /> Refreshing...</>
                                ) : (
                                    <><FontAwesomeIcon icon={faRotate} /> Refresh Audit</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="audit-filters-bar">
                        <div className="filter-group">
                            <span className="filter-group-label">Category:</span>
                            {["ALL", "PAGE_VIEW", "HTTP_TRAFFIC", "AUTH", "SECURITY", "SUBMISSION", "BATTLE", "ADMIN", "FLEET", "LINUX_TELEMETRY"].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`audit-filter-pill ${auditCategory === cat ? "active" : ""}`}
                                    onClick={() => {
                                        setAuditCategory(cat);
                                        fetchAuditLogs(cat, auditSeverity, auditMethod, auditSearch);
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="filter-group">
                            <span className="filter-group-label">Method:</span>
                            {["ALL", "GET", "POST", "PUT", "DELETE", "EVENT"].map((meth) => (
                                <button
                                    key={meth}
                                    type="button"
                                    className={`audit-filter-pill meth-${meth.toLowerCase()} ${auditMethod === meth ? "active" : ""}`}
                                    onClick={() => {
                                        setAuditMethod(meth);
                                        fetchAuditLogs(auditCategory, auditSeverity, meth, auditSearch);
                                    }}
                                >
                                    {meth}
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
                                        fetchAuditLogs(auditCategory, sev, auditMethod, auditSearch);
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
                                        <th>Method</th>
                                        <th>Origin IP</th>
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
                                                    <span className={`method-badge meth-${(entry.method || "EVENT").toLowerCase()}`}>
                                                        {entry.method || "EVENT"}
                                                    </span>
                                                </td>
                                                <td className="audit-ip-cell">
                                                    <span
                                                        className={`ip-chip ${entry.ip === "127.0.0.1" ? "ip-local" : "ip-remote"}`}
                                                        title="Click to copy IP / inspect origin"
                                                        onClick={(e) => handleCopyIp(entry.ip || "127.0.0.1", e)}
                                                    >
                                                        <FontAwesomeIcon icon={faGlobe} /> {entry.ip || "127.0.0.1"}
                                                        {copiedIp === entry.ip && <span className="copied-tag"><FontAwesomeIcon icon={faCheck} /></span>}
                                                    </span>
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
                                            {expandedAuditId === entry.id && (
                                                <tr className="audit-meta-row">
                                                    <td colSpan={8}>
                                                        <div className="audit-meta-card">
                                                            <div className="audit-meta-header">
                                                                <span>Client IP Origin: <strong>{entry.ip || "127.0.0.1"}</strong></span>
                                                                <span>HTTP Method: <strong>{entry.method || "EVENT"}</strong></span>
                                                                <button
                                                                    type="button"
                                                                    className="filter-by-ip-btn"
                                                                    onClick={(e) => handleFilterByIp(entry.ip || "127.0.0.1", e)}
                                                                >
                                                                    <FontAwesomeIcon icon={faMagnifyingGlass} /> Filter All Events for this IP
                                                                </button>
                                                            </div>
                                                            {entry.metadata && (
                                                                <>
                                                                    <strong style={{ display: 'block', marginTop: '8px' }}>Metadata Payload:</strong>
                                                                    <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                                                                </>
                                                            )}
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
                                <FontAwesomeIcon icon={faRotate} /> Check Connectivity
                            </button>
                            <a
                                href={linuxTelemetryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="external-window-btn"
                            >
                                Open in New Window <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
                            <div className="guide-icon"><FontAwesomeIcon icon={faDesktop} /></div>
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
                                <FontAwesomeIcon icon={faRotate} /> Reconnect to Service
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
                                <h4><FontAwesomeIcon icon={faMagnifyingGlass} /> Fleet Diagnostics Probe Results</h4>
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
                                                <strong><FontAwesomeIcon icon={faBox} /> {res.id} ({res.url})</strong>
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
                    </AnimatePresence>
                </main>
            </div>
            <Footer />
        </BackgroundPaths>
    );
}
