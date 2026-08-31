import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './About.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faBrain,
  faChartBar,
  faClock,
  faCode,
  faRocket,
  faShieldHalved,
  faStar,
  faArrowRight,
  faServer,
  faLock,
  faBuildingColumns
} from '@fortawesome/free-solid-svg-icons';

export const missionPillars = [
  {
    title: 'Real-Time Competitive Duels',
    copy: '1v1 algorithmic battles with live opponent progress sync, sub-second test execution, and dynamic Elo ratings.',
    icon: faBolt,
    tone: 'cyan'
  },
  {
    title: 'Cryptographic Edge Security',
    copy: 'Protected by high-performance Logical Gateways with HMAC-SHA256 attestations, anti-cheat detection, and IP abuse jails.',
    icon: faShieldHalved,
    tone: 'pink'
  },
  {
    title: 'Institutional & Batch Arenas',
    copy: 'Custom tournament sub-batches for universities and student labs with isolated capacity and batch leaderboards.',
    icon: faBuildingColumns,
    tone: 'yellow'
  },
  {
    title: 'Skill-Accelerated Practice',
    copy: 'Curated problem archives across all major paradigms with multi-language compiler support and instant test feedback.',
    icon: faBrain,
    tone: 'green'
  },
];

export const learningTracks = [
  {
    title: 'Data Structures & Foundations',
    summary: 'Arrays, Strings, Hash Maps, Stacks, and Two-Pointer sliding windows.',
    level: 'Beginner',
    pace: '2 Weeks',
    icon: faCode,
  },
  {
    title: '1v1 Battle Mastery',
    summary: 'Greedy heuristics, Binary Search variants, Graph traversals, and Speed tactics.',
    level: 'Intermediate',
    pace: '3 Weeks',
    icon: faClock,
  },
  {
    title: 'Grandmaster Championship',
    summary: 'Dynamic Programming, Trie trees, Segment Trees, and Contest-grade time optimizations.',
    level: 'Advanced',
    pace: '4 Weeks',
    icon: faChartBar,
  },
];

export const platformStats = [
  { value: '50K+', label: 'Active Combatants' },
  { value: '2M+', label: 'Submissions Judged' },
  { value: '< 6ms', label: 'Gateway Latency' },
  { value: '99.99%', label: 'Platform Reliability' },
];

export const architecturalHighlights = [
  {
    icon: faShieldHalved,
    title: 'Logical User Gateway',
    desc: 'Requests are validated and authenticated at the application perimeter before reaching domain services.',
  },
  {
    icon: faServer,
    title: 'Sandboxed Isolation',
    desc: 'Code runs inside hardened container execution sandboxes with zero host leakage.',
  },
  {
    icon: faBolt,
    title: 'Reactive WebSocket Fabric',
    desc: 'High-frequency broadcast bus dispatching room updates and Elo changes under 5ms.',
  },
  {
    icon: faLock,
    title: 'Anti-Abuse Jails & Limits',
    desc: 'Automatic token bucket rate limiters and instant session revocation for bad actors.',
  },
];

export default function AboutContent({ isModal = false, onCloseModal }) {
  const navigate = useNavigate();

  const handleAction = (path) => {
    if (onCloseModal) onCloseModal();
    navigate(path);
  };

  return (
    <div className={`about-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      {/* Hero Section */}
      <motion.section
        className="learn-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="learn-pre-heading">COMPETITIVE SYSTEM & ARCHITECTURE</div>
        <h1>
          About <span>AlgoFight</span>
        </h1>
        <p>
          AlgoFight is the next-generation competitive coding arena where developers practice with intent, duel in real-time under pressure, and accelerate algorithmic mastery through deterministic, zero-lag grading.
        </p>

        <div className="learn-hero-stats">
          {platformStats.map((stat) => (
            <article key={stat.label} className="hero-stat-card">
              <div className="hero-stat-value">{stat.value}</div>
              <div className="hero-stat-label">{stat.label}</div>
            </article>
          ))}
        </div>
      </motion.section>

      {/* Core Mission Grid */}
      <motion.section
        className="learn-mission-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="learn-panel-header">
          <h2>Platform Pillars</h2>
          <p>
            Combining cryptographic edge security with real-time multiplayer combat to push algorithmic thinking under pressure.
          </p>
        </div>

        <div className="mission-grid">
          {missionPillars.map((pillar) => (
            <article key={pillar.title} className={`mission-card tone-${pillar.tone}`}>
              <div className="mission-icon">
                <FontAwesomeIcon icon={pillar.icon} />
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
            </article>
          ))}
        </div>
      </motion.section>

      {/* Architecture DNA Row */}
      <motion.section
        className="learn-arch-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="learn-panel-header">
          <h2>Engineered for High-Frequency Combat</h2>
          <p>
            Designed with enterprise-grade resilience, zero-leak memory buffers, and distributed state machines.
          </p>
        </div>

        <div className="arch-grid">
          {architecturalHighlights.map((arch) => (
            <div key={arch.title} className="arch-card">
              <div className="arch-icon-wrap">
                <FontAwesomeIcon icon={arch.icon} />
              </div>
              <h4>{arch.title}</h4>
              <p>{arch.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Learning Tracks & Why It Works */}
      <section className="learn-flow-section">
        <article className="learn-flow-card">
          <div className="learn-flow-title-row">
            <h2>Algorithmic Progression Tracks</h2>
            <span className="chip">Curated</span>
          </div>

          <ul className="track-list">
            {learningTracks.map((track) => (
              <li key={track.title}>
                <div className="track-left">
                  <div className="track-icon">
                    <FontAwesomeIcon icon={track.icon} />
                  </div>
                  <div>
                    <h4>{track.title}</h4>
                    <p>{track.summary}</p>
                  </div>
                </div>

                <div className="track-meta">
                  <span className="level-pill">{track.level}</span>
                  <span className="pace-pill">{track.pace}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="learn-flow-card">
          <div className="learn-flow-title-row">
            <h2>The AlgoFight Advantage</h2>
            <span className="chip">Competitive Edge</span>
          </div>

          <ul className="why-list">
            <li>
              <div className="why-icon cyan"><FontAwesomeIcon icon={faShieldHalved} /></div>
              <div>
                <strong>Fair Play & Anti-Cheat Engine</strong>
                <p>Tamper-proof HMAC trust verification and sandboxed execution ensure fair competitive rankings.</p>
              </div>
            </li>
            <li>
              <div className="why-icon yellow"><FontAwesomeIcon icon={faRocket} /></div>
              <div>
                <strong>Instant Sub-Second Feedback</strong>
                <p>Zero-lag test case evaluation with real-time pass/fail indicators during live battles.</p>
              </div>
            </li>
            <li>
              <div className="why-icon pink"><FontAwesomeIcon icon={faStar} /></div>
              <div>
                <strong>Elo Rating Progression</strong>
                <p>Transparent matchmaking with rank tiers from Silver to Grandmaster.</p>
              </div>
            </li>
          </ul>

          <div className="about-cta-box">
            <button className="btn-primary-about" onClick={() => handleAction('/battle')}>
              Enter Live Arena <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button className="btn-secondary-about" onClick={() => handleAction('/practice')}>
              Explore Practice Archive
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
