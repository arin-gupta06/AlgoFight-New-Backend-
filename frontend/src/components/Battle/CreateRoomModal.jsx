import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPlus,
  faMinus,
  faUsers,
  faClock,
  faFire,
  faDice,
  faListCheck,
  faSearch,
  faCheck,
  faInfoCircle,
  faSpinner,
  faBullhorn,
  faChevronDown,
  faLock,
  faEye,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import { requestJson, fetchPracticeProblems } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useNavigate } from "react-router-dom";
import "./CreateRoomModal.css";

const TIME_LIMIT_OPTIONS = [
  { value: 5, label: "5 Minutes (Blitz Duel)", tag: "⚡ Blitz" },
  { value: 10, label: "10 Minutes (Rapid Round)", tag: "⏱️ Rapid" },
  { value: 15, label: "15 Minutes (Standard Match)", tag: "⚔️ Standard" },
  { value: 20, label: "20 Minutes (Extended Round)", tag: "🎯 Extended" },
  { value: 30, label: "30 Minutes (Deep Challenge)", tag: "🧠 Deep" },
  { value: 45, label: "45 Minutes (Classroom Session)", tag: "🎓 Classroom" },
  { value: 60, label: "60 Minutes (1 Hour Match)", tag: "🏆 1 Hour" },
  { value: 90, label: "90 Minutes (1.5 Hour Marathon)", tag: "🔥 Marathon" },
  { value: 120, label: "120 Minutes (2 Hour Grand Finals)", tag: "👑 Finals" },
];

const PARTICIPANT_OPTIONS = [
  { value: 2, label: "2 Participants (1v1 Duel)", tag: "1v1" },
  { value: 3, label: "3 Participants (3-Way Battle)", tag: "FFA" },
  { value: 4, label: "4 Participants (Small Team)", tag: "Party" },
  { value: 6, label: "6 Participants (6-Way Arena)", tag: "Arena" },
  { value: 8, label: "8 Participants (Group Tournament)", tag: "Tourney" },
  { value: 10, label: "10 Participants (Squad Pool)", tag: "Pool" },
  { value: 12, label: "12 Participants (Double Squad)", tag: "Squad" },
  { value: 16, label: "16 Participants (Classroom Round)", tag: "Class" },
  { value: 20, label: "20 Participants (Classroom Large)", tag: "Hall" },
  { value: 25, label: "25 Participants (Medium Arena)", tag: "Massive" },
  { value: 50, label: "50 Participants (Large Arena)", tag: "Mega" },
  { value: 75, label: "75 Participants (Mega Tournament)", tag: "Colosseum" },
  { value: 100, label: "100 Participants (Full Hall)", tag: "Max" },
  { value: "CUSTOM", label: "Custom Player Count...", tag: "Custom" },
];

function CustomHudSelect({ value, onChange, options, icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 240 && rect.top > 240) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`custom-hud-select-wrapper ${isOpen ? "open-wrapper" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`custom-hud-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-hud-select-trigger-label">
          {icon && <FontAwesomeIcon icon={icon} className="custom-hud-select-trigger-icon" />}
          {selectedOption ? selectedOption.label : "Select..."}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`custom-hud-select-chevron ${isOpen ? "rotated" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`custom-hud-select-menu ${openUpwards ? "open-upwards" : "open-downwards"}`}
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="listbox"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-hud-select-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <div className="custom-hud-select-item-content">
                    <span className="custom-hud-select-item-label">{opt.label}</span>
                    {opt.tag && <span className="custom-hud-select-item-tag">{opt.tag}</span>}
                  </div>
                  {isSelected && (
                    <FontAwesomeIcon icon={faCheck} className="custom-hud-select-check" />
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CreateRoomModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  // Mode: "AUTO" (Random Auto-Pick) or "CUSTOM" (User chooses specific problems)
  const [hostRole, setHostRole] = useState("PARTICIPANT"); // "PARTICIPANT" (active competitor) or "VIEWER" (spectator/proctor)
  const [battleMode, setBattleMode] = useState("DUEL_1V1"); // "DUEL_1V1" or "SQUAD_BATTLE"
  const [squadSize, setSquadSize] = useState(2); // 2 (2v2), 3 (3v3), or 4 (4v4)
  const [selectionMode, setSelectionMode] = useState("AUTO");
  const [roomType, setRoomType] = useState("RATED"); // "RATED" or "UNRATED"
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [isCustomPlayers, setIsCustomPlayers] = useState(false);
  const [timeLimit, setTimeLimit] = useState(15);
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [questionCount, setQuestionCount] = useState(3);
  const [isCustomQuestions, setIsCustomQuestions] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
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

      const isSquad = battleMode === "SQUAD_BATTLE";
      const payload = {
        hostId: user.uid || user.email,
        hostRole,
        maxPlayers: isSquad ? squadSize * 2 : Number(maxPlayers),
        timeLimitMinutes: Number(timeLimit),
        difficulty: selectionMode === "CUSTOM" ? "CUSTOM" : difficulty,
        questionCount:
          selectionMode === "CUSTOM" ? selectedProblems.length : Number(questionCount),
        problemIds:
          selectionMode === "CUSTOM"
            ? selectedProblems.map((p) => String(p.id || p._id))
            : undefined,
        roomType: isSquad ? "UNRATED" : roomType,
        isFriendly: isSquad ? true : roomType === "UNRATED",
        isPublic,
        battleMode,
        squadSize: isSquad ? squadSize : undefined,
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
        message: `Room Code: ${roomCode}${hostRole === "VIEWER" ? " (Supervisor/Viewer Mode)" : ""}`,
      });
      onClose();
      navigate(`/battle/room/${roomCode}`, { state: { hostRole } });
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
      <div className="modal-overlay create-room-modal-overlay" onClick={onClose}>
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

          {/* Host Perspective: Participant vs Spectator/Proctor */}
          <div className="host-role-selector-box" style={{ margin: "14px 0 16px" }}>
            <div className="form-group-header" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.04em", color: "#cbd5e1" }}>
                <FontAwesomeIcon icon={faUserShield} style={{ marginRight: "6px", color: "#38bdf8" }} />
                HOST PERSPECTIVE & ROLE
              </label>
              {(user?.role === "FACULTY" || user?.role === "ADMIN" || user?.userType === "FACULTY") && (
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#a855f7", background: "rgba(168, 85, 247, 0.15)", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
                  🎓 Faculty / Admin Proctoring Enabled
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div
                className={`match-type-card ${hostRole === "PARTICIPANT" ? "active-rated" : ""}`}
                onClick={() => setHostRole("PARTICIPANT")}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: hostRole === "PARTICIPANT" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                  background: hostRole === "PARTICIPANT" ? "rgba(56, 189, 248, 0.12)" : "rgba(15, 23, 42, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.88rem", color: hostRole === "PARTICIPANT" ? "#38bdf8" : "#e2e8f0" }}>
                    ⚔️ Active Competitor
                  </span>
                  {hostRole === "PARTICIPANT" && (
                    <span style={{ background: "#38bdf8", color: "#0f172a", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                  Compete in the match, write code, submit solutions, and occupy a player seat in the arena.
                </p>
              </div>

              <div
                className={`match-type-card ${hostRole === "VIEWER" ? "active-unrated" : ""}`}
                onClick={() => setHostRole("VIEWER")}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: hostRole === "VIEWER" ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.1)",
                  background: hostRole === "VIEWER" ? "rgba(168, 85, 247, 0.14)" : "rgba(15, 23, 42, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.88rem", color: hostRole === "VIEWER" ? "#c084fc" : "#e2e8f0" }}>
                    <FontAwesomeIcon icon={faEye} style={{ marginRight: "5px" }} />
                    Viewer / Proctor
                  </span>
                  {hostRole === "VIEWER" && (
                    <span style={{ background: "#a855f7", color: "#ffffff", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                  Observe without coding. Freely proctor competitors, monitor submissions, and moderate without taking a seat.
                </p>
              </div>
            </div>
          </div>

          {/* Battle Format Selector: Standard Duel vs Squad Battle */}
          <div className="battle-format-selector-box" style={{ margin: "12px 0 16px" }}>
            <div className="form-group-header" style={{ marginBottom: "8px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.04em", color: "#cbd5e1" }}>
                BATTLE FORMAT
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div
                className={`match-type-card ${battleMode === "DUEL_1V1" ? "active-rated" : ""}`}
                onClick={() => setBattleMode("DUEL_1V1")}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: battleMode === "DUEL_1V1" ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.1)",
                  background: battleMode === "DUEL_1V1" ? "rgba(6, 182, 212, 0.12)" : "rgba(15, 23, 42, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: battleMode === "DUEL_1V1" ? "#38bdf8" : "#e2e8f0" }}>
                    ⚔️ Standard Duel / FFA
                  </span>
                  {battleMode === "DUEL_1V1" && <span style={{ background: "#06b6d4", color: "#0f172a", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>ACTIVE</span>}
                </div>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                  Classic competitive 1v1 duel or multi-player arena. Individual scoring and leaderboard.
                </p>
              </div>

              <div
                className={`match-type-card ${battleMode === "SQUAD_BATTLE" ? "active-squad" : ""}`}
                onClick={() => {
                  setBattleMode("SQUAD_BATTLE");
                  setRoomType("UNRATED");
                }}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: battleMode === "SQUAD_BATTLE" ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                  background: battleMode === "SQUAD_BATTLE" ? "rgba(16, 185, 129, 0.14)" : "rgba(15, 23, 42, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: battleMode === "SQUAD_BATTLE" ? "#34d399" : "#e2e8f0" }}>
                    🛡️ Squad Battle (Team vs Team)
                  </span>
                  {battleMode === "SQUAD_BATTLE" && <span style={{ background: "#10b981", color: "#0f172a", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>ACTIVE</span>}
                </div>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                  Alpha vs Beta. Dual-captain approval gate, squad scoring, and teammate live code viewing!
                </p>
              </div>
            </div>
          </div>

          {/* If Squad Battle: show Squad Size Selector */}
          {battleMode === "SQUAD_BATTLE" ? (
            <div className="squad-config-box" style={{ margin: "0 0 16px", padding: "12px 14px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#34d399", letterSpacing: "0.04em" }}>
                  SQUAD ROSTER FORMAT
                </span>
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  Unrated Friendly Scrimmage
                </span>
              </div>
              <div className="squad-format-grid">
                <button
                  type="button"
                  className={`squad-format-card ${squadSize === 2 ? "active" : ""}`}
                  onClick={() => setSquadSize(2)}
                >
                  <div className="squad-format-title">2 vs 2 (4 Players)</div>
                  <div className="squad-format-sub">2 per squad • 1 Captain each</div>
                </button>
                <button
                  type="button"
                  className={`squad-format-card ${squadSize === 3 ? "active" : ""}`}
                  onClick={() => setSquadSize(3)}
                >
                  <div className="squad-format-title">3 vs 3 (6 Players)</div>
                  <div className="squad-format-sub">3 per squad • 1 Captain each</div>
                </button>
                <button
                  type="button"
                  className={`squad-format-card ${squadSize === 4 ? "active" : ""}`}
                  onClick={() => setSquadSize(4)}
                >
                  <div className="squad-format-title">4 vs 4 (8 Players)</div>
                  <div className="squad-format-sub">4 per squad • 1 Captain each</div>
                </button>
              </div>
            </div>
          ) : (
            /* Match Type: Rated vs Unrated for Standard Duel */
            <div className="match-type-selector-box" style={{ margin: "12px 0 16px" }}>
              <div className="form-group-header" style={{ marginBottom: "8px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.04em", color: "#cbd5e1" }}>
                  MATCH TYPE
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div
                  className={`match-type-card ${roomType === "RATED" ? "active-rated" : ""}`}
                  onClick={() => setRoomType("RATED")}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: roomType === "RATED" ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.1)",
                    background: roomType === "RATED" ? "rgba(6, 182, 212, 0.12)" : "rgba(15, 23, 42, 0.5)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: roomType === "RATED" ? "#38bdf8" : "#e2e8f0" }}>
                      ⚔️ Rated Match
                    </span>
                    {roomType === "RATED" && <span style={{ background: "#06b6d4", color: "#0f172a", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>ACTIVE</span>}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                    Competitive match. Elo rating &amp; competitive statistics are updated. Earn performance Arena Points.
                  </p>
                </div>

                <div
                  className={`match-type-card ${roomType === "UNRATED" ? "active-unrated" : ""}`}
                  onClick={() => setRoomType("UNRATED")}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: roomType === "UNRATED" ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.1)",
                    background: roomType === "UNRATED" ? "rgba(168, 85, 247, 0.12)" : "rgba(15, 23, 42, 0.5)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", color: roomType === "UNRATED" ? "#c084fc" : "#e2e8f0" }}>
                      🤝 Unrated Practice
                    </span>
                    {roomType === "UNRATED" && <span style={{ background: "#a855f7", color: "#ffffff", fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px" }}>ACTIVE</span>}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0, lineHeight: 1.35 }}>
                    Friendly practice. No Elo changes or rating impact. Safe environment for learning &amp; testing.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                      <FontAwesomeIcon icon={faUsers} /> {battleMode === "SQUAD_BATTLE" ? "Squad Capacity" : "Max Participants"}
                    </label>
                    <span className="form-group-value-badge">
                      {battleMode === "SQUAD_BATTLE" ? `${squadSize * 2} Seats (${squadSize}v${squadSize})` : `${maxPlayers} Seats`}
                    </span>
                  </div>
                  {battleMode === "SQUAD_BATTLE" ? (
                    <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.85rem", color: "#6ee7b7" }}>
                      🛡️ Fixed {squadSize}v{squadSize} Squad ({squadSize} Alpha vs {squadSize} Beta)
                    </div>
                  ) : (
                    <>
                      <CustomHudSelect
                        value={isCustomPlayers ? "CUSTOM" : maxPlayers}
                        onChange={(val) => {
                          if (val === "CUSTOM") {
                            setIsCustomPlayers(true);
                          } else {
                            setIsCustomPlayers(false);
                            setMaxPlayers(Number(val));
                          }
                        }}
                        options={PARTICIPANT_OPTIONS}
                        icon={faUsers}
                      />
                      {isCustomPlayers && (
                        <div className="custom-question-stepper-row" style={{ marginTop: "8px" }}>
                          <button
                            type="button"
                            className="stepper-adjust-btn"
                            onClick={() => setMaxPlayers((prev) => Math.max(2, (Number(prev) || 2) - 1))}
                            disabled={maxPlayers <= 2}
                            title="Decrease participants"
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                          <div className="custom-input-with-label">
                            <input
                              type="number"
                              min={2}
                              max={100}
                              value={maxPlayers}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) setMaxPlayers(Math.min(100, Math.max(2, val)));
                              }}
                              className="custom-question-num-input"
                              placeholder="2-100"
                            />
                            <span className="custom-input-suffix">Seats (2 - 100)</span>
                          </div>
                          <button
                            type="button"
                            className="stepper-adjust-btn"
                            onClick={() => setMaxPlayers((prev) => Math.min(100, (Number(prev) || 2) + 1))}
                            disabled={maxPlayers >= 100}
                            title="Increase participants"
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="form-group-hud">
                  <div className="form-group-header">
                    <label>
                      <FontAwesomeIcon icon={faClock} /> Time Limit
                    </label>
                    <span className="form-group-value-badge">{timeLimit} Mins</span>
                  </div>
                  <CustomHudSelect
                    value={timeLimit}
                    onChange={(val) => setTimeLimit(Number(val))}
                    options={TIME_LIMIT_OPTIONS}
                    icon={faClock}
                  />
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
                      <div className="pill-grid-4">
                        {[1, 3, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`pill-btn ${!isCustomQuestions && questionCount === num ? "active" : ""}`}
                            onClick={() => {
                              setIsCustomQuestions(false);
                              setQuestionCount(num);
                            }}
                          >
                            {num} Qs
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`pill-btn ${isCustomQuestions ? "active" : ""}`}
                          onClick={() => {
                            setIsCustomQuestions(true);
                            if ([1, 3, 5].includes(questionCount)) {
                              setQuestionCount(4);
                            }
                          }}
                        >
                          Custom
                        </button>
                      </div>

                      {isCustomQuestions && (
                        <div className="custom-question-stepper-row">
                          <button
                            type="button"
                            className="stepper-adjust-btn"
                            onClick={() => setQuestionCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                            disabled={questionCount <= 1}
                            title="Decrease question count"
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                          <div className="custom-input-with-label">
                            <input
                              type="number"
                              min={1}
                              max={15}
                              value={questionCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val) || val < 1) {
                                  setQuestionCount(1);
                                } else {
                                  setQuestionCount(Math.min(15, val));
                                }
                              }}
                              className="custom-question-num-input"
                              placeholder="1 - 15"
                            />
                            <span className="custom-input-suffix">
                              {questionCount === 1 ? "Question" : "Questions"} (Limit: 1 - 15)
                            </span>
                          </div>
                          <button
                            type="button"
                            className="stepper-adjust-btn"
                            onClick={() => setQuestionCount((prev) => Math.min(15, (Number(prev) || 1) + 1))}
                            disabled={questionCount >= 15}
                            title="Increase question count"
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        </div>
                      )}
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
                            className={`pill-btn pill-diff-${diff.toLowerCase()} ${difficulty === diff ? "active" : ""}`}
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
                  <span className="form-group-value-badge">
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

            {/* Public vs Private Room Arena Broadcast Toggle */}
            <div className={`form-group-hud public-broadcast-toggle-box ${!isPublic ? "is-private" : ""}`}>
              <div className="broadcast-toggle-header">
                <div className="broadcast-toggle-info">
                  <label className="broadcast-toggle-label" onClick={() => setIsPublic((prev) => !prev)}>
                    <FontAwesomeIcon
                      icon={isPublic ? faBullhorn : faLock}
                      className={`broadcast-toggle-icon ${isPublic ? "icon-public" : "icon-private"}`}
                    />
                    <span>
                      {isPublic
                        ? "Broadcast Public Challenge to Arena"
                        : "Private Challenge (Invite / Room Code Only)"}
                    </span>
                  </label>
                  <span className="broadcast-toggle-subtext">
                    {isPublic
                      ? "Display on Home Screen \"Battle Dispatch\" & flash live notification to active coders"
                      : "Hidden from public arena. Only coders with your room code or direct link can join."}
                  </span>
                </div>
                <button
                  type="button"
                  className={`broadcast-toggle-pill ${isPublic ? "active" : "private-active"}`}
                  onClick={() => setIsPublic((prev) => !prev)}
                >
                  {isPublic ? "PUBLIC" : "PRIVATE"}
                </button>
              </div>
            </div>

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
