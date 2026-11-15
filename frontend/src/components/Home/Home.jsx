import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Home.css';
import HeroScene from './HeroScene';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faArrowRight,
  faArrowDown,
  faBolt,
  faUsers,
  faTrophy,
  faFire,
  faCode,
  faPlus,
  faBullhorn,
  faGift,
  faCoins,
  faTicket,
  faLaptopCode,
  faBriefcase,
  faRocket,
  faCheckCircle,
  faClock,
  faUserCircle,
  faShieldHalved,
  faPalette,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from 'react-router-dom';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import '../BackgroundPaths/BackgroundPaths.css';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Footer from '../Common/Footer/Footer';
import BrandIntro from '../BrandIntro/BrandIntro';
import { fetchPublicRooms, fetchPlatformStats, fetchShowcaseFeedback } from '../../services/api';
import { connectSocket } from '../../services/socket';
import { getSessionToken } from '../../services/authStorage';
import CreateRoomModal from '../Battle/CreateRoomModal';
import { calculateArenaPointBreakdown } from '../../utils/playerMetrics';
import EloRatingGraph from '../Common/gamification/EloRatingGraph';

const coderTestimonialsData = [
  {
    id: 1,
    name: "Palash Rai",
    role: "Top 1% Grandmaster",
    avatar: "/testimonials/palash.png",
    rating: "2140 ELO",
    quote: "AlgoFight's real-time battles push me out of my comfort zone every day. The live telemetry and instant compiler feedback are insane.",
  },
  {
    id: 2,
    name: "Sneha",
    role: "5★ Problem Solver",
    avatar: "/testimonials/sneha.png",
    rating: "1980 ELO",
    quote: "The best platform to level up problem solving speed and compete with elite coders under live pressure. HMAC judging is top-tier.",
  },
  {
    id: 3,
    name: "Prateek Amar Batham",
    role: "Competitive Programmer",
    avatar: "/testimonials/prateek.png",
    rating: "1850 ELO",
    quote: "Clean cyber UI, fair matches, and zero-lag WebSocket sync. The synchronized 1v1 arenas make competitive programming feel like esports.",
  },
  {
    id: 4,
    name: "Sarvesh Baghel",
    role: "ICPC Finalist",
    avatar: "/testimonials/sarvesh.png",
    rating: "2010 ELO",
    quote: "Sub-second execution with automated judging changed how our team prepares for collegiate hackathons and technical interviews.",
  },
  {
    id: 5,
    name: "Aishwary Pahariya",
    role: "Senior Systems Engineer",
    avatar: "/testimonials/aishwary.png",
    rating: "1920 ELO",
    quote: "The 1v1 duel format creates unbeatable focus. You don't just solve algorithms, you master them under high pressure.",
  },
];


const coderOffersData = [
  {
    id: "vault_avatars",
    title: "Cyber Avatars Vault",
    category: "Avatars Vault",
    categoryTag: "AVATARS VAULT",
    cost: 200,
    costLabel: "From 200 Pts",
    statusText: "40 Collectibles",
    isUpcoming: false,
    desc: "Unlock 40 battle avatars across Recruit Protocol (200 PTS), Vanguard Syndicate (500 PTS) & Apex Mythic (1,000 PTS).",
    perkHighlight: "40 Unique Avatars",
    link: "/rewards",
    actionText: "Explore Avatars",
    tone: "cyan",
    icon: faUserCircle,
  },
  {
    id: "vault_frames",
    title: "Prestige Frames Vault",
    category: "Frames Vault",
    categoryTag: "FRAMES VAULT",
    cost: 500,
    costLabel: "From 500 Pts",
    statusText: "20 Dynamic Halos",
    isUpcoming: false,
    desc: "Equip glowing halo borders across Neon Edge (500 PTS), Quantum Surge (1,000 PTS) & Cosmic Singularity (2,000 PTS).",
    perkHighlight: "20 Glowing Halos",
    link: "/rewards",
    actionText: "Explore Frames",
    tone: "purple",
    icon: faShieldHalved,
  },
  {
    id: "vault_themes",
    title: "Cyber HUD Themes",
    category: "Themes Vault",
    categoryTag: "HUD THEMES",
    cost: 5000,
    costLabel: "From 5,000 Pts",
    statusText: "2 Free + 6 Skins",
    isUpcoming: false,
    desc: "2 Free Forever HUDs (Regular & Horizon Studio) + 6 Paid High-Spec Battle Cockpits (5,000 to 10,000 PTS).",
    perkHighlight: "8 Combat Cockpits",
    link: "/rewards",
    actionText: "Explore Themes",
    tone: "pink",
    icon: faPalette,
  },
];

const dynamicWords = [
  { w1: "SHARP", w2: "MINDS" },
  { w1: "ELITE", w2: "CODERS" },
  { w1: "FUTURE", w2: "MASTERS" },
  { w1: "SPEED", w2: "DEMONS" },
  { w1: "CODE", w2: "WARRIORS" },
];

const getInitials = (user) => {
  if (!user) return 'KD';
  const name = user.displayName?.trim() || user.username?.trim() || user.email?.split('@')[0] || 'KD';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

function Home() {
  const { user } = useAuth();
  const { theme, activeThemeConfig } = useTheme();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('af_brand_intro_played');
    }
    return false;
  });

  useEffect(() => {
    const handleReplay = () => setShowIntro(true);
    window.addEventListener('af_replay_intro', handleReplay);
    return () => window.removeEventListener('af_replay_intro', handleReplay);
  }, []);

  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % dynamicWords.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const [newsIndex, setNewsIndex] = useState(0);
  const [publicChallenges, setPublicChallenges] = useState([]);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [totalPlatformCoders, setTotalPlatformCoders] = useState("100+");
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  // Fetch actual enrolled platform coders count
  const [liveFeedbackList, setLiveFeedbackList] = useState([]);

  useEffect(() => {
    fetchPlatformStats()
      .then((res) => {
        if (res?.displayCount) {
          setTotalPlatformCoders(res.displayCount);
        }
      })
      .catch(() => {});

    fetchShowcaseFeedback()
      .then((res) => {
        if (Array.isArray(res?.feedbacks) && res.feedbacks.length > 0) {
          const mapped = res.feedbacks.map((f, idx) => ({
            id: f.id || `live_fb_${idx}`,
            name: f.username || "Verified Coder",
            role: "Platform Coder",
            avatar: "/testimonials/palash.png",
            rating: `${Math.round((f.rating || 5) * 350 + 400)} ELO`,
            quote: f.comment,
          }));
          setLiveFeedbackList(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const allTestimonials = useMemo(() => {
    if (liveFeedbackList.length > 0) {
      return [...liveFeedbackList, ...coderTestimonialsData];
    }
    return coderTestimonialsData;
  }, [liveFeedbackList]);

  // Auto-rotate coder testimonials with smooth animation
  useEffect(() => {
    const timer = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % allTestimonials.length);
    }, 4600);
    return () => clearInterval(timer);
  }, [allTestimonials.length]);

  // Fetch active public rooms on mount and continuously poll every 7 seconds
  useEffect(() => {
    let mounted = true;

    const loadPublicRooms = () => {
      fetchPublicRooms()
        .then((res) => {
          if (!mounted) return;
          if (Array.isArray(res)) {
            const now = Date.now();
            const valid = res.filter((c) => {
              if (c.status === "CANCELLED" || c.status === "FINISHED") return false;
              const createdMs = new Date(c.createdAt).getTime();
              // Waiting rooms must be created within last 25 mins
              if (c.status === "WAITING" && now - createdMs > 25 * 60 * 1000) return false;
              // Running rooms must not exceed match duration
              if (c.status === "RUNNING" && c.startedAt) {
                const startedMs = new Date(c.startedAt).getTime();
                const limitMs = (c.timeLimitMinutes || 15) * 60 * 1000;
                if (now - startedMs >= limitMs) return false;
              }
              return true;
            });
            setPublicChallenges(valid);
          }
        })
        .catch(() => {});
    };

    loadPublicRooms();
    const pollInterval = setInterval(loadPublicRooms, 7000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // Listen for real-time public challenge broadcasts
  useEffect(() => {
    let active = true;

    const setupHomeSocket = async () => {
      const token = user
        ? (typeof user.getIdToken === 'function' ? await user.getIdToken().catch(() => null) : getSessionToken())
        : null;
      if (!active) return;

      const socket = connectSocket(token, user?.uid || "guest", user?.displayName || "Guest");
      if (!socket) return;

      const onChallengeCreated = (challenge) => {
        if (!challenge?.roomCode) return;
        setPublicChallenges((prev) => {
          const exists = prev.some((c) => c.roomCode === challenge.roomCode);
          if (exists) return prev;
          return [challenge, ...prev];
        });
        setNewsIndex(0); // Immediately spotlight new public duel
      };

      const onChallengeRemoved = ({ roomCode } = {}) => {
        if (!roomCode) return;
        setPublicChallenges((prev) => prev.filter((c) => c.roomCode !== roomCode));
      };

      socket.on("public_challenge_created", onChallengeCreated);
      socket.on("public_challenge_removed", onChallengeRemoved);

      return () => {
        socket.off("public_challenge_created", onChallengeCreated);
        socket.off("public_challenge_removed", onChallengeRemoved);
      };
    };

    const cleanupPromise = setupHomeSocket();
    return () => {
      active = false;
      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
    };
  }, [user]);

  // Real, joinable public battles ONLY - excludes bot matches, private friendly duels, or full rooms
  const liveBattleItems = useMemo(() => {
    return publicChallenges
      .filter((c) => {
        if (!c || !c.roomCode) return false;
        if (c.isFriendly) return false; // Exclude private friendly matches with friends
        const isBotMatch = Boolean(
          c.isBot ||
          c.player1?.toLowerCase()?.includes("bot") ||
          c.player2?.toLowerCase()?.includes("bot") ||
          c.hostUsername?.toLowerCase()?.includes("bot")
        );
        if (isBotMatch) return false; // Exclude AlgoBot matches
        // Must be in WAITING/READY state with available seats so users can join
        const hasOpenSeats = (c.currentPlayers || 1) < (c.maxPlayers || 2);
        return hasOpenSeats && (c.status === "WAITING" || c.status === "READY");
      })
      .map((c) => {
        return {
          id: `battle_${c.roomCode}`,
          tag: `⚔️ ${c.difficulty || "MIX"} DUEL`,
          statusLabel: `Seats Open: ${c.currentPlayers || 1}/${c.maxPlayers || 2}`,
          title: `${c.hostUsername}'s Arena Challenge`,
          desc: `${c.questionCount || 3} Questions • ${c.timeLimitMinutes || 15} Mins • Host ELO: ${c.hostRating || 1200}`,
          action: "Join Duel",
          link: `/battle/room/${c.roomCode}`,
          isLiveBattle: true,
          isRunning: false,
          raw: c,
        };
      });
  }, [publicChallenges]);

  const hasActiveBattles = liveBattleItems.length > 0;
  const safeIndex = newsIndex >= liveBattleItems.length ? 0 : newsIndex;
  const currentBattle = hasActiveBattles ? liveBattleItems[safeIndex] : null;

  useEffect(() => {
    if (liveBattleItems.length <= 1) return;
    const timer = setInterval(() => {
      setNewsIndex((prev) => (prev + 1) % liveBattleItems.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [liveBattleItems.length]);

  // Compute live user stats or sensible defaults
  const userRating = user?.rating ?? 0;
  const userRatingDelta = user?.ratingDelta ?? 0;
  const userRatingHistory = user?.ratingHistory || [];
  const userWins = user?.wins ?? 0;
  const userLosses = user?.losses ?? 0;
  const totalBattles = userWins + userLosses;
  const winRate = totalBattles > 0 ? Math.round((userWins / totalBattles) * 100) : 0;
  const userRank = user?.highestRank && user.highestRank !== "ROOKIE" ? user.highestRank : "Unranked";
  const userSubmissions = user?.totalSubmissions ?? (userWins > 0 ? userWins * 2 : 0);

  // Dynamic user reward points breakdown consistent with Rewards page
  const userPointBreakdown = useMemo(() => {
    return calculateArenaPointBreakdown({
      rating: userRating,
      matchesWon: userWins,
      matchesPlayed: totalBattles,
      practiceSolved: userSubmissions > 0 ? Math.floor(userSubmissions / 2) : 0,
    });
  }, [userRating, userWins, totalBattles, userSubmissions]);

  const userPoints = userPointBreakdown.total;

  // Coder Perks carousel state
  const [offerIndex, setOfferIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setOfferIndex((prev) => (prev + 1) % coderOffersData.length);
    }, 5200);
    return () => clearInterval(timer);
  }, []);

  const currentOffer = coderOffersData[offerIndex] || coderOffersData[0];
  const offerProgressPct = Math.min(100, Math.round((userPoints / currentOffer.cost) * 100));
  const isOfferClaimable = userPoints >= currentOffer.cost && !currentOffer.isUpcoming;
  const activeTestimonial = allTestimonials[testimonialIndex] || allTestimonials[0];

  const graphConfig = useMemo(() => {
    return activeThemeConfig?.graph || {
      lineGradient: ['#7F808F', '#CBD5E1', '#FFFFFF'],
      areaColor: '#FFFFFF',
      areaOpacities: [0.18, 0.03, 0.0],
    };
  }, [activeThemeConfig]);

  return (
    <BackgroundPaths>
      {/* Brand First-Load Reveal Animation */}
      {showIntro && <BrandIntro onComplete={() => setShowIntro(false)} />}

      <div className="home-dashboard-wrapper">
        {/* ================= 3-COLUMN HERO DASHBOARD ================= */}
        <div className="home-hero-grid">
          
          {/* ========== LEFT COLUMN: STATS & COMMUNITY ========== */}
          <div className="hero-side-col hero-left-col">
            
            {/* Card 1: Global Rating with Proper Graph Structure */}
            <motion.div 
              className="dash-card rating-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -4 }}
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
                <div className="dash-stat-big">{userRating}</div>
                <div className="rating-trend-badge">
                  {userRatingDelta > 0 ? (
                    <>
                      <span className="rating-trend-arrow">▲</span> +{userRatingDelta} pts
                    </>
                  ) : userRatingDelta < 0 ? (
                    <>
                      <span className="rating-trend-arrow" style={{ color: "#f87171" }}>▼</span> {userRatingDelta} pts
                    </>
                  ) : userRating === 0 ? (
                    <span>Provisional</span>
                  ) : (
                    <span>Active Tier</span>
                  )}
                </div>
              </div>
              <div className="dash-card-subtext">Compete • Improve • Climb</div>

              {/* Dynamic Real SVG ELO Graph */}
              <div className="proper-graph-container">
                <EloRatingGraph
                  rating={userRating}
                  ratingHistory={userRatingHistory}
                  graphConfig={graphConfig}
                  theme={theme}
                  idPrefix="home-elo"
                  viewBoxHeight={74}
                />
              </div>
            </motion.div>

            {/* Card 2: Real Active Battle Dispatch (Zero Hardcoded / Zero Stale) */}
            <motion.div 
              className="dash-card news-dispatch-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -4 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-cyan">
                    <FontAwesomeIcon icon={faBullhorn} />
                  </div>
                  <span className="dash-card-title">Battle Dispatch</span>
                </div>
                <span className={`dash-pill-tag ${hasActiveBattles ? "tag-gold live-duel-tag" : "tag-cyan live-news-tag"}`}>
                  <span className={hasActiveBattles ? "live-duel-pulse" : "live-news-pulse"} />
                  {hasActiveBattles ? `LIVE DUEL (${liveBattleItems.length})` : "ARENA RADAR"}
                </span>
              </div>

              {/* Dynamic Real Active Battle Item or Live Radar Standby */}
              <div className="news-content-box">
                {hasActiveBattles && currentBattle ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentBattle.id || safeIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="news-item-body"
                    >
                      <div className="news-badge-row">
                        <span className="news-category-badge public-challenge-badge">
                          {currentBattle.tag}
                        </span>
                        <span className="news-time-label">
                          {currentBattle.statusLabel}
                        </span>
                      </div>

                      <h4 className="news-title" title={currentBattle.title}>
                        {currentBattle.title}
                      </h4>

                      <p className="news-snippet">
                        {currentBattle.desc}
                      </p>

                      <div className="news-footer-row">
                        <div className="news-dots-group">
                          {liveBattleItems.slice(0, 5).map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`news-dot-btn ${idx === (safeIndex % Math.min(5, liveBattleItems.length)) ? 'active' : ''}`}
                              onClick={() => setNewsIndex(idx)}
                              aria-label={`Show battle ${idx + 1}`}
                            />
                          ))}
                        </div>

                        <div className="news-footer-actions">
                          <button
                            type="button"
                            className="home-host-duel-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!user) {
                                navigate('/login');
                                return;
                              }
                              setShowCreateRoomModal(true);
                            }}
                            title="Host an open public room"
                          >
                            <FontAwesomeIcon icon={faPlus} /> Host
                          </button>

                          <button
                            type="button"
                            className="news-action-btn action-btn-duel"
                            onClick={() => navigate(currentBattle.link)}
                          >
                            <span>{currentBattle.action}</span>
                            <FontAwesomeIcon icon={faArrowRight} className="news-btn-icon" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="news-item-body arena-standby-body">
                    <div className="news-badge-row">
                      <span className="news-category-badge arena-radar-badge">
                        ACTIVE RADAR
                      </span>
                      <span className="news-time-label">0 Open Duels</span>
                    </div>

                    <h4 className="news-title">
                      No Active Battles Right Now
                    </h4>

                    <p className="news-snippet">
                      All arena duels are closed or completed. Host a custom room or enter matchmaking to start a live 1v1 battle!
                    </p>

                    <div className="news-footer-row">
                      <div className="news-standby-pulse-wrap">
                        <span className="standby-radar-dot" />
                        <span className="standby-radar-text">Radar active • 0 duels</span>
                      </div>

                      <div className="news-footer-actions">
                        <button
                          type="button"
                          className="home-host-duel-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user) {
                              navigate('/login');
                              return;
                            }
                            setShowCreateRoomModal(true);
                          }}
                          title="Host a public battle room"
                        >
                          <FontAwesomeIcon icon={faPlus} /> Host
                        </button>

                        <button
                          type="button"
                          className="news-action-btn action-btn-duel"
                          onClick={() => navigate('/battle')}
                        >
                          <span>Find Match</span>
                          <FontAwesomeIcon icon={faArrowRight} className="news-btn-icon" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Card 3: Real Enrolled Coders & Live Testimonials Rotator */}
            <motion.div 
              className="dash-card testimonials-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -4 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-blue">
                    <FontAwesomeIcon icon={faUsers} />
                  </div>
                  <span className="dash-card-title">Total Players</span>
                </div>
                <span className="dash-pill-tag tag-cyan live-news-tag">
                  <span className="live-news-pulse" />
                  {totalPlatformCoders} CODERS
                </span>
              </div>

              {/* Dynamic Animated Testimonials Carousel */}
              <div className="testimonials-content-box">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTestimonial.id || testimonialIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="testimonial-item-body"
                  >
                    <p className="testimonial-quote-text" title={activeTestimonial.quote}>
                      “{activeTestimonial.quote}”
                    </p>

                    <div className="testimonial-author-row">
                      <img 
                        src={activeTestimonial.avatar} 
                        alt={activeTestimonial.name} 
                        className="testimonial-author-avatar"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="testimonial-author-meta">
                        <span className="testimonial-author-name">{activeTestimonial.name}</span>
                        <span className="testimonial-author-role">{activeTestimonial.role}</span>
                      </div>
                      <span className="testimonial-elo-badge">{activeTestimonial.rating}</span>
                    </div>

                    <div className="testimonial-footer-row">
                      <div className="testimonial-dots-group">
                        {allTestimonials.slice(0, 6).map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`testimonial-dot-btn ${idx === (testimonialIndex % Math.min(6, allTestimonials.length)) ? 'active' : ''}`}
                            onClick={() => setTestimonialIndex(idx)}
                            aria-label={`Show review ${idx + 1}`}
                          />
                        ))}
                      </div>

                      <button 
                        type="button" 
                        className="testimonial-explore-btn"
                        onClick={() => navigate('/leaderboard')}
                      >
                        <span>Rankings</span>
                        <FontAwesomeIcon icon={faArrowRight} className="testimonial-btn-icon" />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>

          </div>

          {/* ========== CENTER COLUMN: HERO HEADLINE & 3D ANIMATED CHARACTERS ========== */}
          <div className="hero-center-col">
            

            {/* Main Title */}
            <motion.h1 
              className="hero-main-heading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              ALGORITHMIC BATTLES<br />
              <span className="hero-second-line">
                <span className="hero-for-text">FOR </span>
                <span className="dynamic-rotator-wrapper">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={wordIndex}
                      className="dynamic-word-pair"
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    >
                      <span className="hero-word-sharp">
                        {dynamicWords[wordIndex].w1}
                      </span>{" "}
                      <span className="hero-word-minds">
                        {dynamicWords[wordIndex].w2}
                      </span>
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              className="hero-main-subtext"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              Solve problems. Earn points. Climb the rankings.<br />
              Show the world what you're made of.
            </motion.p>

            {/* Action Buttons */}
            <motion.div 
              className="hero-action-buttons"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <button className="btn-hero-compete" onClick={() => navigate('/battle')}>
                <FontAwesomeIcon icon={faPlay} className="btn-play-icon" />
                <span>Start Competing</span>
              </button>
              <button className="btn-hero-practice" onClick={() => navigate('/practice')}>
                <FontAwesomeIcon icon={faCode} className="btn-code-icon" />
                <span>Practice Arena</span>
              </button>
            </motion.div>

            {/* Theme-Aware Layered Dynamic Hero Scene */}
            <HeroScene />

            {/* Scroll Indicator */}
            <motion.div 
              className="scroll-explore-pill"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
            </motion.div>
          </div>

          {/* ========== RIGHT COLUMN: LIVE ARENA & QUICK STATS ========== */}
          <div className="hero-side-col hero-right-col">
            
            {/* Card 1: Live Arena */}
            <motion.div 
              className="dash-card live-arena-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              whileHover={{ y: -4 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-cyan-code">
                    <FontAwesomeIcon icon={faCode} />
                  </div>
                  <span className="dash-card-title">Live Arena</span>
                </div>
                <span className="live-status-pill">
                  <span className="live-pulse-node" />
                  <span>LIVE</span>
                </span>
              </div>

              <div className="dash-card-subtext arena-sub">Real-time coding battles</div>

              {/* VS Matchup Section */}
              <div className="arena-matchup-box">
                {/* You */}
                <div className="combatant-avatar-block">
                  <div className="combatant-circle user-circle">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="User Avatar" className="combatant-img" />
                    ) : (
                      <span>{getInitials(user)}</span>
                    )}
                  </div>
                  <div className="combatant-meta">
                    <span className="c-name">You</span>
                    <span className="c-rank">{userRank}</span>
                  </div>
                </div>

                {/* VS Watermark */}
                <div className="vs-watermark-text">VS</div>

                {/* Opponent */}
                <div className="combatant-avatar-block">
                  <div className="combatant-circle opp-circle">
                    <span>?</span>
                  </div>
                  <div className="combatant-meta">
                    <span className="c-name">Opponent</span>
                    <span className="c-rank">Unranked</span>
                  </div>
                </div>
              </div>

              {/* Join Match Button */}
              <button className="btn-join-match" onClick={() => navigate('/battle')}>
                <span>Join Match</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </motion.div>

            {/* Card 2: Quick Stats */}
            <motion.div 
              className="dash-card quick-stats-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              whileHover={{ y: -4 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className="dash-icon-box icon-trophy">
                    <FontAwesomeIcon icon={faTrophy} />
                  </div>
                  <span className="dash-card-title">Quick Stats</span>
                </div>
              </div>

              <div className="quick-stats-list">
                <div className="q-stat-row">
                  <div className="q-stat-label-group">
                    <FontAwesomeIcon icon={faTrophy} className="q-icon text-muted" />
                    <span>Battles Won</span>
                  </div>
                  <span className="q-stat-value">{userWins}</span>
                </div>

                <div className="q-stat-row">
                  <div className="q-stat-label-group">
                    <FontAwesomeIcon icon={faBolt} className="q-icon text-cyan" />
                    <span>Win Rate</span>
                  </div>
                  <span className="q-stat-value">{winRate}%</span>
                </div>

                <div className="q-stat-row">
                  <div className="q-stat-label-group">
                    <FontAwesomeIcon icon={faFire} className="q-icon text-pink" />
                    <span>Longest Streak</span>
                  </div>
                  <span className="q-stat-value">{user?.longestStreak ?? user?.currentStreak ?? (userWins > 0 ? 1 : 0)}</span>
                </div>

                <div className="q-stat-row">
                  <div className="q-stat-label-group">
                    <FontAwesomeIcon icon={faCode} className="q-icon text-muted" />
                    <span>Total Submissions</span>
                  </div>
                  <span className="q-stat-value">{user?.totalSubmissions ?? userSubmissions}</span>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Coder Perks & Reward Offers Box */}
            <motion.div 
              className="dash-card offers-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              whileHover={{ y: -4 }}
            >
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className={`dash-icon-box icon-${currentOffer.tone || 'gold'}`}>
                    <FontAwesomeIcon icon={currentOffer.icon || faGift} />
                  </div>
                  <span className="dash-card-title">Rewards Vault</span>
                </div>
                <span className={`dash-pill-tag tag-${currentOffer.tone || 'gold'} live-offers-tag`}>
                  <span className="live-offers-pulse" />
                  {currentOffer.statusText || "ACTIVE VAULT"}
                </span>
              </div>

              {/* Dynamic Offers Content Box with AnimatePresence */}
              <div className="offers-content-box">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentOffer.id || offerIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="offer-item-body"
                  >
                    <div className="offer-badge-row">
                      <span className={`offer-category-badge badge-${currentOffer.tone || 'gold'}`}>
                        {currentOffer.categoryTag}
                      </span>
                      <span className="offer-cost-badge">
                        <FontAwesomeIcon icon={faCoins} className="offer-coin-icon" />
                        <span>{currentOffer.costLabel || `${currentOffer.cost.toLocaleString()} Pts`}</span>
                      </span>
                    </div>

                    <h4 className="offer-title" title={currentOffer.title}>
                      {currentOffer.title}
                    </h4>

                    <p className="offer-snippet" title={currentOffer.desc}>
                      {currentOffer.desc}
                    </p>

                    {/* Dynamic User Progress Bar towards this reward */}
                    <div className="offer-progress-container">
                      <div className="offer-progress-header">
                        <span className="offer-progress-label">
                          {currentOffer.isUpcoming ? (
                            <span className="text-upcoming">
                              <FontAwesomeIcon icon={faClock} /> {currentOffer.dropDate}
                            </span>
                          ) : isOfferClaimable ? (
                            <span className="text-ready">
                              <FontAwesomeIcon icon={faCheckCircle} /> Ready to Unlock!
                            </span>
                          ) : (
                            <span>Your Progress ({offerProgressPct}%)</span>
                          )}
                        </span>
                        <span className="offer-progress-pts">
                          {userPoints.toLocaleString()} / {currentOffer.cost.toLocaleString()} Pts
                        </span>
                      </div>

                      <div className="offer-progress-track">
                        <div 
                          className={`offer-progress-fill fill-${currentOffer.tone || 'gold'} ${isOfferClaimable ? 'fill-ready' : ''}`}
                          style={{ width: `${offerProgressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="offer-footer-row">
                      <div className="offer-dots-group">
                        {coderOffersData.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`offer-dot-btn ${idx === offerIndex ? 'active' : ''}`}
                            onClick={() => setOfferIndex(idx)}
                            aria-label={`Show ${item.title}`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        className={`offer-action-btn ${isOfferClaimable ? 'btn-claim-ready' : ''}`}
                        onClick={() => navigate(currentOffer.link)}
                      >
                        <span>{isOfferClaimable ? 'Unlock in Vault' : currentOffer.actionText}</span>
                        <FontAwesomeIcon icon={faArrowRight} className="offer-btn-icon" />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Built for coders tagline */}
            <div className="hero-built-tagline">
              <span className="built-icon">&lt;/&gt;</span>
              <span>Built for coders. By coders.</span>
            </div>

          </div>

        </div>
      </div>

      {/* Shared Unified Footer */}
      <Footer />

      {/* Quick Host Duel Modal from Home */}
      <CreateRoomModal
        isOpen={showCreateRoomModal}
        onClose={() => setShowCreateRoomModal(false)}
      />
    </BackgroundPaths>
  );
}

export default Home;
