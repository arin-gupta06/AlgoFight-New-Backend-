import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartColumn,
  faChartLine,
  faGlobe,
  faLayerGroup,
  faUser,
  faCheck,
  faMagnifyingGlass,
  faRotate
} from "@fortawesome/free-solid-svg-icons";

export default function AnalyticsTab({
  analyticsData,
  isAnalyticsLoading,
  fetchAnalytics,
  handleCopyIp,
  handleFilterByIp,
  copiedIp,
}) {
  return (
    <div className="admin-analytics-section">
      {/* Analytics Header Panel */}
      <div className="analytics-header-panel glass-panel">
        <div className="analytics-title-wrap">
          <div className="pre-heading">REAL-TIME TRAFFIC & USER BEHAVIOR INTELLIGENCE</div>
          <h3>
            <FontAwesomeIcon icon={faChartColumn} /> Live Platform Surfing & Traffic Analytics
          </h3>
          <p>Real-time active users, route hit volume, dwell times, and origin IP telemetry.</p>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={fetchAnalytics}
          disabled={isAnalyticsLoading}
        >
          <FontAwesomeIcon icon={faRotate} className={isAnalyticsLoading ? "fa-spin" : ""} />{" "}
          Refresh Analytics
        </button>
      </div>

      {/* Summary Scorecards */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card glass-panel">
          <span className="kpi-tag-label">SURFING NOW</span>
          <div className="kpi-big-num cyan">{analyticsData?.activeSurfersNow ?? 0}</div>
          <span className="kpi-footnote">Active clients in rolling 5m window</span>
        </div>
        <div className="analytics-kpi-card glass-panel">
          <span className="kpi-tag-label">TOTAL REQUESTS (24H)</span>
          <div className="kpi-big-num green">{analyticsData?.totalRequests24h ?? 0}</div>
          <span className="kpi-footnote">Aggregated API & gateway hits</span>
        </div>
        <div className="analytics-kpi-card glass-panel">
          <span className="kpi-tag-label">UNIQUE CLIENT IPS</span>
          <div className="kpi-big-num purple">{analyticsData?.uniqueIps24h ?? 0}</div>
          <span className="kpi-footnote">Unique origins accessing endpoints</span>
        </div>
        <div className="analytics-kpi-card glass-panel">
          <span className="kpi-tag-label">AVG ROUTE DWELL</span>
          <div className="kpi-big-num gold">{analyticsData?.avgDwellTimeSec ?? 48}s</div>
          <span className="kpi-footnote">Session focus engagement duration</span>
        </div>
      </div>

      {/* 2-Column Deck: Top Routes vs 24h Timeline Chart */}
      <div className="analytics-split-layout">
        {/* Column 1: Top Visited Routes */}
        <div className="telemetry-card glass-panel top-routes-card">
          <div className="card-header">
            <div>
              <h3>Top Platform Routes Visited</h3>
              <span className="telemetry-subtext">Highest traffic endpoints & views</span>
            </div>
            <span className="telemetry-tag tag-cyan">PAGE POPULARITY</span>
          </div>

          <div className="top-routes-list">
            {(analyticsData?.topRoutes || []).map((r, i) => (
              <div key={r.path || i} className="route-stat-item">
                <div className="route-item-head">
                  <span className="route-rank">#{i + 1}</span>
                  <code className="route-path">{r.path}</code>
                  <span className="route-hits">{r.hits} hits</span>
                </div>
                <div className="route-progress-track">
                  <div
                    className="route-progress-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        (r.hits / Math.max(1, analyticsData?.totalRequests24h || 1)) * 100 * 3
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: 24h Traffic Timeline Chart + Method Breakdown */}
        <div className="analytics-right-col">
          {/* SVG Traffic Timeline Chart */}
          <div className="telemetry-card glass-panel timeline-card">
            <div className="card-header">
              <div>
                <h3>
                  <FontAwesomeIcon icon={faChartLine} /> 24-Hour Surfing & Traffic Timeline
                </h3>
                <span className="telemetry-subtext">Hourly distribution of requests</span>
              </div>
              <span className="telemetry-tag tag-cyan">HOURLY TREND</span>
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

                {/* Grid lines */}
                <line x1="20" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.15)" />

                {(() => {
                  const timeline = analyticsData?.hourlyTimeline || [];
                  if (timeline.length === 0) return null;
                  const maxHits = Math.max(1, ...timeline.map((t) => t.hits));
                  const points = timeline.map((t, i) => {
                    const x = 30 + i * (460 / Math.max(1, timeline.length - 1));
                    const y = 140 - (t.hits / maxHits) * 110;
                    return { x, y, hit: t.hits, hour: t.hour, users: t.activeUsers };
                  });

                  const pathD = points.reduce(
                    (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
                    ""
                  );
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

              <div className="chart-x-labels">
                {(analyticsData?.hourlyTimeline || [])
                  .filter((_, i) => i % 2 === 0)
                  .map((t) => (
                    <span key={t.hour} className="x-label">
                      {t.hour}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* HTTP Method Breakdown */}
          <div className="telemetry-card glass-panel method-breakdown-card">
            <div className="card-header">
              <div>
                <h3>
                  <FontAwesomeIcon icon={faLayerGroup} /> HTTP Method Breakdown
                </h3>
                <span className="telemetry-subtext">Mutations vs static query distribution</span>
              </div>
              <span className="telemetry-tag tag-cyan">VERB RATIO</span>
            </div>

            {(() => {
              const mb = analyticsData?.methodBreakdown || { GET: 1, POST: 1 };
              const total = Object.values(mb).reduce((a, b) => a + b, 0) || 1;
              const getPct = (((mb.GET || 0) / total) * 100).toFixed(1);
              const postPct = (((mb.POST || 0) / total) * 100).toFixed(1);
              const putPct = (((mb.PUT || 0) / total) * 100).toFixed(1);
              const delPct = (((mb.DELETE || 0) / total) * 100).toFixed(1);

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
      <div className="admin-section" style={{ marginTop: "24px" }}>
        <div className="telemetry-card glass-panel ip-origins-card">
          <div className="card-header">
            <div>
              <h3>
                <FontAwesomeIcon icon={faGlobe} /> Client Origin IP Distribution
              </h3>
              <span className="telemetry-subtext">
                Active remote IP addresses surfing managed nodes, dominant method & latest route
              </span>
            </div>
            <span className="telemetry-tag tag-cyan">ORIGIN TELEMETRY</span>
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
                        {copiedIp === rec.ip && (
                          <span className="copied-tag">
                            <FontAwesomeIcon icon={faCheck} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <strong className="cyan-text">{rec.totalRequests}</strong> hits
                    </td>
                    <td>
                      <span className={`method-badge meth-${rec.primaryMethod.toLowerCase()}`}>
                        {rec.primaryMethod}
                      </span>
                    </td>
                    <td>
                      <code>{rec.topPath}</code>
                    </td>
                    <td>{rec.lastSeen}</td>
                    <td>
                      {rec.username ? (
                        <strong className="green-text">
                          <FontAwesomeIcon icon={faUser} /> {rec.username}
                        </strong>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Guest Visitor</span>
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
  );
}
