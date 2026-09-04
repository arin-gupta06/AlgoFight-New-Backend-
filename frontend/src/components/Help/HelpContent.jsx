import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faChevronDown,
  faArrowRight,
  faGamepad,
  faCode,
  faTrophy,
  faServer,
  faShieldHalved,
  faCoins,
  faHeadset
} from '@fortawesome/free-solid-svg-icons';
import './Help.css';

const faqs = [
  {
    id: 'battle-matchmaking',
    category: '1v1 Battles',
    icon: faGamepad,
    question: 'How does 1v1 Battle matchmaking and duel progression work?',
    answer: 'You can either join a public matchmaking queue or create a private room with a custom 6-digit code to invite friends or institutional classmates. Once both combatants are locked in, a 5-second countdown triggers, the problem statement is decrypted, and real-time opponent test case telemetry starts streaming via WebSockets.'
  },
  {
    id: 'sandbox-execution',
    category: 'Code Sandbox',
    icon: faServer,
    question: 'How are code submissions executed and graded?',
    answer: 'Every submission is dynamically classified into Light (Python, JS) or Heavy (C++, Java compilation) workload queues. Submissions are processed by asymmetric BullMQ workers across an elastic multi-container Piston sandbox pool with strict CPU and memory limits (256MB), ensuring sub-second grading and zero queue starvation.'
  },
  {
    id: 'elo-ratings',
    category: 'Elo & Ratings',
    icon: faTrophy,
    question: 'How is my Elo rating calculated after battles?',
    answer: 'AlgoFight utilizes an adaptive Elo rating formula based on the relative skill of your opponent and your match performance. Defeating higher-rated opponents yields significant rank jumps. Rank tiers range from Silver I to Grandmaster with seasonal leaderboards.'
  },
  {
    id: 'supported-languages',
    category: 'Practice',
    icon: faCode,
    question: 'What programming languages can I use?',
    answer: 'AlgoFight currently supports C++ (GCC 14 / C++20), Python 3.11, Java 17, and JavaScript (Node.js 20). Our web editor includes Monaco syntax highlighting, auto-completion, bracket pairing, and customizable keybindings.'
  },
  {
    id: 'anti-cheat-integrity',
    category: 'Security',
    icon: faShieldHalved,
    question: 'What anti-cheat systems protect competitive leaderboards?',
    answer: 'Our Logical User Gateway enforces cryptographic HMAC-SHA256 test attestations, IP abuse jails, and suspicious submission velocity tracking. Pasting code during rated tournament rounds is flagged for heuristic integrity analysis.'
  },
  {
    id: 'rewards-tokens',
    category: 'Rewards',
    icon: faCoins,
    question: 'How do I earn tokens and redeem items in the Rewards Hub?',
    answer: 'You earn AlgoTokens by winning 1v1 duels, completing daily practice streaks, and advancing in seasonal leaderboard ranks. Tokens can be redeemed for cybernetic badge flairs, profile custom banners, and exclusive developer swag.'
  },
  {
    id: 'custom-rooms',
    category: '1v1 Battles',
    icon: faGamepad,
    question: 'Can I host institutional competitions or classroom group battles?',
    answer: 'Yes! Custom Room Lobbies allow host players, mentors, and batch leads to spin up private battle rooms for up to 100 players with configurable question counts (1 to 5), dynamic MIX difficulty, time limits, and live in-room scoreboard synchronization.'
  },
  {
    id: 'broadcast-documents',
    category: 'Announcements',
    icon: faShieldHalved,
    question: 'How do System Broadcasts and document previews work?',
    answer: 'System announcements and tournament bulletins support rich media attachments. PDF documents, problem set briefs, and guidelines display with an instant WhatsApp-style first-page sheet preview, page counters, and secure one-click downloads.'
  }
];

export default function HelpContent({ isModal = false, onSelectTab }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState('battle-matchmaking');

  const categories = ['All', '1v1 Battles', 'Practice', 'Code Sandbox', 'Elo & Ratings', 'Security', 'Rewards', 'Announcements'];

  const filteredFaqs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesCat = activeCategory === 'All' || faq.category === activeCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleFaq = (id) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  const handleContactClick = () => {
    if (onSelectTab) {
      onSelectTab('contact');
    }
  };

  return (
    <div className={`help-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      <motion.section
        className="help-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="help-pre">DOCUMENTATION & SUPPORT</div>
        <h1>
          AlgoFight <span>Help Center</span>
        </h1>
        <p>
          Everything you need to know about 1v1 live battles, isolated compiler sandboxes, Elo progression, and platform security.
        </p>
      </motion.section>

      <div className="help-controls">
        <div className="help-search-box">
          <FontAwesomeIcon icon={faSearch} className="help-search-icon" />
          <input
            type="text"
            placeholder="Search FAQs, topics, or features..."
            className="help-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="help-categories">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`help-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="help-faq-list">
        {filteredFaqs.map((faq) => {
          const isOpen = openFaqId === faq.id;
          return (
            <div key={faq.id} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
              <button
                className="faq-question"
                onClick={() => toggleFaq(faq.id)}
                aria-expanded={isOpen}
              >
                <div>
                  <span className="faq-badge">{faq.category}</span>
                  {faq.question}
                </div>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`faq-icon-chevron ${isOpen ? 'rotated' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    className="faq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredFaqs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px', color: '#8596b0' }}>
            <p>No matching FAQs found for "{searchQuery}".</p>
          </div>
        )}
      </div>

      <div className="help-contact-prompt">
        <div>
          <h3>Still have unresolved questions?</h3>
          <p>Our engineering support team is available Mon - Fri, 10AM - 6PM IST to assist you.</p>
        </div>
        <button className="btn-help-contact" onClick={handleContactClick}>
          <FontAwesomeIcon icon={faHeadset} /> Contact Support <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  );
}
