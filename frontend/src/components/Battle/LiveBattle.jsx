import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { connectSocket, disconnectSocket } from "../../services/socket";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { requestJson } from "../../services/api";
import { useAntiCheat } from "../../hooks/useAntiCheat";
import ProblemStatement from "../Common/ProblemStatement.jsx";
import DetailedAnalysisModal from "../Common/DetailedAnalysisModal.jsx";
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
import "./LiveBattle.css";

const PostBattleSummaryModal = ({ battleResult, liveState, problems, ratingUpdates, onClose }) => {
  if (!battleResult) return null;
  const isWin = battleResult.winner === "You";

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
              {liveState?.players?.map((p, i) => {
                const ratingChange = ratingUpdates?.[p.userId]?.ratingDelta;
                const newRating = ratingUpdates?.[p.userId]?.winnerNewRating;
                
                return (
                  <React.Fragment key={p.userId}>
                    <div className="lb-cell">
                      {i === 0 && <FontAwesomeIcon icon={faTrophy} style={{ color: "gold", marginRight: "8px" }} />}
                      {p.username}
                    </div>
                    <div className="lb-cell">{p.points}</div>
                    <div className="lb-cell">{p.solvedCount === problems.length ? "Completed" : "Incomplete"}</div>
                    <div className="lb-cell">
                      {newRating ? (
                        <span>
                          {newRating} 
                          <span style={{ color: ratingChange > 0 ? '#4ade80' : '#ef4444', marginLeft: '6px', fontSize: '0.85em' }}>
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
              {liveState?.players?.map((p) => (
                <React.Fragment key={p.userId}>
                  <div className="mx-cell">{p.username}</div>
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

  // Anti-Cheat Hook
  const { isBlurred, violations } = useAntiCheat(status === "matched");

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
  }, [roomId, initialRoomCode]);

  useEffect(() => {
    if (problem && problem.starterCode && typeof problem.starterCode === "object") {
      const isDefaultCode = !code || Object.values(problem.starterCode).includes(code) || code === "// write your solution here";
      if (isDefaultCode) {
         setCode(problem.starterCode[language] || "// write your solution here");
      }
    } else if (problem && typeof problem.starterCode === "string") {
       if (!code || code === "// write your solution here") setCode(problem.starterCode);
    }
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

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const setupSocket = async () => {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      if (cancelled) return;

      socket = connectSocket(token, user?.uid || null);
      socketRef.current = socket;

      socket.on("connect", () => {
        const currentTarget = roomId || initialMatch?.roomId || initialMatch?.roomCode || initialRoomCode;
        if (currentTarget) {
          socket.emit("join_room_channel", { roomCode: currentTarget, userId: user?.uid, username });
        } else if (status !== "matched") {
          setStatus("waiting");
          notify({ type: "info", title: "Connected", message: "Connected to battle server. Looking for an opponent...", duration: 2600 });
          socket.emit("find_match", { username });
        }
      });

      socket.on("waiting_for_opponent", () => {
        if (!roomId && !initialMatch) {
          setStatus("waiting");
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
        const winner = data?.winner || "Opponent";
        const youWin = winner === username;
        let message = `Time is up! ${winner} wins.`;
        if (data.reason === "ALL_SOLVED") message = `${winner} completed all questions first!`;
        if (data.reason === "OPPONENT_FORFEIT") message = `Your opponent forfeited! You win!`;
        
        setBattleResult({
          winner: youWin ? "You" : winner,
          message,
        });
        if (data.finalState) {
           setLiveState(data.finalState);
        }
        setStatus("finished");
        setShowSummary(true);
      });

      socket.on("opponent_disconnected", (data) => {
        notify({ type: "warning", title: "Opponent Disconnected", message: "Your opponent left! They have 60 seconds to return before forfeiting.", duration: 5000 });
      });

      socket.on("opponent_reconnected", (data) => {
        notify({ type: "success", title: "Opponent Reconnected", message: "Your opponent is back in the battle!", duration: 3000 });
      });

      socket.on("rating_updates", (updates) => {
        setRatingUpdates(updates);
      });
    };

    setupSocket();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.off("connect");
        socketRef.current.off("waiting_for_opponent");
        socketRef.current.off("match_found");
        socketRef.current.off("battle_started");
        socketRef.current.off("battle_state_sync");
        socketRef.current.off("execution_progress");
        socketRef.current.off("code_result");
        socketRef.current.off("battle_over");
        socketRef.current.off("opponent_disconnected");
        socketRef.current.off("opponent_reconnected");
        socketRef.current.off("rating_updates");
        disconnectSocket();
      }
    };
  }, [notify, user?.uid, username]);

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

  const goBack = () => {
    navigate("/battle", { state: battleResult ? { result: battleResult } : undefined });
  };

  if (status === "connecting" || status === "waiting") {
    return (
      <div className="livebattle-page">
        <section className="livebattle-header-card">
          <div className="livebattle-header-copy">
            <div className="livebattle-pre">LIVE BATTLE</div>
            <h1>{status === "connecting" ? "Connecting to server" : "Finding your opponent"}</h1>
            <p>Matchmaking uses your rating and recent performance to find a fair challenge.</p>
          </div>
          <button className="livebattle-leave-btn" onClick={() => navigate("/battle")}>Cancel</button>
        </section>

        <section className="livebattle-wait-panel">
          <div className="livebattle-loader">Searching for an opponent...</div>
          <div className="livebattle-wait-steps">
            <article>
              <FontAwesomeIcon icon={faUsers} />
              <h3>Queue</h3>
              <p>Scanning available coders near your rating.</p>
            </article>
            <article>
              <FontAwesomeIcon icon={faShieldHalved} />
              <h3>Match Integrity</h3>
              <p>Verifying battle room and fair-play checks.</p>
            </article>
            <article>
              <FontAwesomeIcon icon={faCode} />
              <h3>Problem Setup</h3>
              <p>Preparing starter code and evaluation suite.</p>
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
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
             {liveState?.players?.map(p => (
                <div key={p.userId} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                   <span style={{ opacity: 0.7, fontSize: '0.8rem', display: 'block' }}>{p.username}</span>
                   <strong>{p.points} pts</strong> ({p.solvedCount}/{problems.length})
                </div>
             ))}
          </div>
        </div>

        <div className="livebattle-header-right">
          <div className={`livebattle-timer flashing`} style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff4d4d', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FontAwesomeIcon icon={faClock} /> {formatTime(timeLeft)}
          </div>
          <button className="livebattle-leave-btn" onClick={goBack}>
            {status === "finished" ? "Back to Arena" : "Leave Battle"}
          </button>
        </div>
      </motion.section>

      <div className="livebattle-grid" style={{ gridTemplateColumns: isSubmitPanelOpen ? undefined : "minmax(280px, 1fr) 2fr" }}>
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
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="livebattle-chip"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', outline: 'none' }}
              disabled={status === "finished" || running}
            >
              <option value="javascript" style={{ background: '#111' }}>JavaScript</option>
              <option value="cpp" style={{ background: '#111' }}>C++</option>
              <option value="python" style={{ background: '#111' }}>Python</option>
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
