import "dotenv/config";
import { prisma } from "../../packages/database/src/client/prisma";
import { getRankKeyFromRating } from "../../packages/types/src/index";

async function main() {
    console.log("Checking and resetting existing users to base rating = 0...");

    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users in database.`);

    for (const u of users) {
        // If the user had the legacy 1200 or pre-upgrade test ratings
        const newRating = 0;
        const rankKey = getRankKeyFromRating(newRating);

        await prisma.user.update({
            where: { id: u.id },
            data: {
                rating: newRating,
                ewma: 0.50,
                highestRating: 0,
                highestRank: rankKey,
            },
        });
        console.log(`Reset user ${u.username} (${u.id}) -> Rating: 0 | Rank: ${rankKey}`);
    }

    console.log("All existing users in DB now start cleanly with rating = 0.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
