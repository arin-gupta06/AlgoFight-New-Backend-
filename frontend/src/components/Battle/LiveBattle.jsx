import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { connectSocket, disconnectSocket } from "../../services/socket";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { requestJson } from "../../services/api";
import { useAntiCheat } from "../../hooks/useAntiCheat";
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
  faUsers,
  faTimes,
  faTrophy,
  faCheckCircle,
  faBolt,
  faChartBar,
  faChevronLeft,
  faChevronRight
} from "@fortawesome/free-solid-svg-icons";
import {
  SUPPORTED_LANGUAGES,
  getStarterCodeForLanguage,
  getLanguageLabel,
} from "../../constants/languages";
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
        className="modal-content-hud"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className={`modal-tag ${isWin ? "win" : "loss"}`}>
              {isWin ? "VICTORY" : "DEFEAT"}
            </span>
            <h2>Battle Summary</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body summary-body">
          <p className="summary-reason">{battleResult.message}</p>
          
          <div className="summary-leaderboard">
            <h3>Final Leaderboard</h3>
            <div className="leaderboard-grid">
              <div className="lb-header">Player</div>
              <div className="lb-header">Points</div>
              <div className="lb-header">Status</div>
              <div className="lb-header">Rating</div>
              {sortedPlayers.map((p, i) => {
                const ratingChange = ratingUpdates?.[p.userId]?.ratingDelta;
                const newRating = ratingUpdates?.[p.userId]?.newRating ?? ratingUpdates?.[p.userId]?.winnerNewRating ?? ratingUpdates?.[p.userId]?.loserNewRating;
                
                const isThisPlayerWinner = 
                  (winnerUserId && p.userId === winnerUserId) ||
                  (p.userId === myUserId && isWin) ||
                  (p.username === battleResult.winner) ||
                  (ratingChange !== undefined && ratingChange > 0 && (sortedPlayers.length <= 2 || i === 0));

                const isThisPlayerForfeited = 
                  p.forfeited || 
                  p.status === "LEFT" || 
                  p.status === "FORFEITED" || 
                  (battleResult.reason === "OPPONENT_FORFEIT" && !isThisPlayerWinner && (p.userId === battleResult.forfeitedUserId || p.username === battleResult.forfeitedPlayer || sortedPlayers.length <= 2));
                
                return (
                  <React.Fragment key={p.userId || i}>
                    <div className="lb-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isThisPlayerWinner && <FontAwesomeIcon icon={faTrophy} style={{ color: "gold" }} />}
                      <RankEmblem rating={newRating || p.rating || 0} size={22} glow={false} />
                      <span style={{ fontWeight: isThisPlayerWinner ? '600' : 'normal' }}>
                        {p.username} {p.userId === myUserId ? <span style={{ opacity: 0.7, fontSize: '0.85em' }}>(You)</span> : null}
                      </span>
                    </div>
                    <div className="lb-cell">{p.points || 0}</div>
                    <div className="lb-cell">
                      {isThisPlayerForfeited ? (
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Forfeited</span>
                      ) : p.solvedCount === problems.length ? (
                        <span style={{ color: '#4ade80', fontWeight: '600' }}>Completed</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Incomplete</span>
                      )}
                    </div>
                    <div className="lb-cell">
                      {newRating !== undefined ? (
                        <span>
                          {newRating} 
                          <span style={{ color: ratingChange > 0 ? '#4ade80' : ratingChange < 0 ? '#ef4444' : '#94a3b8', marginLeft: '6px', fontSize: '0.85em', fontWeight: 'bold' }}>
                            ({ratingChange > 0 ? '+' : ''}{ratingChange})
                          </span>
                        </span>
                      ) : (
                        <span style={{ opacity: 0.5 }}>--</span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="summary-matrix" style={{ marginTop: '20px' }}>
            <h3>Per-Question Breakdown</h3>
            <div className="matrix-grid" style={{ 
               display: 'grid', 
               gridTemplateColumns: `1.5fr repeat(${problems.length}, 1fr)`,
               gap: '10px',
               marginTop: '10px'
            }}>
              <div className="mx-header" style={{ fontWeight: 'bold' }}>Player</div>
              {problems.map((_, i) => (
                <div key={i} className="mx-header" style={{ fontWeight: 'bold', textAlign: 'center' }}>Q{i + 1}</div>
              ))}
              {sortedPlayers.map((p) => (
                <React.Fragment key={p.userId}>
                  <div className="mx-cell" style={{ fontWeight: p.userId === myUserId ? '600' : 'normal' }}>
                    {p.username} {p.userId === myUserId ? "(You)" : ""}
                  </div>
                  {problems.map((prob) => {
                     const solvedData = p.solvedProblems?.find(sp => sp.problemId === prob.id);
                     return (
                        <div key={prob.id} className="mx-cell" style={{ 
                           textAlign: 'center',
                           color: solvedData ? '#4ade80' : '#ef4444',
                           background: 'rgba(255,255,255,0.05)',
                           borderRadius: '4px',
                           padding: '4px'
                        }}>
                          {solvedData ? `✓ ${solvedData.timeString}` : "✗ --"}
                        </div>
                     );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="livebattle-leave-btn" onClick={onClose}>Return to Arena</button>
        </div>
      </motion.div>
    </div>
  );
};

export default function LiveBattle() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { notify } = useNotification();

  const initialMatch = location.state?.matchData;
  const initialRoomCode = location.state?.roomCode;

  const [status, setStatus] = useState(initialMatch || initialRoomCode ? "matched" : "connecting");
  const [problems, setProblems] = useState(initialMatch?.problems || []);
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const [opponentName, setOpponentName] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [timeLeft, setTimeLeft] = useState(initialMatch?.timeLimitSeconds || 0);
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

  // Anti-Cheat Hook
  const { isBlurred, violations } = useAntiCheat(status === "matched");

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

  useEffect(() => {
    if (violations >= 3 && status !== "finished") {
        notify({ type: "error", title: "Disqualified", message: "You have been disqualified for multiple anti-cheat violations.", duration: 5000 });
        setStatus("finished");
        setTimeout(() => {
            navigate("/battle");
        }, 3000);
    }
  }, [violations, status, navigate, notify]);

  const problem = problems[activeProblemIndex] || null;

  // Fetch full room and problem details from API if problem statement/testcases are missing or on direct match entry
  useEffect(() => {
    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
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
          if (roomData.timeLimitMinutes) {
            setTimeLeft((prev) => (prev > 0 ? prev : roomData.timeLimitMinutes * 60));
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
  }, [roomId, initialMatch, initialRoomCode]);

  useEffect(() => {
    if (!problem) return;
    setCode(getStarterCodeForLanguage(problem, language));
  }, [language, problem, activeProblemIndex]);

  const [output, setOutput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [submissionMeta, setSubmissionMeta] = useState(null);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState("idle");
  const socketRef = useRef(null);
  const username = user?.displayName || user?.email || "Player";

  const sampleCases = Array.isArray(problem?.testCases) ? problem.testCases.slice(0, 2) : [];

  useEffect(() => {
    let timer;
    if (status === "matched" && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeLeft]);

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
    if (socketRef.current) {
      socketRef.current.emit("cancel_queue", { userId: user?.uid });
    }
    navigate("/battle");
  };

  const handleLeaveBattle = () => {
    if (status === "finished") {
      navigate("/battle");
      return;
    }

    const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
    if (socketRef.current && targetId) {
      socketRef.current.emit("leave_battle", {
        roomId: targetId,
        userId: user?.uid,
        username,
      });
    }

    notify({
      type: "info",
      title: "Battle Forfeited",
      message: "You have left the battle arena.",
      duration: 3500,
    });

    navigate("/battle");
  };

  const goBack = () => {
    navigate("/battle");
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
      if (socketRef.current && targetId && status !== "finished") {
        socketRef.current.emit("leave_battle", {
          roomId: targetId,
          userId: user?.uid,
          username,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, initialMatch, initialRoomCode, status, user?.uid, username]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const setupSocket = async () => {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      if (cancelled) return;

      socket = connectSocket(token, user?.uid || null, username);
      socketRef.current = socket;

      const initiateBattleQueue = () => {
        const currentTarget = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
        if (currentTarget) {
          socket.emit("join_room_channel", { roomCode: currentTarget, userId: user?.uid, username });
        } else if (status !== "matched") {
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
      if (socket.connected || socket.ws?.readyState === WebSocket.OPEN) {
        initiateBattleQueue();
      }

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
        const result = data?.result || data?.payload?.result || data;
        setRunning(false);
        setRunMode("idle");

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
    };

    setupSocket();

    return () => {
      cancelled = true;
      const targetId = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
      if (socketRef.current && targetId && status !== "finished") {
        socketRef.current.emit("leave_battle", {
          roomId: targetId,
          userId: user?.uid,
          username,
        });
      }

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
      }
    };
  }, [notify, user?.uid, username, roomId, initialMatch, initialRoomCode, status]);

  const onTestCode = () => {
    if (!roomId || !socketRef.current) return;
    setRunning(true);
    setRunMode("test");
    setExecutionTimeline(["PREPARE"]);
    setExecutionTests([]);
    setOutput("Testing against sample cases...");
    socketRef.current.emit("test_code", { code, language, roomId, problemId: problem.id });
  };

  const onSubmitCode = () => {
    if (!roomId || !socketRef.current || !problem) return;
    setRunning(true);
    setRunMode("submit");
    setExecutionTimeline(["PREPARE"]);
    setExecutionTests([]);
    setOutput("Testing against hidden and edge cases...");
    socketRef.current.emit("submit_code", { code, language, roomId, problemId: problem.id });
  };

  if (status === "connecting" || status === "waiting") {
    return (
      <div className="livebattle-page">
        <section className="livebattle-header-card">
          <div className="livebattle-header-copy">
            <div className="livebattle-pre">1V1 RANKED ARENA</div>
            <h1>{status === "connecting" ? "Connecting to Battle Grid" : "Scanning For Challenger"}</h1>
            <p>Distributed matchmaking connects combatants across all active nodes based on skill and rating tier.</p>
          </div>
          <button className="livebattle-leave-btn" onClick={handleCancelQueue}>
            Cancel Queue
          </button>
        </section>

        <section className="livebattle-wait-panel">
          <div className="livebattle-loader">
            {status === "connecting" ? "Establishing Secure Uplink..." : `Finding Opponent (${formatTime(searchElapsed)} / 00:25)`}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap', margin: '4px 0 16px' }}>
            <span className="livebattle-chip" style={{ borderColor: 'rgba(0, 229, 255, 0.4)', color: '#00e5ff', background: 'rgba(0, 229, 255, 0.08)' }}>
              🎯 Bracket: {searchWindow}
            </span>
            <span className="livebattle-chip" style={{ borderColor: 'rgba(124, 255, 193, 0.3)', color: '#7cffc1' }}>
              ⚡ Global Redis Pool Active
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '10px 0 20px', flexWrap: 'wrap' }}>
            <button
              onClick={handlePlayVsBot}
              style={{
                background: 'linear-gradient(135deg, rgba(255, 170, 0, 0.22), rgba(255, 102, 0, 0.12))',
                border: '1px solid rgba(255, 170, 0, 0.5)',
                color: '#ffbe3b',
                fontWeight: 700,
                fontSize: '0.85rem',
                letterSpacing: '0.04em',
                padding: '9px 18px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 170, 0, 0.36), rgba(255, 102, 0, 0.24))';
                e.currentTarget.style.boxShadow = '0 0 14px rgba(255, 170, 0, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 170, 0, 0.22), rgba(255, 102, 0, 0.12))';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span>⚡ Play vs AlgoBot Now (Skip Wait)</span>
            </button>
            <button
              onClick={handleCancelQueue}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#d0dded',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          <div className="livebattle-wait-steps">
            <article>
              <FontAwesomeIcon icon={faUsers} />
              <h3>Distributed Queue</h3>
              <p>Scanning active nodes. Expanding search window every 5 seconds.</p>
            </article>
            <article>
              <FontAwesomeIcon icon={faShieldHalved} />
              <h3>Match Integrity</h3>
              <p>Verifying low latency, sandbox isolation, and fair-play rating bracket.</p>
            </article>
            <article>
              <FontAwesomeIcon icon={faCode} />
              <h3>Problem Suite</h3>
              <p>Auto-generating algorithm challenge set & evaluation test vectors.</p>
            </article>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="livebattle-page">
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

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="livebattle-header-card">
        <div className="livebattle-header-copy" style={{ flex: 1 }}>
          <div className="livebattle-pre">LIVE BATTLE</div>
          <h1>Room {roomId}</h1>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
             {liveState?.players?.map(p => {
                const hasLeft = p.status === 'LEFT' || p.forfeited;
                return (
                  <div
                    key={p.userId}
                    style={{
                      padding: '6px 12px',
                      background: hasLeft ? 'rgba(255, 77, 77, 0.14)' : 'rgba(255,255,255,0.08)',
                      border: hasLeft ? '1px solid rgba(255, 77, 77, 0.45)' : '1px solid rgba(0, 229, 255, 0.16)',
                      borderRadius: '8px',
                      opacity: hasLeft ? 0.6 : 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                     <span style={{ opacity: 0.85, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       {p.username}
                       {hasLeft && (
                         <span style={{ fontSize: '0.68rem', color: '#ff6699', fontWeight: 800, letterSpacing: '0.04em' }}>[LEFT]</span>
                       )}
                     </span>
                     <strong style={{ color: hasLeft ? '#94a3b8' : '#7fefff' }}>{p.points} pts</strong> ({p.solvedCount}/{problems.length})
                  </div>
                );
             })}
          </div>
        </div>

        <div className="livebattle-header-right">
          <div
            className={`livebattle-timer calm-timer ${timeLeft <= 60 && timeLeft > 0 ? "timer-warning" : ""}`}
            aria-label={`Time remaining: ${formatTime(timeLeft)}`}
            title="Time remaining"
          >
            <FontAwesomeIcon icon={faClock} className="timer-icon" />
            <span className="timer-digits">{formatTime(timeLeft)}</span>
          </div>
          <button className="livebattle-leave-btn" onClick={handleLeaveBattle}>
            {status === "finished" ? "Back to Arena" : "Leave Battle"}
          </button>
        </div>
      </motion.section>

      <div className={`livebattle-grid ${!isSubmitPanelOpen ? "submit-panel-collapsed" : ""}`}>
        <section className="livebattle-panel livebattle-problem-panel">
          <div className="livebattle-panel-head" style={{ paddingBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
             <div className="problem-tabs" style={{ display: 'flex', gap: '10px' }}>
                {problems.map((p, idx) => (
                   <button 
                     key={p.id}
                     className={`tab-btn ${activeProblemIndex === idx ? 'active' : ''}`}
                     onClick={() => setActiveProblemIndex(idx)}
                     style={{
                        padding: '10px 16px',
                        background: activeProblemIndex === idx ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: 'none',
                        borderBottom: activeProblemIndex === idx ? '2px solid var(--primary-color)' : '2px solid transparent',
                        color: '#fff',
                        cursor: 'pointer'
                     }}
                   >
                     Q{idx + 1}
                     {liveState?.players?.find(pl => pl.username === username)?.solvedProblems?.find(sp => sp.problemId === p.id) && (
                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#4ade80', marginLeft: '6px' }} />
                     )}
                   </button>
                ))}
             </div>
          </div>

          <div className="livebattle-problem-scroll">
            <ProblemStatement problem={problem} />
          </div>
        </section>

          <section className="livebattle-panel livebattle-editor-panel">
          <div className="livebattle-panel-head">
            <h3>Solution</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <span className="livebattle-chip">{getLanguageLabel(language)}</span>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="livebattle-language-select"
                disabled={status === "finished" || running}
              >
                {SUPPORTED_LANGUAGES.map((langOption) => (
                  <option key={langOption.value} value={langOption.value}>
                    {langOption.label}
                  </option>
                ))}
              </select>
            </div>
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

          <textarea
            className="livebattle-code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
            disabled={status === "finished"}
            style={{ 
                filter: isBlurred ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s'
            }}
          />
          {isBlurred && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ff4d4d', fontWeight: 'bold', fontSize: '1.2rem', background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '8px', zIndex: 10 }}>
                  Return to this window to continue coding!
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
            <div className="livebattle-actions-row">
              <button
                className="livebattle-action-btn test-btn"
                onClick={onTestCode}
                disabled={running || status === "finished"}
              >
                <FontAwesomeIcon icon={faFlask} />
                {running && runMode === "test" ? "Testing..." : "Test (Sample)"}
              </button>

              <button
                className="livebattle-action-btn submit-btn"
                onClick={onSubmitCode}
                disabled={running || status === "finished"}
              >
                <FontAwesomeIcon icon={faForward} />
                {running && runMode === "submit" ? "Submitting..." : "Submit (All)"}
              </button>
              
              <button
                className="livebattle-action-btn detail-btn"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
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
        </section>
        )}
      </div>
    </div>
  );
}
