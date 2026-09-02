import { RANK_TIERS as OFFICIAL_RANK_TIERS, getRankTier } from "../components/Common/RankEmblem";

export const RANK_TIERS = OFFICIAL_RANK_TIERS.map((t) => ({
  label: t.name,
  key: t.key,
  minRating: t.minRating,
  maxRating: t.maxRating,
  color: t.color,
  gradient: t.gradient,
  glowColor: t.glowColor,
  description: t.description,
}));

export function deriveRank(rating) {
  const tier = getRankTier(rating);
  return tier.name;
}

export function normalizeUserStats(profile = {}) {
  const rating = Math.max(0, Number(profile?.rating ?? 0));
  const matchesPlayed = Number(profile?.matchesPlayed ?? 0);
  const matchesWon = Number(profile?.matchesWon ?? (profile?.wins ?? 0));

  const solvedFromIds = Array.isArray(profile?.practiceSolvedProblemIds)
    ? profile.practiceSolvedProblemIds.length
    : 0;

  const practiceSolved = Number(profile?.practiceSolvedCount ?? solvedFromIds);
  const practiceSubmissions = Number(profile?.practiceSubmissionCount ?? 0);

  const lossCount = Math.max(0, matchesPlayed - matchesWon);
  const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
  const practiceAccuracy =
    practiceSubmissions > 0 ? Math.round((practiceSolved / practiceSubmissions) * 100) : 0;

  const tier = getRankTier(rating);

  return {
    rating,
    matchesPlayed,
    matchesWon,
    lossCount,
    practiceSolved,
    practiceSubmissions,
    winRate,
    practiceAccuracy,
    rank: tier.name,
    rankKey: tier.key,
    rankTier: tier,
    highestRating: Math.max(rating, Number(profile?.highestRating ?? rating)),
    highestRank: profile?.highestRank || tier.key,
    ewma: Number(profile?.ewma ?? 0.5),
  };
}

export const UNIVERSAL_EFFICIENCY_RULES = [
  {
    title: "⚡ Rapid Solver Multiplier (< 50% Allotted Time)",
    description: "Finishing a battle or challenge in less than half the time limit awards a +35% to +50% point surge.",
    multiplier: "Up to +50 Pts / Match",
    type: "Speed"
  },
  {
    title: "🧠 Optimal Complexity & Memory Efficiency",
    description: "Submissions that achieve sub-100ms sandboxed execution or top-tier memory percentiles receive an algorithmic efficiency bonus.",
    multiplier: "+30 Pts Bonus",
    type: "Efficiency"
  },
  {
    title: "🎯 Flawless First-Attempt Pass",
    description: "Passing 100% of test suites on the very first submission with zero runtime errors unlocks a perfection bonus.",
    multiplier: "+25 Pts Bonus",
    type: "Accuracy"
  }
];

export function calculateArenaPointBreakdown(stats) {
  const safeStats = normalizeUserStats(stats);

  const ratingPoints = safeStats.rating;
  const battleWinPoints = safeStats.matchesWon * 120;
  const speedEfficiencyPoints = Math.round(safeStats.matchesWon * 35 + safeStats.practiceSolved * 15);
  const practiceSolvedPoints = safeStats.practiceSolved * 50;
  const participationPoints = safeStats.lossCount * 20;

  const total = ratingPoints + battleWinPoints + speedEfficiencyPoints + practiceSolvedPoints + participationPoints;

  return {
    total,
    ratingPoints,
    battleWinPoints,
    speedEfficiencyPoints,
    practiceSolvedPoints,
    participationPoints,
  };
}

export function getRankProgressByRating(rating) {
  const score = Math.max(0, Number(rating) || 0);
  const currentTierIndex = RANK_TIERS.reduce((bestIndex, tier, index) => {
    if (score >= tier.minRating) return index;
    return bestIndex;
  }, 0);

  const currentTier = RANK_TIERS[currentTierIndex];
  const nextTier = RANK_TIERS[currentTierIndex + 1] || currentTier;

  const isMaxTier = currentTierIndex === RANK_TIERS.length - 1;

  const progressWithinTier = isMaxTier
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          ((score - currentTier.minRating) / (nextTier.minRating - currentTier.minRating)) * 100
        )
      );

  const progressToNext = isMaxTier
    ? 100
    : Math.min(100, Math.max(0, (score / nextTier.minRating) * 100));

  const ratingToNextTier = isMaxTier ? 0 : Math.max(0, nextTier.minRating - score);

  return {
    currentTier,
    nextTier,
    currentTierIndex,
    progressToNext,
    progressWithinTier,
    ratingToNextTier,
    isMaxTier,
  };
}
