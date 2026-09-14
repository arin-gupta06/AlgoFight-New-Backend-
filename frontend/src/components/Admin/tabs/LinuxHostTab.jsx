import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDesktop,
  faRotate,
  faArrowUpRightFromSquare
} from "@fortawesome/free-solid-svg-icons";

export default function LinuxHostTab({
  linuxStatus = "CHECKING",
  checkLinuxStatus,
  linuxTelemetryUrl = "http://localhost:8000/dashboard",
}) {
  return (
    <div className="admin-linux-telemetry-wrapper">
      {/* Toolbar */}
      <div className="linux-toolbar glass-panel">
        <div className="toolbar-info">
          <h4>Linux Host Telemetry & Stress Server</h4>
          <span className="target-pill">Target: {linuxTelemetryUrl}</span>
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
        <div className="linux-iframe-container glass-panel">
          <iframe
            src={linuxTelemetryUrl}
            title="AlgoFight Linux Host Telemetry Dashboard"
            className="linux-telemetry-iframe"
          />
        </div>
      ) : (
        <div className="linux-offline-guide-card glass-panel">
          <div className="guide-icon">
            <FontAwesomeIcon icon={faDesktop} />
          </div>
          <h3>WSL Linux Telemetry Service is Offline</h3>
          <p>
            The dedicated FastAPI Telemetry and Evaluation Service (<code>AlgoFight_Linux</code>) is not running on <code>http://localhost:8000</code>.
          </p>

          <div className="guide-command-box">
            <span className="command-label">To launch inside WSL Ubuntu terminal, run:</span>
            <pre>
              <code>wsl -d Ubuntu -e bash -c "cd /home/arin/AlgoFight_Linux && python3 run_server.py"</code>
            </pre>
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
  );
}
