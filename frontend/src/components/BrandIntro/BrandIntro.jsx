import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoIcon from '../../assets/algofight-logo.png';
import './BrandIntro.css';

export default function BrandIntro({ onComplete }) {
  // Stages: 'typing' | 'executed' | 'zooming' | 'wordmark' | 'logoReveal' | 'hold' | 'complete'
  const [stage, setStage] = useState('typing');
  const [typedText, setTypedText] = useState('');
  const targetCode = 'print("Hello, Coders.")';

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStage('logoReveal');
      const timer = setTimeout(() => {
        handleFinish();
      }, 1200);
      return () => clearTimeout(timer);
    }

    // Scene 1: Measured, comfortable typing (0.0s - 1.5s)
    let charIndex = 0;
    const typingInterval = setInterval(() => {
      charIndex++;
      setTypedText(targetCode.slice(0, charIndex));
      if (charIndex >= targetCode.length) {
        clearInterval(typingInterval);
      }
    }, 62); // ~1.35s total typing duration

    // Scene 2: Code Execution Output appears and lingers (1.8s)
    const tExecute = setTimeout(() => {
      setStage('executed');
    }, 1800);

    // Scene 3: Camera Zoom Out + Wordmark emerges Big to Small (3.2s)
    const tZoom = setTimeout(() => {
      setStage('zooming');
    }, 3200);

    // Scene 4: Wordmark settles gracefully in center (5.5s)
    const tWordmark = setTimeout(() => {
      setStage('wordmark');
    }, 5500);

    // Scene 5: Slow, smooth slide left & fade out of text, as Logo smoothly enters center (6.8s)
    const tLogo = setTimeout(() => {
      setStage('logoReveal');
    }, 6800);

    // Scene 6: Hold on centered logo and prepare dissolve (8.8s)
    const tFadeOut = setTimeout(() => {
      setStage('hold');
    }, 8800);

    // Completion: Transition cleanly into landing page (10.0s)
    const tComplete = setTimeout(() => {
      handleFinish();
    }, 10000);

    // Keyboard shortcut to skip (Escape)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(typingInterval);
      clearTimeout(tExecute);
      clearTimeout(tZoom);
      clearTimeout(tWordmark);
      clearTimeout(tLogo);
      clearTimeout(tFadeOut);
      clearTimeout(tComplete);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prefersReducedMotion]);

  const handleFinish = () => {
    sessionStorage.setItem('af_brand_intro_played', 'true');
    setStage('complete');
    if (onComplete) onComplete();
  };

  if (stage === 'complete') return null;

  return (
    <AnimatePresence>
      <motion.div
        className="brand-intro-overlay"
        initial={{ opacity: 1 }}
        animate={{ opacity: stage === 'hold' ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        onClick={handleFinish}
        role="dialog"
        aria-label="AlgoFight Brand Introduction"
      >
        {/* Deep Cyber Background Grid & Ambient Glow */}
        <div className="brand-intro-bg-grid" />
        <div className="brand-intro-ambient-glow" />

        {/* ================= SCENE 1 & 2: CODE EDITOR CAMERA RIG ================= */}
        <motion.div
          className="brand-intro-camera-rig"
          animate={{
            scale: stage === 'typing' || stage === 'executed'
              ? 1
              : stage === 'zooming'
                ? 0.38
                : 0.12,
            opacity: stage === 'typing' || stage === 'executed'
              ? 1
              : stage === 'zooming'
                ? 0.22
                : 0,
            y: stage === 'typing' || stage === 'executed' ? 0 : -70
          }}
          transition={{
            duration: stage === 'zooming' ? 2.2 : 0.9,
            ease: [0.16, 1, 0.3, 1]
          }}
        >
          <div className="brand-intro-editor-card">
            {/* Editor Window Topbar */}
            <div className="brand-intro-editor-header">
              <div className="editor-window-controls">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <div className="editor-tab-label">
                <span className="editor-file-icon">&lt;/&gt;</span>
                <span className="editor-file-name">arena.py</span>
              </div>
              <div className="editor-header-status">Python 3.12</div>
            </div>

            {/* Editor Window Body */}
            <div className="brand-intro-editor-body">
              <div className="code-line">
                <span className="line-num">1</span>
                <span className="code-content">
                  <span className="token-fn">print</span>
                  <span className="token-paren">(</span>
                  <span className="token-string">"{typedText.replace('print("', '').replace('")', '')}"</span>
                  <span className="token-paren">)</span>
                  {stage === 'typing' && <span className="typing-cursor">|</span>}
                </span>
              </div>

              {/* Execution stdout */}
              {(stage === 'executed' || stage === 'zooming') && (
                <motion.div
                  className="editor-stdout-container"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                  <div className="stdout-divider" />
                  <div className="stdout-row">
                    <span className="stdout-prompt">&gt;</span>
                    <span className="stdout-output">Hello, Coders.</span>
                    <span className="stdout-status-badge">EXEC 0.04s</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ================= SCENE 3, 4, 5: ALGOFIGHT WORDMARK & LOGO TRANSITION ================= */}
        <div className="brand-intro-stage-center">
          {/* Wordmark: Scales from Big (1.6) -> Normal (1.0), then slowly slides left & disappears */}
          <motion.div
            className="brand-intro-wordmark-wrapper"
            initial={{ opacity: 0, scale: 1.6, x: 0 }}
            animate={{
              opacity: stage === 'typing' || stage === 'executed'
                ? 0
                : stage === 'zooming'
                  ? 0.95
                  : stage === 'wordmark'
                    ? 1
                    : 0, // slowly fades away in logoReveal & hold
              scale: stage === 'typing' || stage === 'executed'
                ? 1.6
                : stage === 'zooming'
                  ? 1.18
                  : stage === 'wordmark'
                    ? 1.0
                    : 0.92,
              x: stage === 'logoReveal' || stage === 'hold' ? -150 : 0
            }}
            transition={{
              opacity: {
                duration: stage === 'logoReveal' ? 1.4 : 1.6,
                ease: [0.22, 1, 0.36, 1]
              },
              scale: {
                duration: 2.1,
                ease: [0.16, 1, 0.3, 1]
              },
              x: {
                duration: 1.5,
                ease: [0.22, 1, 0.36, 1]
              }
            }}
          >
            <h1 className="brand-intro-wordmark-text">
              <span className="brand-word-algo">ALGO</span>
              <span className="brand-word-fight">FIGHT</span>
            </h1>
            <div className="brand-intro-tagline">
              COMPETITIVE PROGRAMMING ARENA
            </div>
          </motion.div>

          {/* Centered Logo: Gracefully appears and expands as the text slides left and vanishes */}
          <motion.div
            className="brand-intro-logo-spotlight"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{
              opacity: stage === 'logoReveal' || stage === 'hold' ? 1 : 0,
              scale: stage === 'logoReveal' || stage === 'hold' ? 1 : 0.82
            }}
            transition={{
              duration: 1.5,
              ease: [0.22, 1, 0.36, 1],
              delay: stage === 'logoReveal' ? 0.15 : 0
            }}
          >
            <div className="brand-intro-logo-glow-ring" />
            <img
              src={logoIcon}
              alt="AlgoFight Official Circular Logo"
              className="brand-intro-centered-logo-img"
            />
            <motion.div 
              className="brand-intro-logo-subtitle"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: stage === 'logoReveal' || stage === 'hold' ? 0.95 : 0,
                y: stage === 'logoReveal' || stage === 'hold' ? 0 : 10
              }}
              transition={{ duration: 1.1, delay: 0.4 }}
            >
              FIGHT FOR DOMINANCE
            </motion.div>
          </motion.div>
        </div>

        {/* Subtle skip indicator */}
        <div className="brand-intro-skip-hint">
          <span>Press ESC or click to enter Arena</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
