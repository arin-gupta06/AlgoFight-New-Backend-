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
import RankEmblem from "../Common/gamification/RankEmblem";
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
} from "@fortawesome/free-solid-svg-icons";
import "./BattleArena.css";

export default function BattleArena({ defaultTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

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
        .then((data) => { if (data) setProfile(data); })
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
          .then((data) => { if (data) setProfile(data); })
          .catch(() => { });
      }
    }
  }, [location.state, user]);

  const { rating, matchesWon, winRate } = normalizeUserStats(profile || {});

  return (
    <BackgroundPaths>
      <div className="arena-root">
        <div className="arena-inner">
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="arena-header"
          >
            <div className="arena-header-top">
              <div className="hero-badge">
                <span className="badge-pulse-dot" />
                <span>COMPETITIVE ARENA</span>
              </div>
              <div className="telemetry-bar">
                <span><FontAwesomeIcon icon={faSignal} className="text-cyan" /> 24ms Low Latency</span>
                <span className="telemetry-divider">•</span>
                <span><FontAwesomeIcon icon={faShieldHalved} className="text-purple" /> Anti-Cheat Secured</span>
              </div>
            </div>

            <h1 className="arena-title">
              Real-Time <span className="text-cyan-gradient">Algorithmic</span> <span className="text-purple">Battles</span>
            </h1>
            <p className="arena-subtitle">
              Compete in live head-to-head duels, challenge online players, host private multiplayer rooms, or battle AlgoBot AI.
            </p>
          </motion.div>

          {/* Player Stats Grid */}
          <section className="arena-stats">
            <div className="stat-card tone-gold">
              <div className="stat-icon-wrapper">
                <RankEmblem rating={rating} size={30} glow={false} />
              </div>
              <div className="stat-info">
                <div className="stat-number stat-yellow">{rating}</div>
                <div className="stat-label">Global Rating</div>
              </div>
              <div className="stat-pill-badge">ELO RANKED</div>
            </div>

            <div className="stat-card tone-pink">
              <div className="stat-icon-wrapper">
                <FontAwesomeIcon icon={faBullseye} />
              </div>
              <div className="stat-info">
                <div className="stat-number stat-pink">{matchesWon}</div>
                <div className="stat-label">Battles Won</div>
              </div>
              <div className="stat-pill-badge pink">VICTORIES</div>
            </div>

            <div className="stat-card tone-cyan">
              <div className="stat-icon-wrapper">
                <FontAwesomeIcon icon={faBolt} />
              </div>
              <div className="stat-info">
                <div className="stat-number stat-cyan">{winRate}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
              <div className="stat-pill-badge cyan">ACCURACY</div>
            </div>
          </section>

          {/* Tab Switcher: Combat Modes vs Available Players */}
          <div className="arena-nav-container">
            <div className="arena-tabs-nav">
              <button
                className={`arena-nav-btn ${activeTab === "modes" ? "active" : ""}`}
                onClick={() => handleTabChange("modes")}
              >
                <FontAwesomeIcon icon={faGamepad} /> Combat Modes
              </button>
              <button
                className={`arena-nav-btn ${activeTab === "players" ? "active" : ""}`}
                onClick={() => handleTabChange("players")}
              >
                <FontAwesomeIcon icon={faUsers} /> Available Combatants
                {onlineCount > 0 && (
                  <span className="arena-tab-badge">
                    {onlineCount} Online
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tab 1: 4 Game Modes Grid */}
          {activeTab === "modes" && (
            <motion.section
              className="arena-modes-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="modes-grid-4">
                {/* Mode 1: Quick 1v1 Match */}
                <motion.div
                  className="mode-card featured"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mode-card-header">
                    <span className="mode-tag ranked">Ranked Matchmaking</span>
                    <span className="capacity-chip">1v1 ELO</span>
                  </div>
                  <div className="mode-card-title-row">
                    <div className="mode-icon-accent"><FontAwesomeIcon icon={faBolt} /></div>
                    <h3>Ranked 1v1 Duel</h3>
                  </div>
                  <p>Instant automated matchmaking against coders of equal rating. Earn ELO points and climb global leaderboards.</p>
                  <button className="btn-primary-glow w-full" onClick={() => navigate("/battle/live")}>
                    <FontAwesomeIcon icon={faMagnifyingGlass} /> Find 1v1 Match
                  </button>
                </motion.div>

                {/* Mode 2: Create Custom Room */}
                <motion.div
                  className="mode-card"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mode-card-header">
                    <span className="mode-tag custom">Custom Lobby</span>
                    <span className="capacity-chip purple">Up to 100</span>
                  </div>
                  <div className="mode-card-title-row">
                    <div className="mode-icon-accent custom"><FontAwesomeIcon icon={faPlus} /></div>
                    <h3>Host Custom Room</h3>
                  </div>
                  <p>Host private lobbies or classroom tournaments for up to 100 players. Configure question counts and custom time limits.</p>
                  <button className="btn-secondary-glass custom-purple w-full" onClick={() => setShowCreateModal(true)}>
                    <FontAwesomeIcon icon={faPlus} /> Host Custom Room
                  </button>
                </motion.div>

                {/* Mode 3: Join Room with Code */}
                <motion.div
                  className="mode-card"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mode-card-header">
                    <span className="mode-tag direct">Direct Access</span>
                    <span className="capacity-chip gold">Passcode Required</span>
                  </div>
                  <div className="mode-card-title-row">
                    <div className="mode-icon-accent direct"><FontAwesomeIcon icon={faKey} /></div>
                    <h3>Join with Code</h3>
                  </div>
                  <p>Have a room passcode from a classmate or instructor? Enter your code to join their live battle lobby instantly.</p>
                  <button className="btn-secondary-glass custom-gold w-full" onClick={() => setShowJoinModal(true)}>
                    <FontAwesomeIcon icon={faKey} /> Enter Room Code
                  </button>
                </motion.div>

                {/* Mode 4: Play vs Bot AI */}
                <motion.div
                  className="mode-card"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mode-card-header">
                    <span className="mode-tag bot">Solo Practice</span>
                    <span className="capacity-chip emerald">Vs AlgoBot</span>
                  </div>
                  <div className="mode-card-title-row">
                    <div className="mode-icon-accent bot"><FontAwesomeIcon icon={faRobot} /></div>
                    <h3>Play vs AlgoBot</h3>
                  </div>
                  <p>Warm up or hone your competitive speed in a 1v1 duel against our adaptive AI engine with instant response times.</p>
                  <button className="btn-secondary-glass custom-emerald w-full" onClick={() => navigate("/battle/live", { state: { autoBot: true } })}>
                    <FontAwesomeIcon icon={faRobot} /> Play vs AlgoBot
                  </button>
                </motion.div>
              </div>
            </motion.section>
          )}

          {/* Tab 2: Available Players Directory */}
          {activeTab === "players" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AvailablePlayers onPlayerCountChange={setOnlineCount} />
            </motion.div>
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
