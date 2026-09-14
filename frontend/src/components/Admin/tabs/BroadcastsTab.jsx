import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBullhorn,
  faStar,
  faRotate,
  faPaperPlane,
  faEye,
  faEyeSlash,
  faFileCode,
  faMinus
} from "@fortawesome/free-solid-svg-icons";
import SystemBroadcastCard from "../../Common/broadcasts/SystemBroadcastCard.jsx";

export default function BroadcastsTab({
  broadcastForm,
  setBroadcastForm,
  includeMediaOrAction,
  setIncludeMediaOrAction,
  showPreview,
  setShowPreview,
  isDispatching,
  handleDispatchBroadcast,
  handleApplyPreset,
  handleMediaFileUpload,
  adminBroadcasts = [],
  fetchBroadcasts,
  handleRevokeBroadcast,
  formatRemaining,
}) {
  return (
    <div className="page-view-stack">
      <div className="admin-section broadcast-dispatcher-section">
        <div className="dispatcher-header">
          <div>
            <h3 className="section-title">
              <FontAwesomeIcon icon={faBullhorn} className="section-icon" />
              Global System Broadcast Dispatcher
            </h3>
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
              <FontAwesomeIcon icon={faStar} /> Alpha Testing (10 Sep 2026)
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

        <form className="broadcast-composer-form" onSubmit={handleDispatchBroadcast}>
          {/* Step 1: Announcement Message */}
          <div className="composer-card glass-panel">
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
                    onChange={(e) =>
                      setBroadcastForm({ ...broadcastForm, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Category / Type *</label>
                  <select
                    value={broadcastForm.type}
                    onChange={(e) =>
                      setBroadcastForm({ ...broadcastForm, type: e.target.value })
                    }
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
                  onChange={(e) =>
                    setBroadcastForm({ ...broadcastForm, message: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          </div>

          {/* Step 2: Schedule & Display Configuration */}
          <div className="composer-card glass-panel">
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
                    onChange={(e) =>
                      setBroadcastForm({ ...broadcastForm, expiryDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Time (24h) *</label>
                  <input
                    type="time"
                    value={broadcastForm.expiryTime}
                    onChange={(e) =>
                      setBroadcastForm({ ...broadcastForm, expiryTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Flash Top Banner</label>
                  <div className="toggle-btn-wrap">
                    <button
                      type="button"
                      className={`toggle-option-btn ${broadcastForm.flashBanner ? "active" : ""}`}
                      onClick={() =>
                        setBroadcastForm({ ...broadcastForm, flashBanner: true })
                      }
                    >
                      Enabled
                    </button>
                    <button
                      type="button"
                      className={`toggle-option-btn ${!broadcastForm.flashBanner ? "active" : ""}`}
                      onClick={() =>
                        setBroadcastForm({ ...broadcastForm, flashBanner: false })
                      }
                    >
                      Disabled
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Optional Media Attachment & Action CTA */}
          <div className="composer-card glass-panel">
            <div className="composer-card-header">
              <span className="card-step-badge">03</span>
              <h4>Optional Media Attachment & Call-to-Action</h4>
              <div className="step-toggle-inline">
                <label className="cyber-toggle-control" htmlFor="include-media-toggle">
                  <input
                    id="include-media-toggle"
                    type="checkbox"
                    checked={includeMediaOrAction}
                    onChange={(e) => setIncludeMediaOrAction(e.target.checked)}
                  />
                  <span className="cyber-toggle-track">
                    <span className="cyber-toggle-thumb" />
                  </span>
                  <span className="cyber-toggle-label">Include Media / Action Button</span>
                </label>
              </div>
            </div>

            {includeMediaOrAction && (
              <div className="composer-card-body">
                <div className="composer-row-2">
                  <div className="form-group flex-1">
                    <label>Attachment Type</label>
                    <select
                      value={broadcastForm.contentType}
                      onChange={(e) =>
                        setBroadcastForm({ ...broadcastForm, contentType: e.target.value })
                      }
                    >
                      <option value="NONE">None</option>
                      <option value="DOCUMENT">Document / PDF</option>
                      <option value="IMAGE">Image / Banner</option>
                      <option value="VIDEO">Video Demo</option>
                    </select>
                  </div>
                  {broadcastForm.contentType !== "NONE" && (
                    <div className="form-group flex-2">
                      <label>Upload Media File (Max 8MB)</label>
                      <input
                        type="file"
                        onChange={handleMediaFileUpload}
                        className="file-input-field"
                      />
                      {broadcastForm.contentName && (
                        <div className="file-attached-info">
                          <FontAwesomeIcon icon={faFileCode} /> {broadcastForm.contentName}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="composer-row-3" style={{ marginTop: "12px" }}>
                  <div className="form-group">
                    <label>Action CTA Type</label>
                    <select
                      value={broadcastForm.actionType}
                      onChange={(e) =>
                        setBroadcastForm({ ...broadcastForm, actionType: e.target.value })
                      }
                    >
                      <option value="NONE">No Action Button</option>
                      <option value="EXTERNAL_LINK">External URL Link</option>
                      <option value="INTERNAL_ROUTE">Internal App Route</option>
                    </select>
                  </div>
                  {broadcastForm.actionType !== "NONE" && (
                    <>
                      <div className="form-group">
                        <label>Button Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Share Feedback / Join Arena"
                          value={broadcastForm.actionLabel}
                          onChange={(e) =>
                            setBroadcastForm({ ...broadcastForm, actionLabel: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Target URL or Route</label>
                        <input
                          type="text"
                          placeholder="e.g. https://... or /battle"
                          value={broadcastForm.actionTarget}
                          onChange={(e) =>
                            setBroadcastForm({ ...broadcastForm, actionTarget: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          {showPreview && (
            <div className="broadcast-live-preview-box glass-panel">
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
                    content:
                      includeMediaOrAction &&
                      broadcastForm.contentType !== "NONE" &&
                      broadcastForm.contentUrl
                        ? {
                            type: broadcastForm.contentType,
                            url: broadcastForm.contentUrl,
                            name: broadcastForm.contentName || "Attachment",
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
                <>
                  <FontAwesomeIcon icon={faEyeSlash} /> Hide Preview
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faEye} /> Show Live Preview
                </>
              )}
            </button>
            <button
              type="submit"
              className="broadcast-dispatch-btn"
              disabled={isDispatching}
            >
              {isDispatching ? (
                <>
                  <FontAwesomeIcon icon={faRotate} spin /> Broadcasting...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPaperPlane} /> Dispatch Global Broadcast
                </>
              )}
            </button>
          </div>
        </form>

        {/* Broadcasts Registry Table */}
        <div className="active-broadcasts-management" style={{ marginTop: "24px" }}>
          <div className="active-broadcasts-header">
            <div>
              <h4>Active & Historical Broadcasts ({adminBroadcasts.length})</h4>
              <p>Review running flash announcements or immediately revoke active client messages.</p>
            </div>
            <button type="button" className="refresh-btn" onClick={fetchBroadcasts}>
              <FontAwesomeIcon icon={faRotate} /> Refresh
            </button>
          </div>

          {adminBroadcasts.length === 0 ? (
            <div className="no-broadcasts-notice glass-panel">
              No broadcasts dispatched yet.
            </div>
          ) : (
            <div className="broadcasts-table-wrapper glass-panel">
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
                          {b.content?.type && (
                            <span className="meta-chip chip-content">{b.content.type}</span>
                          )}
                          {b.action?.type && (
                            <span className="meta-chip chip-action">
                              {b.action.type === "EXTERNAL_LINK" ? "EXT LINK" : "INT ROUTE"}
                            </span>
                          )}
                          {!b.content?.type && !b.action?.type && (
                            <span className="meta-chip-none">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`flash-indicator ${
                            b.flashBanner ? "flash-on" : "flash-off"
                          }`}
                        >
                          {b.flashBanner ? "ON" : "OFF"}
                        </span>
                      </td>
                      <td className="expiry-cell">
                        {new Date(b.expiresAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
  );
}
