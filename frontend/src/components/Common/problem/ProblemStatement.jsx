import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileImport,
  faFileExport,
  faShieldHalved,
  faLightbulb,
  faCopy,
  faCheck,
  faClock,
  faMemory,
  faTags,
  faVial
} from "@fortawesome/free-solid-svg-icons";
import { parseProblemStatement } from "../../../utils/problemFormatter";
import { useNotification } from "../../../contexts/NotificationContext";
import "./ProblemStatement.css";

export default function ProblemStatement({ problem }) {
  const { notify } = useNotification();
  const [copiedIndex, setCopiedIndex] = React.useState(null);

  const rawStatement = problem?.statement || problem?.description || "";

  const parsed = useMemo(() => {
    return parseProblemStatement(rawStatement);
  }, [rawStatement]);

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

  const categoryName = problem?.category?.trim();
  const normalizedCategory = categoryName ? categoryName.toLowerCase() : "";

  const extraTags = useMemo(() => {
    if (!Array.isArray(problem?.tags)) return [];
    const seen = new Set(normalizedCategory ? [normalizedCategory] : []);
    const result = [];
    for (const t of problem.tags) {
      if (typeof t === "string" && t.trim()) {
        const k = t.trim().toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          result.push(t.trim());
        }
      }
    }
    return result;
  }, [problem?.tags, normalizedCategory]);

  const difficultyClass = `difficulty-${(problem?.difficulty || "medium").toLowerCase()}`;

  return (
    <div className="ps-container">
      {/* Header Section */}
      <div className="ps-header">
        <div className="ps-title-row">
          <h2 className="ps-title">{problem?.title || "Problem Statement"}</h2>
          <div className="ps-badges-row">
            <span className={`ps-badge ${difficultyClass}`}>
              {problem?.difficulty || "MEDIUM"}
            </span>

            {categoryName && (
              <span className="ps-badge tag-chip">
                <FontAwesomeIcon icon={faTags} /> {categoryName}
              </span>
            )}
          </div>
        </div>

        <div className="ps-badges-row">
          <span className="ps-badge meta-info">
            <FontAwesomeIcon icon={faClock} /> Time Limit: {problem?.timeLimit ?? 2000}ms
          </span>
          <span className="ps-badge meta-info">
            <FontAwesomeIcon icon={faMemory} /> Memory Limit: {problem?.memoryLimit ?? 256}MB
          </span>

          {extraTags.map((tag) => (
            <span key={tag} className="ps-badge meta-info">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Main Problem Description */}
      <div className="ps-section">
        {parsed.description.map((paragraph, idx) => (
          <p key={idx} className="ps-paragraph">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Input Format Section */}
      {parsed.inputFormat && (
        <div className="ps-section">
          <div className="ps-section-title">
            <FontAwesomeIcon icon={faFileImport} /> Input Format
          </div>
          <div className="ps-box">
            {parsed.inputFormat.map((paragraph, idx) => (
              <p key={idx} className="ps-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Output Format Section */}
      {parsed.outputFormat && (
        <div className="ps-section">
          <div className="ps-section-title">
            <FontAwesomeIcon icon={faFileExport} /> Output Format
          </div>
          <div className="ps-box">
            {parsed.outputFormat.map((paragraph, idx) => (
              <p key={idx} className="ps-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Constraints Section */}
      {parsed.constraints && (
        <div className="ps-section">
          <div className="ps-section-title">
            <FontAwesomeIcon icon={faShieldHalved} /> Constraints
          </div>
          <div className="ps-box constraints-box">
            {parsed.constraints.map((paragraph, idx) => (
              <p key={idx} className="ps-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Sample Test Cases */}
      <div className="ps-section">
        <div className="ps-section-title">
          <FontAwesomeIcon icon={faVial} /> Sample Test Cases
        </div>

        {sampleCases.length > 0 ? (
          <div className="ps-samples-container">
            {sampleCases.map((sample, idx) => {
              const inputVal = sample.input || "";
              const expectedVal = sample.expectedOutput ?? sample.output ?? "N/A";

              return (
                <div key={idx} className="ps-sample-card">
                  <div className="ps-sample-header">
                    <span>Sample Test Case {idx + 1}</span>
                    <button
                      className="ps-copy-btn"
                      onClick={() => handleCopyInput(inputVal, idx)}
                      title="Copy Input"
                    >
                      <FontAwesomeIcon icon={copiedIndex === idx ? faCheck : faCopy} />
                      {copiedIndex === idx ? "Copied" : "Copy Input"}
                    </button>
                  </div>
                  <div className="ps-sample-body">
                    <div className="ps-sample-block">
                      <span className="ps-sample-label">Input</span>
                      <pre className="ps-code-block">{inputVal}</pre>
                    </div>
                    <div className="ps-sample-block">
                      <span className="ps-sample-label">Expected Output</span>
                      <pre className="ps-code-block">{expectedVal}</pre>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : problem?.example ? (
          <div className="ps-box">
            <pre className="ps-code-block">{problem.example}</pre>
          </div>
        ) : (
          <p className="ps-paragraph" style={{ opacity: 0.7, italic: "true" }}>
            No sample test cases available for this problem.
          </p>
        )}
      </div>

      {/* Note / Explanation Section */}
      {parsed.note && (
        <div className="ps-section">
          <div className="ps-section-title">
            <FontAwesomeIcon icon={faLightbulb} /> Note & Explanation
          </div>
          <div className="ps-box note-box">
            {parsed.note.map((paragraph, idx) => (
              <p key={idx} className="ps-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}