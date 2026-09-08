import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowRightToBracket,
  faBolt, 
  faShieldHalved, 
  faTrophy, 
  faBrain, 
  faQuoteLeft, 
  faChevronLeft, 
  faChevronRight,
  faEnvelope,
  faLocationDot,
  faClock,
  faUsers,
  faFileCode,
  faCircleCheck,
  faTerminal
} from '@fortawesome/free-solid-svg-icons';
import { 
  faGithub, 
  faDiscord, 
  faXTwitter, 
  faLinkedin 
} from '@fortawesome/free-brands-svg-icons';
import BackgroundPaths from '../BackgroundPaths/BackgroundPaths';
import logoIcon from '../../assets/algofight-logo.png';
import BrandIntro from '../BrandIntro/BrandIntro';
import HeroCodeEditor from './HeroCodeEditor';
import CircularTestimonials from '../ui/circular-testimonials';
import Footer from '../Common/Footer/Footer';
import './LandingPage.css';

const testimonialsData = [
  {
    quote: "AlgoFight's real-time battles push me out of my comfort zone every day. The adrenaline, live telemetry, and instant compiler feedback are real.",
    name: "Rishabh Codes",
    designation: "Top 1% Global Grandmaster",
    src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=75&fm=webp",
  },
  {
    quote: "The best platform to level up problem solving speed and compete with elite coders under live pressure. HMAC anti-cheat is truly top-tier.",
    name: "Aarav Sharma",
    designation: "5★ Problem Solver • Rank 42",
    src: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=75&fm=webp",
  },
  {
    quote: "Clean cyber UI, fair matches, and zero-lag WebSocket sync. The synchronized 1v1 arenas make competitive programming feel like true esports.",
    name: "Sneha Verma",
    designation: "Competitive Programmer • Tier 1",
    src: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=75&fm=webp",
  },
  {
    quote: "Sub-second execution with automated judging changed how our team prepares for collegiate coding hackathons and technical rounds.",
    name: "Vikram Malhotra",
    designation: "Collegiate ICPC Finalist",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=75&fm=webp",
  },
  {
    quote: "The 1v1 duel format creates unbeatable focus. You don't just solve algorithms, you master them under pressure.",
    name: "Ananya Roy",
    designation: "Senior Systems Engineer",
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=75&fm=webp",
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('about');
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('af_brand_intro_played');
    }
    return false;
  });

  const handleOpenModal = (tabKey) => {
    setActiveModalTab(tabKey);
    setIsModalOpen(true);
  };

  return (
    <BackgroundPaths>
      {/* Brand First-Load Reveal Animation */}
      {showIntro && <BrandIntro onComplete={() => setShowIntro(false)} />}

      {/* Floating decorative code symbol */}
      <motion.div 
        className="bg-floating-code-symbol"
        animate={{ 
          y: [0, -12, 0],
          opacity: [0.22, 0.38, 0.22]
        }}
        transition={{ 
          duration: 6, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      >
        &lt;/&gt;
      </motion.div>

      <div className="landing-container">
        
        {/* ================= HERO SECTION ================= */}
        <section className="landing-hero-section">
          {/* Left Column: Brand Hero Identity */}
          <div className="hero-left-col">
            {/* Logo with gentle floating levitation */}
            <motion.div 
              className="algofight-hero-logo-wrapper"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.06 }}
            >
              <img 
                src={logoIcon} 
                alt="AlgoFight Logo" 
                className="hero-brand-logo-image"
              />
            </motion.div>

            {/* Tagline kicker */}
            <motion.div 
              className="pre-heading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <span className="text-cyan-dim">COMPETITIVE PROGRAMMING</span> <span className="text-pink">REDEFINED</span>
            </motion.div>

            {/* Giant Title */}
            <h1 className="hero-headline">
              <motion.span 
                className="text-white hero-word"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                CODE.{' '}
              </motion.span>
              <motion.span 
                className="text-cyan-gradient hero-word battle-glow-word"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                BATTLE.
              </motion.span>
              <br />
              <motion.span 
                className="text-white hero-word"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
              >
                DOMINATE.
              </motion.span>
            </h1>

            {/* Paragraph Subtitle */}
            <motion.p 
              className="hero-description"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              AlgoFight is the next-generation competitive coding arena where developers practice with intent, duel in real-time under pressure, and accelerate algorithmic mastery.
            </motion.p>

            {/* Action CTA Buttons */}
            <motion.div 
              className="hero-buttons-row"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <motion.button 
                className="btn-primary-login"
                onClick={() => navigate('/login')}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="btn-shimmer-sweep" />
                <FontAwesomeIcon icon={faArrowRightToBracket} className="btn-icon" />
                <span>Login / Signup</span>
              </motion.button>
            </motion.div>
          </div>

          {/* Right Column: Dynamic Interactive Code Editor */}
          <div className="hero-right-col">
            <HeroCodeEditor />
          </div>
        </section>


        {/* ================= STATS / METRICS STRIP ================= */}
        <section className="stats-strip-container">
          <div className="stat-card-glass">
            {/* Stat 1 */}
            <div className="stat-block-item">
              <div className="stat-icon-wrapper">
                <FontAwesomeIcon icon={faUsers} className="stat-icon-cyan" />
              </div>
              <div className="stat-meta">
                <div className="stat-number stat-pink">50K+</div>
                <div className="stat-label">ACTIVE COMBATANTS</div>
              </div>
            </div>

            <div className="stat-divider" />

            {/* Stat 2 */}
            <div className="stat-block-item">
              <div className="stat-icon-wrapper">
                <FontAwesomeIcon icon={faFileCode} className="stat-icon-cyan" />
              </div>
              <div className="stat-meta">
                <div className="stat-number stat-cyan">2M+</div>
                <div className="stat-label">SUBMISSIONS JUDGED</div>
              </div>
            </div>

            <div className="stat-divider" />

            {/* Stat 3 */}
            <div className="stat-block-item">
              <div className="stat-icon-wrapper">
                <FontAwesomeIcon icon={faBolt} className="stat-icon-yellow" />
              </div>
              <div className="stat-meta">
                <div className="stat-number stat-yellow">&lt; 6MS</div>
                <div className="stat-label">GATEWAY LATENCY</div>
              </div>
            </div>
          </div>
        </section>


        {/* ================= 4 FEATURES ROW ================= */}
        <section className="features-grid-layout">
          {/* Feature 1 */}
          <div className="feature-panel-card">
            <div className="feature-badge-icon tone-cyan">
              <FontAwesomeIcon icon={faBolt} />
            </div>
            <h3 className="feature-panel-title">REAL-TIME DUELS</h3>
            <p className="feature-panel-text">
              1v1 algorithmic battles with live opponent progress sync, sub-second test execution, and dynamic Elo ratings.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="feature-panel-card">
            <div className="feature-badge-icon tone-pink">
              <FontAwesomeIcon icon={faShieldHalved} />
            </div>
            <h3 className="feature-panel-title">FAIR PLAY & INTEGRITY</h3>
            <p className="feature-panel-text">
              Protected by automated anti-cheat detection, sealed judge test suites, and strict fair-play rating enforcement.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="feature-panel-card">
            <div className="feature-badge-icon tone-yellow">
              <FontAwesomeIcon icon={faTrophy} />
            </div>
            <h3 className="feature-panel-title">RANKED ARENAS</h3>
            <p className="feature-panel-text">
              Climb global leaderboards in ranked arenas and prove your problem-solving supremacy.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="feature-panel-card">
            <div className="feature-badge-icon tone-green">
              <FontAwesomeIcon icon={faBrain} />
            </div>
            <h3 className="feature-panel-title">SKILL ACCELERATION</h3>
            <p className="feature-panel-text">
              Curated problem archives across all major paradigms with multi-language compiler support and instant test feedback.
            </p>
          </div>
        </section>


        {/* ================= TESTIMONIALS SECTION (CIRCULAR 3D ROTATION) ================= */}
        <section className="combatants-feedback-section">
          <div className="feedback-header">
            <div className="pre-heading">TRUSTED BY DEVELOPERS WORLDWIDE</div>
            <h2 className="feedback-section-title">
              WHAT <span className="text-cyan-gradient">COMBATANTS</span> SAY
            </h2>
          </div>

          <div className="circular-testimonials-wrapper">
            <CircularTestimonials
              testimonials={testimonialsData}
              autoplay={true}
              colors={{
                name: "#00e5ff",
                designation: "#94a3b8",
                testimony: "#f1f5f9",
                arrowBackground: "rgba(0, 229, 255, 0.12)",
                arrowForeground: "#00e5ff",
                arrowHoverBackground: "#00e5ff",
              }}
              fontSizes={{
                name: "1.75rem",
                designation: "0.95rem",
                quote: "1.15rem",
              }}
            />
          </div>
        </section>


        {/* ================= FOOTER ================= */}
        <Footer />

      </div>
    </BackgroundPaths>
  );
}
