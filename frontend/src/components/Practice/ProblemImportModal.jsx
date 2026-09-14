import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faFileExcel,
  faDownload,
  faCloudArrowUp,
  faCheckCircle,
  faTriangleExclamation,
  faSpinner,
  faPlus,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";
import { importProblemsBulk } from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";
import "./ProblemImportModal.css";

export default function ProblemImportModal({ isOpen, onClose, onImportSuccess }) {
  const { notify } = useNotification();
  const fileInputRef = useRef(null);

  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedProblems, setParsedProblems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState("");

  if (!isOpen) return null;

  // 1. Generate & Download Sample Template
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          Title: "Two Sum Target",
          Statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.",
          Difficulty: "EASY",
          Category: "Arrays & Hashing",
          Tags: "arrays, hash-table",
          TimeLimitMs: 2000,
          MemoryLimitMB: 256,
          SampleInput: "[2, 7, 11, 15]\n9",
          SampleOutput: "[0, 1]",
          HiddenInput: "[3, 2, 4]\n6",
          HiddenOutput: "[1, 2]",
        },
        {
          Title: "Maximum Subarray Sum",
          Statement: "Given an integer array nums, find the subarray with the largest sum, and return its sum.",
          Difficulty: "MEDIUM",
          Category: "Dynamic Programming",
          Tags: "arrays, dynamic-programming, divide-and-conquer",
          TimeLimitMs: 2000,
          MemoryLimitMB: 256,
          SampleInput: "[-2, 1, -3, 4, -1, 2, 1, -5, 4]",
          SampleOutput: "6",
          HiddenInput: "[5, 4, -1, 7, 8]",
          HiddenOutput: "23",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Problems Template");
      XLSX.writeFile(wb, "AlgoFight_Problems_Import_Template.xlsx");

      notify({
        type: "success",
        title: "Template Downloaded",
        message: "Fill in the template with your questions and upload it below.",
      });
    } catch (err) {
      notify({
        type: "error",
        title: "Download Failed",
        message: err.message || "Failed to generate template.",
      });
    }
  };

  // 2. Parse uploaded file (Excel, CSV, or JSON)
  const processFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError("");

    try {
      const name = file.name.toLowerCase();

      if (name.endsWith(".json")) {
        const text = await file.text();
        const json = JSON.parse(text);
        const list = Array.isArray(json) ? json : json.problems || [];
        if (list.length === 0) throw new Error("JSON file contains no problem records.");
        setParsedProblems(formatParsedProblems(list));
        return;
      }

      // Handle Excel (.xlsx, .xls) and CSV
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("Spreadsheet contains no sheets.");

      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
      if (rawRows.length === 0) throw new Error("Uploaded spreadsheet is empty.");

      const formatted = formatParsedProblems(rawRows);
      if (formatted.length === 0) throw new Error("No valid problem rows found in file.");

      setParsedProblems(formatted);
    } catch (err) {
      setParseError(err.message || "Failed to parse file format.");
      setParsedProblems([]);
    }
  };

  const formatParsedProblems = (rows) => {
    return rows.map((r, idx) => {
      const title = String(r.Title || r.title || `Problem ${idx + 1}`).trim();
      const statement = String(r.Statement || r.statement || r.description || "").trim();
      let diff = String(r.Difficulty || r.difficulty || "MEDIUM").trim().toUpperCase();
      if (!["EASY", "MEDIUM", "HARD"].includes(diff)) diff = "MEDIUM";

      const category = r.Category || r.category || "General";
      const tagsRaw = r.Tags || r.tags || "";
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw
        : String(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean);

      const timeLimit = Number(r.TimeLimitMs || r.timeLimit || 2000);
      const memoryLimit = Number(r.MemoryLimitMB || r.memoryLimit || 256);

      const testCases = [];
      const sampleIn = r.SampleInput || r.sampleInput || r.input;
      const sampleOut = r.SampleOutput || r.sampleOutput || r.expectedOutput;
      if (sampleIn !== undefined && sampleOut !== undefined) {
        testCases.push({
          input: String(sampleIn).trim(),
          expectedOutput: String(sampleOut).trim(),
          isHidden: false,
        });
      }

      const hiddenIn = r.HiddenInput || r.hiddenInput;
      const hiddenOut = r.HiddenOutput || r.hiddenOutput;
      if (hiddenIn !== undefined && hiddenOut !== undefined) {
        testCases.push({
          input: String(hiddenIn).trim(),
          expectedOutput: String(hiddenOut).trim(),
          isHidden: true,
        });
      }

      // If array of testCases provided in JSON
      if (Array.isArray(r.testCases)) {
        r.testCases.forEach((tc) => {
          if (tc.input !== undefined && tc.expectedOutput !== undefined) {
            testCases.push({
              input: String(tc.input).trim(),
              expectedOutput: String(tc.expectedOutput).trim(),
              isHidden: Boolean(tc.isHidden),
            });
          }
        });
      }

      const isValid = Boolean(title && statement);

      return {
        id: `temp_${idx}`,
        title,
        statement,
        difficulty: diff,
        category,
        tags,
        timeLimit: timeLimit > 0 ? timeLimit : 2000,
        memoryLimit: memoryLimit > 0 ? memoryLimit : 256,
        testCases,
        isValid,
      };
    });
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveProblem = (idx) => {
    setParsedProblems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit bulk problems
  const handleImportSubmit = async () => {
    const validProblems = parsedProblems.filter((p) => p.isValid);
    if (validProblems.length === 0) {
      notify({
        type: "error",
        title: "No Valid Questions",
        message: "All questions must contain at least a Title and Statement.",
      });
      return;
    }

    try {
      setImporting(true);
      const payload = validProblems.map((p) => ({
        title: p.title,
        statement: p.statement,
        difficulty: p.difficulty,
        category: p.category,
        tags: p.tags,
        timeLimit: p.timeLimit,
        memoryLimit: p.memoryLimit,
        testCases: p.testCases,
      }));

      const res = await importProblemsBulk(payload);
      notify({
        type: "success",
        title: "Problems Imported!",
        message: `Successfully added ${res.count || payload.length} new question(s) to the problem archive.`,
      });

      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      notify({
        type: "error",
        title: "Import Failed",
        message: err.message || "Failed to commit problems to archive.",
      });
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedProblems.filter((p) => p.isValid).length;

  return (
    <AnimatePresence>
      <div className="import-modal-overlay" onClick={onClose}>
        <motion.div
          className="import-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="import-modal-header">
            <div className="import-title-group">
              <span className="import-badge">FACULTY & ADMIN CURATOR</span>
              <h2>Import Questions to Problem List</h2>
              <p>Upload an Excel spreadsheet, CSV, or document containing algorithmic problems.</p>
            </div>
            <button className="import-close-btn" onClick={onClose} aria-label="Close dialog">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Action Row: Download Template */}
          <div className="import-action-bar">
            <button
              type="button"
              className="import-template-btn"
              onClick={handleDownloadTemplate}
            >
              <FontAwesomeIcon icon={faDownload} /> Download Excel Sample Template
            </button>
            <span className="import-supported-hint">
              Supported formats: .xlsx, .xls, .csv, .json
            </span>
          </div>

          {/* Drag and Drop Zone */}
          <div
            className={`import-dropzone ${dragActive ? "drag-active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div className="dropzone-content">
              <div className="dropzone-icon-wrap">
                <FontAwesomeIcon icon={fileName ? faFileExcel : faCloudArrowUp} className="dropzone-icon" />
              </div>
              <div className="dropzone-text">
                {fileName ? (
                  <h4>Selected: <span className="text-cyan">{fileName}</span></h4>
                ) : (
                  <h4>Drop spreadsheet here, or <span className="text-cyan">browse files</span></h4>
                )}
                <p>Accepts multiple questions with title, statement, difficulty, and test cases.</p>
              </div>
            </div>
          </div>

          {parseError && (
            <div className="import-error-banner">
              <FontAwesomeIcon icon={faTriangleExclamation} /> {parseError}
            </div>
          )}

          {/* Live Parsed Preview Table */}
          {parsedProblems.length > 0 && (
            <div className="import-preview-section">
              <div className="import-preview-header">
                <h3>Detected Questions ({parsedProblems.length})</h3>
                <span className="import-preview-count">
                  {validCount} Ready to Import
                </span>
              </div>

              <div className="import-table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Title</th>
                      <th>Difficulty</th>
                      <th>Category</th>
                      <th>Test Cases</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProblems.map((p, idx) => (
                      <tr key={p.id || idx} className={p.isValid ? "" : "row-invalid"}>
                        <td>
                          {p.isValid ? (
                            <span className="status-badge valid" title="Ready to import">
                              <FontAwesomeIcon icon={faCheckCircle} /> Valid
                            </span>
                          ) : (
                            <span className="status-badge invalid" title="Missing Title or Statement">
                              <FontAwesomeIcon icon={faTriangleExclamation} /> Incomplete
                            </span>
                          )}
                        </td>
                        <td className="col-title-preview">
                          <strong>{p.title}</strong>
                        </td>
                        <td>
                          <span className={`diff-tag diff-${p.difficulty.toLowerCase()}`}>
                            {p.difficulty}
                          </span>
                        </td>
                        <td>{p.category || "General"}</td>
                        <td>
                          <span className="tc-count-badge">
                            {p.testCases.length} case(s)
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-row-remove"
                            onClick={() => handleRemoveProblem(idx)}
                            title="Remove from import"
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="import-modal-footer">
            <button
              type="button"
              className="btn-import-cancel"
              onClick={onClose}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-import-commit"
              disabled={importing || validCount === 0}
              onClick={handleImportSubmit}
            >
              {importing ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin /> Importing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} /> Commit {validCount} Problem(s)
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
