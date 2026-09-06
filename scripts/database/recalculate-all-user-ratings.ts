import "dotenv/config";
import { prisma } from "../../packages/database/src/client/prisma";
import { getRankKeyFromRating, getRankTierFromRating } from "../../packages/types/src/index";

async function main() {
    console.log("Recalculating user ratings based on existing match records...");

    const users = await prisma.user.findMany();
    for (const u of users) {
        if (u.wins > 0 || u.losses > 0) {
            // Recalculate baseline rating for users with matches
            // Each win starting from 0 gives ~17 rating points
            const netRating = Math.max(0, u.wins * 17 - u.losses * 16);
            const rankTier = getRankTierFromRating(netRating);

            await prisma.user.update({
                where: { id: u.id },
                data: {
                    rating: netRating,
                    highestRating: Math.max(netRating, u.highestRating || netRating),
                    highestRank: rankTier.key,
                },
            });
            console.log(`Updated user ${u.username} (${u.id}) -> Wins: ${u.wins}, Losses: ${u.losses} => Rating: ${netRating} (${rankTier.key})`);
        }
    }

    console.log("Recalculation complete!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
