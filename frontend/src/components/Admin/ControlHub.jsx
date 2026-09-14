import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  faEye,
  faEyeSlash,
  faLayerGroup,
  faCircleCheck,
  faClock,
  faBolt,
  faChevronLeft,
  faChevronRight,
  faRightFromBracket
} from "@fortawesome/free-solid-svg-icons";

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
import { generatePdfThumbnail } from "../../utils/pdfThumbnail.js";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import Footer from "../Common/Footer/Footer";

// Tab Sub-Components
import FleetTab from "./tabs/FleetTab.jsx";
import SandboxTab from "./tabs/SandboxTab.jsx";
import UsersTab from "./tabs/UsersTab.jsx";
import BroadcastsTab from "./tabs/BroadcastsTab.jsx";
import AnalyticsTab from "./tabs/AnalyticsTab.jsx";
import AuditTab from "./tabs/AuditTab.jsx";
import LinuxHostTab from "./tabs/LinuxHostTab.jsx";

import "./ControlHub.css";

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

// Logically Grouped Sidebar Domains matching modern dashboard standard
const SIDEBAR_SECTIONS = [
  {
    groupTitle: "INFRASTRUCTURE",
    items: [
      { id: "overview", icon: faServer, title: "Platform Fleet" },
      { id: "sandbox", icon: faCubes, title: "Elastic Sandbox" },
      { id: "linux_telemetry", icon: faDesktop, title: "Linux Host Live" },
    ],
  },
  {
    groupTitle: "OPERATIONS",
    items: [
      { id: "users", icon: faUsers, title: "Users & Batches" },
      { id: "broadcasts", icon: faBullhorn, title: "System Broadcasts" },
    ],
  },
  {
    groupTitle: "SECURITY & INSIGHTS",
    items: [
      { id: "analytics", icon: faChartColumn, title: "Data Analytics" },
      { id: "audit_trail", icon: faShieldHalved, title: "Audit Stream" },
    ],
  },
];

const ALL_SIDEBAR_ITEMS = SIDEBAR_SECTIONS.flatMap((g) => g.items);

export default function ControlHub() {
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("af_admin_key") || "");
  const [isUnlocked, setIsUnlocked] = useState(Boolean(sessionStorage.getItem("af_admin_key")));
  const [passInput, setPassInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const { notify } = useNotification();

  // Live Sync & Telemetry State
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState("overview");
  const [linuxStatus, setLinuxStatus] = useState("CHECKING");

  // Analytics State
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
    message:
      "AlgoFight is currently in its Alpha Testing Phase until September 10, 2026. If you find a bug, have a suggestion, or want to share feedback, let us know!",
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
        notify({
          type: "success",
          title: "ACCESS GRANTED",
          message: "SuperAdmin Level 5 Clearance Verified.",
        });
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

  // 📊 Analytics Fetch
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

  // 👥 Users Fetch
  const fetchUsers = useCallback(
    async (query = "") => {
      if (!adminKey) return;
      try {
        const path = query
          ? `/api/admin/users?search=${encodeURIComponent(query)}`
          : "/api/admin/users";
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
    },
    [adminKey]
  );

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

  // Audit Filter Ref
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

  // 🛡️ Audit Logs Fetch
  const fetchAuditLogs = useCallback(
    async (cat, sev, meth, q) => {
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
    },
    [adminKey]
  );

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

  const handleTabSwitch = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "analytics") fetchAnalytics();
    if (tabId === "audit_trail") fetchAuditLogs();
    if (tabId === "linux_telemetry") checkLinuxStatus();
    if (tabId === "users") fetchUsers(search);
    if (tabId === "broadcasts") fetchBroadcasts();
  };

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
    notify({
      type: "info",
      title: "METRICS SYNCHRONIZED",
      message: "Live telemetry, analytics & audit records updated.",
    });
  };

  // 📋 IP Helpers
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
    notify({
      type: "info",
      title: "FILTERING LOGS",
      message: `Inspecting origin events for IP ${filterIp}`,
    });
  };

  // 🚀 Fleet Diagnostics Probe
  const handleRunFleetProbe = async () => {
    setIsProbingFleet(true);
    try {
      const data = await probeAdminFleet(adminKey, {
        language: "python",
        code:
          "import sys, time; time.sleep(0.01); print(f'AlgoFight Piston Engine Online: Python {sys.version.split()[0]}')",
      });
      setProbeResults(data);
      setIsProbeModalOpen(true);
      notify({
        type: "success",
        title: "PROBE COMPLETED",
        message: `Tested ${data?.totalActiveRuntimes || 1} runtime container(s).`,
      });
      fetchTelemetry();
      fetchAuditLogs();
    } catch (err) {
      notify({
        type: "error",
        title: "PROBE FAILED",
        message: err.message || "Failed to execute runtime probe.",
      });
    } finally {
      setIsProbingFleet(false);
    }
  };

  // ⚖️ Fleet Scaling
  const handleScaleFleet = async (direction) => {
    const actionLabel =
      direction === "out" ? "Scale-Out (+1 Container)" : "Scale-In (-1 Container)";
    if (!window.confirm(`Are you sure you want to trigger manual ${actionLabel}?`)) return;

    setIsScalingFleet(true);
    try {
      const res = await scaleAdminFleet(adminKey, direction, `Admin manual trigger: ${direction}`);
      if (res.success) {
        notify({
          type: "success",
          title: "FLEET SCALED",
          message: `Successfully executed ${actionLabel}.`,
        });
        fetchTelemetry();
        fetchAuditLogs();
      } else {
        notify({
          type: "warning",
          title: "SCALING LIMITED",
          message: res.message || "Pool already at capacity threshold or hysteresis active.",
        });
      }
    } catch (err) {
      notify({ type: "error", title: "SCALING FAILED", message: err.message });
    } finally {
      setIsScalingFleet(false);
    }
  };

  // Auto-Refresh
  useEffect(() => {
    if (!isUnlocked || !adminKey) return;

    fetchTelemetry();
    fetchAnalytics();
    fetchUsers();
    fetchBroadcasts();
    fetchAuditLogs();
    checkLinuxStatus();

    const secTimer = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        setSecondsSinceSync((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(secTimer);
  }, [isUnlocked, adminKey, fetchTelemetry, fetchAnalytics, fetchUsers, fetchBroadcasts, fetchAuditLogs, checkLinuxStatus]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!isUnlocked || !adminKey || refreshInterval <= 0) return;

    const syncTimer = setInterval(() => {
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
        message:
          "AlgoFight is currently in its Alpha Testing Phase until September 10, 2026. We are actively refining platform telemetry and match performance. If you discover a bug or have suggestions, share your feedback!",
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
          notify({
            type: "success",
            title: "MEDIA ATTACHED",
            message: `Successfully attached ${file.name}`,
          });
        }
      } catch (err) {
        notify({
          type: "error",
          title: "UPLOAD FAILED",
          message: err.message || "Failed to process media file.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDispatchBroadcast = async (e) => {
    e.preventDefault();
    setIsDispatching(true);

    try {
      const expiresAt = new Date(
        `${broadcastForm.expiryDate}T${broadcastForm.expiryTime}:00`
      ).toISOString();
      const payload = {
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        type: broadcastForm.type,
        expiresAt,
        flashBanner: broadcastForm.flashBanner,
        content:
          includeMediaOrAction &&
          broadcastForm.contentType !== "NONE" &&
          broadcastForm.contentUrl
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
          includeMediaOrAction &&
          broadcastForm.actionType !== "NONE" &&
          broadcastForm.actionTarget
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
    if (
      !window.confirm(
        "Are you sure you want to revoke this broadcast? It will instantly disappear from all user screens and inboxes."
      )
    ) {
      return;
    }

    try {
      const res = await deleteAdminBroadcast(adminKey, broadcastId);
      if (res.success) {
        notify({
          type: "warning",
          title: "BROADCAST REVOKED",
          message: "Broadcast purged from active clients.",
        });
        fetchBroadcasts();
        fetchAuditLogs();
      }
    } catch (err) {
      notify({
        type: "error",
        title: "REVOCATION FAILED",
        message: err.message || "Failed to revoke.",
      });
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
            transition={{ duration: 0.25 }}
            className="lock-terminal glass-panel"
          >
            <div className="lock-terminal-badge">
              <span className="badge-pulse-dot" />
              <span>RESTRICTED ACCESS</span>
            </div>
            <h2>SuperAdmin Clearance</h2>
            <p>
              Authenticate with your master administrative credentials to access platform telemetry,
              sandbox orchestration, and audit streams.
            </p>

            <form onSubmit={handleUnlock} className="lock-form">
              <div className="lock-input-wrap">
                <FontAwesomeIcon icon={faLock} className="lock-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter SuperAdmin Passkey..."
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
              {authError && <p className="lock-error">{authError}</p>}
              <button type="submit" className="lock-btn">
                <FontAwesomeIcon icon={faUnlock} /> Verify Clearance
              </button>
            </form>
          </motion.div>
        </div>
        <Footer />
      </BackgroundPaths>
    );
  }

  const currentItem = ALL_SIDEBAR_ITEMS.find((i) => i.id === activeTab);

  return (
    <BackgroundPaths>
      <div className="admin-layout-container">
        {/* Structural Architectural Sidebar Panel */}
        <aside className={`admin-sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
          {/* Header / Brand */}
          <div className="sidebar-header">
            {isSidebarCollapsed ? (
              <div className="collapsed-header-wrap">
                <div
                  className="sidebar-logo-box"
                  title="AlgoFight SuperAdmin (Click to expand)"
                  onClick={() => setIsSidebarCollapsed(false)}
                  role="button"
                  tabIndex={0}
                >
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <button
                  type="button"
                  className="sidebar-collapse-btn expand-btn"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            ) : (
              <>
                <div className="sidebar-brand-group">
                  <div className="sidebar-logo-box" title="AlgoFight SuperAdmin Console">
                    <FontAwesomeIcon icon={faShieldHalved} />
                  </div>
                  <div className="sidebar-brand-text">
                    <h2 className="sidebar-brand-title">Control Hub</h2>
                    <span className="sidebar-brand-badge">SUPERADMIN</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="sidebar-collapse-btn"
                  onClick={() => setIsSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
              </>
            )}
          </div>

          {/* Navigation Items List */}
          <nav className="sidebar-nav-list">
            {SIDEBAR_SECTIONS.map((section, idx) => (
              <React.Fragment key={section.groupTitle}>
                {idx > 0 && (
                  isSidebarCollapsed ? (
                    <div className="sidebar-mini-divider" />
                  ) : (
                    <div className="sidebar-group-label">{section.groupTitle}</div>
                  )
                )}
                {idx === 0 && !isSidebarCollapsed && (
                  <div className="sidebar-group-label">{section.groupTitle}</div>
                )}
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`app-sidebar-item ${activeTab === item.id ? "active" : ""}`}
                    onClick={() => handleTabSwitch(item.id)}
                    data-tooltip={isSidebarCollapsed ? item.title : undefined}
                    title={isSidebarCollapsed ? item.title : undefined}
                  >
                    <span className="sidebar-item-icon">
                      <FontAwesomeIcon icon={item.icon} />
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="sidebar-item-label">{item.title}</span>
                    )}
                    {!isSidebarCollapsed && item.id === "linux_telemetry" && (
                      <span className={`sidebar-item-badge ${linuxStatus.toLowerCase()}`}>
                        {linuxStatus === "ONLINE" ? "LIVE" : "OFF"}
                      </span>
                    )}
                    {!isSidebarCollapsed && item.id === "audit_trail" && (
                      <span className="sidebar-item-badge count">
                        {auditTotal || auditLogs.length}
                      </span>
                    )}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>

          {/* Sidebar Bottom Controls */}
          <div className="sidebar-bottom-controls">
            {!isSidebarCollapsed ? (
              <>
                <div className="sidebar-sync-bar">
                  <div className="sync-status-group">
                    <div className="sync-pulse-dot" />
                    <span className="sync-label">
                      Sync: {refreshInterval > 0 ? `${refreshInterval}s` : "Manual"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="sync-trigger-btn"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    title="Sync now"
                  >
                    <FontAwesomeIcon icon={faRotate} className={isSyncing ? "fa-spin" : ""} />
                  </button>
                </div>

                <button
                  type="button"
                  className="sidebar-logout-btn"
                  onClick={handleLock}
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                  <span>Lock Terminal</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sidebar-icon-only-btn"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  data-tooltip="Sync Metrics"
                  title="Sync Metrics"
                >
                  <FontAwesomeIcon icon={faRotate} className={isSyncing ? "fa-spin" : ""} />
                </button>
                <button
                  type="button"
                  className="sidebar-icon-only-btn logout"
                  onClick={handleLock}
                  data-tooltip="Lock Terminal"
                  title="Lock Terminal"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} />
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Dashboard Content Area */}
        <main className="admin-main-content">
          {/* Top Platform Telemetry HUD */}
          <div className="admin-telemetry-hud glass-panel">
            <div className="hud-metric-item">
              <span className="hud-metric-label">API Gateway SLA</span>
              <div className="hud-metric-val">
                <strong className="cyan-text">
                  {metrics?.services?.apiGateway?.avgLatency || "<1ms"}
                </strong>
                <span className="hud-metric-sub">P95: {metrics?.services?.apiGateway?.p95Latency || "<1ms"}</span>
              </div>
            </div>

            <div className="hud-metric-item">
              <span className="hud-metric-label">Cluster Sockets & Rooms</span>
              <div className="hud-metric-val">
                <strong className="green-text">
                  {metrics?.services?.websocketGateway?.activeSockets ?? 0} Sockets
                </strong>
                <span className="hud-metric-sub">{metrics?.services?.websocketGateway?.activeRooms ?? 0} Rooms</span>
              </div>
            </div>

            <div className="hud-metric-item">
              <span className="hud-metric-label">PostgreSQL & Redis</span>
              <div className="hud-metric-val">
                <strong className="purple-text">
                  {metrics?.services?.database?.status || "ONLINE"}
                </strong>
                <span className="hud-metric-sub">Pool: {metrics?.services?.database?.pool || "Active"}</span>
              </div>
            </div>

            <div className="hud-metric-item">
              <span className="hud-metric-label">Clearance & Security</span>
              <div className="hud-metric-val">
                <strong className="gold-text">Level 5 Master</strong>
                <span className="hud-metric-sub">SuperAdmin Clearance</span>
              </div>
            </div>
          </div>

          {/* View Header */}
          <div className="main-view-header glass-panel">
            <div>
              <div className="view-preheading">ADMINISTRATION CONSOLE</div>
              <h1 className="view-title">
                {currentItem?.icon && (
                  <FontAwesomeIcon icon={currentItem.icon} className="view-title-icon" />
                )}{" "}
                {currentItem?.title}
              </h1>
              <p className="view-subtitle">{currentItem?.desc}</p>
            </div>
            <div className="view-actions">
              <span className="live-status-chip">
                <span className="pulse-indicator online" /> TELEMETRY SYNCHRONIZED ({secondsSinceSync}s)
              </span>
            </div>
          </div>

          {/* Active Tab Page View */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="active-page-view"
            >
              {activeTab === "overview" && (
                <FleetTab
                  metrics={metrics}
                  isProbingFleet={isProbingFleet}
                  handleRunFleetProbe={handleRunFleetProbe}
                  isProbeModalOpen={isProbeModalOpen}
                  setIsProbeModalOpen={setIsProbeModalOpen}
                  probeResults={probeResults}
                  SERVICE_NAMES={SERVICE_NAMES}
                  STAT_LABELS={STAT_LABELS}
                />
              )}

              {activeTab === "sandbox" && (
                <SandboxTab
                  metrics={metrics}
                  isScalingFleet={isScalingFleet}
                  handleScaleFleet={handleScaleFleet}
                  handleRunFleetProbe={handleRunFleetProbe}
                  isProbingFleet={isProbingFleet}
                />
              )}

              {activeTab === "users" && (
                <UsersTab
                  metrics={metrics}
                  users={users}
                  search={search}
                  setSearch={setSearch}
                  handleSearch={handleSearch}
                  fetchUsers={fetchUsers}
                />
              )}

              {activeTab === "broadcasts" && (
                <BroadcastsTab
                  broadcastForm={broadcastForm}
                  setBroadcastForm={setBroadcastForm}
                  includeMediaOrAction={includeMediaOrAction}
                  setIncludeMediaOrAction={setIncludeMediaOrAction}
                  showPreview={showPreview}
                  setShowPreview={setShowPreview}
                  isDispatching={isDispatching}
                  handleDispatchBroadcast={handleDispatchBroadcast}
                  handleApplyPreset={handleApplyPreset}
                  handleMediaFileUpload={handleMediaFileUpload}
                  adminBroadcasts={adminBroadcasts}
                  fetchBroadcasts={fetchBroadcasts}
                  handleRevokeBroadcast={handleRevokeBroadcast}
                  formatRemaining={formatRemaining}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsTab
                  analyticsData={analyticsData}
                  isAnalyticsLoading={isAnalyticsLoading}
                  fetchAnalytics={fetchAnalytics}
                  handleCopyIp={handleCopyIp}
                  handleFilterByIp={handleFilterByIp}
                  copiedIp={copiedIp}
                />
              )}

              {activeTab === "audit_trail" && (
                <AuditTab
                  auditLogs={auditLogs}
                  auditTotal={auditTotal}
                  auditCategory={auditCategory}
                  setAuditCategory={setAuditCategory}
                  auditSeverity={auditSeverity}
                  setAuditSeverity={setAuditSeverity}
                  auditMethod={auditMethod}
                  setAuditMethod={setAuditMethod}
                  auditSearch={auditSearch}
                  setAuditSearch={setAuditSearch}
                  auditLoading={auditLoading}
                  fetchAuditLogs={fetchAuditLogs}
                  expandedAuditId={expandedAuditId}
                  setExpandedAuditId={setExpandedAuditId}
                  handleCopyIp={handleCopyIp}
                  handleFilterByIp={handleFilterByIp}
                  copiedIp={copiedIp}
                />
              )}

              {activeTab === "linux_telemetry" && (
                <LinuxHostTab
                  linuxStatus={linuxStatus}
                  checkLinuxStatus={checkLinuxStatus}
                  linuxTelemetryUrl={linuxTelemetryUrl}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Footer />
    </BackgroundPaths>
  );
}
