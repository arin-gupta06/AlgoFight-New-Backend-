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
  faBuildingColumns,
  faGamepad,
  faLightbulb,
  faTrophy,
  faCheckCircle,
  faGift
} from '@fortawesome/free-solid-svg-icons';

export const beginnerPillars = [
  {
    title: 'Real-Time 1v1 Duels',
    copy: 'Match with players of similar skill and race head-to-head to solve a coding puzzle first. See live opponent progress as you code!',
    icon: faGamepad,
    tone: 'cyan'
  },
  {
    title: '100% Fair & Anti-Cheat',
    copy: 'Smart background checks prevent copy-pasting so every battle is 100% fair and your rating reflects your true coding skill.',
    icon: faShieldHalved,
    tone: 'pink'
  },
  {
    title: 'Custom Private Rooms',
    copy: 'Create private battle rooms for your classmates, friends, or study groups. Customize time limits and difficulty settings.',
    icon: faBuildingColumns,
    tone: 'yellow'
  },
  {
    title: 'Solo Practice Archive',
    copy: 'Master coding step-by-step with handpicked problems organized by topic (Arrays, Strings, Math) and difficulty levels.',
    icon: faBrain,
    tone: 'green'
  },
];

export const gettingStartedSteps = [
  {
    step: '01',
    icon: faLightbulb,
    title: 'Pick a Language & Challenge',
    desc: 'Choose your favorite programming language (Python, JavaScript, C++, or Java) and select a problem or 1v1 duel.',
  },
  {
    step: '02',
    icon: faCode,
    title: 'Write & Test Code',
    desc: 'Code right inside your browser with clean syntax highlighting and built-in starter templates for every challenge.',
  },
  {
    step: '03',
    icon: faBolt,
    title: 'Get Instant Feedback',
    desc: 'Click "Run Code" or "Submit" to see instant test results, memory usage, and execution speed in under 1 second.',
  },
  {
    step: '04',
    icon: faTrophy,
    title: 'Rank Up & Claim Rewards',
    desc: 'Win battles to climb from Rookie to Grandmaster tier. Earn Arena Points to redeem gift cards and badges!',
  },
];

export const learningTracks = [
  {
    title: 'Beginner: Data Foundations',
    summary: 'Arrays, Strings, Hash Maps, Loops & Basic Logic. Perfect for newcomers starting out.',
    level: 'Beginner',
    pace: 'Step 1',
    icon: faCode,
  },
  {
    title: 'Intermediate: Battle Tactics',
    summary: 'Two Pointers, Stacks, Binary Search, and Greedy Problem Solving strategies.',
    level: 'Intermediate',
    pace: 'Step 2',
    icon: faClock,
  },
  {
    title: 'Advanced: Algorithm Mastery',
    summary: 'Dynamic Programming, Trees, Graphs & Contest-grade time optimization.',
    level: 'Advanced',
    pace: 'Step 3',
    icon: faChartBar,
  },
];

export const platformStats = [
  { value: '50K+', label: 'Active Coders' },
  { value: '2M+', label: 'Submissions Judged' },
  { value: '< 1 sec', label: 'Instant Feedback' },
  { value: '100%', label: 'Free to Join' },
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
        <div className="hero-badge">
          <span className="badge-pulse-dot" />
          <span>ABOUT ALGOFIGHT</span>
        </div>
        <h1>
          The Fun Way to <span className="text-cyan-gradient">Learn, Practice & Battle</span> in Code
        </h1>
        <p>
          Whether you are writing your very first lines of code or sharpening your skills for tech interviews, AlgoFight makes learning data structures and algorithms interactive, competitive, and rewarding.
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

      {/* Core Features Grid */}
      <motion.section
        className="learn-mission-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="learn-panel-header">
          <div className="pre-heading">WHY CODERS LOVE ALGOFIGHT</div>
          <h2>Everything You Need to Grow Your Skills</h2>
          <p>
            From casual solo practice to intense 1v1 live duels, AlgoFight provides a supportive and fun environment for programmers of all levels.
          </p>
        </div>

        <div className="mission-grid">
          {beginnerPillars.map((pillar) => (
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

      {/* How It Works Step-By-Step */}
      <motion.section
        className="learn-arch-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="learn-panel-header">
          <div className="pre-heading">SIMPLE & EASY START</div>
          <h2>How AlgoFight Works in 4 Steps</h2>
          <p>
            Getting started takes less than 30 seconds. Here is how you can jump in and begin improving your code today:
          </p>
        </div>

        <div className="arch-grid">
          {gettingStartedSteps.map((stepItem) => (
            <div key={stepItem.title} className="arch-card">
              <div className="step-badge">{stepItem.step}</div>
              <div className="arch-icon-wrap">
                <FontAwesomeIcon icon={stepItem.icon} />
              </div>
              <h4>{stepItem.title}</h4>
              <p>{stepItem.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Learning Tracks & Why It Works */}
      <section className="learn-flow-section">
        <article className="learn-flow-card">
          <div className="learn-flow-title-row">
            <h2>Skill Progression Pathways</h2>
            <span className="chip">Step-by-Step</span>
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
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="learn-flow-card">
          <div className="learn-flow-title-row">
            <h2>Why Practice on AlgoFight?</h2>
            <span className="chip">Beginner Friendly</span>
          </div>

          <ul className="why-list">
            <li>
              <div className="why-icon cyan"><FontAwesomeIcon icon={faShieldHalved} /></div>
              <div>
                <strong>Fair & Supportive Environment</strong>
                <p>Anti-cheat protections ensure ratings are earned honestly. Matchmaking pairs you with peers at your exact skill level.</p>
              </div>
            </li>
            <li>
              <div className="why-icon yellow"><FontAwesomeIcon icon={faRocket} /></div>
              <div>
                <strong>Instant Sub-Second Feedback</strong>
                <p>Test your code in real-time and see friendly error messages to help you fix bugs quickly.</p>
              </div>
            </li>
            <li>
              <div className="why-icon pink"><FontAwesomeIcon icon={faGift} /></div>
              <div>
                <strong>Real Rewards & Recognition</strong>
                <p>Earn Arena Points as you practice and battle, and redeem them for gift cards, entry passes, and badges.</p>
              </div>
            </li>
          </ul>

          <div className="about-cta-box">
            <button className="btn-primary-glow" onClick={() => handleAction('/battle')}>
              Start Competing <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button className="btn-secondary-glass" onClick={() => handleAction('/practice')}>
              Explore Practice Problems
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
