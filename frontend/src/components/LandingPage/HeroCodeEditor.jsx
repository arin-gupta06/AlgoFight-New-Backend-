import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTerminal, faBolt, faCode, faHandshakeAngle } from '@fortawesome/free-solid-svg-icons';
import './HeroCodeEditor.css';

const WELCOME_CODE_SNIPPET = [
  'def welcome_combatant(player: str = "New Challenger"):',
  '    arena = "AlgoFight 1v1 Arena"',
  '    rank = "Unranked ➔ Grandmaster"',
  '    ',
  '    print(f"⚡ Welcome to {arena}, {player}!")',
  '    print("⚔️ 50,000+ coders ready. Practice, duel, dominate.")',
  '    ',
  '    return {"status": "INITIALIZED", "ready": True}',
  '',
  'welcome_combatant("Future Grandmaster")'
];

export default function HeroCodeEditor() {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [currentCharIdx, setCurrentCharIdx] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Type lines sequentially
    if (currentLineIdx < WELCOME_CODE_SNIPPET.length) {
      const fullLine = WELCOME_CODE_SNIPPET[currentLineIdx];
      const timer = setTimeout(() => {
        if (currentCharIdx < fullLine.length) {
          setCurrentCharIdx((prev) => prev + 1);
        } else {
          setDisplayedLines((prev) => [...prev, fullLine]);
          setCurrentLineIdx((prev) => prev + 1);
          setCurrentCharIdx(0);
        }
      }, 18);
      return () => clearTimeout(timer);
    } else if (!isExecuting && !isCompleted) {
      // Finished typing, trigger execution
      const execTimer = setTimeout(() => {
        setIsExecuting(true);
        setTimeout(() => {
          setIsExecuting(false);
          setIsCompleted(true);
        }, 700);
      }, 400);
      return () => clearTimeout(execTimer);
    } else if (isCompleted) {
      // Loop after 6 seconds
      const loopTimer = setTimeout(() => {
        setDisplayedLines([]);
        setCurrentLineIdx(0);
        setCurrentCharIdx(0);
        setIsExecuting(false);
        setIsCompleted(false);
      }, 6000);
      return () => clearTimeout(loopTimer);
    }
  }, [currentLineIdx, currentCharIdx, isExecuting, isCompleted]);

  // Syntax highlighter for welcoming code snippet
  const renderSyntaxHighlighted = (lineText) => {
    if (lineText.startsWith('def welcome_combatant')) {
      return (
        <span>
          <span className="syn-keyword">def </span>
          <span className="syn-fn">welcome_combatant</span>
          <span className="syn-punct">(player: </span>
          <span className="syn-type">str</span>
          <span className="syn-punct"> = </span>
          <span className="syn-string">"New Challenger"</span>
          <span className="syn-punct">):</span>
        </span>
      );
    }
    if (lineText.includes('arena = "AlgoFight 1v1 Arena"')) {
      return (
        <span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="syn-var">arena</span> = <span className="syn-string">"AlgoFight 1v1 Arena"</span>
        </span>
      );
    }
    if (lineText.includes('rank = "Unranked ➔ Grandmaster"')) {
      return (
        <span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="syn-var">rank</span> = <span className="syn-string">"Unranked ➔ Grandmaster"</span>
        </span>
      );
    }
    if (lineText.includes('print(f"⚡ Welcome to {arena}, {player}!")')) {
      return (
        <span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="syn-builtin">print</span>
          <span className="syn-punct">(</span>
          <span className="syn-string">f"⚡ Welcome to &#123;arena&#125;, &#123;player&#125;!"</span>
          <span className="syn-punct">)</span>
        </span>
      );
    }
    if (lineText.includes('print("⚔️ 50,000+ coders ready.')) {
      return (
        <span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="syn-builtin">print</span>
          <span className="syn-punct">(</span>
          <span className="syn-string">"⚔️ 50,000+ coders ready. Practice, duel, dominate."</span>
          <span className="syn-punct">)</span>
        </span>
      );
    }
    if (lineText.includes('return {"status": "INITIALIZED", "ready": True}')) {
      return (
        <span>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="syn-keyword">return </span>
          <span className="syn-punct">&#123;</span>
          <span className="syn-string">"status"</span>: <span className="syn-string">"INITIALIZED"</span>, <span className="syn-string">"ready"</span>: <span className="syn-keyword">True</span>
          <span className="syn-punct">&#125;</span>
        </span>
      );
    }
    if (lineText.includes('welcome_combatant("Future Grandmaster")')) {
      return (
        <span>
          <span className="syn-fn">welcome_combatant</span>
          <span className="syn-punct">(</span>
          <span className="syn-string">"Future Grandmaster"</span>
          <span className="syn-punct">)</span>
        </span>
      );
    }

    return <span>{lineText}</span>;
  };

  return (
    <motion.div 
      className="hero-code-editor-card"
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      whileHover={{ y: -4 }}
    >
      {/* Corner Cyber Accent Light */}
      <div className="hero-editor-corner-glow" />

      {/* Editor Top Bar */}
      <div className="hero-editor-header">
        <div className="hero-editor-controls">
          <span className="editor-dot dot-close" />
          <span className="editor-dot dot-min" />
          <span className="editor-dot dot-max" />
        </div>

        <div className="hero-editor-tab-active">
          <FontAwesomeIcon icon={faCode} className="tab-code-icon" />
          <span className="tab-title">welcome_arena.py</span>
          <span className="tab-lang-badge">PY 3.12</span>
        </div>

        <div className="hero-editor-telemetry">
          <span className="telemetry-live-dot" />
          <span className="telemetry-label">ARENA ONLINE</span>
        </div>
      </div>

      {/* Editor Code Area */}
      <div className="hero-editor-body">
        {/* Render already-typed lines */}
        {displayedLines.map((line, idx) => (
          <div key={idx} className="hero-code-line">
            <span className="hero-line-number">{idx + 1}</span>
            <span className="hero-line-code">{renderSyntaxHighlighted(line)}</span>
          </div>
        ))}

        {/* Render currently typing line */}
        {currentLineIdx < WELCOME_CODE_SNIPPET.length && (
          <div className="hero-code-line active-typing-line">
            <span className="hero-line-number">{currentLineIdx + 1}</span>
            <span className="hero-line-code">
              {renderSyntaxHighlighted(WELCOME_CODE_SNIPPET[currentLineIdx].slice(0, currentCharIdx))}
              <span className="hero-editor-cursor">|</span>
            </span>
          </div>
        )}
      </div>

      {/* Test Execution Output Tray */}
      <div className="hero-editor-footer">
        {isExecuting && (
          <div className="hero-exec-status executing">
            <FontAwesomeIcon icon={faBolt} className="exec-icon-spin" />
            <span>Connecting to AlgoFight Matchmaking Gateway...</span>
          </div>
        )}

        {isCompleted && (
          <motion.div 
            className="hero-exec-status passed"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="exec-passed-left">
              <FontAwesomeIcon icon={faCircleCheck} className="exec-check-icon" />
              <span className="exec-verdict">SYSTEM READY</span>
              <span className="exec-metric">Welcome Future Grandmaster!</span>
            </div>
            <div className="exec-passed-right">
              <span className="exec-speed-tag">50K+ In Queue</span>
              <span className="exec-elo-gain">Start Rating: 1200</span>
            </div>
          </motion.div>
        )}

        {!isExecuting && !isCompleted && (
          <div className="hero-exec-status idle">
            <FontAwesomeIcon icon={faTerminal} className="exec-idle-icon" />
            <span>AlgoFight Live Matchmaking Kernel Ready</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
