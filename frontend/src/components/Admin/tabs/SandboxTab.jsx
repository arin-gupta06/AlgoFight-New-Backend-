import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCubes,
  faBolt,
  faShieldHalved,
  faLock,
  faPlus,
  faMinus,
  faRotate,
  faMagnifyingGlass
} from "@fortawesome/free-solid-svg-icons";

export default function SandboxTab({
  metrics,
  isScalingFleet,
  handleScaleFleet,
  handleRunFleetProbe,
  isProbingFleet,
}) {
  return (
    <div className="page-view-stack">
      <div className="admin-section">
        <div className="section-head-bar">
          <div>
            <h3 className="section-title">
              <FontAwesomeIcon icon={faCubes} className="section-icon" />
              Elastic Sandbox Fleet & Workload Queue Lanes
            </h3>
            <p className="section-subtitle">
              Asymmetric BullMQ dispatch (Light Concurrency 4 vs Heavy Concurrency 2) + Programmatic Dynamic Scaling.
            </p>
          </div>
          <div className="section-head-actions">
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
            <button
              type="button"
              className="fleet-action-btn scale-out-btn"
              onClick={() => handleScaleFleet("out")}
              disabled={isScalingFleet}
            >
              <FontAwesomeIcon icon={faPlus} /> Scale Out (+1)
            </button>
            <button
              type="button"
              className="fleet-action-btn scale-in-btn"
              onClick={() => handleScaleFleet("in")}
              disabled={isScalingFleet}
            >
              <FontAwesomeIcon icon={faMinus} /> Scale In (-1)
            </button>
          </div>
        </div>

        {/* Asymmetric Queue Lanes Cards */}
        <div className="sandbox-lanes-grid">
          {/* Light Lane */}
          <div className="sandbox-lane-card lane-light glass-panel">
            <div className="lane-head">
              <span className="lane-title light-title">
                <FontAwesomeIcon icon={faBolt} /> LIGHT LANE
              </span>
              <span className="lane-tag">Fast-Track Script Runner</span>
            </div>
            <div className="lane-body">
              <div>
                <div className="lane-queue-num light-num">
                  {metrics?.runtimePool?.queues?.lightLane?.depth ?? 0}
                </div>
                <div className="lane-queue-label">Jobs in Queue</div>
              </div>
              <div className="lane-meta-col">
                <div>
                  Concurrency: <strong className="light-text">4 Workers</strong>
                </div>
                <span className="lane-spec">Python / JS / TS (&lt;8KB)</span>
              </div>
            </div>
          </div>

          {/* Heavy Lane */}
          <div className="sandbox-lane-card lane-heavy glass-panel">
            <div className="lane-head">
              <span className="lane-title heavy-title">
                <FontAwesomeIcon icon={faShieldHalved} /> HEAVY LANE
              </span>
              <span className="lane-tag">Isolated Compiler Sandbox</span>
            </div>
            <div className="lane-body">
              <div>
                <div className="lane-queue-num heavy-num">
                  {metrics?.runtimePool?.queues?.heavyLane?.depth ?? 0}
                </div>
                <div className="lane-queue-label">Jobs in Queue</div>
              </div>
              <div className="lane-meta-col">
                <div>
                  Concurrency: <strong className="heavy-text">2 Workers</strong>
                </div>
                <span className="lane-spec">C++ / Java / Heavy (&gt;8KB)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Piston Fleet or Baseline Sandbox Status */}
        {metrics?.runtimePool?.activeInstances?.length > 0 ? (
          <div className="active-instances-grid">
            {metrics.runtimePool.activeInstances.map((inst, i) => (
              <div key={inst.id || i} className="instance-card glass-panel">
                <div className="instance-card-head">
                  <span className="inst-name">
                    <FontAwesomeIcon icon={faCubes} className="inst-icon" />
                    {inst.id || `piston-${i + 1}`}
                  </span>
                  <span className={`status-pill ${inst.healthy ? "online" : "offline"}`}>
                    {inst.state || (inst.healthy ? "ONLINE" : "OFFLINE")}
                  </span>
                </div>
                <div className="inst-stat-row">
                  <span>Type:</span>
                  <strong className={inst.type === "DYNAMIC_EPHEMERAL" ? "gold-text" : "cyan-text"}>
                    {inst.type === "DYNAMIC_EPHEMERAL" ? (
                      <>
                        <FontAwesomeIcon icon={faBolt} /> Dynamic Scaled
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faLock} /> Prewarmed
                      </>
                    )}
                  </strong>
                </div>
                <div className="inst-stat-row">
                  <span>Endpoint:</span>
                  <code className="inst-code">:{inst.port}</code>
                </div>
                <div className="inst-stat-row">
                  <span>Active Load:</span>
                  <strong className={(inst.activeJobs || 0) > 2 ? "gold-text" : "green-text"}>
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
                <h4>
                  <FontAwesomeIcon icon={faLock} className="green-icon" />
                  Standalone Baseline Sandbox Active
                </h4>
                <p>
                  Operating in zero-cost baseline mode. Dynamic ephemeral containers spawn
                  automatically under burst workload pressure.
                </p>
              </div>
              <span className="status-pill online">BASELINE READY</span>
            </div>
            <div className="standalone-meta-row">
              <span>
                Primary Endpoint:{" "}
                <code>{metrics?.runtimePool?.standaloneEndpoint || "http://127.0.0.1:2000"}</code>
              </span>
              <span>
                Available Runtimes:{" "}
                <strong className="cyan-text">
                  {metrics?.runtimePool?.runtimesAvailable || 15} Language Engines
                </strong>
              </span>
              <span>
                Scaling Policy: <strong className="green-text">Autonomous Idle</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
