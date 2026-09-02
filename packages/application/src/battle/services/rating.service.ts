import { UserRepository, UserEntity } from "@algofight/database";
import {
    RankTierDefinition,
    RankTierKey,
    getRankTierFromRating,
    getRankKeyFromRating,
} from "@algofight/types";

export interface EloResult {
    winnerNewRating: number;
    loserNewRating: number;
    ratingDelta: number;
    // Extended fields for rich client consumption
    oldRating?: number;
    newRating?: number;
    rank?: RankTierKey;
    rankTier?: RankTierDefinition;
    performanceScore?: number;
    ewmaBefore?: number;
    ewmaAfter?: number;
}

export interface BattleParticipantInput {
    userId: string;
    rank: number; // 1-indexed finishing place (1 = 1st, 2 = 2nd, ...)
    score?: number;
    solvedCount?: number;
    totalProblems?: number;
    timeTakenSeconds?: number;
    totalTimeSeconds?: number;
}

export interface PlayerRatingResolution {
    userId: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingDelta: number;
    eloDelta: number;
    performanceScore: number;
    ewmaBefore: number;
    ewmaAfter: number;
    rankKey: RankTierKey;
    rankTier: RankTierDefinition;
    isWin: boolean;
}

export class RatingService {
    public static readonly K_FACTOR = 32;
    public static readonly EWMA_ALPHA = 0.20; // 3-5 match half-life smoothing
    public static readonly EWMA_BASE = 0.50; // Neutral baseline form
    public static readonly FORM_DAMPING = 0.50; // Sensitivity of form modulation factor
    public static readonly MIN_MODULATION = 0.75;
    public static readonly MAX_MODULATION = 1.25;

    constructor(private readonly userRepository: UserRepository) {}

    /**
     * Pipeline 1: Pure Opponent-Aware ELO Calculation (Completely independent of EWMA)
     * For N participants, normalizes field expectation across (N - 1) opponents.
     */
    public calculatePureEloDelta(
        playerRating: number,
        opponentRatings: number[],
        playerPlacement: number, // 1-indexed finishing rank
        totalParticipants: number
    ): number {
        if (totalParticipants < 2 || opponentRatings.length === 0) {
            return 0;
        }

        const safePlayerRating = Math.max(0, playerRating);

        // 1. Normalized Field Expected Outcome: E_i = (1 / (N - 1)) * Σ (1 / (1 + 10^((R_j - R_i) / 400)))
        let expectedSum = 0;
        for (const oppRating of opponentRatings) {
            const safeOppRating = Math.max(0, oppRating);
            const expectedVsOpp = 1 / (1 + Math.pow(10, (safeOppRating - safePlayerRating) / 400));
            expectedSum += expectedVsOpp;
        }
        const expectedScore = expectedSum / (totalParticipants - 1);

        // 2. Normalized Actual Score: S_i = (N - rank_i) / (N - 1)
        const actualScore = Math.max(0, Math.min(1, (totalParticipants - playerPlacement) / (totalParticipants - 1)));

        // 3. Raw ELO Delta: K * (S_i - E_i)
        return RatingService.K_FACTOR * (actualScore - expectedScore);
    }

    /**
     * Pipeline 2: Pure Battle Performance Score X_t ∈ [0, 1] (Completely independent of ELO delta)
     */
    public calculatePerformanceScore(
        playerPlacement: number,
        totalParticipants: number,
        solvedCount = 0,
        totalProblems = 1,
        timeTakenSeconds = 0,
        totalTimeSeconds = 900
    ): number {
        const N = Math.max(2, totalParticipants);

        // Component 1: Placement Score (weight = 0.50)
        const placementScore = Math.max(0, Math.min(1, (N - playerPlacement) / (N - 1)));

        // Component 2: Problem Completion Score (weight = 0.30)
        const safeTotalProblems = Math.max(1, totalProblems);
        const solveScore = Math.max(0, Math.min(1, solvedCount / safeTotalProblems));

        // Component 3: Time Efficiency Score (weight = 0.20)
        let timeScore = 0.5;
        if (solvedCount > 0 && totalTimeSeconds > 0) {
            const timeRatio = Math.max(0, Math.min(1, timeTakenSeconds / totalTimeSeconds));
            timeScore = 1.0 - (0.5 * timeRatio); // Faster solve = closer to 1.0
        } else if (solvedCount === 0) {
            timeScore = 0.1;
        }

        const performanceScore = (0.50 * placementScore) + (0.30 * solveScore) + (0.20 * timeScore);
        return Math.max(0, Math.min(1, Math.round(performanceScore * 1000) / 1000));
    }

    /**
     * Pipeline 2 (continued): Pure EWMA update from performance score
     */
    public calculateNextEwma(currentEwma: number | undefined | null, performanceScore: number): number {
        const prevEwma = typeof currentEwma === "number" && !isNaN(currentEwma)
            ? Math.max(0, Math.min(1, currentEwma))
            : RatingService.EWMA_BASE;

        const safeX = Math.max(0, Math.min(1, performanceScore));
        const alpha = RatingService.EWMA_ALPHA;
        const nextEwma = (alpha * safeX) + ((1 - alpha) * prevEwma);

        return Math.max(0, Math.min(1, Math.round(nextEwma * 10000) / 10000));
    }

    /**
     * Synthesis Engine: Couples pure ELO delta with pure EWMA form
     * ΔR = round(ΔR_ELO * M(EWMA_t))
     * R_new = max(0, R_old + ΔR)
     */
    public synthesizeRating(
        oldRating: number,
        pureEloDelta: number,
        ewma: number
    ): { ratingDelta: number; newRating: number; modulation: number } {
        const safeOldRating = Math.max(0, oldRating);
        const safeEwma = Math.max(0, Math.min(1, ewma));
        const centeredZ = safeEwma - RatingService.EWMA_BASE; // in [-0.5, +0.5]

        let modulation = 1.0;
        if (pureEloDelta >= 0) {
            // Winning / Gaining: High form accelerates gain; Low form dampens gain
            modulation = 1.0 + (RatingService.FORM_DAMPING * centeredZ);
        } else {
            // Losing / Dropping: High form cushions drop; Low form confirms drop
            modulation = 1.0 - (RatingService.FORM_DAMPING * centeredZ);
        }

        modulation = Math.max(
            RatingService.MIN_MODULATION,
            Math.min(RatingService.MAX_MODULATION, modulation)
        );

        const ratingDelta = Math.round(pureEloDelta * modulation);
        const newRating = Math.max(0, safeOldRating + ratingDelta);

        return {
            ratingDelta,
            newRating,
            modulation,
        };
    }

    /**
     * Classic 1v1 calculation helper (Pure + Synthesis)
     */
    public calculateElo(winnerRating: number, loserRating: number): EloResult {
        const safeWinnerRating = Math.max(0, winnerRating);
        const safeLoserRating = Math.max(0, loserRating);

        const expectedWinner = 1 / (1 + Math.pow(10, (safeLoserRating - safeWinnerRating) / 400));
        const baseDelta = RatingService.K_FACTOR * (1 - expectedWinner);
        const delta = Math.round(baseDelta);

        const winnerNew = safeWinnerRating + delta;
        const loserNew = Math.max(0, safeLoserRating - delta);

        return {
            winnerNewRating: winnerNew,
            loserNewRating: loserNew,
            ratingDelta: delta,
            oldRating: safeWinnerRating,
            newRating: winnerNew,
            rank: getRankKeyFromRating(winnerNew),
            rankTier: getRankTierFromRating(winnerNew),
        };
    }

    /**
     * Resolves a battle (1v1 or multiplayer) and updates all user ratings atomically in DB
     */
    public async applyBattleResolution(
        roomId: string | undefined,
        participants: BattleParticipantInput[]
    ): Promise<Record<string, EloResult>> {
        const validParticipants = participants.filter((p) => p.userId);
        if (validParticipants.length < 2) {
            return {};
        }

        const users = await Promise.all(
            validParticipants.map(async (p) => {
                if (p.userId === "bot") {
                    return {
                        id: "bot",
                        username: "AlgoBot",
                        rating: 200,
                        ewma: 0.50,
                        highestRating: 200,
                        highestRank: "ROOKIE",
                        wins: 0,
                        losses: 0,
                    } as UserEntity;
                }
                return this.userRepository.getUserById(p.userId);
            })
        );

        const userMap = new Map<string, UserEntity>();
        for (const u of users) {
            if (u) userMap.set(u.id, u);
        }

        const activeParticipants = validParticipants.filter((p) => userMap.has(p.userId));
        const totalN = activeParticipants.length;
        if (totalN < 2) {
            return {};
        }

        const results: Record<string, EloResult> = {};
        const midPoint = totalN / 2;

        for (const p of activeParticipants) {
            const user = userMap.get(p.userId)!;
            const userRating = user.rating ?? 0;
            const currentEwma = user.ewma ?? RatingService.EWMA_BASE;

            // Opponents
            const opponentRatings = activeParticipants
                .filter((other) => other.userId !== p.userId)
                .map((other) => userMap.get(other.userId)!.rating ?? 0);

            // 1. Pure ELO Delta
            const pureEloDelta = this.calculatePureEloDelta(
                userRating,
                opponentRatings,
                p.rank,
                totalN
            );

            // 2. Pure Performance Score & EWMA
            const performanceScore = this.calculatePerformanceScore(
                p.rank,
                totalN,
                p.solvedCount,
                p.totalProblems,
                p.timeTakenSeconds,
                p.totalTimeSeconds
            );
            const nextEwma = this.calculateNextEwma(currentEwma, performanceScore);

            // 3. Synthesized Rating
            const { ratingDelta, newRating } = this.synthesizeRating(
                userRating,
                pureEloDelta,
                nextEwma
            );

            const isWin = p.rank <= midPoint;
            const newRankTier = getRankTierFromRating(newRating);

            // 4. Atomic Update with Audit (only for non-bot users)
            if (user.id !== "bot") {
                await this.userRepository.updateRatingWithAudit({
                    userId: user.id,
                    battleRoomId: roomId,
                    ratingBefore: userRating,
                    ratingAfter: newRating,
                    ratingDelta,
                    performanceScore,
                    ewmaBefore: currentEwma,
                    ewmaAfter: nextEwma,
                    isWin,
                    highestRank: newRankTier.key,
                    metadata: {
                        roomId,
                        placement: p.rank,
                        totalParticipants: totalN,
                        score: p.score ?? 0,
                        solvedCount: p.solvedCount ?? 0,
                        pureEloDelta: Math.round(pureEloDelta * 100) / 100,
                    },
                });
            }

            results[user.id] = {
                winnerNewRating: newRating,
                loserNewRating: newRating,
                ratingDelta,
                oldRating: userRating,
                newRating,
                rank: newRankTier.key,
                rankTier: newRankTier,
                performanceScore,
                ewmaBefore: currentEwma,
                ewmaAfter: nextEwma,
            };
        }

        return results;
    }

    /**
     * Backwards-compatible 1v1 battle result applicator
     */
    public async applyBattleResult(winnerId: string, loserId: string, roomId?: string): Promise<EloResult> {
        const results = await this.applyBattleResolution(roomId, [
            { userId: winnerId, rank: 1, solvedCount: 1, totalProblems: 1 },
            { userId: loserId, rank: 2, solvedCount: 0, totalProblems: 1 },
        ]);

        return results[winnerId] || this.calculateElo(0, 0);
    }

    /**
     * Backwards-compatible multiplayer battle result applicator
     */
    public async applyMultiplayerBattleResult(
        rankedUserIds: string[],
        roomId?: string
    ): Promise<Record<string, EloResult>> {
        const participants: BattleParticipantInput[] = rankedUserIds.map((userId, index) => ({
            userId,
            rank: index + 1,
            solvedCount: index === 0 ? 1 : 0,
            totalProblems: 1,
        }));

        return this.applyBattleResolution(roomId, participants);
    }
}