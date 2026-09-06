import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy, faArrowTrendUp, faArrowTrendDown, faMinus } from "@fortawesome/free-solid-svg-icons";
import { fetchLeaderboard } from "../../services/api";
import RankEmblem from "../Common/gamification/RankEmblem";
import "./Leaderboard.css";

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleUserClick = (userObj) => {
    const id = userObj?.id || userObj?.username || userObj?.user;
    if (id) {
      navigate(`/profile/${encodeURIComponent(id)}`);
    }
  };

  useEffect(() => {
    fetchLeaderboard()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch leaderboard:", err);
        setError("Could not load leaderboard. Is the server running?");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="leaderboard-root">
        <div className="loading-state">Loading Hall of Fame...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-root">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  // Mocking more data if length < 3 for the podium
  let topPlayers = data.slice(0, 3);
  let otherPlayers = data.slice(3);

  if (data.length === 0) {
      topPlayers = [
        { rank: 1, user: "tourist", score: 2150, country: "BY", trend: "up" },
        { rank: 2, user: "Benq", score: 1850, country: "US", trend: "same" },
        { rank: 3, user: "ecnerwala", score: 1520, country: "US", trend: "same" }
      ];
      otherPlayers = [
        { rank: 4, user: "Um_nik", score: 1180, country: "UA", trend: "down" },
        { rank: 5, user: "ksun48", score: 940, country: "CA", trend: "up" },
        { rank: 6, user: "Petr", score: 620, country: "CZ", trend: "same" }
      ];
  }

  const renderTrendIcon = (trend) => {
      if (trend === 'up') return <FontAwesomeIcon icon={faArrowTrendUp} className="trend-up" />;
      if (trend === 'down') return <FontAwesomeIcon icon={faArrowTrendDown} className="trend-down" />;
      return <FontAwesomeIcon icon={faMinus} className="trend-same" />;
  }

  return (
    <div className="leaderboard-root">
      <div className="leaderboard-header">
        <div className="pre-heading">GLOBAL RANKINGS</div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Hall of <span className="text-yellow">Fame</span>
        </motion.h1>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="leaderboard-content"
      >
        {/* Podium for Top 3 */}
        {topPlayers.length >= 3 && (
            <div className="podium-container">
                <div className="podium-item podium-2" onClick={() => handleUserClick(topPlayers[1])} style={{ cursor: "pointer" }}>
                    <div className="podium-avatar-wrapper">
                        <div className="avatar avatar-silver">
                            {topPlayers[1].user.charAt(0).toUpperCase()}
                        </div>
                        <div className="podium-emblem-badge">
                            <RankEmblem rating={topPlayers[1].score} size={26} glow={true} />
                        </div>
                    </div>
                    <div className="podium-name">{topPlayers[1].user}</div>
                    <div className="podium-rank-row">
                        <RankEmblem rating={topPlayers[1].score} size={18} showBadge={true} glow={false} />
                        <span className="podium-score">{topPlayers[1].score} Rating</span>
                    </div>
                    <div className="podium-block block-silver">2</div>
                </div>
                
                <div className="podium-item podium-1" onClick={() => handleUserClick(topPlayers[0])} style={{ cursor: "pointer" }}>
                    <FontAwesomeIcon icon={faTrophy} className="podium-trophy" />
                    <div className="podium-avatar-wrapper">
                        <div className="avatar avatar-gold">
                            {topPlayers[0].user.charAt(0).toUpperCase()}
                        </div>
                        <div className="podium-emblem-badge">
                            <RankEmblem rating={topPlayers[0].score} size={30} glow={true} />
                        </div>
                    </div>
                    <div className="podium-name">{topPlayers[0].user}</div>
                    <div className="podium-rank-row">
                        <RankEmblem rating={topPlayers[0].score} size={20} showBadge={true} glow={false} />
                        <span className="podium-score">{topPlayers[0].score} Rating</span>
                    </div>
                    <div className="podium-block block-gold">1</div>
                </div>

                <div className="podium-item podium-3" onClick={() => handleUserClick(topPlayers[2])} style={{ cursor: "pointer" }}>
                    <div className="podium-avatar-wrapper">
                        <div className="avatar avatar-bronze">
                            {topPlayers[2].user.charAt(0).toUpperCase()}
                        </div>
                        <div className="podium-emblem-badge">
                            <RankEmblem rating={topPlayers[2].score} size={24} glow={true} />
                        </div>
                    </div>
                    <div className="podium-name">{topPlayers[2].user}</div>
                    <div className="podium-rank-row">
                        <RankEmblem rating={topPlayers[2].score} size={18} showBadge={true} glow={false} />
                        <span className="podium-score">{topPlayers[2].score} Rating</span>
                    </div>
                    <div className="podium-block block-bronze">3</div>
                </div>
            </div>
        )}

        {/* List for the rest */}
        <div className="ranking-list">
            {otherPlayers.map((entry, i) => (
                <div className="ranking-row" key={i} onClick={() => handleUserClick(entry)} style={{ cursor: "pointer" }}>
                    <div className="rank-num">{entry.rank}</div>
                    <div className="rank-avatar">
                        {entry.user.charAt(0).toUpperCase()}
                    </div>
                    <div className="rank-name">
                        {entry.user} <span className="rank-country">{entry.country || "UN"}</span>
                    </div>
                    <div className="rank-emblem-cell">
                        <RankEmblem rating={entry.score} size={22} showBadge={true} glow={false} />
                    </div>
                    <div className="rank-trend">
                        {renderTrendIcon(entry.trend)} <span className="rank-score">{entry.score}</span>
                    </div>
                </div>
            ))}
        </div>

      </motion.div>
    </div>
  );
}
