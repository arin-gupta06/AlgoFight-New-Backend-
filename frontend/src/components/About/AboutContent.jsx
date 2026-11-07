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
  faArrowRight,
  faBuildingColumns,
  faGamepad,
  faLightbulb,
  faTrophy,
  faGift,
  faUsers,
  faCodeMerge,
} from '@fortawesome/free-solid-svg-icons';

export const beginnerPillars = [
  {
    title: 'Real-Time 1v1 Duels',
    copy: 'Match with players of similar skill and race head-to-head to solve a coding puzzle first. See live opponent progress as you code!',
    icon: faGamepad,
    tone: 'icon-cyan'
  },
  {
    title: '100% Fair & Anti-Cheat',
    copy: 'Smart background checks prevent copy-pasting so every battle is 100% fair and your rating reflects your true coding skill.',
    icon: faShieldHalved,
    tone: 'icon-pink'
  },
  {
    title: 'Custom Private Rooms',
    copy: 'Create private battle rooms for your classmates, friends, or study groups. Customize time limits and difficulty settings.',
    icon: faBuildingColumns,
    tone: 'icon-trophy'
  },
  {
    title: 'Solo Practice Archive',
    copy: 'Master coding step-by-step with handpicked problems organized by topic (Arrays, Strings, Math) and difficulty levels.',
    icon: faBrain,
    tone: 'icon-emerald'
  },
];

export const gettingStartedSteps = [
  {
    step: '01',
    icon: faLightbulb,
    title: 'Pick a Language & Challenge',
    desc: 'Choose your favorite programming language (Python, JavaScript, C++, or Java) and select a problem or 1v1 duel.',
    tone: 'icon-cyan'
  },
  {
    step: '02',
    icon: faCode,
    title: 'Write & Test Code',
    desc: 'Code right inside your browser with clean syntax highlighting and built-in starter templates for every challenge.',
    tone: 'icon-purple'
  },
  {
    step: '03',
    icon: faBolt,
    title: 'Get Instant Feedback',
    desc: 'Click "Run Code" or "Submit" to see instant test results, memory usage, and execution speed in under 1 second.',
    tone: 'icon-pink'
  },
  {
    step: '04',
    icon: faTrophy,
    title: 'Rank Up & Claim Rewards',
    desc: 'Win battles to climb from Rookie to Grandmaster tier. Earn Arena Points to redeem gift cards and badges!',
    tone: 'icon-trophy'
  },
];

export const learningTracks = [
  {
    title: 'Beginner: Data Foundations',
    summary: 'Arrays, Strings, Hash Maps, Loops & Basic Logic. Perfect for newcomers starting out.',
    level: 'Beginner',
    icon: faCode,
  },
  {
    title: 'Intermediate: Battle Tactics',
    summary: 'Two Pointers, Stacks, Binary Search, and Greedy Problem Solving strategies.',
    level: 'Intermediate',
    icon: faClock,
  },
  {
    title: 'Advanced: Algorithm Mastery',
    summary: 'Dynamic Programming, Trees, Graphs & Contest-grade time optimization.',
    level: 'Advanced',
    icon: faChartBar,
  },
];

export const platformStats = [
  { value: '50K+', label: 'Active Coders', icon: faUsers, tone: 'icon-cyan' },
  { value: '2M+', label: 'Submissions Judged', icon: faCodeMerge, tone: 'icon-purple' },
  { value: '< 1 sec', label: 'Instant Feedback', icon: faBolt, tone: 'icon-pink' },
  { value: '100%', label: 'Free to Join', icon: faRocket, tone: 'icon-emerald' },
];

export default function AboutContent({ isModal = false, onCloseModal }) {
  const navigate = useNavigate();

  const handleAction = (path) => {
    if (onCloseModal) onCloseModal();
    navigate(path);
  };

  return (
    <div className={`about-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      {/* Hero Header */}
      <motion.section
        className="learn-hero-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1 className="learn-hero-title">
          THE FUN WAY TO <span className="word-glow-cyan">LEARN, PRACTICE & BATTLE</span> IN CODE
        </h1>

        <p className="learn-hero-desc">
          Whether you are writing your very first lines of code or sharpening your skills for tech interviews, AlgoFight makes learning data structures and algorithms interactive, competitive, and rewarding.
        </p>

        {/* Hero Stats */}
        <div className="learn-hero-stats">
          {platformStats.map((stat) => (
            <article key={stat.label} className="dash-card hero-stat-card">
              <div className="dash-card-header">
                <div className="dash-card-title-group">
                  <div className={`dash-icon-box ${stat.tone}`}>
                    <FontAwesomeIcon icon={stat.icon} />
                  </div>
                  <span className="dash-card-title">{stat.label}</span>
                </div>
              </div>
              <div className="dash-stat-big stat-cyan">{stat.value}</div>
            </article>
          ))}
        </div>
      </motion.section>

      {/* Core Features Grid */}
      <motion.section
        className="dash-card learn-mission-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        <div className="learn-panel-header">
          <span className="dash-pill-tag tag-cyan">CORE CAPABILITIES</span>
          <h2 className="learn-section-title">Everything You Need to Grow Your Skills</h2>
          <p className="learn-section-sub">
            From casual solo practice to intense 1v1 live duels, AlgoFight provides a supportive and fluid environment for programmers of all levels.
          </p>
        </div>

        <div className="mission-grid">
          {beginnerPillars.map((pillar) => (
            <article key={pillar.title} className="dash-card mission-card">
              <div className="mission-card-top">
                <div className={`dash-icon-box ${pillar.tone}`}>
                  <FontAwesomeIcon icon={pillar.icon} />
                </div>
              </div>
              <h3 className="mission-title">{pillar.title}</h3>
              <p className="mission-copy">{pillar.copy}</p>
            </article>
          ))}
        </div>
      </motion.section>

      {/* How It Works Step-By-Step */}
      <motion.section
        className="dash-card learn-arch-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
      >
        <div className="learn-panel-header">
          <span className="dash-pill-tag tag-purple">GETTING STARTED</span>
          <h2 className="learn-section-title">How AlgoFight Works in 4 Steps</h2>
          <p className="learn-section-sub">
            Getting started takes less than 30 seconds. Here is how you can jump in and begin improving your code today:
          </p>
        </div>

        <div className="arch-grid">
          {gettingStartedSteps.map((stepItem) => (
            <div key={stepItem.title} className="dash-card arch-card">
              <div className="arch-card-top">
                <span className="step-badge">{stepItem.step}</span>
                <div className={`dash-icon-box ${stepItem.tone}`}>
                  <FontAwesomeIcon icon={stepItem.icon} />
                </div>
              </div>
              <h4 className="arch-card-title">{stepItem.title}</h4>
              <p className="arch-card-desc">{stepItem.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Learning Tracks & Why It Works */}
      <section className="learn-flow-section">
        {/* Left Card: Tracks */}
        <motion.article
          className="dash-card learn-flow-card"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <div className="learn-flow-title-row">
            <div className="dash-card-title-group">
              <div className="dash-icon-box icon-cyan">
                <FontAwesomeIcon icon={faCode} />
              </div>
              <h2 className="flow-card-title">Skill Progression Pathways</h2>
            </div>
            <span className="dash-pill-tag tag-cyan">STRUCTURED</span>
          </div>

          <ul className="track-list">
            {learningTracks.map((track) => (
              <li key={track.title} className="track-list-item">
                <div className="track-left">
                  <div className="dash-icon-box icon-blue">
                    <FontAwesomeIcon icon={track.icon} />
                  </div>
                  <div>
                    <h4 className="track-name">{track.title}</h4>
                    <p className="track-summary">{track.summary}</p>
                  </div>
                </div>

                <div className="track-meta">
                  <span className="level-pill">{track.level}</span>
                </div>
              </li>
            ))}
          </ul>
        </motion.article>

        {/* Right Card: Why AlgoFight & CTAs */}
        <motion.article
          className="dash-card learn-flow-card"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
        >
          <div className="learn-flow-title-row">
            <div className="dash-card-title-group">
              <div className="dash-icon-box icon-purple">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <h2 className="flow-card-title">Why Practice on AlgoFight?</h2>
            </div>
            <span className="dash-pill-tag tag-purple">ADVANTAGES</span>
          </div>

          <ul className="why-list">
            <li className="why-list-item">
              <div className="dash-icon-box icon-cyan">
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
              <div>
                <strong className="why-title">Fair & Supportive Environment</strong>
                <p className="why-desc">Anti-cheat protections ensure ratings are earned honestly. Matchmaking pairs you with peers at your exact skill level.</p>
              </div>
            </li>
            <li className="why-list-item">
              <div className="dash-icon-box icon-pink">
                <FontAwesomeIcon icon={faRocket} />
              </div>
              <div>
                <strong className="why-title">Instant Sub-Second Feedback</strong>
                <p className="why-desc">Test your code in real-time and see friendly error messages to help you fix bugs quickly.</p>
              </div>
            </li>
            <li className="why-list-item">
              <div className="dash-icon-box icon-trophy">
                <FontAwesomeIcon icon={faGift} />
              </div>
              <div>
                <strong className="why-title">Real Rewards & Recognition</strong>
                <p className="why-desc">Earn Arena Points as you practice and battle, and redeem them for gift cards, entry passes, and badges.</p>
              </div>
            </li>
          </ul>

          <div className="about-cta-box">
            <button
              type="button"
              className="btn-hero-compete"
              onClick={() => handleAction('/battle')}
            >
              <span>Start Competing</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button
              type="button"
              className="btn-hero-practice"
              onClick={() => handleAction('/practice')}
            >
              <span>Practice Arena</span>
            </button>
          </div>
        </motion.article>
      </section>

      {/* Engineering Architects Spotlight */}
      <motion.section
        className="dash-card learn-mission-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
      >
        <div className="learn-panel-header">
          <span className="dash-pill-tag tag-cyan">ENGINEERING TEAM</span>
          <h2 className="learn-section-title">Built by AlgoFight Architects</h2>
          <p className="learn-section-sub">
            AlgoFight was created and engineered from the ground up by student developers at Madhav Institute of Technology & Science (MITS DU), Gwalior, under distinguished faculty guidance.
          </p>
        </div>

        <div className="mission-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <article className="dash-card mission-card">
            <h3 className="mission-title">Arin Gupta</h3>
            <p className="mission-copy" style={{ color: '#00f0ff', fontWeight: 600 }}>Full Stack Architect & Systems Lead</p>
            <p className="mission-copy">Distributed state machines, real-time WebSocket pipelines, and cryptographic gateways.</p>
          </article>
          <article className="dash-card mission-card">
            <h3 className="mission-title">Vivek Chaurasiya</h3>
            <p className="mission-copy" style={{ color: '#00ff88', fontWeight: 600 }}>Backend & Sandbox Infrastructure Lead</p>
            <p className="mission-copy">Isolated code evaluation clusters, Prisma query optimization, and distributed Redis job queues.</p>
          </article>
          <article className="dash-card mission-card">
            <h3 className="mission-title">Krish Dargar</h3>
            <p className="mission-copy" style={{ color: '#ff007a', fontWeight: 600 }}>Frontend & UI/UX Systems Architect</p>
            <p className="mission-copy">Cyber glassmorphic design language, reactive UI state machines, and micro-animations.</p>
          </article>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button
            type="button"
            className="btn-hero-compete"
            onClick={() => handleAction('/developer')}
          >
            <span>Meet All Developers & Mentors</span>
            <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: '8px' }} />
          </button>
        </div>
      </motion.section>
    </div>
  );
}
