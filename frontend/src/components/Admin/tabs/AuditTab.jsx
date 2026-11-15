import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faGlobe,
  faCheck,
  faMagnifyingGlass,
  faRotate,
  faBolt,
  faCode,
  faClock,
  faCopy,
  faFilter,
  faXmark,
  faCircleExclamation,
  faCheckCircle,
  faTriangleExclamation,
  faServer,
  faUser,
  faNetworkWired,
  faLink,
  faGaugeHigh,
  faFileCode,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";
  const timeMs = typeof timestamp === "string" ? new Date(timestamp).getTime() : Number(timestamp);
  if (isNaN(timeMs)) return "Just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function parseUserAgent(ua) {
  if (!ua || typeof ua !== "string") return "Unknown Client";
  if (ua.includes("Firefox")) return "Firefox Browser";
  if (ua.includes("Edg")) return "Edge Browser";
  if (ua.includes("Chrome")) return "Chrome Browser";
  if (ua.includes("Safari")) return "Safari Browser";
  if (ua.includes("Postman")) return "Postman Client";
  if (ua.includes("curl")) return "cURL CLI";
  if (ua.includes("node")) return "Node.js Service";
  return ua.slice(0, 32);
}

export default function AuditTab({
  auditLogs = [],
  auditTotal = 0,
  auditCategory,
  setAuditCategory,
  auditSeverity,
  setAuditSeverity,
  auditMethod,
  setAuditMethod,
  auditSearch,
  setAuditSearch,
  auditLoading,
  fetchAuditLogs,
  expandedAuditId,
  setExpandedAuditId,
  handleCopyIp,
  handleFilterByIp,
  handleFilterByActor,
  copiedIp,
}) {
  const [copiedPayloadId, setCopiedPayloadId] = useState(null);
  const [showRawJsonMap, setShowRawJsonMap] = useState({});

  const handleCopyPayload = (id, metadata, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(JSON.stringify(metadata, null, 2));
    setCopiedPayloadId(id);
    setTimeout(() => setCopiedPayloadId(null), 2000);
  };

  const toggleRawJson = (id, e) => {
    if (e) e.stopPropagation();
    setShowRawJsonMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleResetFilters = () => {
    setAuditCategory("ALL");
    setAuditSeverity("ALL");
    setAuditMethod("ALL");
    setAuditSearch("");
    fetchAuditLogs("ALL", "ALL", "ALL", "");
  };

  const hasActiveFilters =
    auditCategory !== "ALL" ||
    auditSeverity !== "ALL" ||
    auditMethod !== "ALL" ||
    Boolean(auditSearch && auditSearch.trim());

  // Quick KPI telemetry stats
  const totalEvents = auditTotal || auditLogs.length;
  const securityCount = auditLogs.filter(
    (l) => l.category === "SECURITY" || l.severity === "WARN" || l.severity === "CRITICAL"
  ).length;
  const submissionCount = auditLogs.filter((l) => l.category === "SUBMISSION").length;
  const uniqueIps = new Set(auditLogs.map((l) => l.ip).filter(Boolean)).size;

  return (
    <div className="admin-audit-section">
      {/* Header Panel */}
      <div className="audit-header-panel glass-panel">
        <div className="audit-title-wrap">
          <div className="pre-heading-row">
            <span className="pre-heading">SECURITY TELEMETRY & EVENT STREAM</span>
            <span className="audit-live-status-pill">
              <span className="pulse-indicator online" /> LIVE STREAMING
            </span>
          </div>
          <h3>
            <FontAwesomeIcon icon={faShieldHalved} /> Platform Event Audit Trail & Telemetry
          </h3>
          <p>
            Real-time chronological telemetry stream across authentication, live battles, submissions, and fleet orchestration.
          </p>
        </div>

        <div className="audit-controls-wrap">
          <div className="search-input-wrap">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
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
            {auditSearch && (
              <button
                type="button"
                className="audit-search-clear-btn"
                onClick={() => {
                  setAuditSearch("");
                  fetchAuditLogs(auditCategory, auditSeverity, auditMethod, "");
                }}
                title="Clear search query"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="refresh-btn"
            onClick={() => fetchAuditLogs()}
            disabled={auditLoading}
            title="Fetch latest audit telemetry records"
          >
            <FontAwesomeIcon icon={faRotate} className={auditLoading ? "fa-spin" : ""} />{" "}
            {auditLoading ? "Refreshing..." : "Refresh Stream"}
          </button>
        </div>
      </div>

      {/* KPI Summary Telemetry Strip */}
      <div className="audit-kpi-strip">
        <div className="audit-kpi-card tone-cyan">
          <div className="kpi-icon-wrap">
            <FontAwesomeIcon icon={faServer} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{totalEvents}</div>
            <div className="kpi-label">TOTAL STREAM EVENTS</div>
          </div>
        </div>

        <div className="audit-kpi-card tone-pink">
          <div className="kpi-icon-wrap">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{securityCount}</div>
            <div className="kpi-label">SECURITY & ALERTS</div>
          </div>
        </div>

        <div className="audit-kpi-card tone-green">
          <div className="kpi-icon-wrap">
            <FontAwesomeIcon icon={faFileCode} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{submissionCount}</div>
            <div className="kpi-label">CODE EVALUATIONS</div>
          </div>
        </div>

        <div className="audit-kpi-card tone-gold">
          <div className="kpi-icon-wrap">
            <FontAwesomeIcon icon={faNetworkWired} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{uniqueIps}</div>
            <div className="kpi-label">ACTIVE CLIENT IPS</div>
          </div>
        </div>
      </div>

      {/* Filter Segmented Control Bar */}
      <div className="audit-filters-bar glass-panel">
        <div className="filter-group">
          <span className="filter-group-label">Category:</span>
          {[
            "ALL",
            "SUBMISSION",
            "BATTLE",
            "AUTH",
            "SECURITY",
            "SYSTEM",
            "ADMIN",
            "FLEET",
            "HTTP_TRAFFIC",
            "WEBSOCKET",
            "PAGE_VIEW",
            "LINUX_TELEMETRY",
          ].map((cat) => (
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
          {["ALL", "GET", "POST", "PUT", "DELETE", "WS", "EVENT"].map((meth) => (
            <button
              key={meth}
              type="button"
              className={`audit-filter-pill meth-${meth.toLowerCase()} ${
                auditMethod === meth ? "active" : ""
              }`}
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
              className={`audit-filter-pill sev-${sev.toLowerCase()} ${
                auditSeverity === sev ? "active" : ""
              }`}
              onClick={() => {
                setAuditSeverity(sev);
                fetchAuditLogs(auditCategory, sev, auditMethod, auditSearch);
              }}
            >
              {sev}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <div className="filter-reset-wrap">
            <button
              type="button"
              className="audit-reset-filters-btn"
              onClick={handleResetFilters}
              title="Reset all active filters"
            >
              <FontAwesomeIcon icon={faFilter} /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Audit Stream Table */}
      <div className="audit-table-wrapper glass-panel">
        {auditLogs.length === 0 ? (
          <div className="no-audit-notice">
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: "1.8rem", opacity: 0.35, marginBottom: 8 }} />
            <span>No telemetry records found matching the active filters.</span>
            {hasActiveFilters && (
              <button
                type="button"
                className="audit-reset-filters-btn inline"
                onClick={handleResetFilters}
                style={{ marginTop: 12 }}
              >
                Clear Filters
              </button>
            )}
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
                <th>Stream Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => {
                const meta = entry.metadata || {};
                const isExpanded = expandedAuditId === entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`audit-row ${isExpanded ? "is-expanded" : ""}`}
                      onClick={() => setExpandedAuditId(isExpanded ? null : entry.id)}
                    >
                      <td className="audit-time-cell" title={new Date(entry.timestamp).toLocaleString()}>
                        <div className="time-main">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                        <div className="time-sub">
                          {formatRelativeTime(entry.timestamp)}
                        </div>
                      </td>

                      <td>
                        <span className={`method-badge meth-${(entry.method || "EVENT").toLowerCase()}`}>
                          {entry.method || "EVENT"}
                        </span>
                      </td>

                      <td className="audit-ip-cell">
                        <span
                          className={`ip-chip ${
                            entry.ip === "127.0.0.1" || entry.ip === "Platform_Internal"
                              ? "ip-local"
                              : "ip-remote"
                          }`}
                          title="Click to copy IP"
                          onClick={(e) => handleCopyIp(entry.ip || "127.0.0.1", e)}
                        >
                          <FontAwesomeIcon icon={faGlobe} /> {entry.ip || "127.0.0.1"}
                          {copiedIp === entry.ip && (
                            <span className="copied-tag">
                              <FontAwesomeIcon icon={faCheck} />
                            </span>
                          )}
                        </span>
                      </td>

                      <td>
                        <span className={`cat-chip cat-${(entry.category || "SYSTEM").toLowerCase()}`}>
                          {entry.category || "SYSTEM"}
                        </span>
                      </td>

                      <td>
                        <span className={`sev-badge sev-${(entry.severity || "INFO").toLowerCase()}`}>
                          {entry.severity || "INFO"}
                        </span>
                      </td>

                      <td className="audit-action-cell">
                        <span className="action-tag">{entry.action}</span>
                      </td>

                      <td className="audit-actor-cell">
                        <span
                          className={`actor-chip ${
                            entry.actor === "SuperAdmin"
                              ? "actor-admin"
                              : entry.actor?.startsWith("Guest")
                              ? "actor-guest"
                              : "actor-combatant"
                          }`}
                        >
                          <FontAwesomeIcon icon={faUser} /> {entry.actor}
                        </span>
                      </td>

                      <td className="audit-detail-cell">
                        <div className="audit-detail-content">
                          <div className="audit-detail-summary">{entry.details}</div>
                          <div className="audit-detail-chips">
                            {meta.statusCode && (
                              <span
                                className={`detail-chip status-${
                                  meta.statusCode < 300 ? "2xx" : meta.statusCode < 400 ? "3xx" : meta.statusCode < 500 ? "4xx" : "5xx"
                                }`}
                              >
                                {meta.statusCode}
                              </span>
                            )}
                            {meta.durationMs !== undefined && (
                              <span
                                className={`detail-chip latency-${
                                  meta.durationMs < 100 ? "fast" : meta.durationMs < 400 ? "med" : "slow"
                                }`}
                              >
                                ⏱️ {meta.durationMs}ms
                              </span>
                            )}
                            {meta.language && (
                              <span className="detail-chip lang-chip">
                                {meta.language.toUpperCase()}
                              </span>
                            )}
                            {meta.verdict && (
                              <span className={`detail-chip verdict-${meta.verdict.toLowerCase()}`}>
                                {meta.verdict}
                              </span>
                            )}
                            {meta.passedTestCases !== undefined && meta.totalTestCases !== undefined && (
                              <span className="detail-chip tests-chip">
                                {meta.passedTestCases}/{meta.totalTestCases} Tests
                              </span>
                            )}
                            {meta.roomId && (
                              <span className="detail-chip room-chip">
                                Room: {meta.roomId}
                              </span>
                            )}
                            {meta.rating !== undefined && (
                              <span className="detail-chip rating-chip">
                                ⭐ {meta.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Rich Expanded Telemetry Row */}
                    {isExpanded && (
                      <tr className="audit-meta-row">
                        <td colSpan={8}>
                          <div className="audit-meta-card">
                            <div className="audit-meta-header">
                              <div className="meta-header-left">
                                <span className="meta-badge-title">
                                  EVENT ID: <code>{entry.id}</code>
                                </span>
                                <span>
                                  Client IP: <strong>{entry.ip || "127.0.0.1"}</strong>
                                </span>
                                <span>
                                  Method: <strong>{entry.method || "EVENT"}</strong>
                                </span>
                                <span>
                                  Actor: <strong>{entry.actor}</strong>
                                </span>
                              </div>

                              <div className="meta-header-actions">
                                <button
                                  type="button"
                                  className="filter-by-ip-btn"
                                  onClick={(e) => handleFilterByIp(entry.ip || "127.0.0.1", e)}
                                  title="Filter all stream records by this IP"
                                >
                                  <FontAwesomeIcon icon={faFilter} /> Filter IP
                                </button>
                                {handleFilterByActor && entry.actor && (
                                  <button
                                    type="button"
                                    className="filter-by-ip-btn"
                                    onClick={(e) => handleFilterByActor(entry.actor, e)}
                                    title="Filter all stream records by this actor"
                                  >
                                    <FontAwesomeIcon icon={faUser} /> Filter Actor
                                  </button>
                                )}
                                {meta && (
                                  <button
                                    type="button"
                                    className="filter-by-ip-btn copy-btn"
                                    onClick={(e) => handleCopyPayload(entry.id, meta, e)}
                                    title="Copy raw JSON payload to clipboard"
                                  >
                                    <FontAwesomeIcon icon={copiedPayloadId === entry.id ? faCheck : faCopy} />{" "}
                                    {copiedPayloadId === entry.id ? "Copied!" : "Copy Payload"}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Structured Telemetry Grid */}
                            <div className="audit-meta-grid">
                              <div className="audit-meta-tile">
                                <div className="tile-icon">
                                  <FontAwesomeIcon icon={faLink} />
                                </div>
                                <div className="tile-content">
                                  <div className="tile-label">ENDPOINT / PATH</div>
                                  <div className="tile-val font-mono">
                                    {meta.path || meta.url || entry.details.split(" ")[1] || "N/A"}
                                  </div>
                                </div>
                              </div>

                              <div className="audit-meta-tile">
                                <div className="tile-icon">
                                  <FontAwesomeIcon icon={faGaugeHigh} />
                                </div>
                                <div className="tile-content">
                                  <div className="tile-label">LATENCY & DURATION</div>
                                  <div className="tile-val">
                                    {meta.durationMs !== undefined
                                      ? `${meta.durationMs}ms`
                                      : meta.executionTimeMs !== undefined
                                      ? `${meta.executionTimeMs}ms`
                                      : "Instantaneous"}
                                  </div>
                                </div>
                              </div>

                              <div className="audit-meta-tile">
                                <div className="tile-icon">
                                  <FontAwesomeIcon icon={faServer} />
                                </div>
                                <div className="tile-content">
                                  <div className="tile-label">CLIENT USER AGENT</div>
                                  <div className="tile-val" title={meta.userAgent || "N/A"}>
                                    {parseUserAgent(meta.userAgent)}
                                  </div>
                                </div>
                              </div>

                              <div className="audit-meta-tile">
                                <div className="tile-icon">
                                  <FontAwesomeIcon icon={faCode} />
                                </div>
                                <div className="tile-content">
                                  <div className="tile-label">EXECUTION CONTEXT</div>
                                  <div className="tile-val">
                                    {meta.verdict
                                      ? `Verdict: ${meta.verdict} (${meta.language || "Code"})`
                                      : meta.statusCode
                                      ? `HTTP Status: ${meta.statusCode}`
                                      : meta.roomId
                                      ? `Room: ${meta.roomId}`
                                      : entry.category}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Specific Highlights: Errors / Submissions / Battles */}
                            {meta.error && (
                              <div className="audit-error-callout">
                                <FontAwesomeIcon icon={faCircleExclamation} />
                                <div>
                                  <strong>Operational Error:</strong> {String(meta.error)}
                                </div>
                              </div>
                            )}

                            {/* Raw Payload Collapsible Bar */}
                            {meta && Object.keys(meta).length > 0 && (
                              <div className="payload-inspect-section">
                                <div
                                  className="payload-toggle-row"
                                  onClick={(e) => toggleRawJson(entry.id, e)}
                                >
                                  <span className="payload-heading">
                                    {showRawJsonMap[entry.id] ? "▾ HIDE RAW JSON PAYLOAD" : "▸ VIEW RAW JSON PAYLOAD"}
                                  </span>
                                  <span className="payload-byte-info">
                                    {Object.keys(meta).length} properties
                                  </span>
                                </div>

                                {showRawJsonMap[entry.id] && (
                                  <pre className="payload-json">
                                    {JSON.stringify(meta, null, 2)}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
