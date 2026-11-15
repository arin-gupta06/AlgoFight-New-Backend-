import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.plugin";
import { prisma } from "@algofight/database";
import { isAdminEmail } from "../constants/admins";
import {
    PointLedgerService,
    ConsistencyRewardService,
    AchievementRewardService
} from "@algofight/application";

const ledger = new PointLedgerService();
const consistency = new ConsistencyRewardService(ledger);
const achievements = new AchievementRewardService(ledger);

export async function rewardRoutes(app: FastifyInstance) {
    // 1. Get weekly consistency status and milestones
    app.get("/rewards/weekly-status", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        return consistency.getWeeklyStatus(userId);
    });

    // 2. Claim weekly consistency milestone reward (Server-authoritative)
    app.post("/rewards/claim-weekly", { preHandler: [requireAuth] }, async (req, reply) => {
        const userId = req.user!.id;
        const body = (req.body as any) || {};
        const daysRequired = Number(body.daysRequired);

        if (!daysRequired || isNaN(daysRequired)) {
            return reply.status(400).send({ error: "BAD_REQUEST", message: "daysRequired is required." });
        }

        const result = await consistency.claimWeeklyReward(userId, daysRequired);
        if (!result.success) {
            return reply.status(400).send({ error: "CLAIM_FAILED", message: result.error });
        }

        return result;
    });

    // 3. Get user point transaction history
    app.get("/rewards/history", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        const query = (req.query as any) || {};
        const limit = Number(query.limit) || 20;
        const offset = Number(query.offset) || 0;

        return ledger.getHistory(userId, limit, offset);
    });

    // 4. Redeem Vault Reward (Avatar, Frame, Theme)
    app.post("/rewards/redeem", { preHandler: [requireAuth] }, async (req, reply) => {
        const userId = req.user!.id;
        const body = (req.body as any) || {};
        const cost = Number(body.cost) || 0;
        const rewardTitle = body.rewardTitle || "Reward Item";
        const itemType = (body.itemType || "avatar").toLowerCase(); // 'avatar' | 'frame' | 'theme'
        const itemId = body.itemId || body.id;
        const isAdmin = req.user?.role === "ADMIN";

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return reply.status(404).send({ error: "NOT_FOUND", message: "User not found." });
        }

        let newBalance = user.arenaPoints;

        // Admins can unlock everything for 0 points; regular users must pay cost if > 0
        if (!isAdmin && cost > 0) {
            // Unify points baseline across all earning vectors if ledger was out of sync
            const practiceSolvedCount = await prisma.submission.count({
                where: { userId, verdict: "ACCEPTED" }
            });
            const wins = user.wins || 0;
            const losses = user.losses || 0;
            const rating = user.rating || 0;
            const speedEfficiencyPoints = Math.round(wins * 35 + practiceSolvedCount * 15);
            const computedBaseline = rating + (wins * 120) + (practiceSolvedCount * 50) + (losses * 20) + speedEfficiencyPoints;

            if (user.arenaPoints < cost && computedBaseline >= cost) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { arenaPoints: computedBaseline },
                });
            }

            const result = await ledger.deductPoints({
                userId,
                amount: cost,
                type: "REWARD_REDEMPTION",
                source: "VAULT",
                sourceId: `${Date.now()}_${itemId || rewardTitle}`,
                metadata: {
                    rewardTitle,
                    cost,
                    itemType,
                    itemId,
                    userRating: user.rating || 0,
                    highestRank: user.highestRank || "ROOKIE",
                    redeemedAt: new Date().toISOString(),
                },
            });

            if (!result.success) {
                return reply.status(400).send({
                    error: "INSUFFICIENT_FUNDS",
                    message: result.error || "Insufficient Arena Points balance.",
                    currentBalance: result.newBalance,
                    requiredCost: cost,
                });
            }
            newBalance = result.newBalance;
        }

        // Persist unlocked item and claim history in studentIdentityMetadata
        const currentMeta = (user.studentIdentityMetadata as any) || {};
        const unlockedAvatars = Array.from(new Set([...(currentMeta.unlockedAvatars || []), ...(itemType === "avatar" && itemId ? [itemId] : [])]));
        const unlockedFrames = Array.from(new Set([...(currentMeta.unlockedFrames || []), ...(itemType === "frame" && itemId ? [itemId] : [])]));
        const unlockedThemes = Array.from(new Set([...(currentMeta.unlockedThemes || []), ...(itemType === "theme" && itemId ? [itemId] : [])]));

        const existingClaims = Array.isArray(currentMeta.claimedRewards) ? currentMeta.claimedRewards : [];
        const claimRecord = {
            id: `claim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            itemId: itemId || rewardTitle,
            itemType,
            rewardTitle,
            cost: isAdmin ? 0 : cost,
            claimedAt: new Date().toISOString(),
            userRating: user.rating || 0,
            userRank: user.highestRank || "ROOKIE",
        };

        const updatedMeta = {
            ...currentMeta,
            unlockedAvatars,
            unlockedFrames,
            unlockedThemes,
            claimedRewards: [claimRecord, ...existingClaims],
        };

        await prisma.user.update({
            where: { id: userId },
            data: { studentIdentityMetadata: updatedMeta },
        });

        return {
            success: true,
            newBalance,
            unlockedAvatars,
            unlockedFrames,
            unlockedThemes,
            claim: claimRecord,
            message: `Successfully unlocked ${rewardTitle}!`,
        };
    });

    // 5. Get user's claimed rewards ledger with full metadata (Self or Admin only)
    app.get("/rewards/my-claims", { preHandler: [requireAuth] }, async (req, reply) => {
        const query = (req.query as any) || {};
        const targetUserId = query.targetUserId || req.user!.id;

        const isSelf = req.user!.id === targetUserId;
        const isAdmin = req.user!.role === "ADMIN" || isAdminEmail(req.user!.email);
        if (!isSelf && !isAdmin) {
            return reply.status(403).send({
                error: "FORBIDDEN",
                message: "Cannot view another user's private reward transaction ledger."
            });
        }

        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                username: true,
                rating: true,
                highestRank: true,
                arenaPoints: true,
                studentIdentityMetadata: true,
            }
        });

        if (!targetUser) {
            return reply.status(404).send({ error: "NOT_FOUND", message: "User not found." });
        }

        // 1. Fetch official redemption transactions from ArenaPointTransaction
        const transactions = await prisma.arenaPointTransaction.findMany({
            where: {
                userId: targetUserId,
                type: "REWARD_REDEMPTION",
            },
            orderBy: { createdAt: "desc" },
        });

        // 2. Fetch metadata-stored claimedRewards array
        const userMeta = (targetUser.studentIdentityMetadata as any) || {};
        const metaClaims: any[] = Array.isArray(userMeta.claimedRewards) ? userMeta.claimedRewards : [];

        // 3. Merge & deduplicate claims
        const claimsMap = new Map<string, any>();

        // Seed from transactions
        for (const tx of transactions) {
            const meta = (tx.metadata as any) || {};
            const itemKey = meta.itemId || meta.rewardTitle || tx.sourceId || tx.id;
            const cost = Math.abs(tx.amount) || Number(meta.cost) || 0;
            const itemType = meta.itemType || (tx.sourceId?.includes("theme") ? "theme" : tx.sourceId?.includes("frame") ? "frame" : "avatar");

            claimsMap.set(itemKey, {
                id: tx.id,
                itemId: meta.itemId || itemKey,
                rewardTitle: meta.rewardTitle || itemKey,
                itemType,
                cost,
                claimedAt: tx.createdAt.toISOString(),
                userRating: meta.userRating ?? targetUser.rating,
                userRank: meta.highestRank ?? targetUser.highestRank,
            });
        }

        // Merge from metaClaims
        for (const mc of metaClaims) {
            const itemKey = mc.itemId || mc.rewardTitle || mc.id;
            if (!claimsMap.has(itemKey)) {
                claimsMap.set(itemKey, {
                    id: mc.id || `claim_${Date.now()}`,
                    itemId: mc.itemId || itemKey,
                    rewardTitle: mc.rewardTitle || itemKey,
                    itemType: mc.itemType || "avatar",
                    cost: Number(mc.cost) || 0,
                    claimedAt: mc.claimedAt || new Date().toISOString(),
                    userRating: mc.userRating ?? targetUser.rating,
                    userRank: mc.userRank ?? targetUser.highestRank,
                });
            }
        }

        // Synthesize any unlockedAvatars, unlockedFrames, unlockedThemes not yet in ledger
        const unlockedAvatars: string[] = Array.isArray(userMeta.unlockedAvatars) ? userMeta.unlockedAvatars : [];
        const unlockedFrames: string[] = Array.isArray(userMeta.unlockedFrames) ? userMeta.unlockedFrames : [];
        const unlockedThemes: string[] = Array.isArray(userMeta.unlockedThemes) ? userMeta.unlockedThemes : [];

        for (const av of unlockedAvatars) {
            if (!claimsMap.has(av)) {
                claimsMap.set(av, {
                    id: `legacy_av_${av}`,
                    itemId: av,
                    rewardTitle: av.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                    itemType: "avatar",
                    cost: 200,
                    claimedAt: new Date().toISOString(),
                    userRating: targetUser.rating,
                    userRank: targetUser.highestRank,
                });
            }
        }

        for (const fr of unlockedFrames) {
            if (!claimsMap.has(fr)) {
                claimsMap.set(fr, {
                    id: `legacy_fr_${fr}`,
                    itemId: fr,
                    rewardTitle: fr.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                    itemType: "frame",
                    cost: 500,
                    claimedAt: new Date().toISOString(),
                    userRating: targetUser.rating,
                    userRank: targetUser.highestRank,
                });
            }
        }

        for (const th of unlockedThemes) {
            if (th !== "regular" && th !== "light" && !claimsMap.has(th)) {
                claimsMap.set(th, {
                    id: `legacy_th_${th}`,
                    itemId: th,
                    rewardTitle: `${th.charAt(0).toUpperCase() + th.slice(1)} HUD Theme`,
                    itemType: "theme",
                    cost: 5000,
                    claimedAt: new Date().toISOString(),
                    userRating: targetUser.rating,
                    userRank: targetUser.highestRank,
                });
            }
        }

        const claims = Array.from(claimsMap.values()).sort(
            (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
        );

        const totalSpent = claims.reduce((acc, c) => acc + (Number(c.cost) || 0), 0);

        return {
            success: true,
            claims,
            totalClaimed: claims.length,
            totalSpent,
            arenaPoints: targetUser.arenaPoints,
            equipped: {
                photoURL: userMeta.photoURL || null,
                avatarFrame: userMeta.avatarFrame || null,
                themePreference: userMeta.themePreference || "regular",
            }
        };
    });

    // 6. Resync and verify point balance across all earning venues
    app.post("/rewards/sync-balance", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { success: false, error: "User not found" };

        const practiceSolvedCount = await prisma.submission.count({
            where: { userId, verdict: "ACCEPTED" }
        });
        const wins = user.wins || 0;
        const losses = user.losses || 0;
        const rating = user.rating || 0;
        const speedEfficiencyPoints = Math.round(wins * 35 + practiceSolvedCount * 15);
        const computedBaseline = rating + (wins * 120) + (practiceSolvedCount * 50) + (losses * 20) + speedEfficiencyPoints;

        let synced = false;
        let finalPoints = user.arenaPoints;

        if (user.arenaPoints < computedBaseline) {
            await prisma.user.update({
                where: { id: userId },
                data: { arenaPoints: computedBaseline },
            });
            synced = true;
            finalPoints = computedBaseline;
        }

        return {
            success: true,
            arenaPoints: finalPoints,
            synced,
            breakdown: {
                ratingPoints: rating,
                battleWinPoints: wins * 120,
                practiceSolvedPoints: practiceSolvedCount * 50,
                participationPoints: losses * 20,
                speedEfficiencyPoints,
                computedBaseline,
            }
        };
    });

    // 7. Get user unlocked achievements
    app.get("/rewards/achievements", { preHandler: [requireAuth] }, async (req) => {
        const userId = req.user!.id;
        return achievements.getUserAchievements(userId);
    });
}
