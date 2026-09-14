import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faGraduationCap,
  faBuildingColumns,
  faLaptop,
  faMagnifyingGlass,
  faRotate
} from "@fortawesome/free-solid-svg-icons";

export default function UsersTab({
  metrics,
  users = [],
  search = "",
  setSearch,
  handleSearch,
  fetchUsers,
}) {
  return (
    <div className="page-view-stack">
      {/* 1. User Identity & Ratio Breakdown */}
      <div className="admin-section">
        <div className="telemetry-card glass-panel">
          <div className="card-header">
            <div>
              <h3>Combatant Identity & Community Distribution</h3>
              <span className="telemetry-subtext">
                Registered profiles categorized by institution, faculty clearance, and independent coders
              </span>
            </div>
            <span className="telemetry-tag tag-cyan">
              TOTAL: {metrics?.users?.total || users.length || 0} COMBATANTS
            </span>
          </div>
          <div className="user-ratio-grid">
            <div className="ratio-box glass-panel">
              <span className="role-icon icon-cyan">
                <FontAwesomeIcon icon={faGraduationCap} />
              </span>
              <span className="role-count">{metrics?.users?.students || 0}</span>
              <span className="role-label">College Students</span>
            </div>
            <div className="ratio-box glass-panel">
              <span className="role-icon icon-purple">
                <FontAwesomeIcon icon={faBuildingColumns} />
              </span>
              <span className="role-count">{metrics?.users?.faculty || 0}</span>
              <span className="role-label">Faculty / Instructors</span>
            </div>
            <div className="ratio-box glass-panel">
              <span className="role-icon icon-green">
                <FontAwesomeIcon icon={faLaptop} />
              </span>
              <span className="role-count">{metrics?.users?.independent || 0}</span>
              <span className="role-label">Independent Coders</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Student Sub-Batches & Institutions */}
      <div className="admin-section">
        <h3 className="section-title">Top Registered Institutions & Sub-Batches</h3>
        <div className="institutions-grid">
          {metrics?.subBatches?.length > 0 ? (
            metrics.subBatches.map((inst, i) => (
              <div key={i} className="institution-card glass-panel">
                <div className="inst-badge">BATCH GROUP #{i + 1}</div>
                <div className="inst-name">{inst.institution || "Independent Affiliation"}</div>
                <div className="inst-count">
                  <span>{inst.count}</span> Enrolled Students
                </div>
              </div>
            ))
          ) : (
            <div className="no-data-notice glass-panel">
              <span>No institution batches registered yet.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. User Registry Directory & Table */}
      <div className="admin-section">
        <div className="registry-header-bar">
          <div>
            <h3 className="section-title">Combatant Directory & Authentication Registry</h3>
            <p className="section-subtitle">
              Inspect user metadata, security roles, primary emails, and battle Elo rating records.
            </p>
          </div>
          <div className="registry-actions">
            <form onSubmit={handleSearch} className="registry-search-form">
              <div className="search-input-wrap">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search username, code, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="registry-search-input"
                />
              </div>
              <button type="submit" className="search-submit-btn">
                Search
              </button>
            </form>
            <button
              type="button"
              className="refresh-btn"
              onClick={() => fetchUsers(search)}
              title="Refresh users list"
            >
              <FontAwesomeIcon icon={faRotate} />
            </button>
          </div>
        </div>

        <div className="registry-table-wrapper glass-panel">
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
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-data-cell">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="code-chip">
                        {u.platformCode || `AF-USR-${String(u.id).slice(0, 5)}`}
                      </span>
                    </td>
                    <td className="user-cell">
                      <strong>{u.username}</strong>
                    </td>
                    <td>
                      <span className={`role-badge ${String(u.userType || "individual").toLowerCase()}`}>
                        {u.userType || "INDIVIDUAL"}
                      </span>
                    </td>
                    <td>{u.institutionName || "—"}</td>
                    <td className="email-cell">{u.primaryEmail || u.email}</td>
                    <td className="rating-cell">{u.rating ?? 1200}</td>
                    <td className="record-cell">
                      <span className="win-count">{u.wins ?? 0}W</span> -{" "}
                      <span className="loss-count">{u.losses ?? 0}L</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
