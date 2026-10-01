import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { connectSocket, disconnectSocket } from "../../services/socket";
import { getSessionToken } from "../../services/authStorage";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { useActiveEvent } from "../../contexts/ActiveEventContext";
import { requestJson } from "../../services/api";
import { useAntiCheat } from "../../hooks/useAntiCheat";
import { saveLocalDraft, getLocalDraft, getAllLocalDrafts, saveAllLocalDrafts, reconcileCheckpoints, markDraftAcked, clearDraft } from "../../services/storage/indexedDbRecovery.js";
import ProblemStatement from "../Common/problem/ProblemStatement.jsx";
import DetailedAnalysisModal from "../Common/modals/DetailedAnalysisModal.jsx";
import RankEmblem from "../Common/gamification/RankEmblem";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCode,
  faFlask,
  faForward,
  faShieldHalved,
  faTimes,
  faTrophy,
  faCheckCircle,
  faBolt,
  faChartBar,
  faChevronLeft,
  faChevronRight,
  faExpand,
  faCompress,
  faPaperPlane,
  faSpinner,
  faCheck,
  faWandMagicSparkles,
  faRotateLeft,
  faRotateRight,
  faKeyboard,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import {
  SUPPORTED_LANGUAGES,
  getStarterCodeForLanguage,
  getLanguageLabel,
} from "../../constants/languages";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import SmartCodeEditor from "../Common/editor/SmartCodeEditor.jsx";
import "./LiveBattle.css";

const PostBattleSummaryModal = ({ battleResult, liveState, problems, ratingUpdates, currentUser, currentUsername, onClose }) => {
  if (!battleResult) return null;

  const myUserId = currentUser?.uid;
  const myRatingData = myUserId ? ratingUpdates?.[myUserId] : null;
  const myRatingDelta = myRatingData?.ratingDelta;

  // Determining win status reliably across all payloads and rating deltas
  const isWin =
    battleResult.isWin === true ||
    battleResult.winner === "You" ||
    (myRatingDelta !== undefined && myRatingDelta > 0) ||
    (battleResult.winnerId && myUserId && battleResult.winnerId === myUserId) ||
    (battleResult.winner && currentUsername && (battleResult.winner === currentUsername || battleResult.winner === "You")) ||
    (battleResult.reason === "OPPONENT_FORFEIT" && battleResult.forfeitedUserId !== myUserId && battleResult.forfeitedPlayer !== currentUsername);

  // Identify winning user id
  let winnerUserId = battleResult.winnerId;
  if (!winnerUserId && isWin && myUserId) {
    winnerUserId = myUserId;
  }
  if (!winnerUserId && ratingUpdates) {
    const sortedDeltas = Object.entries(ratingUpdates).sort(([, a], [, b]) => (b.ratingDelta ?? 0) - (a.ratingDelta ?? 0));
    if (sortedDeltas.length > 0 && (sortedDeltas[0][1]?.ratingDelta ?? 0) > 0) {
      winnerUserId = sortedDeltas[0][0];
    }
  }

  // Sort players: winner first, then by rating delta, then points, then solved count
  const sortedPlayers = [...(liveState?.players || [])].sort((a, b) => {
    if (winnerUserId) {
      if (a.userId === winnerUserId) return -1;
      if (b.userId === winnerUserId) return 1;
    }
    const aDelta = ratingUpdates?.[a.userId]?.ratingDelta ?? 0;
    const bDelta = ratingUpdates?.[b.userId]?.ratingDelta ?? 0;
    if (aDelta !== bDelta) return bDelta - aDelta;
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    return (b.solvedCount || 0) - (a.solvedCount || 0);
  });

  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-content-hud summary-modal-content"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className={`modal-tag ${isWin ? "win" : "loss"}`}>
              {isWin ? "VICTORY" : "DEFEAT"}
            </span>
            <h2>Battle Summary</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close summary">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body summary-body">
          <p className="summary-reason">{battleResult.message}</p>

          {(() => {
            const mePlayer = sortedPlayers.find((p) => p.userId === myUserId);
            const mySwitches = mePlayer?.tabSwitches || 0;
            return (
              <div className={`summary-tab-switches-badge ${mySwitches > 0 ? 'has-switches' : ''}`}>
                <FontAwesomeIcon icon={faShieldHalved} />
                <span>Your Total Tab Switches: <strong>{mySwitches}</strong></span>
              </div>
            );
          })()}
          
          <div className="summary-leaderboard">
            <h3 className="summary-section-title">Final Leaderboard</h3>
            <div className="leaderboard-grid">
              <div className="lb-header">Player</div>
              <div className="lb-header">Points</div>
              <div className="lb-header">Status</div>
              <div className="lb-header">Tab Switches</div>
              <div className="lb-header">Rating</div>
              {sortedPlayers.map((p, i) => {
                const ratingChange = ratingUpdates?.[p.userId]?.ratingDelta;
                const newRating = ratingUpdates?.[p.userId]?.newRating ?? ratingUpdates?.[p.userId]?.winnerNewRating ?? ratingUpdates?.[p.userId]?.loserNewRating;
                
                const isThisPlayerWinner = 
                  (winnerUserId && p.userId === winnerUserId) ||
                  (p.userId === myUserId && isWin) ||
                  (p.username === battleResult.winner) ||
                  (ratingChange !== undefined && ratingChange > 0 && (sortedPlayers.length <= 2 || i === 0));

                const isThisPlayerDisqualified = p.disqualified || p.status === "DISQUALIFIED";
                const isThisPlayerForfeited = 
                  p.forfeited || 
                  p.status === "LEFT" || 
                  p.status === "FORFEITED" || 
                  (battleResult.reason === "OPPONENT_FORFEIT" && !isThisPlayerWinner && (p.userId === battleResult.forfeitedUserId || p.username === battleResult.forfeitedPlayer || sortedPlayers.length <= 2));
                
                return (
                  <React.Fragment key={p.userId || i}>
                    <div className="lb-cell lb-player-cell">
                      {isThisPlayerWinner && <FontAwesomeIcon icon={faTrophy} className="summary-trophy-icon" />}
                      <RankEmblem rating={newRating || p.rating || 0} size={22} glow={false} />
                      <span className={`summary-player-name ${isThisPlayerWinner ? 'is-winner' : ''}`}>
                        {p.username} {p.userId === myUserId ? <span className="summary-you-tag">(You)</span> : null}
                      </span>
                    </div>
                    <div className="lb-cell lb-points-cell">{p.points || 0}</div>
                    <div className="lb-cell">
                      {isThisPlayerDisqualified ? (
                        <span className="summary-status-disqualified">Disqualified</span>
                      ) : isThisPlayerForfeited ? (
                        <span className="summary-status-forfeit">Forfeited</span>
                      ) : p.solvedCount === problems.length ? (
                        <span className="summary-status-complete">Completed</span>
                      ) : (
                        <span className="summary-status-incomplete">Incomplete</span>
                      )}
                    </div>
                    <div className="lb-cell lb-switches-cell">
                      <span className={`summary-switches-count ${(p.tabSwitches || 0) > 0 ? 'has-switches' : ''}`}>
                        {p.tabSwitches || 0}
                      </span>
                    </div>
                    <div className="lb-cell lb-rating-cell">
                      {newRating !== undefined ? (
                        <span>
                          {newRating} 
                          <span className={`summary-delta-tag ${ratingChange > 0 ? 'delta-pos' : ratingChange < 0 ? 'delta-neg' : 'delta-zero'}`}>
                            ({ratingChange > 0 ? '+' : ''}{ratingChange})
                          </span>
                        </span>
                      ) : (
                        <span className="summary-muted-dash">--</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="summary-matrix">
            <h3 className="summary-section-title">Per-Question Breakdown</h3>
            <div 
              className="matrix-grid" 
              style={{ gridTemplateColumns: `1.5fr repeat(${problems.length}, 1fr)` }}
            >
              <div className="mx-header">Player</div>
              {problems.map((_, i) => (
                <div key={i} className="mx-header mx-header-center">Q{i + 1}</div>
              ))}
              {sortedPlayers.map((p) => (
                <React.Fragment key={p.userId}>
                  <div className={`mx-cell mx-player-cell ${p.userId === myUserId ? 'is-me' : ''}`}>
                    {p.username} {p.userId === myUserId ? "(You)" : ""}
                  </div>
                  {problems.map((prob) => {
                     const solvedData = p.solvedProblems?.find(sp => sp.problemId === prob.id);
                     return (
                        <div 
                          key={prob.id} 
                          className={`mx-cell mx-result-cell ${solvedData ? 'solved' : 'unsolved'}`}
                        >
                          {solvedData ? `✓ ${solvedData.timeString}` : "✗ --"}
                        </div>
                     );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions summary-modal-actions">
          <button className="livebattle-return-btn" onClick={onClose}>
            Return to Arena
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function LiveBattle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode: paramRoomCode } = useParams();
  const { user } = useAuth();
  const username = user?.displayName || user?.email?.split("@")[0] || "Player";
  const { notify } = useNotification();
  const { setActiveEvent, clearActiveEvent } = useActiveEvent();

  const initialMatch = location.state?.matchData;
  const initialRoomCode = paramRoomCode || location.state?.roomCode;

  const [status, setStatus] = useState(initialMatch || initialRoomCode ? "matched" : "connecting");
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced" | "pending_sync" | "degraded"
  const saveDebounceTimer = useRef(null);
  const statusRef = useRef(status);
  
  useEffect(() => {
      statusRef.current = status;
  }, [status]);

  const [problems, setProblems] = useState(initialMatch?.problems || []);
  const [mySolvedCount, setMySolvedCount] = useState(0);
  const [opponentSolvedCount, setOpponentSolvedCount] = useState(0);
  const [battleId, setBattleId] = useState(null);
  const [myPerformanceScore, setMyPerformanceScore] = useState(0);
  
  const slowNotificationTimer = useRef(null);

  // Gamification states
  const [myRankBefore, setMyRankBefore] = useState("ROOKIE");
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const activeProblemIndexRef = useRef(0);
  useEffect(() => {
    activeProblemIndexRef.current = activeProblemIndex;
  }, [activeProblemIndex]);

  const [codeByProblem, setCodeByProblem] = useState({});
  const codeByProblemRef = useRef({});
  useEffect(() => {
    codeByProblemRef.current = codeByProblem;
  }, [codeByProblem]);

  const [opponentName, setOpponentName] = useState("");
  const [code, setCode] = useState("");
  const codeRef = useRef("");
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const [language, setLanguage] = useState("javascript");
  const languageRef = useRef("javascript");
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  const editorRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(() => {
    const targetId = initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    if (initialMatch?.persistedTimeRemaining !== undefined && !isNaN(Number(initialMatch.persistedTimeRemaining))) {
      return Math.max(0, Number(initialMatch.persistedTimeRemaining));
    }
    if (targetId && user?.uid) {
      try {
        const saved = localStorage.getItem(`af_persisted_time_${targetId}_${user.uid}`);
        if (saved !== null && !isNaN(Number(saved))) {
          return Math.max(0, Number(saved));
        }
      } catch (_) {}
    }
    return initialMatch?.timeLimitSeconds || 0;
  });
  const timeLeftRef = useRef(timeLeft);
  const [liveState, setLiveState] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [roomId, setRoomId] = useState(initialMatch?.roomId || null);
  const [battleResult, setBattleResult] = useState(null);
  const [ratingUpdates, setRatingUpdates] = useState(null);
  
  const [executionTimeline, setExecutionTimeline] = useState([]);
  const [executionTests, setExecutionTests] = useState([]);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [isSubmitPanelOpen, setIsSubmitPanelOpen] = useState(true);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [searchWindow, setSearchWindow] = useState("±50 ELO");
  const [isSelfDisqualified, setIsSelfDisqualified] = useState(false);
  const [reentryStatus, setReentryStatus] = useState("idle"); // "idle" | "pending" | "approved" | "rejected"
  const [incomingPardonRequest, setIncomingPardonRequest] = useState(null);

  // Sync active battle session so user can roam and return
  useEffect(() => {
    if (status === "matched") {
      const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
      if (targetId) {
        setActiveEvent({
          type: "BATTLE",
          roomId: targetId,
          roomCode: targetId,
          status: "RUNNING",
          timeLimitSeconds: timeLeft,
          isDisqualified: isSelfDisqualified,
          tabSwitches: 0,
        });
      }
    }
  }, [status, roomId, initialRoomCode, paramRoomCode, timeLeft, isSelfDisqualified, setActiveEvent]);

  // Fullscreen Mode State & Auto-Trigger
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
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen().catch(() => {});
        }
      }
    };
  }, []);

  // Auto trigger fullscreen mode on first interaction when battle is matched
  useEffect(() => {
    if (status === "matched") {
      const handleFirstInteraction = () => {
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen().catch(() => {});
          }
        }
      };
      window.addEventListener("pointerdown", handleFirstInteraction, { once: true });
      return () => window.removeEventListener("pointerdown", handleFirstInteraction);
    }
  }, [status]);

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

  const currentTargetRoomId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;

  // Anti-Cheat Hook
  const { isBlurred, violations, tabSwitches, isDisqualified, setIsDisqualified, resetViolations } = useAntiCheat(
    status === "matched" && !isSelfDisqualified,
    {
      roomId: currentTargetRoomId,
      onTabSwitch: (count) => {
        setActiveEvent((prev) => (prev ? { ...prev, tabSwitches: count } : prev));
      },
      onDisqualified: (count) => {
        setIsSelfDisqualified(true);
        notify({
          type: "error",
          title: "Anti-Cheat Disqualification",
          message: `Disqualified for ${count} tab switches. Code editor and submissions locked. Re-entry requires host approval.`,
          duration: 7000,
        });
        setActiveEvent((prev) => (prev ? { ...prev, isDisqualified: true, tabSwitches: count } : prev));
      },
    }
  );

  // Synchronize anti-cheat status from liveState if server marks player disqualified
  useEffect(() => {
    const myPlayer = liveState?.players?.find((p) => p.userId === user?.uid || p.username === username);
    if (myPlayer?.disqualified || myPlayer?.status === "DISQUALIFIED") {
      if (!isSelfDisqualified) {
        setIsSelfDisqualified(true);
        setIsDisqualified(true);
      }
    }
  }, [liveState, user?.uid, username, isSelfDisqualified, setIsDisqualified]);

  // Search Timer Interval when queued
  useEffect(() => {
    let interval = null;
    if (status === "waiting") {
      setSearchElapsed(0);
      interval = setInterval(() => {
        setSearchElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchElapsed(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  const problem = problems[activeProblemIndex] || null;

  // Ensure both combatants always display in the 1v1 battle header
  const battlePlayers = useMemo(() => {
    if (Array.isArray(liveState?.players) && liveState.players.length > 0) {
      return liveState.players;
    }
    if (Array.isArray(initialMatch?.players) && initialMatch.players.length > 0) {
      return initialMatch.players.map((p, idx) => {
        if (typeof p === "string") {
          return {
            userId: p === username ? (user?.uid || "me") : `p_${idx}`,
            username: p,
            points: 0,
            solvedCount: 0,
            rating: p === username ? (user?.rating || 1200) : 1200,
          };
        }
        return p;
      });
    }
    return [
      { userId: user?.uid || "me", username: username || "You", points: 0, solvedCount: 0, rating: user?.rating || 1200 },
      { userId: "opponent", username: opponentName || "Opponent", points: 0, solvedCount: 0, rating: 1200 }
    ];
  }, [liveState?.players, initialMatch?.players, username, user?.uid, user?.rating, opponentName]);

  // Fetch full room and problem details from API if problem statement/testcases are missing or on direct match entry
  useEffect(() => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    if (!targetId) return;

    let active = true;
    requestJson(`/api/battle/rooms/${encodeURIComponent(targetId)}`)
      .then((data) => {
        if (!active) return;
        const roomData = data?.room || data;
        if (roomData) {
          if (roomData.id) setRoomId(roomData.id);
          if (Array.isArray(roomData.problems) && roomData.problems.length > 0) {
            setProblems(roomData.problems);
          }
          if (roomData.persistedTimeRemaining !== undefined && !isNaN(Number(roomData.persistedTimeRemaining))) {
            setTimeLeft(Math.max(0, Number(roomData.persistedTimeRemaining)));
          } else {
            const savedLocal = user?.uid ? localStorage.getItem(`af_persisted_time_${targetId}_${user.uid}`) : null;
            if (savedLocal !== null && !isNaN(Number(savedLocal))) {
              setTimeLeft(Math.max(0, Number(savedLocal)));
            } else if (roomData.timeLimitMinutes) {
              setTimeLeft((prev) => (prev > 0 ? prev : roomData.timeLimitMinutes * 60));
            }
          }
          setStatus("matched");
        }
      })
      .catch((err) => {
        console.warn("Could not load battle room details from REST API:", err?.message || err);
      });

    return () => {
      active = false;
    };
  }, [roomId, initialMatch, initialRoomCode, paramRoomCode]);

  // 🛡️ AF-CHK: Load all local problem drafts on room initialization and request Redis checkpoints
  useEffect(() => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    if (!targetId || !user?.uid) return;

    let active = true;
    getAllLocalDrafts("battle", targetId, user.uid).then((allDrafts) => {
      if (!active) return;
      if (allDrafts && Object.keys(allDrafts).length > 0) {
        setCodeByProblem((prev) => {
          const next = { ...allDrafts, ...prev };
          codeByProblemRef.current = next;
          return next;
        });
      }
    });

    if (socketRef.current?.connected) {
      socketRef.current.emit("get_checkpoints", { roomId: targetId });
    }

    return () => {
      active = false;
    };
  }, [roomId, initialMatch, initialRoomCode, paramRoomCode, user?.uid]);

  // 🛡️ AF-CHK: Set editor buffer when problem changes or when drafts hydrate
  useEffect(() => {
    if (!problem) return;
    const currentProbId = problem?.id || `p_${activeProblemIndex}`;
    const saved = codeByProblemRef.current[currentProbId];
    if (saved && saved.code) {
      setCode(saved.code);
      if (saved.language) setLanguage(saved.language);
      setSyncStatus(saved.syncStatus || "synced");
    } else {
      const starter = getStarterCodeForLanguage(problem, languageRef.current);
      setCode(starter);
    }
  }, [problem?.id, activeProblemIndex]);

  // 🛡️ AF-CHK: Immediate Synchronous Problem Switching (No 2-second debounce loss)
  const switchProblem = (nextIdx) => {
    if (nextIdx === activeProblemIndexRef.current) return;

    const currentProb = problems[activeProblemIndexRef.current];
    const currentProbId = currentProb?.id || (currentProb ? `p_${activeProblemIndexRef.current}` : null);
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;

    let nextMap = { ...codeByProblemRef.current };
    if (currentProbId) {
      const currentCode = codeRef.current;
      const currentLang = languageRef.current;
      const existing = nextMap[currentProbId];
      const nextRev = (existing?.revision || existing?.localRevision || 0) + 1;
      nextMap[currentProbId] = {
        problemId: currentProbId,
        code: currentCode,
        language: currentLang,
        revision: nextRev,
        localRevision: nextRev,
        updatedAt: Date.now(),
        isDirty: false,
      };
      codeByProblemRef.current = nextMap;
      setCodeByProblem(nextMap);

      // 1. Immediately flush to IndexedDB
      if (targetId && user?.uid) {
        saveAllLocalDrafts({
          activityType: "battle",
          activityId: targetId,
          userId: user.uid,
          checkpoints: nextMap,
        });
      }

      // 2. Immediately emit to Redis / WebSocket (zero debounce wait)
      if (socketRef.current?.connected && targetId) {
        socketRef.current.emit("checkpoint_sync", {
          roomId: targetId,
          checkpoints: nextMap,
        });
      }
    }

    // Load destination problem
    const nextProb = problems[nextIdx];
    const nextProbId = nextProb?.id || (nextProb ? `p_${nextIdx}` : null);
    const destinationSaved = nextProbId ? nextMap[nextProbId] : null;

    const nextLang = destinationSaved?.language || languageRef.current || "javascript";
    const nextCode = destinationSaved?.code !== undefined
      ? destinationSaved.code
      : (nextProb ? getStarterCodeForLanguage(nextProb, nextLang) : "");

    setLanguage(nextLang);
    setCode(nextCode);
    setActiveProblemIndex(nextIdx);
  };

  // 🛡️ AF-CHK: Handle code changes with in-memory update and 1.5s background debounce
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    setSyncStatus("pending_sync");

    const currentProb = problems[activeProblemIndexRef.current];
    const currentProbId = currentProb?.id || (currentProb ? `p_${activeProblemIndexRef.current}` : null);
    if (!currentProbId) return;

    const now = Date.now();
    const existing = codeByProblemRef.current[currentProbId];
    const nextRev = (existing?.revision || existing?.localRevision || 0) + 1;

    const updatedEntry = {
      problemId: currentProbId,
      code: newCode,
      language: languageRef.current,
      revision: nextRev,
      localRevision: nextRev,
      updatedAt: now,
      isDirty: true,
    };

    const nextMap = { ...codeByProblemRef.current, [currentProbId]: updatedEntry };
    codeByProblemRef.current = nextMap;
    setCodeByProblem(nextMap);

    if (saveDebounceTimer.current) {
      clearTimeout(saveDebounceTimer.current);
    }

    saveDebounceTimer.current = setTimeout(async () => {
      const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
      if (!targetId || !user?.uid) return;

      try {
        await saveAllLocalDrafts({
          activityType: "battle",
          activityId: targetId,
          userId: user.uid,
          checkpoints: codeByProblemRef.current,
        });

        if (socketRef.current?.connected) {
          socketRef.current.emit("checkpoint_sync", {
            roomId: targetId,
            checkpoints: codeByProblemRef.current,
          });
        } else {
          setSyncStatus("degraded");
        }
      } catch (err) {
        console.warn("Autosave draft error:", err);
      }
    }, 1500);
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const currentProb = problems[activeProblemIndexRef.current];
    const currentProbId = currentProb?.id || (currentProb ? `p_${activeProblemIndexRef.current}` : null);
    if (!currentProbId) return;

    const existing = codeByProblemRef.current[currentProbId];
    const currentProbStarter = currentProb ? getStarterCodeForLanguage(currentProb, languageRef.current) : "";
    const isStarterOrEmpty = !codeRef.current || codeRef.current.trim() === "" || codeRef.current.trim() === currentProbStarter.trim();

    let newCode = codeRef.current;
    if (isStarterOrEmpty && currentProb) {
      newCode = getStarterCodeForLanguage(currentProb, newLang);
      setCode(newCode);
    }

    const nextRev = (existing?.revision || existing?.localRevision || 0) + 1;
    const updatedEntry = {
      problemId: currentProbId,
      code: newCode,
      language: newLang,
      revision: nextRev,
      localRevision: nextRev,
      updatedAt: Date.now(),
      isDirty: true,
    };
    const nextMap = { ...codeByProblemRef.current, [currentProbId]: updatedEntry };
    codeByProblemRef.current = nextMap;
    setCodeByProblem(nextMap);
  };


  const [output, setOutput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [submissionMeta, setSubmissionMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState("idle");
  const socketRef = useRef(null);

  const sampleCases = Array.isArray(problem?.testCases) ? problem.testCases.slice(0, 2) : [];

  // Always keep timeLeftRef and localStorage in sync with the exact second remaining
  useEffect(() => {
    timeLeftRef.current = timeLeft;
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    if (targetId && user?.uid && timeLeft > 0) {
      try {
        localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(timeLeft));
      } catch (_) {}
    }
  }, [timeLeft, roomId, initialMatch, initialRoomCode, paramRoomCode, user?.uid]);

  useEffect(() => {
    let timer;
    if (status === "matched" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          if (next > 0 && next % 10 === 0 && socketRef.current?.connected) {
            const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
            if (targetId && user?.uid) {
              socketRef.current.emit("sync_timer_remaining", {
                roomId: targetId,
                userId: user.uid,
                timeRemaining: next,
              });
            }
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeLeft > 0, roomId, initialMatch, initialRoomCode, paramRoomCode, user?.uid]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handlePlayVsBot = () => {
    if (socketRef.current) {
      socketRef.current.emit("play_vs_bot", { username, userId: user?.uid });
      notify({ type: "info", title: "Solo Mode", message: "Spawning AlgoBot duel..." });
    }
  };

  const handleCancelQueue = () => {
    clearActiveEvent();
    if (socketRef.current) {
      socketRef.current.emit("cancel_queue", { userId: user?.uid });
    }
    navigate("/battle");
  };

  const handleLeaveBattle = () => {
    clearActiveEvent();
    if (status === "finished") {
      navigate("/battle");
      return;
    }

    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
    const remainingToSave = timeLeftRef.current || timeLeft;

    if (targetId && user?.uid && remainingToSave > 0) {
      try {
        localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(remainingToSave));
        const blob = new Blob([JSON.stringify({ userId: user.uid, timeRemaining: remainingToSave })], {
          type: "application/json",
        });
        navigator.sendBeacon(`/api/battle/rooms/${encodeURIComponent(targetId)}/persist-time`, blob);
      } catch (_) {}
    }

    if (socketRef.current && targetId) {
      socketRef.current.emit("leave_battle", {
        roomId: targetId,
        userId: user?.uid,
        username,
        timeRemaining: remainingToSave,
      });
    }

    notify({
      type: "info",
      title: "Left Battle Arena",
      message: "You have left the battle room. Your remaining time has been saved.",
      duration: 3500,
    });

    navigate("/battle");
  };

  const goBack = () => {
    clearActiveEvent();
    navigate("/battle");
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
      const currentProblemId = problem?.id || activeProblemIndex;
      if (targetId && user?.uid) {
        try {
          if (code) {
            const key = `af_draft_battle_${targetId}_${currentProblemId}_${user.uid}`;
            localStorage.setItem(key, JSON.stringify({
              code,
              language,
              updatedAt: Date.now(),
            }));
          }
          if (timeLeftRef.current > 0) {
            localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(timeLeftRef.current));
            const blob = new Blob([JSON.stringify({ userId: user.uid, timeRemaining: timeLeftRef.current })], {
              type: "application/json",
            });
            navigator.sendBeacon(`/api/battle/rooms/${encodeURIComponent(targetId)}/persist-time`, blob);
          }
        } catch (_) {}
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [roomId, initialMatch, initialRoomCode, paramRoomCode, problem?.id, activeProblemIndex, user?.uid, code, language]);

  // 🛡️ AF-CHK: Reconcile server checkpoints with local in-memory & IndexedDB state
  const applyServerCheckpoints = (serverCheckpoints) => {
    if (!serverCheckpoints || typeof serverCheckpoints !== "object") return;
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    const currentMap = { ...codeByProblemRef.current };
    let hasChanges = false;

    for (const [probId, sCp] of Object.entries(serverCheckpoints)) {
      if (!sCp || !sCp.code) continue;
      const localCp = currentMap[probId];
      const winner = reconcileCheckpoints(localCp, sCp);
      if (winner) {
        currentMap[probId] = {
          problemId: probId,
          code: winner.code,
          language: winner.language || "javascript",
          revision: winner.revision || winner.localRevision || 1,
          localRevision: winner.revision || winner.localRevision || 1,
          updatedAt: winner.updatedAt || Date.now(),
          isDirty: false,
          syncStatus: "synced",
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      codeByProblemRef.current = currentMap;
      setCodeByProblem(currentMap);

      if (targetId && user?.uid) {
        saveAllLocalDrafts({
          activityType: "battle",
          activityId: targetId,
          userId: user.uid,
          checkpoints: currentMap,
        });
      }

      const currProb = problems[activeProblemIndexRef.current];
      const currProbId = currProb?.id || (currProb ? `p_${activeProblemIndexRef.current}` : null);
      if (currProbId && currentMap[currProbId]) {
        const activeWin = currentMap[currProbId];
        setCode(activeWin.code);
        if (activeWin.language) setLanguage(activeWin.language);
      }
      setSyncStatus("synced");
    }
  };

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const setupSocket = async () => {
      const token = typeof user?.getIdToken === "function"
        ? await user.getIdToken().catch(() => null)
        : (user ? getSessionToken() : null);
      if (cancelled) return;

      socket = connectSocket(token, user?.uid || null, username);
      socketRef.current = socket;

      const initiateBattleQueue = () => {
        const currentTarget = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
        if (currentTarget) {
          socket.emit("join_room_channel", { roomCode: currentTarget, userId: user?.uid, username });
        } else if (statusRef.current !== "matched") {
          setStatus("waiting");
          notify({ type: "info", title: "Matchmaking", message: "Searching for a 1v1 challenger...", duration: 2600 });
          socket.emit("find_match", {
            userId: user?.uid,
            username,
            email: user?.email,
            token,
          });
        }
      };

      socket.on("connect", initiateBattleQueue);

      socket.on("waiting_for_opponent", (data) => {
        if (!roomId && !initialMatch) {
          setStatus("waiting");
          if (data?.searchWindow) setSearchWindow(data.searchWindow);
        }
      });

      socket.on("matchmaking_status", (data) => {
        if (data?.searchWindow) {
          setSearchWindow(data.searchWindow);
        }
      });

      socket.on("matchmaking_timeout", (data) => {
        clearActiveEvent();
        notify({ type: "warning", title: "Matchmaking Failed", message: data?.message || "No available player found for 1v1 battle.", duration: 5000 });
        navigate("/battle");
      });

      socket.on("match_found", (data) => {
        const rid = data?.roomId || data?.payload?.roomId;
        const probs = data?.problems || (data?.problem ? [data.problem] : []);
        const players = Array.isArray(data?.players) ? data.players : [username, "Opponent"];
        
        setRoomId(rid);
        setProblems(probs);
        setActiveProblemIndex(0);
        setLanguage("javascript");
        if (data.timeLimitSeconds) setTimeLeft(data.timeLimitSeconds);
        
        setCode("// write your solution here");
        setOutput("");
        setLastResult(null);
        setExecutionTimeline([]);
        setExecutionTests([]);
        setSubmissionMeta(null);

        const opp = players.find((p) => p !== username) || "Opponent";
        setOpponentName(opp);
        setStatus("matched");

        notify({ type: "success", title: "Match Found", message: `You are now battling ${opp}.`, duration: 3000 });
      });

      socket.on("battle_started", (data) => {
        const rid = data?.roomId || data?.payload?.roomId;
        const probs = data?.problems || (data?.problem ? [data.problem] : []);
        
        setRoomId(rid);
        setProblems(probs);
        setActiveProblemIndex(0);
        setLanguage("javascript");
        if (data.timeLimitSeconds) setTimeLeft(data.timeLimitSeconds);
        
        setCode("// write your solution here");
        setOutput("");
        setLastResult(null);
        setExecutionTimeline([]);
        setExecutionTests([]);
        setStatus("matched");

        notify({ type: "success", title: "Battle Started", message: `The group battle has begun!`, duration: 3000 });
      });

      socket.on("battle_state_sync", (state) => {
        setLiveState(state);
        if (state?.myCheckpoints && typeof state.myCheckpoints === "object") {
          applyServerCheckpoints(state.myCheckpoints);
        }
      });

      socket.on("checkpoints_restored", (data) => {
        if (data?.checkpoints && typeof data.checkpoints === "object") {
          applyServerCheckpoints(data.checkpoints);
        }
      });


      socket.on("execution_progress", (data) => {
          if (data.stage === "PREPARE" || data.stage === "COMPILE") {
              setExecutionTimeline(prev => [...prev.filter(s => s !== data.stage), data.stage]);
          } else if (data.stage === "TEST_STARTED") {
              setExecutionTimeline(prev => [...prev.filter(s => s !== "TEST_STARTED"), "TEST_STARTED"]);
          } else if (data.stage === "TEST_COMPLETED") {
              setExecutionTests(prev => {
                  const updated = [...prev];
                  updated[data.testCaseIndex] = data.testCaseResult;
                  return updated;
              });
          }
      });

      socket.on("code_result", (data) => {
        setRunning(false);
        setRunMode("idle");
        
        if (slowNotificationTimer.current) {
            clearTimeout(slowNotificationTimer.current);
            slowNotificationTimer.current = null;
        }

        const result = data.result || data;
        const isSuccess = result?.success || false;
        const testCases = result?.results || [];
        const passedCount = testCases.filter(tc => tc.passed).length;
        const totalCount = testCases.length || 1;
        
        let outputText = isSuccess ? "All test cases passed successfully!" : "Some test cases failed.\n";
        if (!isSuccess && testCases.length > 0) {
            const failedTc = testCases.find(tc => !tc.passed);
            if (failedTc) {
                outputText += `\nError: ${failedTc.error || "Wrong Answer"}`;
                if (failedTc.input) outputText += `\nInput: ${failedTc.input}`;
                if (failedTc.expected) outputText += `\nExpected: ${failedTc.expected}`;
                if (failedTc.actual) outputText += `\nActual: ${failedTc.actual}`;
            }
        }

        const uiResult = {
            passed: isSuccess,
            passedTestCases: passedCount,
            totalTestCases: totalCount,
            executionTime: result?.executionTime || 0,
            memoryUsage: result?.memoryUsage || 0,
            verdict: result?.verdict || (isSuccess ? "ACCEPTED" : "WRONG_ANSWER"),
            testCaseResults: testCases,
            output: outputText
        };

        setLastResult(uiResult);
        setOutput(uiResult.output);

        if (uiResult.passed) {
          notify({ type: "success", title: "Execution Passed", message: `Passed ${passedCount}/${totalCount} test cases.`, duration: 2200 });
        } else {
          notify({ type: "error", title: "Execution Failed", message: `Passed ${passedCount}/${totalCount} test cases.`, duration: 2200 });
        }
      });

      socket.on("error", (errorMsg) => {
        setRunning(false);
        setRunMode("idle");
        
        if (slowNotificationTimer.current) {
            clearTimeout(slowNotificationTimer.current);
            slowNotificationTimer.current = null;
        }
        
        const message = typeof errorMsg === "string" ? errorMsg : errorMsg?.message || "An error occurred during execution.";
        setOutput(`Error:\n${message}\n\nPlease check if your Piston sandbox is running or your code has syntax errors.`);
        notify({ type: "error", title: "Execution Error", message, duration: 4000 });
      });

      socket.on("battle_over", (data) => {
        const winnerId = data?.winnerId;
        const winnerName = data?.winnerUsername || data?.winner || "Opponent";
        const myUid = user?.uid;
        const myName = username;

        // Check if the current client is the winner or the one who forfeited
        const isIWinner = (winnerId && myUid && winnerId === myUid) ||
                          (winnerName && (winnerName === myName || winnerName === "You"));
        const isIForfeited = (data?.forfeitedUserId && myUid && data.forfeitedUserId === myUid) ||
                             (data?.forfeitedPlayer && data.forfeitedPlayer === myName);

        const youWin = isIWinner || (!isIForfeited && data?.reason === "OPPONENT_FORFEIT");

        let message = `Time is up! ${winnerName} wins.`;
        if (data.reason === "ALL_SOLVED") {
          message = youWin ? "You completed all questions first!" : `${winnerName} completed all questions first!`;
        } else if (data.reason === "OPPONENT_FORFEIT") {
          if (isIForfeited) {
            message = "You forfeited the match.";
          } else {
            message = data.forfeitedPlayer ? `${data.forfeitedPlayer} forfeited the match! You win!` : "Your opponent forfeited! You win!";
          }
        }
        
        setBattleResult({
          winner: youWin ? "You" : winnerName,
          winnerId,
          winnerUsername: winnerName,
          reason: data?.reason,
          forfeitedPlayer: data?.forfeitedPlayer,
          forfeitedUserId: data?.forfeitedUserId,
          isWin: youWin,
          message,
        });
        if (data.finalState) {
           setLiveState(data.finalState);
        }
        setStatus("finished");
        setShowSummary(true);
        clearActiveEvent();

        if (data.reason === "OPPONENT_FORFEIT") {
          notify({
            type: youWin ? "success" : "error",
            title: youWin ? "🏆 Victory by Forfeit!" : "Match Forfeited",
            message,
            duration: 6000,
          });
        }
      });

      socket.on("player_left_battle", (data) => {
        const departed = data?.username || "A combatant";
        notify({
          type: "warning",
          title: "Combatant Left Battle",
          message: `${departed} has departed from the battle arena.${data?.remainingActiveCount !== undefined ? ` (${data.remainingActiveCount} remaining)` : ""}`,
          duration: 5000,
        });

        // Instantly update liveState to show [LEFT] badge
        setLiveState((prev) => {
          if (!prev || !Array.isArray(prev.players)) return prev;
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.userId === data?.userId || p.username === departed
                ? { ...p, status: "LEFT", forfeited: true }
                : p
            ),
          };
        });
      });

      socket.on("battle_forfeited", (data) => {
        notify({
          type: "info",
          title: "Match Forfeited",
          message: data?.reason || "A player has surrendered the match.",
          duration: 5000,
        });
      });

      socket.on("opponent_disconnected", (data) => {
        const discUser = data?.username || "Opponent";
        notify({
          type: "warning",
          title: "Combatant Disconnected",
          message: `${discUser} lost connection! They have 60 seconds to reconnect before forfeiting.`,
          duration: 6000,
        });
      });

      socket.on("opponent_reconnected", (data) => {
        const recUser = data?.username || "Opponent";
        notify({
          type: "success",
          title: "Combatant Reconnected",
          message: `${recUser} is back in the battle!`,
          duration: 3000,
        });
      });

      socket.on("rating_updates", (updates) => {
        setRatingUpdates(updates);
      });

      // Issue 1: Server acknowledgment of checkpoint
      socket.on("checkpoint_ack", (data) => {
        const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
        if (data?.problemId && data?.revision && targetId && user?.uid) {
          const dKey = `battle_${targetId}_${data.problemId}_${user.uid}`;
          markDraftAcked({ draftKey: dKey, revision: data.revision });
          setSyncStatus("synced");
        }
      });

      // Issue 4: Host moderation events
      socket.on("player_kicked", (data) => {
        if (data?.targetUserId === user?.uid) {
          notify({
            type: "error",
            title: "Removed from Battle",
            message: data?.reason || "You were removed from this battle by the host.",
            duration: 6000,
          });
          navigate("/battle");
        } else {
          notify({
            type: "warning",
            title: "Player Kicked",
            message: `${data?.targetUsername || "A combatant"} was removed by the host.`,
            duration: 4000,
          });
        }
      });

      socket.on("player_readmitted", (data) => {
        const isMe = data?.targetUserId === user?.uid || data?.userId === user?.uid;
        if (isMe) {
          setIsSelfDisqualified(false);
          setIsDisqualified(false);
          resetViolations();
          setReentryStatus("approved");
          if (data?.persistedTimeRemaining !== undefined && !isNaN(Number(data.persistedTimeRemaining))) {
            const rest = Math.max(0, Number(data.persistedTimeRemaining));
            setTimeLeft(rest);
            const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
            if (targetId && user?.uid) {
              try {
                localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(rest));
              } catch (_) {}
            }
          }
          notify({
            type: "success",
            title: "Re-admitted to Battle!",
            message: "You were re-admitted by the host. Your remaining battle time has been restored!",
            duration: 4000,
          });
          setActiveEvent((prev) => (prev ? { ...prev, isDisqualified: false } : prev));
          setTimeout(() => setReentryStatus("idle"), 3000);
        } else {
          notify({
            type: "info",
            title: "Player Re-admitted",
            message: `${data?.targetUsername || data?.username || "Player"} was re-admitted by the host.`,
            duration: 3500,
          });
        }
        setIncomingPardonRequest((prev) => (prev && (prev.targetUserId === data?.targetUserId || prev.userId === data?.targetUserId) ? null : prev));
      });

      socket.on("timer_restored", (data) => {
        if (data?.persistedTimeRemaining !== undefined && !isNaN(Number(data.persistedTimeRemaining))) {
          const rest = Math.max(0, Number(data.persistedTimeRemaining));
          setTimeLeft(rest);
          const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
          if (targetId && user?.uid) {
            try {
              localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(rest));
            } catch (_) {}
          }
        }
      });

      socket.on("readmitted_to_battle", (data) => {
        setIsSelfDisqualified(false);
        setIsDisqualified(false);
        resetViolations();
        setReentryStatus("approved");
        if (data?.persistedTimeRemaining !== undefined && !isNaN(Number(data.persistedTimeRemaining))) {
          const rest = Math.max(0, Number(data.persistedTimeRemaining));
          setTimeLeft(rest);
          const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
          if (targetId && user?.uid) {
            try {
              localStorage.setItem(`af_persisted_time_${targetId}_${user.uid}`, String(rest));
            } catch (_) {}
          }
        }
        notify({
          type: "success",
          title: "Re-admitted to Battle!",
          message: data?.message || "You have been re-admitted to the battle by the host. Your time has been restored.",
          duration: 4000,
        });
        setActiveEvent((prev) => (prev ? { ...prev, isDisqualified: false } : prev));
        setTimeout(() => setReentryStatus("idle"), 3000);
      });

      socket.on("anti_cheat_disqualified", (data) => {
        if (data?.targetUserId === user?.uid || !data?.targetUserId) {
          setIsSelfDisqualified(true);
          setIsDisqualified(true);
          notify({
            type: "error",
            title: "Anti-Cheat Disqualification",
            message: data?.reason || "Disqualified for anti-cheat violations. Request host approval to re-enter.",
            duration: 7000,
          });
          setActiveEvent((prev) => (prev ? { ...prev, isDisqualified: true, tabSwitches: data?.tabSwitches || 3 } : prev));
        }
      });

      socket.on("anticheat_pardon_requested", (data) => {
        setIncomingPardonRequest(data);
        notify({
          type: "warning",
          title: "Re-Entry Requested",
          message: `${data.username || data.targetUsername || "A player"} was disqualified for anti-cheat (${data.tabSwitches || 3} tab switches) and is asking for pardon.`,
          duration: 8000,
        });
      });

      socket.on("anticheat_reentry_approved", (data) => {
        if (data?.targetUserId === user?.uid || !data?.targetUserId) {
          setIsSelfDisqualified(false);
          setIsDisqualified(false);
          resetViolations();
          setReentryStatus("approved");
          notify({
            type: "success",
            title: "Re-Entry Approved!",
            message: "The host has approved your re-entry. You may resume coding and submitting!",
            duration: 5000,
          });
          setActiveEvent((prev) => (prev ? { ...prev, isDisqualified: false } : prev));
          setTimeout(() => setReentryStatus("idle"), 3000);
        }
        setIncomingPardonRequest((prev) => (prev && (prev.targetUserId === data?.targetUserId || prev.userId === data?.targetUserId) ? null : prev));
      });

      socket.on("anticheat_reentry_rejected", (data) => {
        if (data?.targetUserId === user?.uid || !data?.targetUserId) {
          setReentryStatus("rejected");
          notify({
            type: "error",
            title: "Request Declined",
            message: data?.reason || "The host declined your re-entry request.",
            duration: 6000,
          });
        }
        setIncomingPardonRequest((prev) => (prev && (prev.targetUserId === data?.targetUserId || prev.userId === data?.targetUserId) ? null : prev));
      });

      socket.on("anticheat_reentry_pending", () => {
        setReentryStatus("pending");
      });

      socket.on("disconnect", () => {
        setSyncStatus("degraded");
      });
    };

    setupSocket();

    return () => {
      cancelled = true;

      // Issue 2 & 4: Do NOT forfeit on component unmount / tab refresh.
      // Forfeits should ONLY occur on explicit 'Leave Battle' button click or expired grace window.

      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("waiting_for_opponent");
        socketRef.current.off("match_found");
        socketRef.current.off("battle_started");
        socketRef.current.off("battle_state_sync");
        socketRef.current.off("execution_progress");
        socketRef.current.off("code_result");
        socketRef.current.off("battle_over");
        socketRef.current.off("player_left_battle");
        socketRef.current.off("battle_forfeited");
        socketRef.current.off("opponent_disconnected");
        socketRef.current.off("opponent_reconnected");
        socketRef.current.off("rating_updates");
        socketRef.current.off("matchmaking_timeout");
        socketRef.current.off("checkpoint_ack");
        socketRef.current.off("checkpoints_restored");
        socketRef.current.off("player_kicked");
        socketRef.current.off("player_readmitted");
        socketRef.current.off("timer_restored");
        socketRef.current.off("readmitted_to_battle");
        socketRef.current.off("anti_cheat_disqualified");
        socketRef.current.off("anticheat_pardon_requested");
        socketRef.current.off("anticheat_reentry_approved");
        socketRef.current.off("anticheat_reentry_rejected");
        socketRef.current.off("anticheat_reentry_pending");
        socketRef.current.off("disconnect");
      }
      
      if (slowNotificationTimer.current) clearTimeout(slowNotificationTimer.current);
    };
  }, [notify, user?.uid, username, roomId, initialMatch, initialRoomCode, paramRoomCode]);

  const handleSendReentryRequest = () => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    if (socketRef.current && targetId) {
      socketRef.current.emit("request_anticheat_reentry", {
        roomId: targetId,
        userId: user?.uid,
        username,
        tabSwitches: tabSwitches || violations || 3,
      });
      setReentryStatus("pending");
      notify({
        type: "info",
        title: "Request Sent",
        message: "Sent re-entry request to host. Awaiting approval...",
        duration: 4000,
      });
    }
  };

  const handleApprovePardon = (req) => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    const targetUserId = req?.targetUserId || req?.userId;
    if (socketRef.current && targetId && targetUserId) {
      socketRef.current.emit("approve_anticheat_reentry", {
        roomId: targetId,
        targetUserId,
      });
      setIncomingPardonRequest(null);
      notify({
        type: "success",
        title: "Pardon Approved",
        message: `Approved re-entry for ${req?.targetUsername || req?.username || "player"}.`,
        duration: 3500,
      });
    }
  };

  const handleDeclinePardon = (req) => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
    const targetUserId = req?.targetUserId || req?.userId;
    if (socketRef.current && targetId && targetUserId) {
      socketRef.current.emit("reject_anticheat_reentry", {
        roomId: targetId,
        targetUserId,
      });
      setIncomingPardonRequest(null);
      notify({
        type: "info",
        title: "Request Declined",
        message: `Declined re-entry for ${req?.targetUsername || req?.username || "player"}.`,
        duration: 3000,
      });
    }
  };

  const onTestCode = () => {
    if (!roomId || !socketRef.current) return;
    setRunning(true);
    setRunMode("test");
    setExecutionTimeline(["PREPARE"]);
    setExecutionTests([]);
    setOutput("Testing against sample cases...");
    socketRef.current.emit("test_code", { code, language, roomId, problemId: problem.id });
    
    if (slowNotificationTimer.current) clearTimeout(slowNotificationTimer.current);
    slowNotificationTimer.current = setTimeout(() => {
        notify({
            type: "info",
            title: "Evaluating...",
            message: "The platform is taking a little longer to get the result. Please hold on!",
            autoClose: 5000
        });
    }, 5000);
  };

  const onSubmitCode = () => {
    if (!roomId || !socketRef.current || !problem) return;
    setRunning(true);
    setRunMode("submit");
    setExecutionTimeline(["PREPARE"]);
    setExecutionTests([]);
    setOutput("Testing against hidden and edge cases...");
    socketRef.current.emit("submit_code", { code, language, roomId, problemId: problem.id });
    
    if (slowNotificationTimer.current) clearTimeout(slowNotificationTimer.current);
    slowNotificationTimer.current = setTimeout(() => {
        notify({
            type: "info",
            title: "Evaluating...",
            message: "The platform is taking a little longer to get the result. Please hold on!",
            autoClose: 5000
        });
    }, 5000);
  };

  if (status === "connecting" || status === "waiting") {
    return (
      <BackgroundPaths>
        <div className="livebattle-page wait-mode">
          <section className="livebattle-header-card wait-header-card">
            <div className="livebattle-header-left">
              <button 
                type="button" 
                className="btn-livebattle-back" 
                onClick={handleCancelQueue}
                title="Exit to Arena"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                <span>Arena</span>
              </button>
              <div className="livebattle-header-copy">
                <h1 className="livebattle-hero-title">
                  {status === "connecting" ? "Connecting to Arena..." : "Finding Opponent..."}
                </h1>
                <p className="livebattle-hero-sub">
                  Matching you with a contender near your bracket ({user?.rating ?? 1200} ELO). Match starts automatically.
                </p>
              </div>
            </div>
            <button className="livebattle-leave-btn cancel-queue-btn" onClick={handleCancelQueue}>
              <FontAwesomeIcon icon={faTimes} />
              <span>Cancel</span>
            </button>
          </section>

          <section className="livebattle-wait-panel">
            {/* Radar & Search Timer */}
            <div className="matchmaking-radar-section">
              <div className="matchmaking-radar-halo">
                <div className="radar-sweep" />
                <div className="radar-crosshair-h" />
                <div className="radar-crosshair-v" />
                <div className="radar-ring ring-1" />
                <div className="radar-ring ring-2" />
                <div className="radar-core-pulse">
                  <FontAwesomeIcon icon={faBolt} className="radar-bolt-icon" />
                </div>
              </div>

              <div className="matchmaking-status-text">
                <div className="livebattle-timer-chip">
                  <FontAwesomeIcon icon={faClock} />
                  <span className="timer-elapsed">{formatTime(searchElapsed)}</span>
                </div>
              </div>
            </div>

            {/* Matchup Duel Preview Cards */}
            <div className="matchmaking-duel-preview">
              {/* User Card */}
              <div className="matchmaking-combatant-card is-user">
                <div className="combatant-role-tag">YOU</div>
                <div className="combatant-avatar-wrap">
                  <RankEmblem rating={user?.rating ?? 1200} size={44} glow={true} />
                </div>
                <div className="combatant-name">{username}</div>
                <div className="combatant-rating-pill">
                  <span className="rating-num">{user?.rating ?? 1200}</span>
                  <span className="rating-lbl">ELO</span>
                </div>
                <div className="combatant-status ready">
                  <span className="combatant-pulse-dot" /> Ready
                </div>
              </div>

              {/* Center VS Indicator */}
              <div className="matchmaking-vs-node">
                <div className="vs-badge-glow">VS</div>
                {searchWindow && (
                  <div className="vs-window-chip">
                    <span>{searchWindow}</span>
                  </div>
                )}
              </div>

              {/* Opponent Target Card */}
              <div className="matchmaking-combatant-card is-searching">
                <div className="combatant-role-tag searching">OPPONENT</div>
                <div className="combatant-avatar-wrap searching">
                  <div className="searching-spinner-ring" />
                  <span className="searching-glyph">?</span>
                </div>
                <div className="combatant-name searching-text">Searching...</div>
                <div className="combatant-status searching">
                  <FontAwesomeIcon icon={faSpinner} spin className="searching-icon" /> Matching
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="livebattle-wait-actions">
              <button
                type="button"
                className="livebattle-bot-cta-btn"
                onClick={handlePlayVsBot}
              >
                <FontAwesomeIcon icon={faBolt} />
                <span>Play vs Bot</span>
              </button>
              <button
                type="button"
                className="livebattle-cancel-cta-btn"
                onClick={handleCancelQueue}
              >
                <FontAwesomeIcon icon={faTimes} />
                <span>Cancel</span>
              </button>
            </div>

            {/* Battle Info / Rules HUD Strip */}
            <div className="matchmaking-rules-strip">
              <div className="matchmaking-rule-item">
                <FontAwesomeIcon icon={faBolt} className="rule-icon icon-cyan" />
                <div className="rule-text">
                  <strong>Speed & Accuracy</strong>
                  <span>Fastest correct solution with passing testcases wins.</span>
                </div>
              </div>
              <div className="matchmaking-rule-item">
                <FontAwesomeIcon icon={faShieldHalved} className="rule-icon icon-purple" />
                <div className="rule-text">
                  <strong>Anti-Cheat Active</strong>
                  <span>Tab switching and code pasting are tracked.</span>
                </div>
              </div>
              <div className="matchmaking-rule-item">
                <FontAwesomeIcon icon={faTrophy} className="rule-icon icon-amber" />
                <div className="rule-text">
                  <strong>Ranked Duel</strong>
                  <span>Earn ELO rating and unlock prestigious badges.</span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <Footer />
      </BackgroundPaths>
    );
  }

  return (
    <BackgroundPaths>
      <div className={`livebattle-page ${isFullscreen ? "is-fullscreen-mode" : ""}`}>
        <AnimatePresence>
          {incomingPardonRequest && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              className="host-pardon-floating-banner"
            >
              <div className="pardon-banner-content">
                <div className="pardon-icon">
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
                <div className="pardon-text">
                  <strong>Pardon Request: {incomingPardonRequest.username || incomingPardonRequest.targetUsername || "A Player"}</strong>
                  <span>
                    Disqualified for {incomingPardonRequest.tabSwitches || 3} tab switches. Approve re-entry to the battle?
                  </span>
                </div>
                <div className="pardon-btn-group">
                  <button className="pardon-btn approve" onClick={() => handleApprovePardon(incomingPardonRequest)}>
                    <FontAwesomeIcon icon={faCheck} /> Approve Re-Entry
                  </button>
                  <button className="pardon-btn decline" onClick={() => handleDeclinePardon(incomingPardonRequest)}>
                    <FontAwesomeIcon icon={faTimes} /> Decline
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {showSummary && (
           <PostBattleSummaryModal 
             battleResult={battleResult} 
             liveState={liveState} 
             problems={problems}
             ratingUpdates={ratingUpdates}
             currentUser={user}
             currentUsername={username}
             onClose={goBack} 
           />
        )}

        {/* Standalone Full-Screen Detailed Analysis Portal Modal */}
        <DetailedAnalysisModal
          isOpen={showDetailedAnalysis}
          onClose={() => setShowDetailedAnalysis(false)}
          result={lastResult}
          problem={problem}
        />

        <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="livebattle-header-card">
          <div className="livebattle-header-left">
            <button 
              type="button" 
              className="btn-livebattle-back" 
              onClick={handleLeaveBattle}
              title="Exit to Battle Arena"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Arena</span>
            </button>

            <div className="livebattle-room-info">
              <div className="livebattle-room-pill">
                <span className="badge-pulse-dot" />
                <span className="room-code-tag">
                  #{roomId ? (roomId.length > 12 ? roomId.slice(0, 8) : roomId) : "BTL"}
                </span>
                {roomId && (
                  <button 
                    className="livebattle-copy-code-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(roomId);
                      notify({ type: "success", title: "Copied!", message: `Room code ${roomId} copied.` });
                    }}
                    title="Copy full room ID"
                  >
                    <FontAwesomeIcon icon={faCode} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Center Matchup Duel Hub */}
          <div className="livebattle-header-center">
            <div className="livebattle-players-matchup">
              {battlePlayers.map((p, idx) => {
                const hasLeft = p.status === 'LEFT' || p.forfeited;
                const isMe = p.username === username || p.userId === user?.uid;
                const isWinner = battleResult && (battleResult.winnerId === p.userId || battleResult.winner === p.username);
                const playerRating = p.rating || (isMe ? (user?.rating || 1200) : 1200);
                const totalProblemsCount = Math.max(problems.length, 1);
                const solveProgressPct = Math.min(100, Math.round(((p.solvedCount || 0) / totalProblemsCount) * 100));

                return (
                  <React.Fragment key={p.userId || idx}>
                    {idx > 0 && <div className="matchup-vs-divider">VS</div>}
                    <div className={`player-score-card ${isMe ? 'is-me' : ''} ${hasLeft ? 'is-left' : ''} ${isWinner ? 'is-winner' : ''}`}>
                      <div className="player-avatar-badge-wrap">
                        <div className="player-avatar">
                          {(p.username || "P")[0].toUpperCase()}
                        </div>
                        <div className="player-rank-emblem-mini">
                          <RankEmblem rating={playerRating} size={18} glow={false} />
                        </div>
                      </div>

                      <div className="player-info">
                        <div className="player-name-row">
                          <span className="player-username">{p.username}</span>
                          {isMe && <span className="you-badge">YOU</span>}
                          {p.disqualified && (
                            <span className="disqualified-badge">
                              DISQUALIFIED ({p.tabSwitches || 3})
                            </span>
                          )}
                          {hasLeft && !p.disqualified && <span className="left-badge">LEFT</span>}
                          {isWinner && <span className="winner-badge"><FontAwesomeIcon icon={faTrophy} /> WIN</span>}
                          {/* Host participant controls */}
                          {((liveState?.hostId && liveState.hostId === user?.uid) || (initialMatch?.hostId && initialMatch.hostId === user?.uid)) && !isMe && (
                            p.disqualified ? (
                              <button
                                type="button"
                                className="host-btn pardon-btn"
                                onClick={() => {
                                  const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
                                  if (socketRef.current && targetId) {
                                    socketRef.current.emit("approve_anticheat_reentry", { roomId: targetId, targetUserId: p.userId });
                                    notify({ type: "info", title: "Host Action", message: `Pardoned ${p.username}. Re-admitted to match.` });
                                  }
                                }}
                              >
                                Pardon
                              </button>
                            ) : hasLeft ? (
                              <button
                                type="button"
                                className="host-btn readmit-btn"
                                onClick={() => {
                                  const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
                                  if (socketRef.current && targetId) {
                                    socketRef.current.emit("readmit_player", { roomId: targetId, targetUserId: p.userId });
                                    notify({ type: "info", title: "Host Action", message: `Re-admitting ${p.username}...` });
                                  }
                                }}
                              >
                                Re-admit
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="host-btn kick-btn"
                                onClick={() => {
                                  const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode || paramRoomCode;
                                  if (socketRef.current && targetId) {
                                    socketRef.current.emit("kick_player", { roomId: targetId, targetUserId: p.userId, reason: "Host moderation" });
                                    notify({ type: "warning", title: "Host Action", message: `Removed ${p.username} from match.` });
                                  }
                                }}
                              >
                                Kick
                              </button>
                            )
                          )}
                        </div>
                        <div className="player-score-row">
                          <span className="player-pts">{p.points || 0} pts</span>
                          <span className="player-solved">({p.solvedCount || 0}/{problems.length} solved)</span>
                          <span className="player-elo-tag">{playerRating} ELO</span>
                        </div>
                        <div className="player-solved-progress-bar">
                          <div 
                            className="player-solved-progress-fill" 
                            style={{ width: `${solveProgressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="livebattle-header-right">
            {/* Active Problem Headline in Header */}
            {problem && (
              <div className="livebattle-header-problem-info">
                <span className="problem-index-chip">Q{activeProblemIndex + 1}</span>
                <span className="problem-title-text">{problem.title || "Challenge Problem"}</span>
                {problem.difficulty && (
                  <span className={`problem-diff-badge diff-${problem.difficulty.toLowerCase()}`}>
                    {problem.difficulty}
                  </span>
                )}
              </div>
            )}
            <button 
              className="livebattle-fullscreen-btn" 
              onClick={toggleFullScreen}
              title={isFullscreen ? "Exit Fullscreen" : "Full Screen Mode"}
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
            </button>
            <div
              className={`livebattle-timer calm-timer ${timeLeft <= 60 && timeLeft > 0 ? "timer-warning" : ""}`}
              aria-label={`Time remaining: ${formatTime(timeLeft)}`}
              title="Time remaining"
            >
              <FontAwesomeIcon icon={faClock} className="timer-icon" />
              <span className="timer-digits">{formatTime(timeLeft)}</span>
            </div>
            <button className="livebattle-leave-btn" onClick={handleLeaveBattle}>
              <FontAwesomeIcon icon={faTimes} />
              <span>{status === "finished" ? "Exit Arena" : "Leave Battle"}</span>
            </button>
          </div>
        </motion.section>

      <div 
        ref={gridRef}
        className={`livebattle-grid ${!isSubmitPanelOpen ? "submit-panel-collapsed" : ""} ${isDraggingLeft || isDraggingRight ? "is-resizing" : ""}`}
      >
        <section 
          className="livebattle-panel livebattle-problem-panel"
          style={{ flex: `0 0 ${leftWidth}%`, minWidth: "220px", maxWidth: "55%" }}
        >
          <div className="livebattle-panel-head problem-panel-head">
             <div className="problem-tabs">
                {problems.map((p, idx) => (
                   <button 
                     key={p.id}
                     className={`tab-btn ${activeProblemIndex === idx ? 'active' : ''}`}
                     onClick={() => switchProblem(idx)}
                   >
                     <span>Q{idx + 1}</span>
                     {liveState?.players?.find(pl => pl.username === username)?.solvedProblems?.find(sp => sp.problemId === p.id) && (
                        <FontAwesomeIcon icon={faCheckCircle} className="solved-check-icon" />
                     )}
                   </button>
                ))}
             </div>
          </div>

          <div className="livebattle-problem-scroll">
            <ProblemStatement problem={problem} />
          </div>
        </section>

        <div 
          className={`livebattle-resize-handle ${isDraggingLeft ? "active" : ""}`}
          onMouseDown={handleMouseDownLeft}
          title="Drag to resize Question & Solution panels"
        >
          <div className="resize-handle-bar" />
        </div>

        <section 
          className="livebattle-panel livebattle-editor-panel"
          style={{ flex: "1 1 0%", minWidth: "240px" }}
        >
          <div className="livebattle-panel-head">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FontAwesomeIcon icon={faCode} style={{ color: "#00e5ff", fontSize: "0.9rem" }} />
              <h3>Solution</h3>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <select 
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="livebattle-language-select"
                disabled={status === "finished" || running}
              >
                {SUPPORTED_LANGUAGES.map((langOption) => (
                  <option key={langOption.value} value={langOption.value}>
                    {langOption.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="livebattle-action-btn format-btn"
                onClick={() => editorRef.current?.formatCode?.()}
                title="Format Code with Prettier (Shift+Alt+F)"
                disabled={status === "finished" || isSelfDisqualified}
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: "#ea5e9e" }} />
                <span>Format</span>
              </button>
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

          <div className="code-editor-wrapper" style={{ position: "relative" }}>
            {isSelfDisqualified && (
              <div className="live-disqualified-overlay">
                <div className="live-disqualified-card">
                  <div className="disqualified-icon">
                    <FontAwesomeIcon icon={faShieldHalved} />
                  </div>
                  <h3>Disqualified for Anti-Cheat Violation</h3>
                  <p>
                    You have accumulated {tabSwitches || 3} tab switches. Code editing and submissions are locked.
                  </p>
                  <div className="disqualified-actions">
                    {reentryStatus === "pending" ? (
                      <div className="status-pill pending">
                        <FontAwesomeIcon icon={faSpinner} spin /> Request Sent — Waiting for Host Approval...
                      </div>
                    ) : reentryStatus === "rejected" ? (
                      <div className="rejected-flow">
                        <div className="status-pill rejected">
                          <FontAwesomeIcon icon={faTimes} /> Host Declined Re-Entry Request
                        </div>
                        <button className="request-pardon-btn" onClick={handleSendReentryRequest}>
                          <FontAwesomeIcon icon={faPaperPlane} /> Retry Re-Entry Request
                        </button>
                      </div>
                    ) : (
                      <button className="request-pardon-btn" onClick={handleSendReentryRequest}>
                        <FontAwesomeIcon icon={faPaperPlane} /> Send Re-Entry Request to Host
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            <SmartCodeEditor
              ref={editorRef}
              value={code}
              onChange={handleCodeChange}
              language={language}
              disabled={status === "finished" || isSelfDisqualified}
              isBlurred={isBlurred}
              problemId={problem?.id}
              onRun={onTestCode}
              onSubmit={onSubmitCode}
              errorLocation={
                (lastResult?.error?.line || lastResult?.structuredError?.line)
                  ? {
                      line: lastResult?.error?.line || lastResult?.structuredError?.line,
                      column: lastResult?.error?.column || lastResult?.structuredError?.column,
                      message: lastResult?.error?.message || lastResult?.structuredError?.message,
                    }
                  : null
              }
            />
            <div className="code-editor-statusbar">
              <div className="statusbar-left">
                <button
                  type="button"
                  className="statusbar-prettier-badge"
                  onClick={() => editorRef.current?.formatCode?.()}
                  title="Format Code with Prettier (Shift+Alt+F)"
                  disabled={status === "finished" || isSelfDisqualified}
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  <span>Prettier</span>
                  <span className="prettier-shortcut">Shift+Alt+F</span>
                </button>
                <button
                  type="button"
                  className="statusbar-editor-action-btn"
                  onClick={() => editorRef.current?.undo?.()}
                  title="Undo (Ctrl+Z / ⌘Z)"
                  disabled={status === "finished" || isSelfDisqualified}
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  <span>Undo</span>
                  <span className="editor-shortcut-hint">Ctrl+Z</span>
                </button>
                <button
                  type="button"
                  className="statusbar-editor-action-btn"
                  onClick={() => editorRef.current?.redo?.()}
                  title="Redo (Ctrl+Y / ⌘Shift+Z)"
                  disabled={status === "finished" || isSelfDisqualified}
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                  <span>Redo</span>
                  <span className="editor-shortcut-hint">Ctrl+Y</span>
                </button>
                <button
                  type="button"
                  className="statusbar-editor-action-btn shortcuts-btn"
                  onClick={() => editorRef.current?.openShortcuts?.()}
                  title="Keyboard Shortcuts Guide (F1)"
                >
                  <FontAwesomeIcon icon={faKeyboard} />
                  <span>Shortcuts</span>
                  <span className="editor-shortcut-hint">F1</span>
                </button>
              </div>
              <div className="statusbar-right">
                <span>{code ? code.split('\n').length : 0} Lines</span>
                <span>{code ? code.length : 0} Chars</span>
                <span
                  className={`sync-status-indicator ${syncStatus}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "1px 8px",
                    borderRadius: "10px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: syncStatus === "synced" ? "rgba(124, 255, 193, 0.12)" : syncStatus === "pending_sync" ? "rgba(255, 170, 0, 0.15)" : "rgba(255, 77, 77, 0.18)",
                    color: syncStatus === "synced" ? "#7cffc1" : syncStatus === "pending_sync" ? "#ffbe3b" : "#ff6b6b",
                    border: `1px solid ${syncStatus === "synced" ? "rgba(124, 255, 193, 0.3)" : syncStatus === "pending_sync" ? "rgba(255, 170, 0, 0.35)" : "rgba(255, 77, 77, 0.35)"}`,
                  }}
                >
                  {syncStatus === "synced" ? "☁️ Synced" : syncStatus === "pending_sync" ? "💾 Local Saved" : "⚠️ Local Only (Degraded)"}
                </span>
                <span className="syntax-badge">{getLanguageLabel(language)}</span>
              </div>
            </div>
          </div>
          {isBlurred && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ff4d4d', fontWeight: 'bold', fontSize: '1.1rem', background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,77,77,0.4)', padding: '16px 24px', borderRadius: '12px', zIndex: 10 }}>
                  Return to this window to continue coding!
              </div>
          )}
        </section>

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
            <div className="livebattle-actions-row">
              <button
                className="livebattle-action-btn test-btn"
                onClick={onTestCode}
                disabled={running || status === "finished" || isSelfDisqualified}
              >
                <FontAwesomeIcon icon={faFlask} />
                {running && runMode === "test" ? "Testing..." : "Test (Sample)"}
              </button>

              <button
                className="livebattle-action-btn submit-btn"
                onClick={onSubmitCode}
                disabled={running || status === "finished" || isSelfDisqualified}
              >
                <FontAwesomeIcon icon={faForward} />
                {running && runMode === "submit" ? "Submitting..." : "Submit (All)"}
              </button>
              
              <button
                className="livebattle-action-btn detail-btn"
                onClick={() => setShowDetailedAnalysis(true)}
                disabled={!lastResult || running}
              >
                <FontAwesomeIcon icon={faChartBar} />
                Detailed Analysis
              </button>
            </div>

            {lastResult ? (
              <div className="livebattle-result-meta">
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

            <div className="livebattle-output-box">
              <div className="console-bar">
                <div className="console-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-yellow" />
                  <span className="dot dot-green" />
                </div>
                <span className="console-title">Execution Console</span>
              </div>
              <div className="console-content">
                {running ? (
                  <div className="execution-timeline">
                    <div className="timeline-nodes" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        {['PREPARE', 'COMPILE', 'TEST_STARTED'].map(stage => (
                            <div key={stage} style={{ 
                                color: executionTimeline.includes(stage) ? '#4ade80' : 'rgba(255,255,255,0.3)',
                                fontSize: '0.8rem',
                                fontWeight: 'bold'
                            }}>
                                {stage} {executionTimeline.includes(stage) ? '✓' : '...'}
                            </div>
                        ))}
                    </div>
                    <div className="livebattle-tests-progress" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {executionTests.map((tc, idx) => (
                            <div key={idx} style={{ 
                                padding: '10px', 
                                borderRadius: '8px', 
                                background: tc.passed ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${tc.passed ? '#4ade80' : '#ef4444'}`,
                                fontSize: '0.9rem'
                            }}>
                                <strong style={{ color: tc.passed ? '#4ade80' : '#ef4444' }}>
                                    Test Case {idx + 1} - {tc.passed ? 'PASSED' : 'FAILED'}
                                </strong>
                                <div style={{ marginTop: '4px', opacity: 0.8, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Time: {tc.metrics?.executionTime}ms</span>
                                    <span>Memory: {(tc.metrics?.memoryUsage / (1024 * 1024)).toFixed(2)} MB</span>
                                </div>
                                {runMode === "test" && (
                                    <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', overflowX: 'auto' }}>
                                        <div style={{color: '#aaa'}}>Input:</div>
                                        <div>{tc.expectedOutput ? problem?.testCases?.[idx]?.input : "Hidden"}</div>
                                        <div style={{color: '#aaa', marginTop: '4px'}}>Expected:</div>
                                        <div>{tc.expectedOutput || "Hidden"}</div>
                                        <div style={{color: '#aaa', marginTop: '4px'}}>Actual:</div>
                                        <div style={{ color: tc.passed ? '#fff' : '#ef4444'}}>{tc.actualOutput || "Hidden"}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <pre>{output || "Output will appear here."}</pre>
                )}
              </div>
            </div>
          </div>
        </section>
        </>
        )}
      </div>
    </div>
    {!isFullscreen && status !== "matched" && <Footer />}
  </BackgroundPaths>
);
}
