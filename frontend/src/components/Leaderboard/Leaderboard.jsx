import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrophy,
  faArrowTrendUp,
  faArrowTrendDown,
  faMinus,
  faCrown,
  faShieldHalved,
  faMedal,
  faUsers,
  faBolt,
  faArrowRight,
  faUserAstronaut,
} from "@fortawesome/free-solid-svg-icons";
import { fetchLeaderboard } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import RankEmblem, { getRankTier } from "../Common/gamification/RankEmblem";
import BackgroundPaths from "../BackgroundPaths/BackgroundPaths";
import "../BackgroundPaths/BackgroundPaths.css";
import Footer from "../Common/Footer/Footer";
import "./Leaderboard.css";

export default function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleUserClick = (userObj) => {
    const handle = userObj?.username || userObj?.user || userObj?.id;
    if (handle) {
      const cleanHandle = typeof handle === "string" && handle.includes("@") ? handle.split("@")[0] : handle;
      navigate(`/profile/${encodeURIComponent(cleanHandle)}`);
    }
  };

  useEffect(() => {
    fetchLeaderboard()
      .then((res) => {
        const studentLeaderboard = Array.isArray(res)
          ? res.filter((u) => u.userType !== "FACULTY" && u.role !== "FACULTY")
          : [];
        setData(studentLeaderboard);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch leaderboard:", err);
        setError("Could not load leaderboard. Is the server running?");
        setLoading(false);
      });
  }, []);

  const FALLBACK_PLAYERS = [
    { rank: 1, user: "tourist", score: 2150, country: "BY", trend: "up" },
    { rank: 2, user: "Benq", score: 1850, country: "US", trend: "same" },
    { rank: 3, user: "ecnerwala", score: 1520, country: "US", trend: "same" },
    { rank: 4, user: "Um_nik", score: 1180, country: "UA", trend: "down" },
    { rank: 5, user: "ksun48", score: 940, country: "CA", trend: "up" },
    { rank: 6, user: "Petr", score: 620, country: "CZ", trend: "same" },
    { rank: 7, user: "Radewoosh", score: 580, country: "PL", trend: "up" },
    { rank: 8, user: "Gennady", score: 540, country: "BY", trend: "same" },
  ];

  // Table displays all ranked players (or fallback demo champions if empty)
  const tablePlayers = data.length > 0 ? data : FALLBACK_PLAYERS;

  // Podium displays top 3 players (padded with contenders if fewer than 3 players are registered)
  let topPlayers = [];
  if (data.length >= 3) {
    topPlayers = data.slice(0, 3);
  } else if (data.length > 0) {
    topPlayers = [...data.slice(0, 3)];
    const padNeeded = 3 - topPlayers.length;
    for (let i = 0; i < padNeeded; i++) {
      const fallbackIdx = topPlayers.length;
      topPlayers.push({
        rank: fallbackIdx + 1,
        user: FALLBACK_PLAYERS[fallbackIdx]?.user || `Contender_${fallbackIdx + 1}`,
        score: Math.max(0, (topPlayers[topPlayers.length - 1]?.score || 1000) - 150),
        country: FALLBACK_PLAYERS[fallbackIdx]?.country || "GLOBAL",
        trend: "same",
      });
    }
  } else {
    topPlayers = FALLBACK_PLAYERS.slice(0, 3);
  }

  const renderTrendIcon = (trend) => {
    if (trend === "up") return <FontAwesomeIcon icon={faArrowTrendUp} className="trend-up" />;
    if (trend === "down") return <FontAwesomeIcon icon={faArrowTrendDown} className="trend-down" />;
    return <FontAwesomeIcon icon={faMinus} className="trend-same" />;
  };

  const currentUserRating = user?.rating || 0;
  const userRankTier = getRankTier(currentUserRating);

  return (
    <BackgroundPaths>
      <div className="leaderboard-dashboard-wrapper">
        <div className="leaderboard-inner-container">
          {/* ================= COMPACT HEADER ================= */}
          <motion.header
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="leaderboard-compact-header"
          >
            <div className="leaderboard-header-left">
              <h1 className="leaderboard-header-title">
                GLOBAL <span className="text-yellow-gradient">RANKING</span>
              </h1>
              <p className="leaderboard-header-subtext">
                Celebrating the highest rated algorithmic combatants. Duel rivals, earn seasonal ELO points, and immortalize your handle.
              </p>
            </div>

            <div className="leaderboard-header-right">
              <div className="telemetry-bar leaderboard-telemetry-bar">
                <span className="live-status-pill">
                  <span className="live-pulse-node" />
                  <span>ELO LADDER LIVE</span>
                </span>
                <span className="telemetry-divider">•</span>
                <span>
                  <FontAwesomeIcon icon={faTrophy} className="text-gold" /> Season 4 Active
                </span>
                <span className="telemetry-divider">•</span>
                <span>
                  <FontAwesomeIcon icon={faShieldHalved} className="text-purple" /> Anti-Cheat Verified
                </span>
              </div>
            </div>
          </motion.header>

          {/* ================= 3 SUMMARY METRIC CARDS ================= */}
          <section className="leaderboard-stats-grid">
            {/* Card 1: Ladder Apex / Reigning Champion */}
            <motion.div
              className="dash-card leaderboard-stat-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              whileHover={{ y: -3 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-trophy">
                    <FontAwesomeIcon icon={faCrown} />
                  </div>
                  <span className="dash-card-title">Ladder Apex</span>
                </div>
                <span className="dash-pill-tag tag-gold">RANK #1</span>
              </div>

              <div className="rating-stat-row">
                <div className="dash-stat-big text-gold">
                  {topPlayers[0]?.user || "Champion"}
                </div>
                <div className="rating-trend-badge badge-gold">
                  {topPlayers[0]?.score ?? 0} ELO
                </div>
              </div>
              <div className="dash-card-subtext">Reigning algorithmic duelist champion</div>

              <div className="leaderboard-meter-box">
                <div className="leaderboard-meter-bar">
                  <div className="leaderboard-meter-fill fill-gold" style={{ width: "100%" }} />
                </div>
                <div className="leaderboard-meter-meta">
                  <span>Grandmaster Tier</span>
                  <span className="meta-gold">Unbeaten Streak</span>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Active Combatants */}
            <motion.div
              className="dash-card leaderboard-stat-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              whileHover={{ y: -3 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-cyan">
                    <FontAwesomeIcon icon={faUsers} />
                  </div>
                  <span className="dash-card-title">Ranked Combatants</span>
                </div>
                <span className="dash-pill-tag tag-cyan">LADDER</span>
              </div>

              <div className="rating-stat-row">
                <div className="dash-stat-big text-cyan-stat">
                  {Math.max(data.length, 100)}+
                </div>
                <div className="rating-trend-badge badge-cyan">
                  Active Coders
                </div>
              </div>
              <div className="dash-card-subtext">Compete in 1v1 duels to place onto the ladder</div>

              <div className="leaderboard-meter-box">
                <div className="leaderboard-meter-bar">
                  <div className="leaderboard-meter-fill fill-cyan" style={{ width: "75%" }} />
                </div>
                <div className="leaderboard-meter-meta">
                  <span>Season 4 Ladder</span>
                  <span className="meta-cyan">Global Pool</span>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Your Standing */}
            <motion.div
              className="dash-card leaderboard-stat-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              whileHover={{ y: -3 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-purple">
                    <FontAwesomeIcon icon={faUserAstronaut} />
                  </div>
                  <span className="dash-card-title">Your Dossier</span>
                </div>
                <span className="dash-pill-tag tag-purple">
                  {userRankTier?.name?.toUpperCase() || "COMBATANT"}
                </span>
              </div>

              <div className="rating-stat-row">
                <div className="dash-stat-big text-purple-stat">
                  {currentUserRating}
                </div>
                <div className="rating-trend-badge badge-purple">
                  Rating Points
                </div>
              </div>
              <div className="dash-card-subtext">Join ranked 1v1 duels to earn ELO and climb</div>

              <div className="leaderboard-meter-box">
                <div className="leaderboard-meter-bar">
                  <div
                    className="leaderboard-meter-fill fill-purple"
                    style={{ width: `${Math.min(100, Math.max(10, (currentUserRating / 2000) * 100))}%` }}
                  />
                </div>
                <div className="leaderboard-meter-meta">
                  <span>{user ? user.displayName || user.email?.split("@")[0] : "Guest Combatant"}</span>
                  <span className="meta-purple">±25 ELO Stakes</span>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ================= COMPACT PODIUM SECTION (TOP 3) ================= */}
          {topPlayers.length >= 3 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="dash-card podium-wrapper-card"
            >
              <div className="podium-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-trophy">
                    <FontAwesomeIcon icon={faMedal} />
                  </div>
                  <span className="dash-card-title">Podium Elite</span>
                </div>
                <span className="dash-pill-tag tag-gold">TOP 3 DUELISTS</span>
              </div>

              <div className="podium-compact-grid">
                {/* 2nd Place (Silver) */}
                <div
                  className="podium-pillar pillar-silver"
                  onClick={() => handleUserClick(topPlayers[1])}
                  role="button"
                  tabIndex={0}
                >
                  <div className="podium-avatar-box">
                    <div className="podium-avatar avatar-silver">
                      {topPlayers[1]?.photoURL ? (
                        <img src={topPlayers[1].photoURL} alt={topPlayers[1].user} className="podium-avatar-img" />
                      ) : (
                        (topPlayers[1]?.user || "P").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="podium-emblem-badge">
                      <RankEmblem rating={topPlayers[1]?.score ?? 0} size={22} glow={false} />
                    </div>
                  </div>
                  <div className="podium-user-name">{topPlayers[1]?.user}</div>
                  <div className="podium-user-elo">{topPlayers[1]?.score ?? 0} ELO</div>
                  <div className="podium-pedestal pedestal-2">
                    <span className="pedestal-rank">#2</span>
                    <span className="pedestal-label">SILVER</span>
                  </div>
                </div>

                {/* 1st Place (Gold Champion) */}
                <div
                  className="podium-pillar pillar-gold"
                  onClick={() => handleUserClick(topPlayers[0])}
                  role="button"
                  tabIndex={0}
                >
                  <div className="champion-crown-tag">
                    <FontAwesomeIcon icon={faCrown} />
                  </div>
                  <div className="podium-avatar-box">
                    <div className="podium-avatar avatar-gold">
                      {topPlayers[0]?.photoURL ? (
                        <img src={topPlayers[0].photoURL} alt={topPlayers[0].user} className="podium-avatar-img" />
                      ) : (
                        (topPlayers[0]?.user || "P").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="podium-emblem-badge">
                      <RankEmblem rating={topPlayers[0]?.score ?? 0} size={26} glow={true} />
                    </div>
                  </div>
                  <div className="podium-user-name champion-name">{topPlayers[0]?.user}</div>
                  <div className="podium-user-elo champion-elo">{topPlayers[0]?.score ?? 0} ELO</div>
                  <div className="podium-pedestal pedestal-1">
                    <span className="pedestal-rank">#1</span>
                    <span className="pedestal-label">CHAMPION</span>
                  </div>
                </div>

                {/* 3rd Place (Bronze) */}
                <div
                  className="podium-pillar pillar-bronze"
                  onClick={() => handleUserClick(topPlayers[2])}
                  role="button"
                  tabIndex={0}
                >
                  <div className="podium-avatar-box">
                    <div className="podium-avatar avatar-bronze">
                      {topPlayers[2]?.photoURL ? (
                        <img src={topPlayers[2].photoURL} alt={topPlayers[2].user} className="podium-avatar-img" />
                      ) : (
                        (topPlayers[2]?.user || "P").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="podium-emblem-badge">
                      <RankEmblem rating={topPlayers[2]?.score ?? 0} size={22} glow={false} />
                    </div>
                  </div>
                  <div className="podium-user-name">{topPlayers[2]?.user}</div>
                  <div className="podium-user-elo">{topPlayers[2]?.score ?? 0} ELO</div>
                  <div className="podium-pedestal pedestal-3">
                    <span className="pedestal-rank">#3</span>
                    <span className="pedestal-label">BRONZE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= RANKINGS TABLE ================= */}
          <div className="dash-card leaderboard-table-card">
            <div className="leaderboard-table-scroll-container">
              <div className="leaderboard-table-header">
                <div className="th-rank"># Rank</div>
                <div className="th-avatar">Combatant</div>
                <div className="th-country">Region</div>
                <div className="th-tier">Tier</div>
                <div className="th-trend">Trend</div>
                <div className="th-score">ELO Rating</div>
                <div className="th-action">Profile</div>
              </div>

              <div className="leaderboard-table-body">
                {loading && <div className="loading-state">Loading global rankings...</div>}
                {error && <div className="error-state">{error}</div>}

                {!loading &&
                  tablePlayers.map((entry, i) => {
                    const isCurrent = user && (user.username === entry.user || user.displayName === entry.user || user.email?.split("@")[0] === entry.user);
                    return (
                      <div
                        key={entry.id || entry.user || i}
                        className={`leaderboard-row ${isCurrent ? "is-current-user" : ""}`}
                        onClick={() => handleUserClick(entry)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="col-rank">
                          <span className={`rank-badge rank-${entry.rank}`}>
                            {`#${entry.rank}`}
                          </span>
                        </div>

                        <div className="col-combatant">
                          <div className="row-avatar">
                            {entry.photoURL ? (
                              <img src={entry.photoURL} alt={entry.user} className="row-avatar-img" />
                            ) : (
                              (entry.user || "P").charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="row-username">{entry.user}</span>
                          {isCurrent && <span className="you-pill">YOU</span>}
                        </div>

                        <div className="col-country">
                          <span className="country-chip">{entry.country || "GLOBAL"}</span>
                        </div>

                        <div className="col-tier">
                          <RankEmblem rating={entry.score ?? 0} size={20} showBadge={true} glow={false} />
                        </div>

                        <div className="col-trend">
                          {renderTrendIcon(entry.trend)}
                        </div>

                        <div className="col-score">
                          <span className="elo-text">{entry.score ?? 0}</span>
                        </div>

                        <div className="col-action">
                          <button
                            type="button"
                            className="view-profile-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUserClick(entry);
                            }}
                          >
                            <span>Inspect</span>
                            <FontAwesomeIcon icon={faArrowRight} className="btn-arrow-icon" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </BackgroundPaths>
  );
}
