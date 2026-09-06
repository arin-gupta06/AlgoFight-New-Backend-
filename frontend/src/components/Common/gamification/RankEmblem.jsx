import React from "react";
import "./RankEmblem.css";

/**
 * AlgoFight Authoritative Rank Tier Definitions
 */
export const RANK_TIERS = [
  {
    key: "ROOKIE",
    name: "Rookie",
    minRating: 0,
    maxRating: 399,
    color: "#94a3b8",
    gradient: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
    glowColor: "rgba(148, 163, 184, 0.4)",
    badgeBg: "rgba(148, 163, 184, 0.12)",
    badgeBorder: "rgba(148, 163, 184, 0.3)",
    description: "Initiate fighting in the algorithmic proving grounds.",
  },
  {
    key: "EXPERT",
    name: "Expert",
    minRating: 400,
    maxRating: 799,
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)",
    glowColor: "rgba(6, 182, 212, 0.4)",
    badgeBg: "rgba(6, 182, 212, 0.12)",
    badgeBorder: "rgba(6, 182, 212, 0.3)",
    description: "Proven competitor with sharp execution and solid algorithmic grasp.",
  },
  {
    key: "MASTER",
    name: "Master",
    minRating: 800,
    maxRating: 1199,
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #7e22ce 0%, #c084fc 100%)",
    glowColor: "rgba(168, 85, 247, 0.45)",
    badgeBg: "rgba(168, 85, 247, 0.12)",
    badgeBorder: "rgba(168, 85, 247, 0.3)",
    description: "Advanced tactician capable of resolving complex systems under pressure.",
  },
  {
    key: "GRANDMASTER",
    name: "Grandmaster",
    minRating: 1200,
    maxRating: 1599,
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #b91c1c 0%, #f87171 100%)",
    glowColor: "rgba(239, 68, 68, 0.45)",
    badgeBg: "rgba(239, 68, 68, 0.12)",
    badgeBorder: "rgba(239, 68, 68, 0.3)",
    description: "Elite problem solver dominating high-tier ranked lobbies.",
  },
  {
    key: "LEGEND",
    name: "Legend",
    minRating: 1600,
    maxRating: 1999,
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
    glowColor: "rgba(245, 158, 11, 0.5)",
    badgeBg: "rgba(245, 158, 11, 0.12)",
    badgeBorder: "rgba(245, 158, 11, 0.3)",
    description: "Champion of the arena whose mastery commands universal respect.",
  },
  {
    key: "SUPREME",
    name: "Supreme",
    minRating: 2000,
    maxRating: Infinity,
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #38bdf8 100%)",
    glowColor: "rgba(236, 72, 153, 0.6)",
    badgeBg: "rgba(236, 72, 153, 0.15)",
    badgeBorder: "rgba(236, 72, 153, 0.4)",
    description: "Peak competitive supremacy. The pinnacle of AlgoFight mastery.",
  },
];

export function getRankTier(ratingOrKey) {
  if (typeof ratingOrKey === "string") {
    const key = ratingOrKey.toUpperCase();
    const found = RANK_TIERS.find((t) => t.key === key || t.name.toUpperCase() === key);
    if (found) return found;
  }
  const rating = Math.max(0, Number(ratingOrKey) || 0);
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RANK_TIERS[i].minRating) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

/**
 * Rookie Emblem SVG: Titanium Cyber Aegis with Cyan Power Core
 */
const RookieSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rookie-steel-bevel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="30%" stopColor="#64748b" />
        <stop offset="70%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="rookie-cyan-core" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#00e5ff" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <filter id="rookie-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Outer Armor Mantle */}
    <path d="M50 4 L86 18 L82 56 L50 96 L18 56 L14 18 Z" fill="#0f172a" stroke="url(#rookie-steel-bevel)" strokeWidth="3" />
    {/* Upper Shoulder Chamfers */}
    <path d="M14 18 L34 26 L50 16 L66 26 L86 18" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    {/* Recessed Plate */}
    <path d="M50 14 L76 25 L72 52 L50 84 L28 52 L24 25 Z" fill="url(#rookie-steel-bevel)" />
    <path d="M50 20 L70 30 L66 50 L50 76 L34 50 L30 30 Z" fill="#0b0f19" stroke="#475569" strokeWidth="1.5" />
    {/* Cyan Power Channels */}
    <path d="M50 24 L50 40" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    <path d="M38 36 L46 44" stroke="#00e5ff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    <path d="M62 36 L54 44" stroke="#00e5ff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    {/* Central Power Core Crystal */}
    <polygon points="50,38 65,52 50,68 35,52" fill="url(#rookie-cyan-core)" filter="url(#rookie-glow)" />
    <polygon points="50,44 58,52 50,60 42,52" fill="#ffffff" opacity="0.9" />
    {/* Bottom Vented Spine */}
    <line x1="50" y1="72" x2="50" y2="82" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    {/* Armor Rivets */}
    <circle cx="26" cy="28" r="2" fill="#cbd5e1" />
    <circle cx="74" cy="28" r="2" fill="#cbd5e1" />
    <circle cx="50" cy="90" r="2" fill="#00e5ff" />
  </svg>
);

/**
 * Expert Emblem SVG: Cyan Cyber Hex-Valkyrie Blade
 */
const ExpertSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="expert-neon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="45%" stopColor="#00e5ff" />
        <stop offset="80%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="expert-blade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <filter id="expert-glow-fx" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="3.2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Outer Swept Hex-Wing Frame */}
    <path d="M50 4 L88 20 L94 48 L76 74 L50 96 L24 74 L6 48 L12 20 Z" fill="#041226" stroke="url(#expert-neon)" strokeWidth="3" filter="url(#expert-glow-fx)" />
    {/* Recessed Carbon Plate */}
    <path d="M50 14 L78 28 L82 48 L68 68 L50 84 L32 68 L18 48 L22 28 Z" fill="#08233d" stroke="#0284c7" strokeWidth="1.5" />
    {/* Lateral Aerodynamic Fins */}
    <polygon points="12,24 24,34 16,46" fill="url(#expert-neon)" opacity="0.8" />
    <polygon points="88,24 76,34 84,46" fill="url(#expert-neon)" opacity="0.8" />
    {/* Dual Velocity Energy Chevrons */}
    <path d="M34 38 L50 24 L66 38" stroke="url(#expert-blade)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M34 52 L50 38 L66 52" stroke="url(#expert-neon)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Center Plasma Prism */}
    <polygon points="50,50 62,64 50,78 38,64" fill="url(#expert-neon)" />
    <polygon points="50,56 56,64 50,72 44,64" fill="#ffffff" />
    {/* Top and Bottom Power Nodes */}
    <circle cx="50" cy="10" r="3" fill="#ffffff" />
    <circle cx="50" cy="88" r="2.5" fill="#00e5ff" />
    <circle cx="28" cy="70" r="2" fill="#38bdf8" />
    <circle cx="72" cy="70" r="2" fill="#38bdf8" />
  </svg>
);

/**
 * Master Emblem SVG: Radiant Amethyst Diamond Sigil
 */
const MasterSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="master-regal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f3e8ff" />
        <stop offset="25%" stopColor="#c084fc" />
        <stop offset="65%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#6b21a8" />
      </linearGradient>
      <linearGradient id="master-core-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#d8b4fe" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
      <filter id="master-glow-fx" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="3.6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Floating Crystal Mantle Spikes */}
    <polygon points="4,48 20,24 24,56" fill="url(#master-regal)" opacity="0.85" />
    <polygon points="96,48 80,24 76,56" fill="url(#master-regal)" opacity="0.85" />
    {/* Outer Imperial Diamond */}
    <polygon points="50,2 92,48 50,96 8,48" fill="#1e0a38" stroke="url(#master-regal)" strokeWidth="3.5" filter="url(#master-glow-fx)" />
    {/* Recessed Amethyst Plate */}
    <polygon points="50,14 80,48 50,82 20,48" fill="#2e1065" stroke="#c084fc" strokeWidth="1.8" />
    {/* Faceted Crystal Angles */}
    <polygon points="50,14 50,48 20,48" fill="#3b0764" opacity="0.6" />
    <polygon points="50,14 80,48 50,48" fill="#581c87" opacity="0.6" />
    <polygon points="50,82 50,48 20,48" fill="#581c87" opacity="0.6" />
    <polygon points="50,82 80,48 50,48" fill="#3b0764" opacity="0.6" />
    {/* Brilliant Faceted Jewel Heart */}
    <polygon points="50,26 68,48 50,70 32,48" fill="url(#master-core-grad)" stroke="#f3e8ff" strokeWidth="1.2" />
    {/* Arcane 8-Point Starlight Center */}
    <polygon points="50,34 53,44 64,48 53,52 50,62 47,52 36,48 47,44" fill="#ffffff" />
    {/* Cardinal Orbit Spheres */}
    <circle cx="50" cy="12" r="3" fill="#ffffff" />
    <circle cx="82" cy="48" r="3" fill="#ffffff" />
    <circle cx="50" cy="84" r="3" fill="#ffffff" />
    <circle cx="18" cy="48" r="3" fill="#ffffff" />
  </svg>
);

/**
 * Grandmaster Emblem SVG: Crimson Solar Star Crest
 */
const GrandmasterSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gm-crimson" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fca5a5" />
        <stop offset="30%" stopColor="#ef4444" />
        <stop offset="70%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </linearGradient>
      <linearGradient id="gm-gold-trim" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <filter id="gm-glow-fx" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur stdDeviation="4.2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Razor-Edged Battle Star Points */}
    <path d="M50 2 L62 22 L88 10 L78 36 L98 50 L74 64 L82 92 L50 76 L18 92 L26 64 L2 50 L22 36 L12 10 L38 22 Z" fill="#2a0505" stroke="url(#gm-crimson)" strokeWidth="3" filter="url(#gm-glow-fx)" />
    {/* Gold Edge Highlights on Star */}
    <path d="M50 4 L62 22 M88 12 L78 36 M98 50 L74 64 M50 4 L38 22 M12 12 L22 36 M2 50 L26 64" stroke="url(#gm-gold-trim)" strokeWidth="1.5" strokeLinecap="round" />
    {/* Inner Armored Fortress Shield */}
    <polygon points="50,18 74,32 72,66 50,82 28,66 26,32" fill="#450a0a" stroke="#f87171" strokeWidth="2" />
    {/* Faceted Ruby Mantle */}
    <polygon points="50,28 66,44 66,58 50,72 34,58 34,44" fill="url(#gm-crimson)" stroke="#fecaca" strokeWidth="1" />
    {/* Molten Solar Heart */}
    <polygon points="50,36 58,48 50,60 42,48" fill="#ffffff" />
    <circle cx="50" cy="48" r="4.5" fill="#fef08a" />
    <circle cx="50" cy="48" r="2.5" fill="#ffffff" />
    {/* Cardinal Star Beams */}
    <line x1="50" y1="6" x2="50" y2="14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    <line x1="50" y1="84" x2="50" y2="90" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Legend Emblem SVG: Golden Winged Apex Solar Crest
 */
const LegendSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="legend-24k-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="25%" stopColor="#fde047" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="85%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="legend-shine" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#b45309" />
        <stop offset="50%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#ffffff" />
      </linearGradient>
      <filter id="legend-glow-fx" x="-28%" y="-28%" width="156%" height="156%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Sweeping Tiered Phoenix Wings */}
    <path d="M10 30 C24 16 38 28 50 12 C62 28 76 16 90 30 C78 52 74 72 50 96 C26 72 22 52 10 30 Z" fill="#2d1502" stroke="url(#legend-24k-gold)" strokeWidth="3.5" filter="url(#legend-glow-fx)" />
    {/* Secondary Wing Feather Layer */}
    <path d="M18 36 C30 26 40 34 50 20 C60 34 70 26 82 36 C72 54 68 70 50 86 C32 70 28 54 18 36 Z" fill="#451a03" stroke="url(#legend-shine)" strokeWidth="2" />
    {/* Imperial Crown Apex */}
    <polygon points="50,4 56,16 50,14 44,16" fill="url(#legend-shine)" />
    <polygon points="34,14 42,22 36,22" fill="url(#legend-24k-gold)" />
    <polygon points="66,14 58,22 64,22" fill="url(#legend-24k-gold)" />
    {/* Royal Gold Chest Shield */}
    <polygon points="50,28 72,44 64,72 50,82 36,72 28,44" fill="#1c1917" stroke="url(#legend-24k-gold)" strokeWidth="2" />
    {/* Brilliant Sunburst Diamond */}
    <polygon points="50,34 65,50 50,66 35,50" fill="url(#legend-24k-gold)" stroke="#ffffff" strokeWidth="1" />
    <polygon points="50,40 58,50 50,60 42,50" fill="#ffffff" />
    {/* Radiating Sun Beams */}
    <line x1="50" y1="2" x2="50" y2="10" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="26" y1="12" x2="32" y2="18" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
    <line x1="74" y1="12" x2="68" y2="18" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
    {/* Sparkle Spheres */}
    <circle cx="50" cy="50" r="3.5" fill="#ffffff" />
    <circle cx="28" cy="46" r="2" fill="#fef08a" />
    <circle cx="72" cy="46" r="2" fill="#fef08a" />
  </svg>
);

/**
 * Supreme Emblem SVG: Peak Iridescent Chromatic Celestial Crown
 */
const SupremeSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="supreme-hologram" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f43f5e" />
        <stop offset="25%" stopColor="#ec4899" />
        <stop offset="50%" stopColor="#a855f7" />
        <stop offset="75%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#00e5ff" />
      </linearGradient>
      <linearGradient id="supreme-stellar-core" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="40%" stopColor="#ec4899" />
        <stop offset="80%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#ffffff" />
      </linearGradient>
      <filter id="supreme-supernova-glow" x="-32%" y="-32%" width="164%" height="164%">
        <feGaussianBlur stdDeviation="5.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Celestial Orbit Rings */}
    <ellipse cx="50" cy="50" rx="46" ry="18" stroke="url(#supreme-hologram)" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.75" transform="rotate(-20 50 50)" />
    <ellipse cx="50" cy="50" rx="46" ry="18" stroke="url(#supreme-hologram)" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.75" transform="rotate(20 50 50)" />
    {/* Outer Crown of the Cosmos */}
    <path d="M50 2 L64 18 L88 10 L80 34 L98 52 L76 68 L84 94 L50 82 L16 94 L24 68 L2 52 L20 34 L12 10 L36 18 Z" fill="#120324" stroke="url(#supreme-hologram)" strokeWidth="3.5" filter="url(#supreme-supernova-glow)" />
    {/* Inner Astral Plate */}
    <polygon points="50,16 76,32 76,66 50,82 24,66 24,32" fill="#1f0a38" stroke="url(#supreme-stellar-core)" strokeWidth="2" />
    {/* Multidimensional Hypercube Prism */}
    <polygon points="50,26 70,42 70,64 50,78 30,64 30,42" fill="url(#supreme-hologram)" opacity="0.9" />
    {/* Center Supernova Core */}
    <polygon points="50,34 54,45 66,50 54,55 50,66 46,55 34,50 46,45" fill="#ffffff" />
    <circle cx="50" cy="50" r="5" fill="#fef08a" />
    <circle cx="50" cy="50" r="2.5" fill="#ffffff" />
    {/* Floating Satellite Crystals */}
    <circle cx="50" cy="8" r="3.5" fill="#ffffff" filter="url(#supreme-supernova-glow)" />
    <circle cx="16" cy="24" r="2.5" fill="#38bdf8" />
    <circle cx="84" cy="24" r="2.5" fill="#f43f5e" />
    <circle cx="50" cy="90" r="3" fill="#a855f7" />
  </svg>
);

export default function RankEmblem({
  rank,
  rating,
  size = 40,
  showBadge = false,
  showLabel = false,
  className = "",
  glow = true,
}) {
  const tier = getRankTier(rank || rating || 0);

  const renderIcon = () => {
    switch (tier.key) {
      case "EXPERT":
        return <ExpertSvg size={size} />;
      case "MASTER":
        return <MasterSvg size={size} />;
      case "GRANDMASTER":
        return <GrandmasterSvg size={size} />;
      case "LEGEND":
        return <LegendSvg size={size} />;
      case "SUPREME":
        return <SupremeSvg size={size} />;
      case "ROOKIE":
      default:
        return <RookieSvg size={size} />;
    }
  };

  return (
    <div
      className={`rank-emblem-wrapper rank-emblem-${tier.key.toLowerCase()} ${className} ${glow ? "has-glow" : ""}`}
      style={{
        "--tier-color": tier.color,
        "--tier-glow": tier.glowColor,
        "--tier-badge-bg": tier.badgeBg,
        "--tier-badge-border": tier.badgeBorder,
      }}
      title={`${tier.name} Rank (${tier.minRating} - ${tier.maxRating === Infinity ? "2000+" : tier.maxRating} Rating)`}
    >
      <div className="rank-emblem-svg-container" style={{ width: size, height: size }}>
        {renderIcon()}
      </div>

      {showLabel && (
        <span className="rank-emblem-label" style={{ color: tier.color }}>
          {tier.name}
        </span>
      )}

      {showBadge && (
        <div className="rank-emblem-badge" style={{ borderColor: tier.badgeBorder, background: tier.badgeBg }}>
          <span className="rank-badge-dot" style={{ backgroundColor: tier.color }}></span>
          <span className="rank-badge-text" style={{ color: tier.color }}>
            {tier.name.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
