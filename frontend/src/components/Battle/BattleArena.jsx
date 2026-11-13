import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ResultPopup from "./ResultPopup.jsx";
import CreateRoomModal from "./CreateRoomModal.jsx";
import JoinRoomModal from "./JoinRoomModal.jsx";
import AvailablePlayers from "./AvailablePlayers.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { fetchUserProfile } from "../../services/api";
import { normalizeUserStats } from "../../utils/playerMetrics";
import RankEmblem, { getRankTier } from "../Common/gamification/RankEmblem";
import EloRatingGraph from "../Common/gamification/EloRatingGraph";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrophy,
  faBullseye,
  faBolt,
  faMagnifyingGlass,
  faPlus,
  faKey,
  faUsers,
  faGamepad,
  faRobot,
  faShieldHalved,
  faSignal,
  faChalkboardUser,
  faFire,
  faPlay,
  faArrowRight,
  faCode,
} from "@fortawesome/free-solid-svg-icons";
import "./BattleArena.css";

export default function BattleArena({ defaultTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profileData } = useAuth();

  const initialTab = defaultTab || searchParams.get("tab") || "modes";
  const [activeTab, setActiveTab] = useState(initialTab); // "modes" | "players"
  const [onlineCount, setOnlineCount] = useState(0);

  const [resultBox, setResultBox] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Sync tab with URL search params or props
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === "modes" ? {} : { tab });
  };

  // Fetch profile stats from backend
  useEffect(() => {
    if (user?.uid) {
      fetchUserProfile(user.uid)
        .then((data) => {
          if (data) setProfile(data);
        })
        .catch((err) => console.error("Failed to fetch profile:", err));
    }
  }, [user]);

  // Re-fetch stats when returning from a battle
  useEffect(() => {
    if (location.state && location.state.result) {
      setResultBox(location.state.result);
      window.history.replaceState({}, document.title);
      if (user?.uid) {
        fetchUserProfile(user.uid)
          .then((data) => {
            if (data) setProfile(data);
          })
          .catch(() => { });
      }
    }
  }, [location.state, user]);

  const { rating, matchesWon, winRate, rankTier } = normalizeUserStats(profile || {});
  const ratingDelta = profile?.ratingDelta ?? user?.ratingDelta ?? 0;
  const ratingHistory = profile?.ratingHistory || user?.ratingHistory || [];
  const userEmail = (user?.email || profileData?.email || profile?.email || "").toLowerCase().trim();
  const isMitsFaculty = userEmail.endsWith("@mitsgwalior.in") ||
                        userEmail.endsWith(".mitsgwalior.in") ||
                        userEmail.includes("mitsgwalior.in");
  const isFaculty = profileData?.userType === "FACULTY" || profile?.userType === "FACULTY" || user?.userType === "FACULTY" || user?.role === "FACULTY" || isMitsFaculty;

  return (
    <BackgroundPaths>
      <div className="arena-dashboard-wrapper">
        <div className="arena-inner-container">
          {/* ================= COMPACT HEADER & TELEMETRY ROW ================= */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="arena-compact-header"
          >
            <div className="arena-header-left">
              <h1 className="arena-header-title">
                REAL-TIME <span className="text-cyan-gradient">CODE COMBAT</span>
              </h1>
              <p className="arena-header-subtext">
                Head-to-head algorithmic duels, custom tournament lobbies, and adaptive AI sparring.
              </p>
            </div>

            <div className="arena-header-right">
              {/* Telemetry Bar */}
              <div className="telemetry-bar arena-telemetry-bar">
                <span className="live-status-pill">
                  <span className="live-pulse-node" />
                  <span>MATCHMAKING LIVE</span>
                </span>
                <span className="telemetry-divider">•</span>
                <span>
                  <FontAwesomeIcon icon={faSignal} className="text-cyan" /> 24ms Latency
                </span>
                <span className="telemetry-divider">•</span>
                <span>
                  <FontAwesomeIcon icon={faShieldHalved} className="text-purple" /> Anti-Cheat v2.4
                </span>
              </div>

              {/* Tabs Switcher */}
              <div className="arena-tabs-pill-bar">
                <button
                  className={`arena-pill-tab ${activeTab === "modes" ? "active" : ""}`}
                  onClick={() => handleTabChange("modes")}
                >
                  <FontAwesomeIcon icon={faGamepad} />
                  <span>Combat Modes</span>
                </button>
                <button
                  className={`arena-pill-tab ${activeTab === "players" ? "active" : ""}`}
                  onClick={() => handleTabChange("players")}
                >
                  <FontAwesomeIcon icon={faUsers} />
                  <span>Combatants</span>
                  {onlineCount > 0 && (
                    <span className="arena-online-badge">
                      <span className="online-pulse-dot" />
                      {onlineCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </motion.header>

          {isFaculty ? (
            <motion.div
              className="dash-card faculty-arena-notice"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-purple">
                    <FontAwesomeIcon icon={faChalkboardUser} />
                  </div>
                  <span className="dash-card-title">FACULTY ACADEMIC ACCOUNT</span>
                </div>
                <span className="dash-pill-tag tag-purple">ACADEMIC SUPERVISOR</span>
              </div>
              <h2 className="faculty-notice-title">Academic Non-Combat Account</h2>
              <p className="faculty-notice-desc">
                Competitive battle matchmaking and ELO ladder ranks are reserved exclusively for student combatants.
                As a faculty member, you have administrative oversight to monitor students, track progress, create quizzes, or solve problems in the practice zone.
              </p>
              <div className="faculty-notice-actions">
                <button className="btn-hero-compete" onClick={() => navigate("/faculty")}>
                  <FontAwesomeIcon icon={faChalkboardUser} />
                  <span>Open Faculty Hub</span>
                </button>
                <button className="btn-hero-practice" onClick={() => navigate("/practice")}>
                  <FontAwesomeIcon icon={faBullseye} />
                  <span>Go to Practice Arena</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* ================= UNIFIED 2-COLUMN MAIN LAYOUT ================= */}
              <div className="arena-main-layout">
                {/* Left Column: Player Combat Dossier (Persistent across both tabs) */}
                <aside className="arena-stats-sidebar">
                  {/* Card 1: Global Rating with ELO Graph */}
                  <motion.div
                    className="dash-card arena-sidebar-card rating-card"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                  >
                    <div className="dash-card-header">
                      <div className="dash-card-title-group">
                        <div className="dash-icon-box icon-purple">
                          <FontAwesomeIcon icon={faTrophy} />
                        </div>
                        <span className="dash-card-title">Global Rating</span>
                      </div>
                      <span className="dash-pill-tag tag-purple">ELO RANKED</span>
                    </div>

                    <div className="rating-stat-row">
                      <div className="dash-stat-big">{rating}</div>
                      <div className="rating-trend-badge">
                        {ratingDelta > 0 ? (
                          <>
                            <span className="rating-trend-arrow">▲</span> +{ratingDelta} pts
                          </>
                        ) : ratingDelta < 0 ? (
                          <>
                            <span className="rating-trend-arrow" style={{ color: "#f87171" }}>▼</span> {ratingDelta} pts
                          </>
                        ) : rating === 0 ? (
                          <span>Provisional</span>
                        ) : (
                          <span>{rankTier?.name || "Active"} Tier</span>
                        )}
                      </div>
                    </div>
                    <div className="dash-card-subtext">Competitive ELO Ladder</div>

                    {/* Dynamic Real SVG ELO Graph */}
                    <div className="proper-graph-container compact-graph">
                      <EloRatingGraph
                        rating={rating}
                        ratingHistory={ratingHistory}
                        idPrefix="arena-elo"
                        viewBoxHeight={64}
                      />
                    </div>
                  </motion.div>

                  {/* Card 2: Combat Performance Record */}
                  <motion.div
                    className="dash-card arena-sidebar-card combat-dossier-card"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                  >
                    <div className="dash-card-header">
                      <div className="dash-card-title-group">
                        <div className="dash-icon-box icon-pink">
                          <FontAwesomeIcon icon={faFire} />
                        </div>
                        <span className="dash-card-title">Combat Record</span>
                      </div>
                      <span className="dash-pill-tag tag-pink">METRICS</span>
                    </div>

                    <div className="combat-stats-list">
                      <div className="c-stat-row">
                        <div className="c-stat-label">
                          <FontAwesomeIcon icon={faTrophy} className="c-icon text-pink" />
                          <span>Battles Won</span>
                        </div>
                        <span className="c-stat-val text-pink-stat">{matchesWon}</span>
                      </div>

                      <div className="c-stat-row">
                        <div className="c-stat-label">
                          <FontAwesomeIcon icon={faBolt} className="c-icon text-cyan" />
                          <span>Win Rate</span>
                        </div>
                        <span className="c-stat-val text-cyan-stat">{winRate}%</span>
                      </div>

                      <div className="c-stat-row">
                        <div className="c-stat-label">
                          <FontAwesomeIcon icon={faShieldHalved} className="c-icon text-gold" />
                          <span>Combat Tier</span>
                        </div>
                        <span className="c-stat-val text-gold">{rankTier?.name || "Combatant"}</span>
                      </div>

                      <div className="c-stat-row">
                        <div className="c-stat-label">
                          <FontAwesomeIcon icon={faCode} className="c-icon text-purple" />
                          <span>Duel Stakes</span>
                        </div>
                        <span className="c-stat-val">±25 ELO</span>
                      </div>
                    </div>
                  </motion.div>
                </aside>

                {/* Right Column: Dynamic Combat Modes or Combatants Directory */}
                <main className="arena-modes-col">
                  <AnimatePresence mode="wait">
                    {activeTab === "modes" ? (
                      <motion.div
                        key="modes"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="modes-grid-4 compact-modes-grid"
                      >
                        {/* Mode 1: Quick 1v1 Ranked Match */}
                        <motion.div
                          className="dash-card arena-mode-card mode-card-ranked featured-mode-card"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="dash-card-header">
                            <div className="dash-card-title-group">
                              <div className="dash-icon-box icon-purple">
                                <FontAwesomeIcon icon={faBolt} />
                              </div>
                              <span className="dash-card-title">Ranked Duel</span>
                            </div>
                            <span className="dash-pill-tag tag-purple">1V1 ELO</span>
                          </div>

                          <div className="mode-title-row">
                            <h3 className="mode-heading">Ranked 1v1 Duel</h3>
                            <span className="mode-capacity-tag">Matchmaking</span>
                          </div>

                          <p className="mode-description">
                            Instant automated pairing against coders of equal rating. Earn ELO points and rank up.
                          </p>

                          <div className="mode-features-row">
                            <span className="mode-chip">Sub-Second Judge</span>
                            <span className="mode-chip">±25 ELO Stakes</span>
                          </div>

                          <button
                            className="btn-hero-compete w-full"
                            onClick={() => navigate("/battle/live")}
                          >
                            <FontAwesomeIcon icon={faPlay} className="btn-play-icon" />
                            <span>Find 1v1 Match</span>
                          </button>
                        </motion.div>

                        {/* Mode 2: Create Custom Room */}
                        <motion.div
                          className="dash-card arena-mode-card mode-card-custom"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="dash-card-header">
                            <div className="dash-card-title-group">
                              <div className="dash-icon-box icon-cyan">
                                <FontAwesomeIcon icon={faPlus} />
                              </div>
                              <span className="dash-card-title">Custom Lobby</span>
                            </div>
                            <span className="dash-pill-tag tag-cyan">UP TO 100</span>
                          </div>

                          <div className="mode-title-row">
                            <h3 className="mode-heading">Host Custom Room</h3>
                            <span className="mode-capacity-tag cyan">Tournaments</span>
                          </div>

                          <p className="mode-description">
                            Create private lobbies or tournament rooms for up to 100 players with custom rules.
                          </p>

                          <div className="mode-features-row">
                            <span className="mode-chip">Passcode Lock</span>
                            <span className="mode-chip">Custom Clock</span>
                          </div>

                          <button
                            className="btn-hero-action btn-action-cyan w-full"
                            onClick={() => setShowCreateModal(true)}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>Host Custom Room</span>
                          </button>
                        </motion.div>

                        {/* Mode 3: Join Room with Code */}
                        <motion.div
                          className="dash-card arena-mode-card mode-card-direct"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="dash-card-header">
                            <div className="dash-card-title-group">
                              <div className="dash-icon-box icon-trophy">
                                <FontAwesomeIcon icon={faKey} />
                              </div>
                              <span className="dash-card-title">Direct Access</span>
                            </div>
                            <span className="dash-pill-tag tag-gold">CODE REQUIRED</span>
                          </div>

                          <div className="mode-title-row">
                            <h3 className="mode-heading">Join with Code</h3>
                            <span className="mode-capacity-tag gold">Instant Entry</span>
                          </div>

                          <p className="mode-description">
                            Enter a private match code to join a friend, club, or classroom tournament lobby.
                          </p>

                          <div className="mode-features-row">
                            <span className="mode-chip">Instant Entry</span>
                            <span className="mode-chip">Spectator Mode</span>
                          </div>

                          <button
                            className="btn-hero-action btn-action-gold w-full"
                            onClick={() => setShowJoinModal(true)}
                          >
                            <FontAwesomeIcon icon={faKey} />
                            <span>Enter Room Code</span>
                          </button>
                        </motion.div>

                        {/* Mode 4: Play vs Bot AI */}
                        <motion.div
                          className="dash-card arena-mode-card mode-card-practice"
                          whileHover={{ y: -3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="dash-card-header">
                            <div className="dash-card-title-group">
                              <div className="dash-icon-box icon-emerald">
                                <FontAwesomeIcon icon={faRobot} />
                              </div>
                              <span className="dash-card-title">Solo Practice</span>
                            </div>
                            <span className="dash-pill-tag tag-emerald">VS ALGOBOT</span>
                          </div>

                          <div className="mode-title-row">
                            <h3 className="mode-heading">Play vs AlgoBot</h3>
                            <span className="mode-capacity-tag emerald">Adaptive AI</span>
                          </div>

                          <p className="mode-description">
                            Warm up or drill algorithmic speed against our adaptive AI engine with zero queue time.
                          </p>

                          <div className="mode-features-row">
                            <span className="mode-chip">Adaptive AI</span>
                            <span className="mode-chip">Zero Queue</span>
                          </div>

                          <button
                            className="btn-hero-action btn-action-emerald w-full"
                            onClick={() => navigate("/battle/live", { state: { autoBot: true } })}
                          >
                            <FontAwesomeIcon icon={faRobot} />
                            <span>Spar with AlgoBot</span>
                          </button>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="players"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="arena-players-tab-wrap"
                      >
                        <AvailablePlayers onPlayerCountChange={setOnlineCount} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </main>
              </div>

            </>
          )}
        </div>

        {/* Modals */}
        <CreateRoomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />

        <JoinRoomModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />

        {/* Result Modal */}
        <AnimatePresence>
          {resultBox && (
            <ResultPopup
              result={resultBox}
              onClose={() => setResultBox(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </BackgroundPaths>
  );
}
