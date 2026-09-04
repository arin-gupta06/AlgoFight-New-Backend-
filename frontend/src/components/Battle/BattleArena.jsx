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
import RankEmblem from "../Common/RankEmblem";
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
    <div className="arena-root">
      <div className="arena-inner">
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="arena-header"
        >
          <div className="pre-heading">COMPETITIVE ARENA</div>
          <h1 className="arena-title">
            Real-Time <span className="text-cyan-gradient"> Battles</span>
          </h1>
          <p className="arena-subtitle">
            Compete in live algorithmic duels, challenge online players, host private multiplayer rooms, or join custom code battles.
          </p>
        </motion.div>

        {/* Player Stats Grid */}
        <section className="arena-stats">
          <div className="stat-card tone-gold">
            <div className="stat-icon-wrapper">
              <RankEmblem rating={rating} size={28} glow={false} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{rating}</div>
              <div className="stat-label">Global Rating</div>
            </div>
          </div>
          <div className="stat-card tone-pink">
            <div className="stat-icon-wrapper">
              <FontAwesomeIcon icon={faBullseye} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{matchesWon}</div>
              <div className="stat-label">Battles Won</div>
            </div>
          </div>
          <div className="stat-card tone-cyan">
            <div className="stat-icon-wrapper">
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
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
              <FontAwesomeIcon icon={faUsers} /> Available Players
              {onlineCount > 0 && (
                <span className="arena-tab-badge">
                  {onlineCount} Online
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: 3 Game Modes Grid */}
        {activeTab === "modes" && (
          <motion.section
            className="arena-modes-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="modes-grid">
              {/* Mode 1: Quick 1v1 Match */}
              <motion.div
                className="mode-card featured"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mode-card-header">
                  <span className="mode-tag ranked">Ranked Matchmaking</span>
                  <div className="mode-icon-accent"><FontAwesomeIcon icon={faBolt} /></div>
                </div>
                <h3>Quick 1v1 Duel</h3>
                <p>Instant automated matchmaking against players of similar rating. Win rating points and climb the global leaderboard.</p>
                <button className="btn-mode-action btn-primary" onClick={() => navigate("/battle/live")}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} /> Find 1v1 Match
                </button>
              </motion.div>

              {/* Mode 2: Create Custom Room */}
              <motion.div
                className="mode-card"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mode-card-header">
                  <span className="mode-tag custom">Custom Lobby</span>
                  <div className="mode-icon-accent custom"><FontAwesomeIcon icon={faPlus} /></div>
                </div>
                <h3>Create Private Room</h3>
                <p>Host a private battle room or classroom tournament for up to 100 players. Customize the number of questions, dynamic difficulty mixing (MIX), and time limits.</p>
                <button className="btn-mode-action btn-secondary" onClick={() => setShowCreateModal(true)}>
                  <FontAwesomeIcon icon={faPlus} /> Host Custom Room
                </button>
              </motion.div>

              {/* Mode 3: Join Room with Code */}
              <motion.div
                className="mode-card"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mode-card-header">
                  <span className="mode-tag direct">Direct Join</span>
                  <div className="mode-icon-accent direct"><FontAwesomeIcon icon={faKey} /></div>
                </div>
                <h3>Join with Code</h3>
                <p>Have a room passcode from a friend or classmate? Enter your code to enter their lobby instantly and join the group battle.</p>
                <button className="btn-mode-action btn-secondary" onClick={() => setShowJoinModal(true)}>
                  <FontAwesomeIcon icon={faKey} /> Enter Room Code
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
  );
}
