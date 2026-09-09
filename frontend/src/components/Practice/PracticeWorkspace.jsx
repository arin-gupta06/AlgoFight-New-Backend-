import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCode,
  faFlask,
  faForward,
  faChartBar,
  faChevronRight,
  faChevronLeft,
  faShieldHalved,
  faExpand,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";
import { evaluatePracticeCode, fetchProblemById, recordPracticeProgress } from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useAntiCheat } from "../../hooks/useAntiCheat";
import ProblemStatement from "../Common/problem/ProblemStatement.jsx";
import DetailedAnalysisModal from "../Common/modals/DetailedAnalysisModal.jsx";
import {
  SUPPORTED_LANGUAGES,
  getStarterCodeForLanguage,
  getLanguageLabel,
} from "../../constants/languages";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import "../Battle/LiveBattle.css";

export default function PracticeWorkspace() {
  const navigate = useNavigate();
  const { problemId } = useParams();
  const { notify } = useNotification();
  const { user } = useAuth();

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [isSubmitPanelOpen, setIsSubmitPanelOpen] = useState(true);

  // Fullscreen Mode State
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // Panel Resizing State
  const gridRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(30); // % for Question panel
  const [rightWidth, setRightWidth] = useState(26); // % for Submit panel
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  const handleMouseDownLeft = (e) => {
    e.preventDefault();
    setIsDraggingLeft(true);
  };

  const handleMouseDownRight = (e) => {
    e.preventDefault();
    setIsDraggingRight(true);
  };

  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight) return;

    const handleMouseMove = (e) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();

      if (isDraggingLeft) {
        const offsetX = e.clientX - rect.left;
        let newPercent = (offsetX / rect.width) * 100;
        if (newPercent < 15) newPercent = 15;
        if (newPercent > 55) newPercent = 55;
        setLeftWidth(newPercent);
      } else if (isDraggingRight) {
        const offsetX = rect.right - e.clientX;
        let newPercent = (offsetX / rect.width) * 100;
        if (newPercent < 15) newPercent = 15;
        if (newPercent > 45) newPercent = 45;
        setRightWidth(newPercent);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  // Anti-Cheat Hook
  const { isBlurred, violations } = useAntiCheat(true);

  useEffect(() => {
    if (violations >= 3) {
      notify({
        type: "error",
        title: "Disqualified / Exited",
        message: "You have exceeded the maximum anti-cheat violations (3/3). Exiting to problems list.",
        duration: 5000,
      });
      setTimeout(() => {
        navigate("/practice");
      }, 2500);
    }
  }, [violations, navigate, notify]);

  const sampleCases = useMemo(
    () => (Array.isArray(problem?.testCases) ? problem.testCases.slice(0, 2) : []),
    [problem]
  );

  useEffect(() => {
    const timer = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    let active = true;

    const loadProblem = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const data = await fetchProblemById(problemId);
        if (!active) return;

        setProblem(data);
        setCode(getStarterCodeForLanguage(data, "javascript"));
      } catch (error) {
        if (!active) return;
        const message = error?.message || "Unable to load the practice problem.";
        setLoadError(message);
        notify({
          type: "error",
          title: "Problem Load Failed",
          message,
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProblem();

    return () => {
      active = false;
    };
  }, [notify, problemId]);

  useEffect(() => {
    if (!problem) return;
    setCode(getStarterCodeForLanguage(problem, selectedLanguage));
    setOutput("");
    setLastResult(null);
  }, [problem, selectedLanguage]);

  const evaluateCode = async (mode) => {
    if (!problem || !code.trim()) return;

    setRunning(true);
    setRunMode(mode);
    const langLabel = getLanguageLabel(selectedLanguage);
    setOutput(
      mode === "test"
        ? `Testing ${langLabel} against sample cases...`
        : `Submitting ${langLabel} to balanced practice suite...`
    );

    const slowNotificationTimer = setTimeout(() => {
      notify({
        type: "info",
        title: "Evaluating...",
        message: "The platform is taking a little longer to get the result. Please hold on!",
        autoClose: 5000,
      });
    }, 5000);

    try {
      const result = await evaluatePracticeCode({
        problemId,
        code,
        language: selectedLanguage,
        mode,
      });

      const passed = Boolean(result?.passed);

      setLastResult(result);
      setOutput(
        mode === "submit"
          ? `${result?.output || "Submission finished."}\n\nPractice submit uses a balanced suite: sample + limited hidden/edge checks.`
          : result?.output || "Test run completed."
      );

      if (mode === "submit") {
        setSubmissionCount((prev) => prev + 1);

        try {
          if (user?.uid) {
            const progressResult = await recordPracticeProgress({
              uid: user.uid,
              problemId,
              passed,
            });

            const backendSubmissionCount = Number(progressResult?.progress?.practiceSubmissionCount);
            if (Number.isFinite(backendSubmissionCount)) {
              setSubmissionCount(backendSubmissionCount);
            }

            if (passed && progressResult?.newlySolved) {
              notify({
                type: "success",
                title: "Problem Counted",
                message: "Solved practice problem added to your profile progress.",
                duration: 2300,
              });
            } else if (passed) {
              notify({
                type: "info",
                title: "Already Counted",
                message: "This problem was already counted in your practice progress.",
                duration: 2300,
              });
            }
          }
        } catch {
          notify({
            type: "warning",
            title: "Progress Not Synced",
            message: "Code was evaluated, but profile progress could not be updated right now.",
          });
        }
      } else if (passed) {
        notify({
          type: "success",
          title: "Sample Tests Passed",
          message: `Passed ${result?.passedTestCases ?? 0}/${result?.totalTestCases ?? 0} test case(s).`,
          duration: 2200,
        });
      } else {
        notify({
          type: "error",
          title: "Execution Failed",
          message: `Passed ${result?.passedTestCases ?? 0}/${result?.totalTestCases ?? 0} test case(s).`,
          duration: 2200,
        });
      }
    } catch (error) {
      setOutput(`Runtime Error: ${error?.message || "Unable to execute code."}`);
      notify({
        type: "error",
        title: "Execution Failed",
        message: error?.message || "Unable to execute your code.",
      });
    } finally {
      clearTimeout(slowNotificationTimer);
      setRunning(false);
      setRunMode("idle");
    }
  };

  if (loading) {
    return (
      <BackgroundPaths>
        <div className="livebattle-page">
          <section className="livebattle-header-card">
            <div className="livebattle-header-left">
              <div className="livebattle-room-info">
                <div className="hero-badge">
                  <span className="badge-pulse-dot" />
                  <span>PRACTICE MODE</span>
                </div>
                <h1 className="livebattle-hero-title">Practice Workspace</h1>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.82rem" }}>Loading selected problem and preparing workspace...</p>
              </div>
            </div>

            <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>
              Back to Problems
            </button>
          </section>

          <section className="livebattle-wait-panel">
            <div className="livebattle-loader">Preparing workspace...</div>
          </section>
        </div>
        <Footer />
      </BackgroundPaths>
    );
  }

  if (loadError) {
    return (
      <BackgroundPaths>
        <div className="livebattle-page">
          <section className="livebattle-header-card">
            <div className="livebattle-header-left">
              <div className="livebattle-room-info">
                <div className="hero-badge">
                  <span className="badge-pulse-dot" />
                  <span>PRACTICE MODE</span>
                </div>
                <h1 className="livebattle-hero-title">Practice Workspace</h1>
                <p style={{ margin: 0, color: "#ff6b6b", fontSize: "0.82rem" }}>{loadError}</p>
              </div>
            </div>

            <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>
              Back to Problems
            </button>
          </section>
        </div>
        <Footer />
      </BackgroundPaths>
    );
  }

  return (
    <BackgroundPaths>
      <div className={`livebattle-page ${isFullscreen ? "is-fullscreen-mode" : ""}`}>
        {/* Standalone Full-Screen Detailed Analysis Portal Modal */}
        <DetailedAnalysisModal
          isOpen={showDetailedAnalysis}
          onClose={() => setShowDetailedAnalysis(false)}
          result={lastResult}
          problem={problem}
        />

        <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="livebattle-header-card">
          <div className="livebattle-header-left">
            <div className="livebattle-room-info">
              <div className="hero-badge">
                <span className="badge-pulse-dot" />
                <span>PRACTICE MODE</span>
              </div>
              <h1 className="livebattle-hero-title">
                {problem?.title || "Practice Problem"}
              </h1>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.82rem" }}>
                Solve, test, and submit in practice mode.
              </p>
            </div>
          </div>

          <div className="livebattle-header-right">
            <button
              className="livebattle-fullscreen-btn"
              onClick={toggleFullScreen}
              title={isFullscreen ? "Exit Fullscreen" : "Full Screen Mode"}
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
            </button>

            <div
              className="livebattle-timer calm-timer"
              aria-label={`Elapsed time: ${formatTime(elapsedTime)}`}
              title="Elapsed time"
            >
              <FontAwesomeIcon icon={faClock} className="timer-icon" />
              <span className="timer-digits">{formatTime(elapsedTime)}</span>
            </div>

            <span className="livebattle-status active">Practice Mode</span>

            <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>
              Back to Problems
            </button>
          </div>
        </motion.section>

        <div
          ref={gridRef}
          className={`livebattle-grid ${!isSubmitPanelOpen ? "submit-panel-collapsed" : ""} ${isDraggingLeft || isDraggingRight ? "is-resizing" : ""}`}
        >
          {/* PROBLEM PANEL */}
          <section
            className="livebattle-panel livebattle-problem-panel"
            style={{ flex: `0 0 ${leftWidth}%`, minWidth: "220px", maxWidth: "55%" }}
          >
            <div className="livebattle-panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FontAwesomeIcon icon={faCode} style={{ color: "#00e5ff", fontSize: "0.9rem" }} />
                <h3>Problem</h3>
              </div>
              <div className="livebattle-problem-meta">
                <span>{problem?.difficulty || "Mixed"}</span>
              </div>
            </div>

            <div className="livebattle-problem-scroll">
              <ProblemStatement problem={problem} />
            </div>
          </section>

          {/* LEFT RESIZE HANDLE */}
          <div
            className={`livebattle-resize-handle ${isDraggingLeft ? "active" : ""}`}
            onMouseDown={handleMouseDownLeft}
            title="Drag to resize Question & Solution panels"
          >
            <div className="resize-handle-bar" />
          </div>

          {/* SOLUTION PANEL */}
          <section
            className="livebattle-panel livebattle-editor-panel"
            style={{ flex: "1 1 0%", minWidth: "240px", position: "relative" }}
          >
            <div className="livebattle-panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FontAwesomeIcon icon={faCode} style={{ color: "#00e5ff", fontSize: "0.9rem" }} />
                <h3>Solution</h3>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <select
                  className="livebattle-language-select"
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  disabled={running}
                >
                  {SUPPORTED_LANGUAGES.map((languageOption) => (
                    <option key={languageOption.value} value={languageOption.value}>
                      {languageOption.label}
                    </option>
                  ))}
                </select>
                {!isSubmitPanelOpen && (
                  <button
                    className="livebattle-action-btn"
                    onClick={() => setIsSubmitPanelOpen(true)}
                    style={{ padding: "4px 10px", minHeight: "30px", marginLeft: "4px" }}
                    title="Open Submit Panel"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                )}
              </div>
            </div>

            <div className="code-editor-wrapper">
              <textarea
                className="livebattle-code-editor"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                spellCheck="false"
                style={{
                  filter: isBlurred ? "blur(8px)" : "none",
                  transition: "filter 0.3s ease",
                }}
              />
              <div className="code-editor-statusbar">
                <span>{code ? code.split("\n").length : 0} Lines</span>
                <span>{code ? code.length : 0} Chars</span>
                <span className="syntax-badge">{getLanguageLabel(selectedLanguage)}</span>
              </div>
            </div>

            {isBlurred && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(10, 16, 26, 0.92)",
                  border: "1px solid rgba(255, 77, 77, 0.4)",
                  boxShadow: "0 0 25px rgba(255, 77, 77, 0.2)",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  color: "#ff6699",
                  fontWeight: "700",
                  fontSize: "0.92rem",
                  textAlign: "center",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: "1.6rem", color: "#ff4d4d" }} />
                <div>Return to this window to continue coding!</div>
                <span style={{ fontSize: "0.75rem", color: "#8092ae", fontWeight: "normal" }}>
                  Anti-Cheat tab-lock is active.
                </span>
              </div>
            )}
          </section>

          {/* RIGHT RESIZE HANDLE & SUBMIT PANEL */}
          {isSubmitPanelOpen && (
            <>
              <div
                className={`livebattle-resize-handle ${isDraggingRight ? "active" : ""}`}
                onMouseDown={handleMouseDownRight}
                title="Drag to resize Solution & Submit panels"
              >
                <div className="resize-handle-bar" />
              </div>

              <section
                className="livebattle-panel livebattle-submit-panel"
                style={{ flex: `0 0 ${rightWidth}%`, minWidth: "220px", maxWidth: "45%" }}
              >
                <div className="livebattle-panel-head">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FontAwesomeIcon icon={faFlask} style={{ color: "#ff2a7a", fontSize: "0.9rem" }} />
                    <h3>Submit Solution</h3>
                  </div>
                  <button
                    className="livebattle-action-btn"
                    onClick={() => setIsSubmitPanelOpen(false)}
                    style={{ padding: "4px 10px", minHeight: "30px" }}
                    title="Hide Submit Panel"
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>

                <div className="livebattle-submit-body">
                  <div className="livebattle-actions-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      className="livebattle-action-btn test-btn"
                      onClick={() => evaluateCode("test")}
                      disabled={running}
                    >
                      <FontAwesomeIcon icon={faFlask} />
                      {running && runMode === "test" ? "Testing..." : "Test (Sample)"}
                    </button>

                    <button
                      className="livebattle-action-btn submit-btn"
                      onClick={() => evaluateCode("submit")}
                      disabled={running}
                    >
                      <FontAwesomeIcon icon={faForward} />
                      {running && runMode === "submit" ? "Submitting..." : "Submit (Balanced)"}
                    </button>
                  </div>

                  {/* Detailed Analysis Button */}
                  <div style={{ marginTop: "10px" }}>
                    <button
                      className="livebattle-action-btn detail-btn"
                      style={{
                        width: "100%",
                        background: lastResult ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 255, 255, 0.04)",
                        color: lastResult ? "#00e5ff" : "#64748b",
                        border: lastResult ? "1px solid rgba(0, 229, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontWeight: "700",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        padding: "10px",
                        borderRadius: "8px",
                        cursor: lastResult ? "pointer" : "not-allowed",
                        transition: "all 0.2s ease",
                      }}
                      onClick={() => setShowDetailedAnalysis(true)}
                      disabled={!lastResult || running}
                    >
                      <FontAwesomeIcon icon={faChartBar} />
                      Detailed Analysis
                    </button>
                  </div>

                  {lastResult ? (
                    <div className="livebattle-result-meta" style={{ marginTop: "12px" }}>
                      <div>
                        <span>Verdict</span>
                        <strong className={lastResult.passed ? "pass" : "fail"}>{lastResult.passed ? "Passed" : "Failed"}</strong>
                      </div>
                      <div>
                        <span>Tests</span>
                        <strong>
                          {lastResult.passedTestCases ?? 0}/{lastResult.totalTestCases ?? 0}
                        </strong>
                      </div>
                      <div>
                        <span>Time</span>
                        <strong>{lastResult.executionTime ?? 0} ms</strong>
                      </div>
                    </div>
                  ) : null}

                  {submissionCount > 0 ? (
                    <div className="livebattle-submission-meta">
                      <FontAwesomeIcon icon={faClock} />
                      <span>Submission Attempts: {submissionCount}</span>
                    </div>
                  ) : null}

                  <div className="livebattle-output-box" style={{ marginTop: "12px" }}>
                    <div className="console-bar">
                      <div className="console-dots">
                        <span className="dot dot-red" />
                        <span className="dot dot-yellow" />
                        <span className="dot dot-green" />
                      </div>
                      <span className="console-title">Console Output</span>
                    </div>
                    <div className="console-content" style={{ padding: "14px", flex: 1, overflowY: "auto" }}>
                      {running ? (
                        <div className="livebattle-loader livebattle-inline-loader">
                          {runMode === "test" ? "Testing against sample cases..." : "Evaluating against balanced test suite..."}
                        </div>
                      ) : (
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'Fira Code', monospace", fontSize: "0.83rem", color: "#d1d5db" }}>
                          {output || "Output will appear here."}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <Footer />
    </BackgroundPaths>
  );
}