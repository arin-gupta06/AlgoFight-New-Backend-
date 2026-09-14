import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShieldHalved,
  faGlobe,
  faCheck,
  faMagnifyingGlass,
  faRotate
} from "@fortawesome/free-solid-svg-icons";

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
  copiedIp,
}) {
  return (
    <div className="admin-audit-section">
      {/* Header Panel */}
      <div className="audit-header-panel glass-panel">
        <div className="audit-title-wrap">
          <div className="pre-heading">SECURITY TELEMETRY & EVENT STREAM</div>
          <h3>
            <FontAwesomeIcon icon={faShieldHalved} /> Platform Event Audit Trail & Telemetry
          </h3>
          <p>Real-time chronological telemetry logs across authentication, battles, submissions, and fleet orchestration.</p>
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
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => fetchAuditLogs()}
            disabled={auditLoading}
          >
            <FontAwesomeIcon icon={faRotate} className={auditLoading ? "fa-spin" : ""} />{" "}
            {auditLoading ? "Refreshing..." : "Refresh Audit"}
          </button>
        </div>
      </div>

      {/* Filter Pills Bar */}
      <div className="audit-filters-bar glass-panel">
        <div className="filter-group">
          <span className="filter-group-label">Category:</span>
          {[
            "ALL",
            "PAGE_VIEW",
            "HTTP_TRAFFIC",
            "AUTH",
            "SECURITY",
            "SUBMISSION",
            "BATTLE",
            "ADMIN",
            "FLEET",
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
          {["ALL", "GET", "POST", "PUT", "DELETE", "EVENT"].map((meth) => (
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
                    onClick={() =>
                      setExpandedAuditId(expandedAuditId === entry.id ? null : entry.id)
                    }
                  >
                    <td className="audit-time-cell">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      <span
                        className={`method-badge meth-${(entry.method || "EVENT").toLowerCase()}`}
                      >
                        {entry.method || "EVENT"}
                      </span>
                    </td>
                    <td className="audit-ip-cell">
                      <span
                        className={`ip-chip ${
                          entry.ip === "127.0.0.1" ? "ip-local" : "ip-remote"
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
                            <span>
                              Client IP Origin: <strong>{entry.ip || "127.0.0.1"}</strong>
                            </span>
                            <span>
                              HTTP Method: <strong>{entry.method || "EVENT"}</strong>
                            </span>
                            <button
                              type="button"
                              className="filter-by-ip-btn"
                              onClick={(e) => handleFilterByIp(entry.ip || "127.0.0.1", e)}
                            >
                              <FontAwesomeIcon icon={faMagnifyingGlass} /> Filter Events for this IP
                            </button>
                          </div>
                          {entry.metadata && (
                            <>
                              <strong className="payload-heading">Metadata Payload:</strong>
                              <pre className="payload-json">
                                {JSON.stringify(entry.metadata, null, 2)}
                              </pre>
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
  );
}
