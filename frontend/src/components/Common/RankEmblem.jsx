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
 * Rookie Emblem SVG: Iron Cyber Shield
 */
const RookieSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rookie-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <linearGradient id="rookie-rim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
    </defs>
    {/* Outer Shield */}
    <path d="M50 8 L84 24 L80 62 L50 92 L20 62 L16 24 Z" fill="url(#rookie-base)" stroke="url(#rookie-rim)" strokeWidth="3" />
    {/* Inner Plate */}
    <path d="M50 18 L74 30 L70 58 L50 80 L30 58 L26 30 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
    {/* Cyber Iron Core */}
    <polygon points="50,30 65,50 50,70 35,50" fill="url(#rookie-rim)" opacity="0.9" />
    <circle cx="50" cy="50" r="5" fill="#38bdf8" />
  </svg>
);

/**
 * Expert Emblem SVG: Cyan Cyber Hexagon with Energy Chevrons
 */
const ExpertSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="expert-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0891b2" />
        <stop offset="50%" stopColor="#06b6d4" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
      <filter id="expert-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Hexagon Outer Frame */}
    <polygon points="50,6 88,27 88,73 50,94 12,73 12,27" fill="#0f172a" stroke="url(#expert-grad)" strokeWidth="3.5" filter="url(#expert-glow)" />
    {/* Circuit Lines */}
    <path d="M50 15 L78 31 L78 69 L50 85 L22 69 L22 31 Z" fill="#082f49" stroke="#38bdf8" strokeWidth="1.5" opacity="0.8" />
    {/* Dual Chevrons */}
    <path d="M35 44 L50 32 L65 44" stroke="url(#expert-grad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M35 58 L50 46 L65 58" stroke="url(#expert-grad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <polygon points="50,62 58,72 42,72" fill="#22d3ee" />
  </svg>
);

/**
 * Master Emblem SVG: Radiant Amethyst Diamond Sigil
 */
const MasterSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="master-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7e22ce" />
        <stop offset="50%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
      <filter id="master-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Outer Diamond Crest */}
    <polygon points="50,4 92,50 50,96 8,50" fill="#2e1065" stroke="url(#master-grad)" strokeWidth="3.5" filter="url(#master-glow)" />
    {/* Inner Angular Plate */}
    <polygon points="50,16 80,50 50,84 20,50" fill="#1e1b4b" stroke="#c084fc" strokeWidth="2" />
    {/* Crystal Centerpiece */}
    <polygon points="50,28 68,50 50,72 32,50" fill="url(#master-grad)" opacity="0.9" />
    <polygon points="50,38 60,50 50,62 40,50" fill="#f3e8ff" />
    {/* Side Accents */}
    <circle cx="50" cy="16" r="3" fill="#e9d5ff" />
    <circle cx="80" cy="50" r="3" fill="#e9d5ff" />
    <circle cx="50" cy="84" r="3" fill="#e9d5ff" />
    <circle cx="20" cy="50" r="3" fill="#e9d5ff" />
  </svg>
);

/**
 * Grandmaster Emblem SVG: Crimson Solar Star Crest
 */
const GrandmasterSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#991b1b" />
        <stop offset="50%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#fca5a5" />
      </linearGradient>
      <filter id="gm-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Star Points Outer */}
    <path d="M50 4 L61 32 L91 35 L68 54 L75 84 L50 68 L25 84 L32 54 L9 35 L39 32 Z" fill="#450a0a" stroke="url(#gm-grad)" strokeWidth="3" filter="url(#gm-glow)" />
    {/* Inner Octagonal Shield */}
    <polygon points="50,18 72,28 82,50 72,72 50,82 28,72 18,50 28,28" fill="#18181b" stroke="#f87171" strokeWidth="2" />
    {/* Blazing Center Ruby */}
    <polygon points="50,28 65,42 65,58 50,72 35,58 35,42" fill="url(#gm-grad)" />
    <polygon points="50,38 58,50 50,62 42,50" fill="#fee2e2" />
    <circle cx="50" cy="50" r="4" fill="#ffffff" />
  </svg>
);

/**
 * Legend Emblem SVG: Golden Winged Apex Solar Crest
 */
const LegendSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="legend-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#b45309" />
        <stop offset="35%" stopColor="#f59e0b" />
        <stop offset="70%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#fffbeb" />
      </linearGradient>
      <filter id="legend-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Soaring Wing Flairs */}
    <path d="M10 32 C26 22 40 32 50 14 C60 32 74 22 90 32 C78 52 74 72 50 94 C26 72 22 52 10 32 Z" fill="#451a03" stroke="url(#legend-gold)" strokeWidth="3.5" filter="url(#legend-glow)" />
    {/* Inner Crowned Core */}
    <path d="M24 38 C34 30 42 36 50 24 C58 36 66 30 76 38 C68 54 64 68 50 82 C36 68 32 54 24 38 Z" fill="#1c1917" stroke="#fbbf24" strokeWidth="2" />
    {/* Apex Solar Diamond */}
    <polygon points="50,32 64,50 50,68 36,50" fill="url(#legend-gold)" />
    <polygon points="50,40 57,50 50,60 43,50" fill="#ffffff" />
    {/* Sunburst Rays */}
    <line x1="50" y1="8" x2="50" y2="18" stroke="#fde047" strokeWidth="3" strokeLinecap="round" />
    <line x1="28" y1="18" x2="35" y2="25" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="72" y1="18" x2="65" y2="25" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/**
 * Supreme Emblem SVG: Peak Iridescent Chromatic Celestial Crown
 */
const SupremeSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="supreme-chroma" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ec4899" />
        <stop offset="33%" stopColor="#a855f7" />
        <stop offset="66%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
      <linearGradient id="supreme-halo" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#67e8f9" />
      </linearGradient>
      <filter id="supreme-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Pulsing Outer Aura Halo */}
    <circle cx="50" cy="50" r="44" stroke="url(#supreme-chroma)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
    {/* Supreme Crowned Apex Mantle */}
    <path d="M50 4 L64 22 L86 16 L78 44 L94 62 L68 76 L50 96 L32 76 L6 62 L22 44 L14 16 L36 22 Z" fill="#18042b" stroke="url(#supreme-chroma)" strokeWidth="3.5" filter="url(#supreme-glow)" />
    {/* Prismatic Inner Seal */}
    <polygon points="50,20 74,38 74,68 50,84 26,68 26,38" fill="#090117" stroke="url(#supreme-halo)" strokeWidth="2" />
    {/* Multi-Faceted Cosmic Core */}
    <polygon points="50,30 65,45 65,65 50,76 35,65 35,45" fill="url(#supreme-chroma)" />
    <polygon points="50,38 60,50 50,64 40,50" fill="#ffffff" opacity="0.95" />
    {/* Floating Celestial Stars */}
    <circle cx="50" cy="10" r="3.5" fill="#ffffff" filter="url(#supreme-glow)" />
    <circle cx="18" cy="22" r="2.5" fill="#67e8f9" />
    <circle cx="82" cy="22" r="2.5" fill="#f472b6" />
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
