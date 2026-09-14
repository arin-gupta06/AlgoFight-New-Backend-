import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPlus,
  faUsers,
  faClock,
  faFire,
  faDice,
  faListCheck,
  faSearch,
  faCheck,
  faInfoCircle,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { requestJson, fetchPracticeProblems } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useNavigate } from "react-router-dom";
import "./CreateRoomModal.css";

export default function CreateRoomModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  // Mode: "AUTO" (Random Auto-Pick) or "CUSTOM" (User chooses specific problems)
  const [selectionMode, setSelectionMode] = useState("AUTO");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [timeLimit, setTimeLimit] = useState(15);
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questionCount, setQuestionCount] = useState(3);
  const [isFriendly, setIsFriendly] = useState(false);
  const [creating, setCreating] = useState(false);

  // Custom problems state
  const [allProblems, setAllProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [problemSearch, setProblemSearch] = useState("");

  // Load problems for custom picker when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const loadProblems = async () => {
      try {
        setLoadingProblems(true);
        const res = await fetchPracticeProblems({ page: 1, limit: 100 });
        if (active && Array.isArray(res?.problems)) {
          setAllProblems(res.problems);
        }
      } catch {
        // Handled silently
      } finally {
        if (active) setLoadingProblems(false);
      }
    };

    loadProblems();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const filteredProblems = useMemo(() => {
    if (!problemSearch.trim()) return allProblems;
    const q = problemSearch.toLowerCase().trim();
    return allProblems.filter((p) => {
      const title = String(p.title || "").toLowerCase();
      const cat = String(p.category || "").toLowerCase();
      const tags = Array.isArray(p.tags) ? p.tags.join(" ").toLowerCase() : "";
      return title.includes(q) || cat.includes(q) || tags.includes(q);
    });
  }, [allProblems, problemSearch]);

  const handleToggleProblem = (problem) => {
    const pid = String(problem.id || problem._id);
    setSelectedProblems((prev) => {
      const exists = prev.some((p) => String(p.id || p._id) === pid);
      if (exists) {
        return prev.filter((p) => String(p.id || p._id) !== pid);
      } else {
        if (prev.length >= 10) {
          notify({
            type: "warning",
            title: "Limit Reached",
            message: "Maximum 10 problems per custom battle.",
          });
          return prev;
        }
        return [...prev, problem];
      }
    });
  };

  const handleRemoveProblem = (problemId) => {
    setSelectedProblems((prev) =>
      prev.filter((p) => String(p.id || p._id) !== String(problemId))
    );
  };

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      notify({
        type: "error",
        title: "Authentication Required",
        message: "Please log in to create a custom room.",
      });
      return;
    }

    if (selectionMode === "CUSTOM" && selectedProblems.length === 0) {
      notify({
        type: "warning",
        title: "Problem Selection Required",
        message: "Please choose at least 1 problem for your battle, or switch to Auto-Pick.",
      });
      return;
    }

    try {
      setCreating(true);

      const payload = {
        hostId: user.uid || user.email,
        maxPlayers: Number(maxPlayers),
        timeLimitMinutes: Number(timeLimit),
        difficulty: selectionMode === "CUSTOM" ? "CUSTOM" : difficulty,
        questionCount:
          selectionMode === "CUSTOM" ? selectedProblems.length : Number(questionCount),
        problemIds:
          selectionMode === "CUSTOM"
            ? selectedProblems.map((p) => String(p.id || p._id))
            : undefined,
        isFriendly,
      };

      const res = await requestJson("/api/battle/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        includeAuth: true,
      });

      const roomCode = res.room?.roomCode || res.roomCode;
      notify({
        type: "success",
        title: "Room Created!",
        message: `Room Code: ${roomCode}`,
      });
      onClose();
      navigate(`/battle/room/${roomCode}`);
    } catch (err) {
      notify({
        type: "error",
        title: "Room Creation Failed",
        message: err.message || "Could not create room.",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          className="modal-content-hud create-room-modal-hud"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title-group">
              <span className="modal-tag">Lobby Host</span>
              <h2>Create Custom Battle Room</h2>
            </div>
            <button className="modal-close-btn" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Mode Switcher: Auto-Pick vs Choose Problems */}
          <div className="battle-mode-selector">
            <button
              type="button"
              className={`mode-tab-btn ${selectionMode === "AUTO" ? "active" : ""}`}
              onClick={() => setSelectionMode("AUTO")}
            >
              <FontAwesomeIcon icon={faDice} />
              <span>Random Auto-Pick</span>
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${selectionMode === "CUSTOM" ? "active" : ""}`}
              onClick={() => setSelectionMode("CUSTOM")}
            >
              <FontAwesomeIcon icon={faListCheck} />
              <span>Choose Specific Problems</span>
            </button>
          </div>

          <form onSubmit={handleCreate} className="modal-form-compact">
            <div className="modal-form-grid">
              {/* Left Column: Participants & Time Limit Dropdowns */}
              <div className="modal-form-col">
                <div className="form-group-hud">
                  <div className="form-group-header">
                    <label>
                      <FontAwesomeIcon icon={faUsers} /> Max Participants
                    </label>
                    <span className="form-group-value-badge">{maxPlayers} Seats</span>
                  </div>
                  <select
                    className="hud-select"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  >
                    <option value={2}>2 Participants (1v1 Duel)</option>
                    <option value={4}>4 Participants (Small Team)</option>
                    <option value={8}>8 Participants (Group Tournament)</option>
                    <option value={16}>16 Participants (Classroom Round)</option>
                    <option value={25}>25 Participants (Medium Arena)</option>
                    <option value={50}>50 Participants (Large Arena)</option>
                    <option value={75}>75 Participants (Mega Tournament)</option>
                    <option value={100}>100 Participants (Full Hall)</option>
                  </select>
                </div>

                <div className="form-group-hud">
                  <div className="form-group-header">
                    <label>
                      <FontAwesomeIcon icon={faClock} /> Time Limit
                    </label>
                    <span className="form-group-value-badge">{timeLimit} Mins</span>
                  </div>
                  <select
                    className="hud-select"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                  >
                    <option value={5}>5 Minutes (Blitz Duel)</option>
                    <option value={10}>10 Minutes (Rapid Round)</option>
                    <option value={15}>15 Minutes (Standard Match)</option>
                    <option value={20}>20 Minutes (Extended Round)</option>
                    <option value={30}>30 Minutes (Deep Challenge)</option>
                    <option value={45}>45 Minutes (Classroom Session)</option>
                    <option value={60}>60 Minutes (1 Hour Match)</option>
                    <option value={90}>90 Minutes (1.5 Hour Marathon)</option>
                    <option value={120}>120 Minutes (2 Hour Grand Finals)</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Questions & Difficulty (or Info in Custom Mode) */}
              <div className="modal-form-col">
                {selectionMode === "AUTO" ? (
                  <>
                    <div className="form-group-hud">
                      <div className="form-group-header">
                        <label>
                          <FontAwesomeIcon icon={faPlus} /> Questions
                        </label>
                        <span className="form-group-value-badge">{questionCount} Qs</span>
                      </div>
                      <div className="pill-grid-3">
                        {[1, 3, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`pill-btn ${questionCount === num ? "active" : ""}`}
                            onClick={() => setQuestionCount(num)}
                          >
                            {num} Qs
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group-hud">
                      <div className="form-group-header">
                        <label>
                          <FontAwesomeIcon icon={faFire} /> Difficulty
                        </label>
                        <span className="form-group-value-badge">{difficulty}</span>
                      </div>
                      <div className="pill-grid-4">
                        {["EASY", "MEDIUM", "HARD", "MIX"].map((diff) => (
                          <button
                            key={diff}
                            type="button"
                            className={`pill-btn ${difficulty === diff ? "active" : ""}`}
                            onClick={() => setDifficulty(diff)}
                          >
                            {diff}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group-hud">
                      <div className="form-group-header">
                        <label>
                          <FontAwesomeIcon icon={faListCheck} /> Chosen Problems
                        </label>
                        <span className="form-group-value-badge">
                          {selectedProblems.length} Selected
                        </span>
                      </div>
                      <div className="custom-difficulty-badge">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span>
                          <strong>Difficulty Locked:</strong> In custom battle mode, each problem
                          retains its individual difficulty. No conflicting filter is applied.
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Custom Problems Selection Section */}
            {selectionMode === "CUSTOM" && (
              <div className="custom-picker-wrap" style={{ marginTop: "16px" }}>
                <div className="form-group-header" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#8fa1bc" }}>
                    SELECTED PROBLEM TAGS:
                  </label>
                  <span style={{ fontSize: "0.78rem", color: "#00e5ff" }}>
                    {selectedProblems.length} of 10 maximum
                  </span>
                </div>

                {/* Tags Placeholder Box: selected problems appear as tags here */}
                <div className="custom-tags-placeholder-box">
                  {selectedProblems.length === 0 ? (
                    <span className="tags-empty-hint">
                      No problems selected yet. Search and click challenges below to add them...
                    </span>
                  ) : (
                    selectedProblems.map((p) => {
                      const pid = p.id || p._id;
                      const diffKey = String(p.difficulty || "medium").toLowerCase();
                      return (
                        <span key={pid} className="selected-problem-chip">
                          <span className={`chip-diff-badge chip-diff-${diffKey}`}>
                            {p.difficulty || "MED"}
                          </span>
                          <span className="chip-title" title={p.title}>
                            {p.title}
                          </span>
                          <button
                            type="button"
                            className="chip-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProblem(pid);
                            }}
                            title="Remove problem"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Search Bar */}
                <div className="problem-search-wrap">
                  <FontAwesomeIcon icon={faSearch} className="problem-search-icon" />
                  <input
                    type="text"
                    className="problem-search-input"
                    placeholder="Filter algorithmic challenges by name or topic..."
                    value={problemSearch}
                    onChange={(e) => setProblemSearch(e.target.value)}
                  />
                </div>

                {/* Available Scrollable Dropdown List */}
                <div className="available-problems-scrollbox">
                  {loadingProblems ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#8fa1bc", fontSize: "0.85rem" }}>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: "8px" }} />
                      Loading challenge archive...
                    </div>
                  ) : filteredProblems.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#8fa1bc", fontSize: "0.85rem" }}>
                      No matching challenges found.
                    </div>
                  ) : (
                    filteredProblems.map((prob) => {
                      const pid = String(prob.id || prob._id);
                      const isSelected = selectedProblems.some(
                        (p) => String(p.id || p._id) === pid
                      );
                      const diffKey = String(prob.difficulty || "medium").toLowerCase();

                      return (
                        <div
                          key={pid}
                          className={`problem-select-row ${isSelected ? "selected" : ""}`}
                          onClick={() => handleToggleProblem(prob)}
                        >
                          <div className="row-left">
                            <span className={`chip-diff-badge chip-diff-${diffKey}`}>
                              {prob.difficulty || "MED"}
                            </span>
                            <span className="row-title" title={prob.title}>
                              {prob.title}
                            </span>
                          </div>
                          <div className="row-right">
                            <span className="row-category">
                              {prob.category || (prob.tags && prob.tags[0]) || "General"}
                            </span>
                            <span className="row-check-badge">
                              {isSelected ? <FontAwesomeIcon icon={faCheck} /> : "+"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <button
                type="button"
                className="btn-hud-secondary"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn-hud-primary" disabled={creating}>
                <FontAwesomeIcon icon={faPlus} />{" "}
                {creating ? "Generating Room..." : "Create Room"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
