import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faClock,
  faMemory,
  faTags,
  faVial,
  faCopy,
  faCheck,
  faFileImport,
  faFileExport,
  faShieldHalved,
  faLightbulb,
  faBookOpen,
} from "@fortawesome/free-solid-svg-icons";
import { fetchProblemById } from "../../services/api";
import { parseProblemStatement } from "../../utils/problemFormatter";
import { useNotification } from "../../contexts/NotificationContext";
import "./ProblemReadPanel.css";

export default function ProblemReadPanel({ problemId, onClose, initialProblem = null }) {
  const { notify } = useNotification();
  const [problem, setProblem] = useState(initialProblem);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const drawerRef = useRef(null);

  // Load problem details when problemId changes
  useEffect(() => {
    if (!problemId) {
      setProblem(null);
      setError(null);
      return;
    }

    let active = true;

    // If initial problem object with complete statement matches, use it immediately
    if (initialProblem && (initialProblem.id === problemId || initialProblem._id === problemId) && (initialProblem.statement || initialProblem.description)) {
      setProblem(initialProblem);
      setLoading(false);
      setError(null);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProblemById(problemId);
        if (!active) return;
        setProblem(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load problem details.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      active = false;
    };
  }, [problemId, initialProblem]);

  // Handle ESC key press to close drawer
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (problemId) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [problemId, handleKeyDown]);

  // Parse raw problem statement into structured sections
  const rawStatement = problem?.statement || problem?.description || "";
  const parsed = useMemo(() => {
    return parseProblemStatement(rawStatement);
  }, [rawStatement]);

  // Sample test cases
  const sampleCases = useMemo(() => {
    if (Array.isArray(problem?.testCases) && problem.testCases.length > 0) {
      return problem.testCases.slice(0, 2);
    }
    return [];
  }, [problem]);

  const handleCopyInput = (inputStr, index) => {
    navigator.clipboard.writeText(inputStr || "");
    setCopiedIndex(index);
    if (notify) {
      notify({
        type: "success",
        title: "Copied!",
        message: `Sample ${index + 1} input copied to clipboard.`,
        duration: 1500,
      });
    }
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!problemId) return null;

  const categoryName = problem?.category?.trim();
  const normalizedCategory = categoryName ? categoryName.toLowerCase() : "";

  const extraTags = Array.isArray(problem?.tags)
    ? problem.tags.filter(
        (t) => typeof t === "string" && t.trim() && t.trim().toLowerCase() !== normalizedCategory
      )
    : [];

  const difficultyLabel = (problem?.difficulty || "Medium").toLowerCase();

  return (
    <div
      className="problem-read-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="problem-read-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={problem?.title ? `Read Problem: ${problem.title}` : "Read Problem"}
        tabIndex={-1}
      >
        {/* Header */}
        <header className="read-drawer-header">
          <div className="read-drawer-header-left">
            <div className="read-drawer-eyebrow">
              <span className="read-drawer-eyebrow-dot" />
              <span>Read-Only Viewer</span>
            </div>

            <h2 className="read-drawer-title">
              {problem?.title || (loading ? "Loading..." : "Problem Statement")}
            </h2>

            {problem && (
              <div className="read-drawer-meta-row">
                <span className={`read-badge read-diff-${difficultyLabel}`}>
                  {difficultyLabel.toUpperCase()}
                </span>

                {categoryName && (
                  <span className="read-meta-pill">
                    <FontAwesomeIcon icon={faTags} /> {categoryName}
                  </span>
                )}

                <span className="read-meta-pill">
                  <FontAwesomeIcon icon={faClock} /> {problem?.timeLimit ?? 2000}ms
                </span>

                <span className="read-meta-pill">
                  <FontAwesomeIcon icon={faMemory} /> {problem?.memoryLimit ?? 256}MB
                </span>

                {extraTags.map((tag) => (
                  <span key={tag} className="read-meta-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="read-drawer-close-btn"
            onClick={onClose}
            aria-label="Close problem read panel"
            title="Close (Esc)"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </header>

        {/* Body Content */}
        {loading ? (
          <div className="read-drawer-loading">
            <div className="read-spinner" />
            <p>Loading problem specification...</p>
          </div>
        ) : error ? (
          <div className="read-drawer-error">
            <p>{error}</p>
            <button
              type="button"
              className="read-retry-btn"
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchProblemById(problemId)
                  .then(setProblem)
                  .catch((err) => setError(err.message || "Failed to load problem details."))
                  .finally(() => setLoading(false));
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="read-drawer-body">
            {/* Description Section */}
            {parsed.description.length > 0 ? (
              <section className="read-section">
                <div className="read-section-title">
                  <FontAwesomeIcon icon={faBookOpen} /> Description
                </div>
                {parsed.description.map((paragraph, idx) => (
                  <p key={idx} className="read-paragraph">
                    {paragraph}
                  </p>
                ))}
              </section>
            ) : null}

            {/* Input Format Section */}
            {parsed.inputFormat && (
              <section className="read-section">
                <div className="read-section-title">
                  <FontAwesomeIcon icon={faFileImport} /> Input Format
                </div>
                <div className="read-box">
                  {parsed.inputFormat.map((paragraph, idx) => (
                    <p key={idx} className="read-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Output Format Section */}
            {parsed.outputFormat && (
              <section className="read-section">
                <div className="read-section-title">
                  <FontAwesomeIcon icon={faFileExport} /> Output Format
                </div>
                <div className="read-box">
                  {parsed.outputFormat.map((paragraph, idx) => (
                    <p key={idx} className="read-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Sample Test Cases */}
            <section className="read-section">
              <div className="read-section-title">
                <FontAwesomeIcon icon={faVial} /> Examples & Sample Cases
              </div>

              {sampleCases.length > 0 ? (
                <div className="read-samples-list">
                  {sampleCases.map((sample, idx) => {
                    const inputVal = sample.input || "";
                    const expectedVal = sample.expectedOutput ?? sample.output ?? "N/A";

                    return (
                      <div key={idx} className="read-sample-card">
                        <div className="read-sample-header">
                          <span>Sample Test Case {idx + 1}</span>
                          <button
                            type="button"
                            className="read-copy-btn"
                            onClick={() => handleCopyInput(inputVal, idx)}
                            title="Copy input to clipboard"
                          >
                            <FontAwesomeIcon icon={copiedIndex === idx ? faCheck : faCopy} />
                            {copiedIndex === idx ? "Copied" : "Copy Input"}
                          </button>
                        </div>
                        <div className="read-sample-body">
                          <div className="read-sample-block">
                            <span className="read-sample-label">Input</span>
                            <pre className="read-code-block">{inputVal}</pre>
                          </div>
                          <div className="read-sample-block">
                            <span className="read-sample-label">Expected Output</span>
                            <pre className="read-code-block">{expectedVal}</pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : problem?.example ? (
                <div className="read-box">
                  <pre className="read-code-block">{problem.example}</pre>
                </div>
              ) : (
                <p className="read-paragraph" style={{ opacity: 0.7, fontStyle: "italic" }}>
                  No sample test cases available for this problem.
                </p>
              )}
            </section>

            {/* Constraints Section */}
            {parsed.constraints && (
              <section className="read-section">
                <div className="read-section-title">
                  <FontAwesomeIcon icon={faShieldHalved} /> Constraints
                </div>
                <div className="read-box constraints-box">
                  {parsed.constraints.map((paragraph, idx) => (
                    <p key={idx} className="read-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Note & Explanation */}
            {parsed.note && (
              <section className="read-section">
                <div className="read-section-title">
                  <FontAwesomeIcon icon={faLightbulb} /> Note & Explanation
                </div>
                <div className="read-box">
                  {parsed.note.map((paragraph, idx) => (
                    <p key={idx} className="read-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="read-drawer-footer">
          <div className="read-drawer-footer-hint">
            <span>Press</span>
            <kbd>ESC</kbd>
            <span>or click outside to close</span>
          </div>
          <div style={{ opacity: 0.8 }}>Strictly Read-Only Mode</div>
        </footer>
      </div>
    </div>
  );
}
