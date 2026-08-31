import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faMicrochip,
  faCode,
  faShieldHalved,
  faArrowRight,
  faEnvelope,
  faCheckCircle,
  faBriefcase,
  faLaptopCode
} from '@fortawesome/free-solid-svg-icons';
import './Careers.css';

const careerValues = [
  {
    icon: faBolt,
    title: 'Sub-Millisecond Obsession',
    desc: 'We optimize every WebSocket frame, database lock, and container compiler pass to shave microseconds off battle latency.'
  },
  {
    icon: faShieldHalved,
    title: 'Radical Integrity',
    desc: 'Deterministic sandboxes, tamper-proof Elo rating updates, and zero tolerance for vulnerabilities or anti-cheat flaws.'
  },
  {
    icon: faLaptopCode,
    title: 'Autonomy & Ownership',
    desc: 'Architects own their domains end-to-end — from systems RFCs to deployment, load-testing, and real-time observability.'
  }
];

const openRoles = [
  {
    id: 'dist-systems',
    title: 'Distributed Systems & WebSocket Architect',
    type: 'Full-time',
    location: 'Remote (Global)',
    experience: '3+ Years',
    tech: 'Node.js, Fastify, WebSockets, Redis BullMQ, High RPS',
    summary: 'Build high-throughput game state orchestrators, atomic duel locks, and resilient broadcast synchronization fabrics.'
  },
  {
    id: 'sandbox-infra',
    title: 'Sandbox Infrastructure & Linux Kernel Engineer',
    type: 'Full-time',
    location: 'Remote (Global)',
    experience: '3+ Years',
    tech: 'Docker, Seccomp-BPF, C++, Linux Cgroups, Piston Engines',
    summary: 'Design hardened, zero-leak execution sandboxes evaluating millions of untrusted submissions under strict CPU/memory limits.'
  },
  {
    id: 'problem-setter',
    title: 'Competitive Problem Setter & Algorithmic Curator',
    type: 'Contract / Part-time',
    location: 'Remote',
    experience: 'Contest Master / Candidate Master',
    tech: 'Data Structures, Graph Theory, Dynamic Programming, Test Case Generation',
    summary: 'Author original, tournament-grade algorithmic problems, edge case test suites, and editorial explanations for 1v1 arenas.'
  }
];

export default function CareersContent({ isModal = false }) {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('supportalgofight@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  return (
    <div className={`careers-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      <motion.section
        className="careers-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="careers-pre">JOIN OUR ARENA</div>
        <h1>
          Build the Future of <span>Competitive Coding</span>
        </h1>
        <p>
          We are engineering the fastest, most deterministic real-time coding combat platform on the planet. Help us build high-throughput distributed systems and empower millions of developers worldwide.
        </p>
      </motion.section>

      <div className="careers-section-title">
        <FontAwesomeIcon icon={faMicrochip} style={{ color: '#00e5ff' }} /> Our Engineering Principles
      </div>

      <div className="careers-values-grid">
        {careerValues.map((val) => (
          <div key={val.title} className="careers-val-card">
            <FontAwesomeIcon icon={val.icon} className="careers-val-icon" />
            <h3>{val.title}</h3>
            <p>{val.desc}</p>
          </div>
        ))}
      </div>

      <div className="careers-section-title">
        <FontAwesomeIcon icon={faBriefcase} style={{ color: '#00e5ff' }} /> Open Positions
      </div>

      <div className="careers-roles-list">
        {openRoles.map((role) => (
          <div key={role.id} className="careers-role-card">
            <div className="careers-role-info">
              <h3>{role.title}</h3>
              <p style={{ margin: '0 0 10px', color: '#94a3b8', fontSize: '0.88rem', maxWidth: '650px' }}>
                {role.summary}
              </p>
              <div className="careers-role-pills">
                <span className="role-pill highlight">{role.type}</span>
                <span className="role-pill">{role.location}</span>
                <span className="role-pill">{role.experience}</span>
                <span className="role-pill">{role.tech}</span>
              </div>
            </div>

            <div>
              <a
                href={`mailto:supportalgofight@gmail.com?subject=Application for ${encodeURIComponent(role.title)}`}
                className="btn-apply"
              >
                Apply via Email <FontAwesomeIcon icon={faArrowRight} />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="careers-talent-box">
        <h3>Don't see your specific role?</h3>
        <p>
          We are always looking for exceptional systems engineers, competitive coders, and UI craftsmen. Send your GitHub, resume, and what you want to build to our talent network.
        </p>
        <div style={{ display: 'inline-flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="mailto:supportalgofight@gmail.com?subject=General Talent Network Application"
            className="btn-apply"
          >
            <FontAwesomeIcon icon={faEnvelope} /> Email supportalgofight@gmail.com
          </a>
          <button
            onClick={handleCopyEmail}
            className="btn-apply"
            style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#00e5ff', border: '1px solid rgba(0, 229, 255, 0.3)' }}
          >
            <FontAwesomeIcon icon={copiedEmail ? faCheckCircle : faCode} />{' '}
            {copiedEmail ? 'Copied to Clipboard!' : 'Copy Email Address'}
          </button>
        </div>
      </div>
    </div>
  );
}
