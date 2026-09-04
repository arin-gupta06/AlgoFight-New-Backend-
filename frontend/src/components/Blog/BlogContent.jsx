import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faArrowRight,
  faSearch,
  faArrowLeft,
  faTerminal,
  faLayerGroup,
  faBolt,
  faShieldHalved
} from '@fortawesome/free-solid-svg-icons';
import './Blog.css';

const blogArticles = [
  {
    id: 'elastic-multi-runtime',
    title: 'Elastic Multi-Runtime Architecture: Workload Classification, Autoscaling Sandboxes & Linux Telemetry',
    tag: 'Architecture',
    author: 'Arin Gupta & Vivek Chaurasiya',
    role: 'Full Stack & Sandbox Leads',
    date: 'September 2026',
    readTime: '5 min read',
    icon: faTerminal,
    excerpt: 'How we segregated submissions into Light and Heavy workload queues with asymmetric worker concurrency, automated Docker Piston scaling, and a 1Hz Linux telemetry data spine.',
    content: `Handling concurrent submission spikes without blowing past free-tier server limits requires intelligent orchestration. In this deep dive, we detail our multi-runtime pipeline: heuristic workload classification (Python/JS scripts vs C++/Java compilation), asymmetric concurrency workers (4x Light vs 2x Heavy), programmatic container scale-out with 60s cooldown hysteresis, and a dedicated FastAPI telemetry stream providing sub-second fleet visibility.`
  },
  {
    id: 'sandbox-v2',
    title: 'Deterministic Sandbox V2: Sub-6ms Code Execution & Hardware Isolation',
    tag: 'Architecture',
    author: 'Vivek Chaurasiya',
    role: 'Sandbox Infrastructure Lead',
    date: 'April 2026',
    readTime: '4 min read',
    icon: faTerminal,
    excerpt: 'How we engineered a stateless, containerized compiler engine capable of evaluating 15,000+ RPS across multi-language submissions with sub-millisecond CPU scheduling.',
    content: `Evaluating untrusted user code at scale requires rigorous mathematical sandboxing. In this dispatch, we break down our container lifecycle, seccomp-bpf filter setups, memory bounds governance, and how BullMQ redis streaming handles concurrent 1v1 battle duels without contention.`
  },
  {
    id: 'websocket-fabric',
    title: 'Multiplayer Arena Fabric: Synchronizing 1v1 Battles under 5ms Latency',
    tag: 'Systems',
    author: 'Arin Gupta',
    role: 'Full Stack Architect',
    date: 'March 2026',
    readTime: '5 min read',
    icon: faBolt,
    excerpt: 'Deep-dive into AlgoFight\'s distributed WebSocket event bus, atomic room state machines, and real-time keystroke/test-progress broadcast synchronization.',
    content: `Maintaining real-time opponent test telemetry requires low-latency event synchronization. We walk through the state transitions, matchmaker countdown protocols, and how our Fastify WebSocket gateway ensures zero race conditions during tiebreakers.`
  },
  {
    id: 'anti-cheat-gateways',
    title: 'Cryptographic Edge Security: HMAC Trust Attestations & Anti-Abuse Jails',
    tag: 'Security',
    author: 'Arin Gupta',
    role: 'Systems Lead',
    date: 'March 2026',
    readTime: '3 min read',
    icon: faShieldHalved,
    excerpt: 'Protecting competitive rankings with token bucket ingress limiters, HMAC-SHA256 test verification, and automated session revocation for malicious actors.',
    content: `Leaderboards must be tamper-proof. We explain how our Logical User Gateway intercepts, validates, and rates incoming socket traffic before it ever hits domain controllers, complete with dynamic IP jail thresholds.`
  },
  {
    id: 'cyber-ui-design',
    title: 'Crafting Cyber Glassmorphic Interfaces for High-Octane Coding Duels',
    tag: 'UI/UX',
    author: 'Krish Dargar',
    role: 'Frontend Architect',
    date: 'February 2026',
    readTime: '3 min read',
    icon: faLayerGroup,
    excerpt: 'The engineering behind AlgoFight\'s dark HUD theme, fluid particle systems, responsive grid telemetry, and micro-interactions designed for competitive speed.',
    content: `When coders are fighting the clock in a 1v1 duel, UI friction is fatal. We explore how framer-motion transitions, Monaco Editor syntax integrations, and subtle glowing feedback indicators create an immersive, futuristic coding cockpit.`
  }
];

export default function BlogContent({ isModal = false }) {
  const [activeTag, setActiveTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const tags = ['All', 'Architecture', 'Systems', 'Security', 'UI/UX'];

  const filteredArticles = useMemo(() => {
    return blogArticles.filter((art) => {
      const matchesTag = activeTag === 'All' || art.tag === activeTag;
      const matchesSearch =
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [activeTag, searchQuery]);

  return (
    <div className={`blog-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      <motion.section
        className="blog-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="blog-pre">ENGINEERING DISPATCHES</div>
        <h1>
          AlgoFight <span>DevLog & Changelog</span>
        </h1>
        <p>
          Deep technical breakdowns, architectural insights, and engineering updates directly from the team building the competitive arena.
        </p>
      </motion.section>

      {selectedArticle ? (
        <motion.div
          className="blog-expanded-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button className="btn-back" onClick={() => setSelectedArticle(null)}>
            <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '6px' }} /> Back to all dispatches
          </button>
          <div style={{ marginTop: '16px' }}>
            <span className="blog-badge">{selectedArticle.tag}</span>
            <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: '#64748b' }}>
              {selectedArticle.date} • {selectedArticle.readTime}
            </span>
          </div>
          <h2 style={{ fontSize: '1.6rem', marginTop: '10px' }}>{selectedArticle.title}</h2>
          <div style={{ fontSize: '0.85rem', color: '#00e5ff', marginBottom: '16px' }}>
            By {selectedArticle.author} ({selectedArticle.role})
          </div>
          <p style={{ fontSize: '1.02rem', lineHeight: '1.7', color: '#cbd5e1' }}>
            {selectedArticle.excerpt}
          </p>
          <p style={{ lineHeight: '1.7', color: '#94a3b8' }}>
            {selectedArticle.content}
          </p>
          <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
              💬 Want to discuss systems architecture or contribute benchmarks? Connect with us on our{' '}
              <a href="https://discord.com" target="_blank" rel="noreferrer" style={{ color: '#00e5ff', textDecoration: 'underline' }}>
                Discord Server
              </a>.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="blog-controls">
            <div className="blog-tags-bar">
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`blog-tag-btn ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => setActiveTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="blog-search-box">
              <FontAwesomeIcon icon={faSearch} className="blog-search-icon" />
              <input
                type="text"
                placeholder="Search technical articles..."
                className="blog-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="blog-grid">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                className="blog-card"
                onClick={() => setSelectedArticle(article)}
              >
                <div>
                  <div className="blog-card-meta">
                    <span className="blog-badge">{article.tag}</span>
                    <span className="blog-read-time">
                      <FontAwesomeIcon icon={faClock} /> {article.readTime}
                    </span>
                  </div>
                  <h3 className="blog-card-title">{article.title}</h3>
                  <p className="blog-card-excerpt">{article.excerpt}</p>
                </div>

                <div className="blog-card-footer">
                  <span className="blog-author">{article.author}</span>
                  <span className="blog-card-link">
                    Read Post <FontAwesomeIcon icon={faArrowRight} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
