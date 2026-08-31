import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faFlask,
  faForward,
  faChartBar,
  faTimes,
  faCheckCircle,
  faExclamationCircle,
  faBolt,
  faShieldHalved,
  faBrain,
  faChevronRight,
  faChevronLeft
} from "@fortawesome/free-solid-svg-icons";
import { evaluatePracticeCode, fetchProblemById, recordPracticeProgress } from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useAntiCheat } from "../../hooks/useAntiCheat";
import ProblemStatement from "../Common/ProblemStatement.jsx";
import DetailedAnalysisModal from "../Common/DetailedAnalysisModal.jsx";
import "../Battle/LiveBattle.css";

const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "cpp", label: "C++" },
];

const JS_FALLBACK_STARTER = [
  "function solution(input) {",
  "  // TODO: implement solution",
  "  return input;",
  "}",
].join("\n");

const CPP_FALLBACK_STARTER = [
  "#include <bits/stdc++.h>",
  "using namespace std;",
  "",
  "int main() {",
  "    // TODO: implement solution",
  "    return 0;",
  "}",
].join("\n");

function getStarterCodeForLanguage(problem, language) {
  const starterCodeByLanguage =
    problem && typeof problem.starterCode === "object" ? problem.starterCode : {};

  const rawStarter =
    starterCodeByLanguage?.[language] ||
    (language === "cpp" ? CPP_FALLBACK_STARTER : JS_FALLBACK_STARTER);

  const normalizedStarter = String(rawStarter || "");
  if (language !== "javascript") {
    return normalizedStarter;
  }

  return normalizedStarter.replace(
    /\n?\s*module\.exports\s*=\s*\{?\s*solution\s*\}?\s*;?\s*$/m,
    ""
  );
}

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
    setOutput(
      mode === "test"
        ? `Testing ${selectedLanguage === "cpp" ? "C++" : "JavaScript"} against sample cases...`
        : `Submitting ${selectedLanguage === "cpp" ? "C++" : "JavaScript"} to balanced practice suite...`
    );

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
      setRunning(false);
      setRunMode("idle");
    }
  };

  if (loading) {
    return (
      <div className="livebattle-page">
        <section className="livebattle-header-card">
          <div className="livebattle-header-copy">
            <div className="livebattle-pre">PRACTICE</div>
            <h1>Practice</h1>
            <p>Loading selected problem and preparing workspace...</p>
          </div>

          <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>Back to Problems</button>
        </section>

        <section className="livebattle-wait-panel">
          <div className="livebattle-loader">Preparing workspace...</div>
        </section>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="livebattle-page">
        <section className="livebattle-header-card">
          <div className="livebattle-header-copy">
            <div className="livebattle-pre">PRACTICE</div>
            <h1>Practice</h1>
            <p>{loadError}</p>
          </div>

          <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>Back to Problems</button>
        </section>
      </div>
    );
  }

  // Simulated per-test breakdowns based on overall result
  const totalTestsCount = lastResult?.totalTestCases || 3;
  const passedTestsCount = lastResult?.passedTestCases || (lastResult?.passed ? totalTestsCount : Math.max(0, totalTestsCount - 1));
  const avgTime = lastResult?.executionTime ? (lastResult.executionTime / totalTestsCount).toFixed(1) : "12.4";

  return (
    <div className="livebattle-page">
      {/* Standalone Full-Screen Detailed Analysis Portal Modal */}
      <DetailedAnalysisModal
        isOpen={showDetailedAnalysis}
        onClose={() => setShowDetailedAnalysis(false)}
        result={lastResult}
        problem={problem}
      />

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="livebattle-header-card">
        <div className="livebattle-header-copy">
          <div className="livebattle-pre">PRACTICE</div>
          <h1>Practice</h1>
          <p>
            {problem?.title || "Selected Problem"} • Solve, test, and submit in practice mode.
          </p>
        </div>

        <div className="livebattle-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="livebattle-timer flashing" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FontAwesomeIcon icon={faClock} /> {formatTime(elapsedTime)}
          </div>
          <span className="livebattle-status active">Practice Mode</span>
          <button className="livebattle-leave-btn" onClick={() => navigate("/practice")}>
            Back to Problems
          </button>
        </div>
      </motion.section>

      <div className="livebattle-grid" style={{ gridTemplateColumns: isSubmitPanelOpen ? undefined : "minmax(280px, 1fr) 2fr" }}>
        <section className="livebattle-panel livebattle-problem-panel">
          <div className="livebattle-panel-head">
            <h3>Problem</h3>
            <div className="livebattle-problem-meta">
              <span>{problem?.difficulty || "Mixed"}</span>
            </div>
          </div>

          <div className="livebattle-problem-scroll">
            <ProblemStatement problem={problem} />
          </div>
        </section>

        <section className="livebattle-panel livebattle-editor-panel" style={{ position: "relative" }}>
          <div className="livebattle-panel-head">
            <h3>Solution</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span className="livebattle-chip">{selectedLanguage === "cpp" ? "C++" : "JavaScript"}</span>
              <select
                className="livebattle-language-select"
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value)}
                disabled={running}
              >
                {LANGUAGE_OPTIONS.map((languageOption) => (
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
                borderRadius: "10px",
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

        {isSubmitPanelOpen && (
        <section className="livebattle-panel livebattle-submit-panel">
          <div className="livebattle-panel-head">
            <h3>Submit Solution</h3>
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
              {running ? (
                <div className="livebattle-loader livebattle-inline-loader">Evaluating...</div>
              ) : (
                <pre>{output || "Output will appear here."}</pre>
              )}
            </div>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}