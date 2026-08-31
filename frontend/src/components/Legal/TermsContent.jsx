import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved,
  faScaleBalanced,
  faEnvelope,
  faArrowRight,
  faFileContract
} from '@fortawesome/free-solid-svg-icons';
import './Legal.css';

export default function TermsContent({ isModal = false }) {
  return (
    <div className={`legal-content-wrapper ${isModal ? 'is-modal-view' : ''}`}>
      {/* Hero Section */}
      <motion.section
        className="legal-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="legal-pre">LEGAL & REGULATORY FRAMEWORK</div>
        <h1>
          Terms of <span>Service</span>
        </h1>
        <p>
          These Terms of Service govern your access to and use of the AlgoFight platform, including real-time 1v1 battle arenas, sandbox compiler execution, ranking leaderboards, problem archives, and token reward features.
        </p>

        <div className="legal-meta-row">
          <span className="legal-meta">Effective: August 2026</span>
          <span className="legal-badge-pill">
            <FontAwesomeIcon icon={faScaleBalanced} /> Version 2.4 Production
          </span>
          <span className="legal-badge-pill">Jurisdiction: India & Global Standard</span>
        </div>
      </motion.section>

      {/* Table of Contents Pill Bar */}
      <div className="legal-toc-bar">
        <span className="legal-toc-label">Sections:</span>
        <a href="#tos-1" className="legal-toc-item">1. Acceptance</a>
        <a href="#tos-2" className="legal-toc-item">2. Accounts & Security</a>
        <a href="#tos-3" className="legal-toc-item">3. 1v1 Arenas & Duels</a>
        <a href="#tos-4" className="legal-toc-item">4. Fair Play & Anti-Cheat</a>
        <a href="#tos-5" className="legal-toc-item">5. Sandbox Execution</a>
        <a href="#tos-6" className="legal-toc-item">6. IP & Code Licensing</a>
        <a href="#tos-7" className="legal-toc-item">7. Ratings & Tokens</a>
        <a href="#tos-8" className="legal-toc-item">8. Availability</a>
        <a href="#tos-9" className="legal-toc-item">9. Disclaimers</a>
        <a href="#tos-10" className="legal-toc-item">10. Termination</a>
      </div>

      {/* Main Content Stack */}
      <div className="legal-stack">
        {/* Section 1 */}
        <section className="legal-panel" id="tos-1">
          <div className="legal-panel-head">
            <span className="legal-section-number">01</span>
            <h2>Acceptance of Terms & Eligibility</h2>
          </div>
          <p>
            By creating an account, connecting via single sign-on, or otherwise accessing the AlgoFight web application, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
          <p>
            <strong>Eligibility:</strong> You must be at least 13 years of age (or the minimum legal age required in your country of residence) to register an account. If you are under 18, you represent that you have received permission from a parent or legal guardian.
          </p>
        </section>

        {/* Section 2 */}
        <section className="legal-panel" id="tos-2">
          <div className="legal-panel-head">
            <span className="legal-section-number">02</span>
            <h2>Account Registration, Security & Credentials</h2>
          </div>
          <p>
            When registering an account, you must provide accurate, current, and complete profile information. You are solely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account.
          </p>
          <ul>
            <li><strong>Single Account Policy:</strong> Users are permitted one primary combatant account. Creating multiple secondary accounts ("smurfing") to manipulate newcomer matchmaking or artificially inflate ratings is strictly prohibited.</li>
            <li><strong>Credential Sharing:</strong> You may not share, sell, rent, or lease your login credentials to third parties or allow unauthorized individuals to compete under your name.</li>
            <li><strong>Security Breaches:</strong> You agree to immediately notify AlgoFight at <code>supportalgofight@gmail.com</code> upon discovering any unauthorized use or security vulnerability affecting your account.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="legal-panel" id="tos-3">
          <div className="legal-panel-head">
            <span className="legal-section-number">03</span>
            <h2>1v1 Battle Arena, Matchmaking & Tournament Rules</h2>
          </div>
          <p>
            AlgoFight features synchronized multi-turn and real-time 1v1 coding battles. Once matchmaking pairs you with an opponent and the countdown sequence completes:
          </p>
          <ul>
            <li><strong>Atomic Room State:</strong> Both combatants are locked into the active room lifecycle. Exiting, disconnecting, or intentionally closing the browser during a live match will be classified as a forfeit and handled by the automated matchmaker adjudication engine.</li>
            <li><strong>Test Case Evaluation:</strong> Match victories are awarded strictly based on deterministic judge results: passing all test cases within the allotted time limit and minimum execution latency.</li>
            <li><strong>Institutional & Private Arenas:</strong> Custom room codes created for universities, bootcamps, and institutional batches are governed by their respective organizer guidelines in conjunction with these general terms.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="legal-panel" id="tos-4">
          <div className="legal-panel-head">
            <span className="legal-section-number">04</span>
            <h2>Fair Play, Code of Conduct & Anti-Cheat Governance</h2>
          </div>
          <p>
            The competitive credibility of AlgoFight relies on strict mathematical fair play. We employ continuous automated heuristic analysis, Logical User Gateways, and HMAC-SHA256 test integrity checks.
          </p>
          <div className="legal-highlight-box">
            <strong>Prohibited Activities:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
              <li>Using external AI copilots, LLMs, automated submission scripts, or unauthorized browser extensions during rated 1v1 matches.</li>
              <li>Plagiarizing source code, utilizing pre-generated solutions from unauthorized leaks, or collaborating in real-time with third parties during competitive duels.</li>
              <li>Attempting to manipulate WebSocket protocol payloads, spoofing execution pass/fail frames, or bypassing Logical User Gateway rate limiters.</li>
              <li>Engaging in denial of service (DoS) attacks, flood requests, or judge worker resource exhaustion.</li>
            </ul>
          </div>
          <p>
            <strong>Enforcement & Penalties:</strong> Violations will result in immediate match cancellation, forfeiture of Elo rating points, placement in temporary or permanent IP/account abuse jails, or total platform ban without refund.
          </p>
        </section>

        {/* Section 5 */}
        <section className="legal-panel" id="tos-5">
          <div className="legal-panel-head">
            <span className="legal-section-number">05</span>
            <h2>Sandbox Execution & Code Governance</h2>
          </div>
          <p>
            All submitted code is compiled and executed in hardware-isolated container execution sandboxes governed by kernel cgroups and seccomp-bpf filters:
          </p>
          <ul>
            <li><strong>Resource Boundaries:</strong> Standard CPU execution is capped at 2.0 seconds and memory consumption is restricted to 256MB per judge pass.</li>
            <li><strong>Prohibited Payloads:</strong> Submissions containing malicious code, fork bombs, unauthorized socket networking, kernel exploit attempts, filesystem breakouts, or crypto-mining scripts are automatically flagged and terminated.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="legal-panel" id="tos-6">
          <div className="legal-panel-head">
            <span className="legal-section-number">06</span>
            <h2>Intellectual Property & Code Licensing</h2>
          </div>
          <p>
            <strong>Your Code Submissions:</strong> You retain full copyright and intellectual property ownership of the original code solutions you author on AlgoFight. By submitting solutions, you grant AlgoFight a perpetual, non-exclusive, worldwide, royalty-free license to run, evaluate, analyze, display in anonymized rankings, and store your solutions to maintain judge metrics, anti-cheat detection, and service reliability.
          </p>
          <p>
            <strong>Platform Assets:</strong> The AlgoFight brand, logos, user interface designs, custom problem statements, animations, graphics, and backend architecture are the proprietary intellectual property of AlgoFight and may not be reproduced without written consent.
          </p>
        </section>

        {/* Section 7 */}
        <section className="legal-panel" id="tos-7">
          <div className="legal-panel-head">
            <span className="legal-section-number">07</span>
            <h2>Elo Ratings, Leaderboards & Virtual Tokens</h2>
          </div>
          <p>
            Elo ratings, competitive tiers (Silver to Grandmaster), and AlgoTokens are virtual achievements designed solely for platform progression and gamification.
          </p>
          <ul>
            <li><strong>No Fiat Value:</strong> Virtual tokens, cosmetics, badges, and rating points carry zero monetary, cash, or fiat value and cannot be exchanged, sold, or transferred outside the application.</li>
            <li><strong>Retroactive Rating Recalculation:</strong> If a match participant is found to have cheated or abused platform mechanics, AlgoFight reserves the right to retroactively adjust and recalculate leaderboard standings.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section className="legal-panel" id="tos-8">
          <div className="legal-panel-head">
            <span className="legal-section-number">08</span>
            <h2>Service Availability, Updates & Maintenance</h2>
          </div>
          <p>
            We strive for 99.99% uptime; however, AlgoFight is an evolving competitive platform. We reserve the right to perform scheduled maintenance, update problem sets, alter sandbox container images, or introduce feature patches. We are not liable for match disruptions resulting from general internet outages, local ISP packet loss, or necessary emergency updates.
          </p>
        </section>

        {/* Section 9 */}
        <section className="legal-panel" id="tos-9">
          <div className="legal-panel-head">
            <span className="legal-section-number">09</span>
            <h2>Disclaimer of Warranties & Limitation of Liability</h2>
          </div>
          <p>
            THE ALGOFIGHT PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ALGOFIGHT DISCLAIMS ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            IN NO EVENT SHALL ALGOFIGHT OR ITS ARCHITECTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
          </p>
        </section>

        {/* Section 10 */}
        <section className="legal-panel" id="tos-10">
          <div className="legal-panel-head">
            <span className="legal-section-number">10</span>
            <h2>Account Termination, Governing Law & Contact</h2>
          </div>
          <p>
            You may terminate your account at any time by contacting support. AlgoFight may suspend or terminate your account immediately if you breach these terms.
          </p>
          <p>
            <strong>Governing Law:</strong> These terms are governed by and construed in accordance with the laws of India, without regard to its conflict of law principles.
          </p>
        </section>

        {/* Contact Callout */}
        <div className="legal-contact-callout">
          <div>
            <h3>Questions Regarding Terms of Service?</h3>
            <p>For legal inquiries, dispute resolutions, or compliance questions, contact our legal team.</p>
          </div>
          <a href="mailto:supportalgofight@gmail.com?subject=Legal / Terms of Service Inquiry" className="btn-legal-contact">
            <FontAwesomeIcon icon={faEnvelope} /> Email supportalgofight@gmail.com <FontAwesomeIcon icon={faArrowRight} />
          </a>
        </div>
      </div>
    </div>
  );
}
