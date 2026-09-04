import React from 'react';
import './Legal.css';

export default function Cookies() {
  return (
    <div className="legal-page">
      <section className="legal-hero">
        <div className="legal-pre">LEGAL</div>
        <h1>Cookie Policy</h1>
        <p>
          Cookies and local storage help AlgoFight keep sessions secure, preserve preferences,
          and improve product reliability and performance.
        </p>
        <div className="legal-meta">Last updated: September 2026</div>
      </section>

      <div className="legal-stack">
        <section className="legal-panel">
          <h2>Essential Cookies</h2>
          <p>
            Required for sign-in state, route protection, and secure access to account-based features.
            Disabling these may prevent core platform functionality.
          </p>
        </section>

        <section className="legal-panel">
          <h2>Preference Cookies</h2>
          <p>
            Used to store non-sensitive preferences such as interface settings and selected workflow options
            for a smoother user experience.
          </p>
        </section>

        <section className="legal-panel">
          <h2>Analytics Signals</h2>
          <p>
            We may use aggregated metrics to understand feature usage, reliability, and performance trends.
            These insights help us optimize matchmaking, judging flow, and user experience.
          </p>
        </section>

        <section className="legal-panel">
          <h2>Managing Cookies</h2>
          <ul>
            <li>You can clear cookies in your browser settings at any time.</li>
            <li>You can block non-essential storage depending on browser capabilities.</li>
            <li>Blocking all cookies may degrade or disable portions of the platform.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
