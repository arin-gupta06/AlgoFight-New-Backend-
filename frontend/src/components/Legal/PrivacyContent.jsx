import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faLock,
  faEnvelope,
  faArrowRight,
  faUserShield
} from '@fortawesome/free-solid-svg-icons';
import './Legal.css';

export default function PrivacyContent({ isModal = false }) {
  return (
    <div className={`legal-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      {/* Hero Section */}
      <motion.section
        className="legal-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="legal-pre">DATA PROTECTION & PRIVACY POLICY</div>
        <h1>
          Privacy <span>Policy</span>
        </h1>
        <p>
          At AlgoFight, protecting developer data and competitive integrity is fundamental. This policy details how we collect, process, store, and safeguard your personal information, code submissions, telemetry data, and match metrics.
        </p>

        <div className="legal-meta-row">
          <span className="legal-meta">Effective: August 2026</span>
          <span className="legal-badge-pill">
            <FontAwesomeIcon icon={faShieldHalved} /> GDPR & CCPA Aligned
          </span>
          <span className="legal-badge-pill">HMAC-SHA256 Encrypted Ingress</span>
        </div>
      </motion.section>

      {/* Table of Contents Pill Bar */}
      <div className="legal-toc-bar">
        <span className="legal-toc-label">Sections:</span>
        <a href="#priv-1" className="legal-toc-item">1. Information We Collect</a>
        <a href="#priv-2" className="legal-toc-item">2. How We Use Data</a>
        <a href="#priv-3" className="legal-toc-item">3. Edge Security</a>
        <a href="#priv-4" className="legal-toc-item">4. Data Sharing & Cloud</a>
        <a href="#priv-5" className="legal-toc-item">5. Cookies & Local Storage</a>
        <a href="#priv-6" className="legal-toc-item">6. Data Retention</a>
        <a href="#priv-7" className="legal-toc-item">7. Your Privacy Rights</a>
        <a href="#priv-8" className="legal-toc-item">8. Children's Privacy</a>
        <a href="#priv-9" className="legal-toc-item">9. International Transfers</a>
        <a href="#priv-10" className="legal-toc-item">10. Policy Updates</a>
      </div>

      {/* Main Content Stack */}
      <div className="legal-stack">
        {/* Section 1 */}
        <section className="legal-panel" id="priv-1">
          <div className="legal-panel-head">
            <span className="legal-section-number">01</span>
            <h2>Information We Collect</h2>
          </div>
          <p>We collect information in three primary categories to provide real-time competitive services:</p>
          <ul>
            <li>
              <strong>Directly Provided Information:</strong> Email address, display name, handle/username, avatar image, biographical details, and optional social/portfolio links (GitHub, LinkedIn).
            </li>
            <li>
              <strong>Gameplay & Code Submissions:</strong> Source code submitted to the practice archive or 1v1 arenas, compilation outputs, memory usage benchmarks, execution runtime metrics, match outcomes, pass/fail status, and Elo rating history.
            </li>
            <li>
              <strong>Automated Telemetry & Network Diagnostics:</strong> IP address, user agent, browser environment, WebSocket handshake metadata, request timing, rate-limiting tokens, and error crash dumps collected to optimize gateway throughput and thwart DDoS attacks.
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="legal-panel" id="priv-2">
          <div className="legal-panel-head">
            <span className="legal-section-number">02</span>
            <h2>How We Use Collected Information</h2>
          </div>
          <p>Your data is processed strictly for legitimate operational and competitive purposes:</p>
          <ul>
            <li><strong>Authentication & Profile Management:</strong> Authenticating account sessions, managing access tokens, and presenting personalized statistics on your Profile.</li>
            <li><strong>Multiplayer Matchmaking & Arenas:</strong> Pairing combatants of comparable skill in real time, broadcasting live test progress, and orchestrating atomic room state machines.</li>
            <li><strong>Automated Code Evaluation:</strong> Passing source code into isolated compiler containers to evaluate correctness against deterministic test suites.</li>
            <li><strong>Anti-Cheat & Leaderboard Integrity:</strong> Detecting unauthorized automation, code leakage, plagiarism, and IP abuse to protect the global rankings.</li>
            <li><strong>Rewards & Milestone Unlocks:</strong> Awarding AlgoTokens, calculating daily streaks, and issuing achievement badges.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="legal-panel" id="priv-3">
          <div className="legal-panel-head">
            <span className="legal-section-number">03</span>
            <h2>Cryptographic Edge Security & Data Protection</h2>
          </div>
          <p>
            AlgoFight implements modern defensive security architectures across every layer of the platform:
          </p>
          <div className="legal-highlight-box">
            <strong>Security Controls Implemented:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
              <li><strong>Transport Security:</strong> All client-server communication and WebSocket streaming are encrypted with TLS 1.3.</li>
              <li><strong>HMAC Attestations:</strong> Test execution outcomes and score dispatch frames require signed HMAC-SHA256 tokens to prevent packet spoofing.</li>
              <li><strong>Container Isolation:</strong> Arbitrary code runs in sandboxed Linux cgroups with read-only root filesystems and seccomp filters.</li>
              <li><strong>Admission Rate Limiters:</strong> Multi-tiered token bucket algorithms shield backend endpoints against brute-force and scraping.</li>
            </ul>
          </div>
        </section>

        {/* Section 4 */}
        <section className="legal-panel" id="priv-4">
          <div className="legal-panel-head">
            <span className="legal-section-number">04</span>
            <h2>Data Sharing & Third-Party Infrastructure</h2>
          </div>
          <p>
            <strong>We Do NOT Sell Personal Data:</strong> AlgoFight has never sold and will never sell personal information, telemetry, or user source code to data brokers or third-party advertisers.
          </p>
          <p>
            We share data only with verified cloud infrastructure providers who are contractually bound by strict data processing and confidentiality agreements:
          </p>
          <ul>
            <li><strong>Authentication Services:</strong> Firebase / Google Identity (for secure OAuth and session token verification).</li>
            <li><strong>Database & Cache Systems:</strong> PostgreSQL with Prisma ORM and Redis (BullMQ) for high-frequency distributed state coordination.</li>
            <li><strong>Isolated Judge Runtime:</strong> Hardened compute instances running containerized Piston judge engines.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="legal-panel" id="priv-5">
          <div className="legal-panel-head">
            <span className="legal-section-number">05</span>
            <h2>Cookies, Local Storage & Session State</h2>
          </div>
          <p>
            We use essential local storage and session tokens to maintain your login context, preserve editor preferences (such as Monaco Editor keybindings, font size, and tab spacing), and manage WebSocket connection IDs.
          </p>
          <p>
            We do not use invasive third-party cross-site advertising cookies. You can manage or clear local storage through your browser settings at any time; however, clearing essential tokens will require you to log in again.
          </p>
        </section>

        {/* Section 6 */}
        <section className="legal-panel" id="priv-6">
          <div className="legal-panel-head">
            <span className="legal-section-number">06</span>
            <h2>Data Retention & Account Erasure</h2>
          </div>
          <p>
            We retain your account profile, match records, and progress statistics for as long as your account remains active. If you choose to delete your account:
          </p>
          <ul>
            <li>Your personal identifiers (email, display name, social links) will be permanently purged from our primary database within 30 days.</li>
            <li>Public match outcomes will be anonymized to preserve global Elo rating mathematical integrity for other players you battled against.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="legal-panel" id="priv-7">
          <div className="legal-panel-head">
            <span className="legal-section-number">07</span>
            <h2>Your Privacy Rights & Controls (GDPR / CCPA)</h2>
          </div>
          <p>Regardless of your geographic location, AlgoFight provides you with full control over your data:</p>
          <ul>
            <li><strong>Right to Access & Portability:</strong> You may request a machine-readable export of all profile data and submissions associated with your account.</li>
            <li><strong>Right to Rectification:</strong> You can edit and correct your profile information directly in the Profile settings tab at any time.</li>
            <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> You may request complete account deletion by contacting our privacy officer.</li>
            <li><strong>Right to Restrict or Object:</strong> You can object to specific automated processing or anti-abuse profiling if you believe an error occurred.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="legal-panel" id="priv-8">
          <div className="legal-panel-head">
            <span className="legal-section-number">08</span>
            <h2>Children's Privacy & Age Protections</h2>
          </div>
          <p>
            AlgoFight does not knowingly collect personal identifiable information from children under 13 years of age. If we discover that an individual under 13 has created an account without verified parental consent, we will promptly delete the account and associated personal data.
          </p>
        </section>

        {/* Section 9 */}
        <section className="legal-panel" id="priv-9">
          <div className="legal-panel-head">
            <span className="legal-section-number">09</span>
            <h2>International Data Transfers</h2>
          </div>
          <p>
            AlgoFight servers and infrastructure are distributed globally to ensure sub-millisecond battle execution. By using the platform, you acknowledge that your data may be processed in data centers located in India and other secure cloud regions adhering to international data transfer safety protocols.
          </p>
        </section>

        {/* Section 10 */}
        <section className="legal-panel" id="priv-10">
          <div className="legal-panel-head">
            <span className="legal-section-number">10</span>
            <h2>Updates to This Policy & Contact Information</h2>
          </div>
          <p>
            We may update this Privacy Policy periodically to reflect new platform capabilities or regulatory requirements. Material revisions will be highlighted with a revised effective date and published across the platform.
          </p>
        </section>

        {/* Contact Callout */}
        <div className="legal-contact-callout">
          <div>
            <h3>Privacy Questions or Data Requests?</h3>
            <p>For data export, account deletion, or privacy-related questions, reach out to our privacy team.</p>
          </div>
          <a href="mailto:supportalgofight@gmail.com?subject=Privacy Policy / Data Subject Request" className="btn-legal-contact">
            <FontAwesomeIcon icon={faEnvelope} /> Email supportalgofight@gmail.com <FontAwesomeIcon icon={faArrowRight} />
          </a>
        </div>
      </div>
    </div>
  );
}
