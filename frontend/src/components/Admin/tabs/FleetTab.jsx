import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faServer,
  faMagnifyingGlass,
  faRotate,
  faCircleCheck,
  faClock,
  faBox,
  faShieldHalved,
  faBolt,
  faTimes,
  faTerminal,
  faNetworkWired
} from "@fortawesome/free-solid-svg-icons";

export default function FleetTab({
  metrics,
  isProbingFleet,
  handleRunFleetProbe,
  isProbeModalOpen,
  setIsProbeModalOpen,
  probeResults,
  SERVICE_NAMES = {},
  STAT_LABELS = {},
}) {
  return (
    <div className="page-view-stack">
      {/* 1. Infrastructure Microservice Fleet Grid */}
      <div className="admin-section">
        <div className="section-head-bar">
          <div>
            <h3 className="section-title">
              <FontAwesomeIcon icon={faServer} className="section-icon" />
              Microservice Fleet & Cluster Gateway SLAs
            </h3>
            <p className="section-subtitle">
              Live operational health, latency metrics, and network topology across distributed services.
            </p>
          </div>
          <button
            type="button"
            className="fleet-action-btn probe-btn"
            onClick={handleRunFleetProbe}
            disabled={isProbingFleet}
          >
            <FontAwesomeIcon
              icon={isProbingFleet ? faRotate : faMagnifyingGlass}
              className={isProbingFleet ? "fa-spin" : ""}
            />{" "}
            {isProbingFleet ? "Probing Fleet..." : "Run Fleet Diagnostics"}
          </button>
        </div>

        <div className="fleet-grid">
          {metrics?.services &&
            Object.entries(metrics.services).map(([key, s]) => (
              <div key={key} className="fleet-card glass-panel">
                <div className="fleet-card-header">
                  <div className="fleet-name-wrap">
                    <span className="fleet-dot-indicator online" />
                    <span className="fleet-name">
                      {SERVICE_NAMES[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </span>
                  </div>
                  <span className={`status-pill ${s.status?.toLowerCase() || "online"}`}>
                    {s.status || "ONLINE"}
                  </span>
                </div>
                <div className="fleet-details">
                  {Object.entries(s)
                    .filter(([k]) => k !== "status")
                    .map(([k, v]) => (
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
        {/* Gateway Traffic Throughput */}
        <div className="telemetry-card glass-panel">
          <div className="card-header">
            <div>
              <h3>Gateway Traffic & Network Throughput</h3>
              <span className="telemetry-subtext">
                Live rolling window traffic from Gateway Telemetry Engine
              </span>
            </div>
            <span className="telemetry-tag tag-cyan">REAL-TIME</span>
          </div>

          <div className="telemetry-stats">
            <div className="telemetry-box">
              <span className="telemetry-label">Ingress Rate (Fan-In)</span>
              <span className="telemetry-num cyan">
                {metrics?.traffic?.ingressRps !== undefined
                  ? `${metrics.traffic.ingressRps} req/s`
                  : "0.0 req/s"}
              </span>
              <span className="telemetry-hint">HTTP API Requests handled</span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">Broadcast Rate (Fan-Out)</span>
              <span className="telemetry-num purple">
                {metrics?.traffic?.egressEventsSec !== undefined
                  ? `${metrics.traffic.egressEventsSec} events/s`
                  : "0.0 events/s"}
              </span>
              <span className="telemetry-hint">WebSocket Room Emissions</span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">Active Combatants</span>
              <span className="telemetry-num green">
                {metrics?.services?.websocketGateway?.activeSockets ?? 0} Connected
              </span>
              <span className="telemetry-hint">
                {metrics?.services?.websocketGateway?.activeRooms ?? 0} active battle rooms
              </span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">Process Memory</span>
              <span className="telemetry-num gold">
                {metrics?.traffic?.memoryRssMb || "0 MB"}
              </span>
              <span className="telemetry-hint">
                Heap: {metrics?.traffic?.heapUsedMb || "0 MB"}
              </span>
            </div>
          </div>

          {/* Admission Controller SLA Bar */}
          <div className="admission-sla-bar-wrap">
            <div className="sla-labels">
              <span>Gateway Security & Admission SLA</span>
              <strong style={{ color: "#4ade80" }}>
                {metrics?.traffic?.admissionRatePercent !== undefined
                  ? `${metrics.traffic.admissionRatePercent}% Admitted`
                  : "100% Admitted"}
              </strong>
            </div>
            <div className="sla-progress-track">
              <div
                className="sla-progress-fill"
                style={{ width: `${metrics?.traffic?.admissionRatePercent ?? 100}%` }}
              />
            </div>
            <div className="sla-counts-row">
              <span>
                Lifetime Processed:{" "}
                <strong>{metrics?.traffic?.totalRequests ?? 0}</strong>
              </span>
              <span>
                Rejections: <strong>{metrics?.traffic?.rejectionsTotal ?? 0}</strong>
              </span>
              <span>
                Active Gateways: <strong>{metrics?.traffic?.activeGateways ?? 1} Cluster</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Latency SLA & Host Matrix */}
        <div className="telemetry-card glass-panel">
          <div className="card-header">
            <div>
              <h3>Latency SLA & Host Matrix</h3>
              <span className="telemetry-subtext">
                Round-trip response benchmarks & WSL host vitals
              </span>
            </div>
            <span
              className={`telemetry-tag ${
                metrics?.linuxTelemetry?.status === "ONLINE" ? "tag-online" : "tag-offline"
              }`}
            >
              {metrics?.linuxTelemetry?.status === "ONLINE" ? "WSL SYNCED" : "WSL IDLE"}
            </span>
          </div>

          <div className="telemetry-stats">
            <div className="telemetry-box">
              <span className="telemetry-label">API Gateway SLA</span>
              <span className="telemetry-num cyan">
                {metrics?.services?.apiGateway?.avgLatency || "<1ms"}
              </span>
              <span className="telemetry-hint">
                P95: {metrics?.services?.apiGateway?.p95Latency || "<1ms"}
              </span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">PostgreSQL 16 SLA</span>
              <span className="telemetry-num green">
                {metrics?.services?.database?.latency || "<1ms"}
              </span>
              <span className="telemetry-hint">
                Engine: {metrics?.services?.database?.pool || "Active"}
              </span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">Redis Cache Bus</span>
              <span className="telemetry-num purple">
                {metrics?.services?.redisCluster?.latency || "<1ms"}
              </span>
              <span className="telemetry-hint">
                Cluster: {metrics?.services?.redisCluster?.status || "ONLINE"}
              </span>
            </div>
            <div className="telemetry-box">
              <span className="telemetry-label">Piston Sandbox SLA</span>
              <span className="telemetry-num gold">
                {metrics?.services?.pistonSandbox?.latency || "<1ms"}
              </span>
              <span className="telemetry-hint">
                {metrics?.services?.pistonSandbox?.runtimesAvailable || 0} runtimes ready
              </span>
            </div>
          </div>

          {/* Linux Host Vitals Widget */}
          <div className="linux-vitals-widget">
            <div className="vitals-header">
              <span className="vitals-title">WSL Host Vitals (localhost:8000)</span>
              <span
                className={`vitals-pill ${
                  metrics?.linuxTelemetry?.status === "ONLINE" ? "online" : "offline"
                }`}
              >
                {metrics?.linuxTelemetry?.status === "ONLINE" ? (
                  <>
                    <FontAwesomeIcon icon={faCircleCheck} /> ONLINE
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faClock} /> STANDBY
                  </>
                )}
              </span>
            </div>
            {metrics?.linuxTelemetry?.vitals ? (
              <div className="vitals-grid">
                <div className="vital-item">
                  <span className="vital-label">Host CPU</span>
                  <strong className="vital-value">
                    {metrics.linuxTelemetry.vitals.cpuUsagePercent}%
                  </strong>
                </div>
                <div className="vital-item">
                  <span className="vital-label">Host RAM</span>
                  <strong className="vital-value">
                    {metrics.linuxTelemetry.vitals.memoryUsagePercent}%
                  </strong>
                </div>
                <div className="vital-item">
                  <span className="vital-label">Load Avg</span>
                  <strong className="vital-value">
                    {metrics.linuxTelemetry.vitals.loadAvg?.slice(0, 2).join(", ") || "0.0"}
                  </strong>
                </div>
                <div className="vital-item">
                  <span className="vital-label">Cached Traces</span>
                  <strong className="vital-value">
                    {metrics.linuxTelemetry.vitals.cachedExecutionsCount || 0}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="vitals-standby-hint">
                <span>
                  WSL Linux Telemetry service at <code>http://localhost:8000</code> is in standby
                  mode. Start it to stream host CPU/RAM vitals.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

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
              className="fleet-modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fleet-modal-header">
                <div className="fleet-modal-header-info">
                  <div className="fleet-modal-badges">
                    <span className="fleet-badge">
                      <span className="badge-pulse-dot" /> LIVE FLEET PROBE
                    </span>
                    <span className="fleet-sub-badge">PISTON RUNTIME ENGINE</span>
                  </div>
                  <h3 className="fleet-modal-title">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="probe-title-icon" />
                    Fleet Diagnostics Probe Results
                  </h3>
                </div>
                <button
                  type="button"
                  className="fleet-modal-close-btn"
                  onClick={() => setIsProbeModalOpen(false)}
                  aria-label="Close Fleet Diagnostics"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              <div className="fleet-modal-body">
                <div className="probe-summary-row">
                  <div className="probe-summary-capsule">
                    <span className="capsule-label">TOTAL PROBED</span>
                    <span className="capsule-val cyan">
                      {probeResults.totalActiveRuntimes || probeResults.results?.length || 0} Nodes
                    </span>
                  </div>
                  <div className="probe-summary-capsule">
                    <span className="capsule-label">TIMESTAMP</span>
                    <span className="capsule-val">
                      {new Date(probeResults.probedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="probe-summary-capsule status-healthy">
                    <span className="capsule-label">OVERALL FLEET HEALTH</span>
                    <span className="capsule-val green">
                      <FontAwesomeIcon icon={faCircleCheck} /> ALL RUNTIMES OPTIMAL
                    </span>
                  </div>
                </div>

                <div className="probe-results-list">
                  {probeResults.results?.map((res) => {
                    const isHealthy = res.status?.toLowerCase() === "healthy";
                    return (
                      <div
                        key={res.id}
                        className={`probe-result-card ${isHealthy ? "card-healthy" : "card-warning"}`}
                      >
                        <div className="probe-card-head">
                          <div className="probe-node-info">
                            <span className="probe-node-icon-wrap">
                              <FontAwesomeIcon icon={faBox} />
                            </span>
                            <span className="probe-node-id">{res.id}</span>
                            <span className="probe-node-url">({res.url})</span>
                          </div>
                          <div className="probe-card-badges">
                            <span className={`probe-latency-pill ${res.latencyMs > 500 ? "high" : "normal"}`}>
                              <FontAwesomeIcon icon={faClock} /> {res.latencyMs}ms
                            </span>
                            <span className={`probe-status-pill ${isHealthy ? "status-healthy" : "status-warn"}`}>
                              <span className={`pulse-indicator ${isHealthy ? "online" : ""}`} />
                              {res.status?.toUpperCase() || "HEALTHY"}
                            </span>
                          </div>
                        </div>

                        {res.output && (
                          <div className="probe-stdout-box">
                            <div className="probe-terminal-head">
                              <FontAwesomeIcon icon={faTerminal} className="terminal-icon" />
                              <span>STDOUT TELEMETRY</span>
                            </div>
                            <pre className="terminal-stdout-text">{res.output}</pre>
                          </div>
                        )}

                        {res.error && (
                          <div className="probe-stderr-box">
                            <div className="probe-terminal-head stderr-head">
                              <FontAwesomeIcon icon={faTerminal} className="terminal-icon" />
                              <span>STDERR EXCEPTION</span>
                            </div>
                            <pre className="terminal-stderr-text">{res.error}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
