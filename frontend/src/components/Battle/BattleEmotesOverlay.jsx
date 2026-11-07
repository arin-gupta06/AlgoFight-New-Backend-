import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faVolumeHigh,
  faVolumeXmark,
  faMagnifyingGlass,
  faFire,
  faFaceLaughSquint,
  faBolt,
  faClock,
  faCommentDots,
  faCommentSlash,
} from "@fortawesome/free-solid-svg-icons";
import EmoteImage from "./EmoteImage";
import {
  BATTLE_EMOTES,
  BATTLE_EMOTE_CATEGORIES,
  QUICK_TAUNT_EMOTES,
  playEmoteChime,
} from "../../constants/battleEmotes";
import "./BattleEmotes.css";

// --- Emote Picker Popover Modal ---
export function BattleEmotePicker({
  isOpen,
  onClose,
  onSelectEmote,
  cooldownRemaining,
  soundEnabled,
  onToggleSound,
  emotesEnabled = true,
  onToggleEmotes,
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredEmotes = useMemo(() => {
    return BATTLE_EMOTES.filter((emote) => {
      const matchesCategory =
        selectedCategory === "all" || emote.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        emote.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emote.teaseText.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="emote-picker-backdrop" onClick={onClose}>
      <motion.div
        className="emote-picker-window"
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="emote-picker-header">
          <div className="emote-picker-title-group">
            <h3>
              <FontAwesomeIcon icon={faFaceLaughSquint} style={{ color: "#fbbf24" }} />
              Battle Emotes
            </h3>
            <span className="emote-badge-tag">Taunt</span>
          </div>

          <div className="emote-header-actions">
            {onToggleEmotes && (
              <button
                type="button"
                className={`emote-sound-toggle-btn ${emotesEnabled ? "is-active" : "is-muted"}`}
                onClick={onToggleEmotes}
                title={emotesEnabled ? "Disable Battle Emotes" : "Enable Battle Emotes"}
              >
                <FontAwesomeIcon icon={emotesEnabled ? faCommentDots : faCommentSlash} />
              </button>
            )}
            <button
              type="button"
              className={`emote-sound-toggle-btn ${soundEnabled ? "is-active" : ""}`}
              onClick={onToggleSound}
              title={soundEnabled ? "Mute Emote Sounds" : "Enable Emote Sounds"}
            >
              <FontAwesomeIcon icon={soundEnabled ? faVolumeHigh : faVolumeXmark} />
            </button>
            <button
              type="button"
              className="emote-picker-close-btn"
              onClick={onClose}
              aria-label="Close Emote Drawer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {!emotesEnabled && (
          <div className="emote-disabled-notice-banner">
            <span>Battle emotes are currently disabled. Opponent emotes & taunts are hidden.</span>
            {onToggleEmotes && (
              <button type="button" className="emote-re-enable-btn" onClick={onToggleEmotes}>
                Enable Emotes
              </button>
            )}
          </div>
        )}

        <div className="emote-picker-toolbar">
          <div className="emote-category-tabs">
            {BATTLE_EMOTE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`emote-tab-btn ${selectedCategory === cat.id ? "is-active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            type="text"
            className="emote-search-input"
            placeholder="Search emote..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="emote-grid-container">
          {filteredEmotes.map((emote) => (
            <button
              key={emote.id}
              type="button"
              className="emote-card-btn"
              disabled={cooldownRemaining > 0}
              onClick={() => {
                onSelectEmote(emote);
                onClose();
              }}
              title={emote.teaseText}
            >
              <div className="emote-card-preview">
                <EmoteImage
                  codepoint={emote.codepoint}
                  alt={emote.name}
                  size={46}
                  fallbackEmoji={emote.fallbackEmoji}
                />
              </div>
              <span className="emote-card-label">{emote.name}</span>
              <span className="emote-card-tease">{emote.teaseText}</span>
            </button>
          ))}
          {filteredEmotes.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", color: "#94a3b8" }}>
              No emotes found matching "{searchQuery}"
            </div>
          )}
        </div>

        <div className="emote-picker-footer">
          {cooldownRemaining > 0 ? (
            <div className="emote-cooldown-status">
              <FontAwesomeIcon icon={faClock} />
              <span>Cooldown: {(cooldownRemaining / 1000).toFixed(1)}s</span>
            </div>
          ) : (
            <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
              Click any animated emote to tease your opponent!
            </span>
          )}

          <span className="emote-attribution">
            Powered by Google Noto Emoji
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// --- Quick Emote Bar in Header ---
export function QuickTauntBar({
  onSelectEmote,
  cooldownRemaining,
  cooldownTotal = 2500,
  onOpenPicker,
  emotesEnabled = true,
  onToggleEmotes,
}) {
  const isCoolingDown = cooldownRemaining > 0;
  const cooldownPct = isCoolingDown
    ? Math.max(0, Math.min(100, (cooldownRemaining / cooldownTotal) * 100))
    : 0;

  if (!emotesEnabled) {
    return (
      <div className="quick-taunt-bar is-disabled-bar" title="Battle Emotes are disabled (click to enable)">
        <button
          type="button"
          className="quick-taunt-disabled-pill"
          onClick={onToggleEmotes}
          title="Battle emotes disabled. Click to enable."
        >
          <FontAwesomeIcon icon={faCommentSlash} className="disabled-pill-icon" />
          <span className="disabled-pill-text">Emotes: Off</span>
        </button>
      </div>
    );
  }

  return (
    <div className="quick-taunt-bar" title="Quick Battle Emotes">
      <div className="quick-taunt-emotes-group">
        {QUICK_TAUNT_EMOTES.map((emote) => (
          <button
            key={emote.id}
            type="button"
            className="quick-taunt-btn"
            disabled={isCoolingDown}
            onClick={() => onSelectEmote(emote)}
            title={`Taunt: "${emote.teaseText}"`}
          >
            <EmoteImage
              codepoint={emote.codepoint}
              alt={emote.name}
              size={20}
              fallbackEmoji={emote.fallbackEmoji}
            />
            <span className="quick-taunt-label">{emote.name}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`emote-menu-trigger-btn ${isCoolingDown ? "has-cooldown" : ""}`}
        onClick={onOpenPicker}
        title="Open All Animated Emotes"
      >
        <EmoteImage codepoint="1f60f" alt="Smirk" size={16} fallbackEmoji="😏" />
        <span className="taunts-btn-text">Taunts</span>
        {isCoolingDown && (
          <div
            className="emote-cooldown-bar"
            style={{ width: `${cooldownPct}%` }}
          />
        )}
      </button>

      {onToggleEmotes && (
        <button
          type="button"
          className="quick-taunt-toggle-btn"
          onClick={onToggleEmotes}
          title="Disable Battle Emotes"
          aria-label="Disable Battle Emotes"
        >
          <FontAwesomeIcon icon={faCommentDots} />
        </button>
      )}
    </div>
  );
}

// --- Speech Bubble over Player Avatar in Matchup Card ---
export function PlayerEmoteBubble({ activeEmote }) {
  if (!activeEmote) return null;

  return (
    <motion.div
      className={`emote-speech-bubble ${activeEmote.isOpponent ? "is-opponent" : ""}`}
      initial={{ opacity: 0, scale: 0.6, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: -10 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
    >
      <div className="emote-bubble-content">
        <EmoteImage
          codepoint={activeEmote.emoteCodepoint}
          alt={activeEmote.emoteLabel || "Emote"}
          size={38}
          priority={true}
        />
        <div className="emote-bubble-text-group">
          <span className="emote-bubble-sender">
            {activeEmote.senderUsername || "Opponent"}
          </span>
          <span className="emote-bubble-taunt">
            {activeEmote.teaseText || activeEmote.emoteLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// --- Screen-level Floating Banner for Taunt Notifications ---
export function ArenaTauntBroadcast({ broadcastEmote }) {
  if (!broadcastEmote) return null;

  const isOpponent = broadcastEmote.isOpponent;

  return (
    <AnimatePresence>
      <motion.div
        key={broadcastEmote.id || broadcastEmote.timestamp}
        className={`arena-taunt-broadcast ${isOpponent ? "opponent-taunt" : ""}`}
        initial={{ opacity: 0, y: -30, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.85 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <div className="arena-taunt-icon-wrap">
          <EmoteImage
            codepoint={broadcastEmote.emoteCodepoint}
            alt={broadcastEmote.emoteLabel || "Taunt"}
            size={44}
            priority={true}
          />
        </div>
        <div className="arena-taunt-details">
          <span className="arena-taunt-label">
            {isOpponent
              ? `${broadcastEmote.senderUsername || "Opponent"} taunted:`
              : "You taunted:"}
          </span>
          <span className="arena-taunt-message">
            {broadcastEmote.teaseText || broadcastEmote.emoteLabel}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
