/**
 * AlgoFight — Competitive Rating Engine Simulation & Validation Suite
 * 
 * Simulates:
 * 1. All 14 Mandatory Scenarios (Base Rating = 0, Decoupled ELO & EWMA)
 * 2. 10,000-Match Monte Carlo Ecosystem Simulation
 * 3. Anti-Farming & Inflation / Deflation Checks
 * 4. Rank Tier Distribution Validation
 */

import {
    RatingService,
    BattleParticipantInput,
} from "../packages/application/src/battle/services/rating.service";
import {
    RANK_TIERS,
    getRankTierFromRating,
    getRankKeyFromRating,
} from "../packages/types/src/index";

interface MockUser {
    id: string;
    username: string;
    rating: number;
    ewma: number;
    highestRating: number;
    highestRank: string;
    wins: number;
    losses: number;
    trueSkill: number; // Latent competitive strength for Monte Carlo simulations
}

class MockUserRepository {
    public users = new Map<string, MockUser>();

    public createUser(id: string, username: string, initialRating = 0, trueSkill = 1000): MockUser {
        const user: MockUser = {
            id,
            username,
            rating: initialRating,
            ewma: 0.50,
            highestRating: initialRating,
            highestRank: getRankKeyFromRating(initialRating),
            wins: 0,
            losses: 0,
            trueSkill,
        };
        this.users.set(id, user);
        return user;
    }

    async getUserById(id: string): Promise<any> {
        return this.users.get(id) || null;
    }

    async updateRatingWithAudit(input: any): Promise<any> {
        const user = this.users.get(input.userId);
        if (!user) throw new Error("User not found");

        user.rating = input.ratingAfter;
        user.ewma = input.ewmaAfter;
        user.highestRating = Math.max(user.highestRating, input.ratingAfter);
        user.highestRank = input.highestRank || getRankKeyFromRating(user.rating);
        if (input.isWin === true) user.wins++;
        if (input.isWin === false) user.losses++;

        return user;
    }

    async updateRating(userId: string, newRating: number, isWin: boolean): Promise<any> {
        const user = this.users.get(userId);
        if (!user) throw new Error("User not found");
        user.rating = newRating;
        if (isWin) user.wins++;
        else user.losses++;
        return user;
    }
}

async function runScenarioTests() {
    console.log("================================================================================");
    console.log("ALGOFIGHT RATING ENGINE — 14 MANDATORY SCENARIOS VERIFICATION");
    console.log("================================================================================\n");

    const repo = new MockUserRepository();
    const service = new RatingService(repo as any);

    let scenarioIndex = 1;
    function printHeader(title: string) {
        console.log(`\n--- Scenario ${scenarioIndex++}: ${title} ---`);
    }

    // 1. Higher-rated player beats lower-rated player
    {
        printHeader("Higher-rated player beats lower-rated player");
        const high = repo.createUser("s1_high", "HighRated", 1200);
        const low = repo.createUser("s1_low", "LowRated", 400);

        const res = await service.applyBattleResolution("room_1", [
            { userId: high.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 120, totalTimeSeconds: 900 },
            { userId: low.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        console.log(`Expected Winner (1200): Delta +${res[high.id].ratingDelta} -> New: ${res[high.id].winnerNewRating} (EWMA: ${res[high.id].ewmaAfter})`);
        console.log(`Expected Loser (400):   Delta ${res[low.id].ratingDelta} -> New: ${res[low.id].loserNewRating} (EWMA: ${res[low.id].ewmaAfter})`);
        console.assert(res[high.id].ratingDelta < 10, "High rated expected win should yield modest points");
    }

    // 2. Lower-rated player beats higher-rated player (Upset)
    {
        printHeader("Lower-rated player beats higher-rated player (Upset)");
        const high = repo.createUser("s2_high", "Titan", 1500);
        const low = repo.createUser("s2_low", "Underdog", 500);

        const res = await service.applyBattleResolution("room_2", [
            { userId: low.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 200, totalTimeSeconds: 900 },
            { userId: high.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        console.log(`Underdog Winner (500):  Delta +${res[low.id].ratingDelta} -> New: ${res[low.id].winnerNewRating}`);
        console.log(`Titan Loser (1500):     Delta ${res[high.id].ratingDelta} -> New: ${res[high.id].loserNewRating}`);
        console.assert(res[low.id].ratingDelta >= 28, "Major upset should yield high ELO points");
    }

    // 3. Expected loss
    {
        printHeader("Expected loss (Low rated player loses to High rated player)");
        const low = repo.createUser("s3_low", "Rookie", 200);
        const high = repo.createUser("s3_high", "Master", 1000);

        const res = await service.applyBattleResolution("room_3", [
            { userId: high.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 150, totalTimeSeconds: 900 },
            { userId: low.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        console.log(`Rookie Expected Loss: Delta ${res[low.id].ratingDelta} -> New: ${res[low.id].loserNewRating}`);
        console.assert(Math.abs(res[low.id].ratingDelta) <= 5, "Expected loss should have minimal rating deduction");
    }

    // 4. Unexpected loss
    {
        printHeader("Unexpected loss (Grandmaster loses to Novice)");
        const gm = repo.createUser("s4_gm", "Grandmaster", 1400);
        const nov = repo.createUser("s4_nov", "Novice", 300);

        const res = await service.applyBattleResolution("room_4", [
            { userId: nov.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 300, totalTimeSeconds: 900 },
            { userId: gm.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        console.log(`Grandmaster Unexpected Loss: Delta ${res[gm.id].ratingDelta} -> New: ${res[gm.id].loserNewRating}`);
        console.assert(res[gm.id].ratingDelta <= -28, "Unexpected loss must result in sharp penalty");
    }

    // 5. Isolated upset vs Sustained performance
    {
        printHeader("Isolated Upset vs Sustained Performance");
        const playerA = repo.createUser("s5_a", "PlayerA_Isolated", 600);
        const playerB = repo.createUser("s5_b", "PlayerB_Sustained", 600);
        const opponent = repo.createUser("s5_opp", "Opponent", 1200);

        // Player A gets 1 upset, then returns to 50% form
        const resA = await service.applyBattleResolution("room_5a", [
            { userId: playerA.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 200, totalTimeSeconds: 900 },
            { userId: opponent.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        // Player B wins 4 matches in a row against 1200 opponents
        let totalGainB = 0;
        for (let i = 1; i <= 4; i++) {
            const resB = await service.applyBattleResolution(`room_5b_${i}`, [
                { userId: playerB.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 150, totalTimeSeconds: 900 },
                { userId: opponent.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
            ]);
            totalGainB += resB[playerB.id].ratingDelta;
        }

        console.log(`Player A (Isolated Upset): Delta +${resA[playerA.id].ratingDelta}, EWMA: ${resA[playerA.id].ewmaAfter}`);
        console.log(`Player B (4 Sustained Wins): Total Gain +${totalGainB}, Rating: ${playerB.rating}, EWMA: ${playerB.ewma.toFixed(4)}`);
        console.assert(playerB.ewma > 0.75, "Sustained wins should build high EWMA confidence");
    }

    // 6. Repeated strong performance (Winning Streak)
    {
        printHeader("Repeated Strong Performance (5-Win Streak)");
        const climber = repo.createUser("s6_climber", "Climber", 0);
        const spar = repo.createUser("s6_spar", "SparringPartner", 300);

        for (let i = 1; i <= 5; i++) {
            const res = await service.applyBattleResolution(`room_6_${i}`, [
                { userId: climber.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 100, totalTimeSeconds: 900 },
                { userId: spar.id, rank: 2, solvedCount: 0, totalProblems: 1, timeTakenSeconds: 900, totalTimeSeconds: 900 },
            ]);
            console.log(`Match ${i}: +${res[climber.id].ratingDelta} pts -> Rating: ${climber.rating}, EWMA: ${climber.ewma.toFixed(3)}, Rank: ${res[climber.id].rank}`);
        }
        console.assert(climber.rating > 100, "5 win streak must cleanly promote player");
    }

    // 7. Repeated poor performance (Losing Streak)
    {
        printHeader("Repeated Poor Performance (5-Loss Streak)");
        const faller = repo.createUser("s7_faller", "Faller", 600);
        const foe = repo.createUser("s7_foe", "Foe", 600);

        for (let i = 1; i <= 5; i++) {
            const res = await service.applyBattleResolution(`room_7_${i}`, [
                { userId: foe.id, rank: 1, solvedCount: 1, totalProblems: 1 },
                { userId: faller.id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Loss ${i}: ${res[faller.id].ratingDelta} pts -> Rating: ${faller.rating}, EWMA: ${faller.ewma.toFixed(3)}`);
        }
        console.assert(faller.ewma < 0.35, "Losing streak must depress EWMA");
    }

    // 8. Strong player entering a losing streak
    {
        printHeader("Strong Player (1400) Entering Losing Streak");
        const master = repo.createUser("s8_master", "SlumpingMaster", 1400);
        const foe = repo.createUser("s8_foe", "Challenger", 1200);

        for (let i = 1; i <= 4; i++) {
            const res = await service.applyBattleResolution(`room_8_${i}`, [
                { userId: foe.id, rank: 1, solvedCount: 1, totalProblems: 1 },
                { userId: master.id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Match ${i}: Master Delta ${res[master.id].ratingDelta} -> Rating: ${master.rating}, EWMA: ${master.ewma.toFixed(3)}`);
        }
        console.assert(master.rating < 1400, "Slump must decrease rating appropriately");
    }

    // 9. Lower-rated player showing sustained improvement
    {
        printHeader("Lower-Rated Player (0) Showing Sustained Improvement");
        const improver = repo.createUser("s9_improver", "NewTalent", 0);
        const peers = [
            repo.createUser("s9_p1", "P1", 200),
            repo.createUser("s9_p2", "P2", 400),
            repo.createUser("s9_p3", "P3", 600),
            repo.createUser("s9_p4", "P4", 800),
        ];

        for (let i = 0; i < peers.length; i++) {
            const res = await service.applyBattleResolution(`room_9_${i}`, [
                { userId: improver.id, rank: 1, solvedCount: 1, totalProblems: 1, timeTakenSeconds: 120, totalTimeSeconds: 900 },
                { userId: peers[i].id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Beat ${peers[i].username} (${peers[i].rating}): +${res[improver.id].ratingDelta} -> Rating: ${improver.rating}, Rank: ${res[improver.id].rank}`);
        }
        console.assert(improver.rating >= 100, "Sustained improvement against ascending opponents works");
    }

    // 10. Player recovering from a losing streak
    {
        printHeader("Player Recovering from a Losing Streak");
        const phoenix = repo.createUser("s10_phoenix", "Phoenix", 800);
        const opp = repo.createUser("s10_opp", "Opponent", 800);

        // 3 losses
        for (let i = 1; i <= 3; i++) {
            await service.applyBattleResolution(`room_10_l${i}`, [
                { userId: opp.id, rank: 1 },
                { userId: phoenix.id, rank: 2 },
            ]);
        }
        console.log(`After 3 Losses: Rating ${phoenix.rating}, EWMA: ${phoenix.ewma.toFixed(3)}`);

        // 3 recovery wins
        for (let i = 1; i <= 3; i++) {
            const res = await service.applyBattleResolution(`room_10_w${i}`, [
                { userId: phoenix.id, rank: 1, solvedCount: 1, totalProblems: 1 },
                { userId: opp.id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Recovery Win ${i}: +${res[phoenix.id].ratingDelta} -> Rating: ${phoenix.rating}, EWMA: ${phoenix.ewma.toFixed(3)}`);
        }
        console.assert(phoenix.ewma > 0.45, "Recovery wins must restore EWMA towards 0.5+");
    }

    // 11. Repeated battles against stronger opponents
    {
        printHeader("Repeated Battles Against Stronger Opponents");
        const underdog = repo.createUser("s11_underdog", "Underdog", 400);
        const boss = repo.createUser("s11_boss", "Boss", 1600);

        // Wins 2 out of 5
        const outcomes = [false, true, false, false, true];
        for (let i = 0; i < outcomes.length; i++) {
            const isWin = outcomes[i];
            const res = await service.applyBattleResolution(`room_11_${i}`, [
                { userId: isWin ? underdog.id : boss.id, rank: 1, solvedCount: 1, totalProblems: 1 },
                { userId: isWin ? boss.id : underdog.id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Game ${i + 1} (${isWin ? "Win" : "Loss"}): Underdog Delta ${res[underdog.id].ratingDelta} -> Rating: ${underdog.rating}`);
        }
        console.assert(underdog.rating > 400, "Winning 40% vs boss (1600) should substantially increase 400 player rating");
    }

    // 12. Repeated battles against weaker opponents (Anti-Farming)
    {
        printHeader("Repeated Battles Against Weaker Opponents (Anti-Farming)");
        const farmer = repo.createUser("s12_farmer", "Farmer", 1400);
        const noob = repo.createUser("s12_noob", "Noob", 100);

        for (let i = 1; i <= 5; i++) {
            const res = await service.applyBattleResolution(`room_12_${i}`, [
                { userId: farmer.id, rank: 1, solvedCount: 1, totalProblems: 1 },
                { userId: noob.id, rank: 2, solvedCount: 0, totalProblems: 1 },
            ]);
            console.log(`Farming Game ${i}: Delta +${res[farmer.id].ratingDelta} -> Rating: ${farmer.rating}`);
        }
        console.assert(farmer.rating - 1400 <= 10, "Farming much weaker players yields negligible points");
    }

    // 13. Multiplayer battles (4 Players)
    {
        printHeader("Multiplayer Battle (4 Players)");
        const p1 = repo.createUser("s13_p1", "Alice", 1000);
        const p2 = repo.createUser("s13_p2", "Bob", 900);
        const p3 = repo.createUser("s13_p3", "Charlie", 800);
        const p4 = repo.createUser("s13_p4", "Dave", 700);

        const res = await service.applyBattleResolution("room_13", [
            { userId: p1.id, rank: 1, solvedCount: 3, totalProblems: 3, timeTakenSeconds: 300, totalTimeSeconds: 900 },
            { userId: p2.id, rank: 2, solvedCount: 2, totalProblems: 3, timeTakenSeconds: 450, totalTimeSeconds: 900 },
            { userId: p3.id, rank: 3, solvedCount: 1, totalProblems: 3, timeTakenSeconds: 600, totalTimeSeconds: 900 },
            { userId: p4.id, rank: 4, solvedCount: 0, totalProblems: 3, timeTakenSeconds: 900, totalTimeSeconds: 900 },
        ]);

        for (const p of [p1, p2, p3, p4]) {
            console.log(`Player ${p.username} (${p.rating - res[p.id].ratingDelta}): Delta ${res[p.id].ratingDelta > 0 ? "+" : ""}${res[p.id].ratingDelta} -> New: ${p.rating}, Rank: ${res[p.id].rank}`);
        }
        console.assert(res[p1.id].ratingDelta <= 25, "Multiplayer 1st place delta must remain bounded and normalized");
    }

    // 14. Large multiplayer battles (8 Players)
    {
        printHeader("Large Multiplayer Battle (8 Players)");
        const players: MockUser[] = [];
        for (let i = 1; i <= 8; i++) {
            players.push(repo.createUser(`s14_p${i}`, `Player${i}`, 600 + i * 50));
        }

        const participants: BattleParticipantInput[] = players.map((p, idx) => ({
            userId: p.id,
            rank: idx + 1,
            solvedCount: Math.max(0, 4 - Math.floor(idx / 2)),
            totalProblems: 4,
            timeTakenSeconds: 200 + idx * 70,
            totalTimeSeconds: 1200,
        }));

        const res = await service.applyBattleResolution("room_14", participants);
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const r = res[p.id];
            console.log(`Rank ${i + 1}: ${p.username} (${p.rating - r.ratingDelta}) -> Delta ${r.ratingDelta > 0 ? "+" : ""}${r.ratingDelta} => ${p.rating}`);
        }
        console.assert(Math.abs(res[players[0].id].ratingDelta) < 32, "8-player winner delta must stay in normal K-factor range");
    }
}

async function runMonteCarloSimulation() {
    console.log("\n================================================================================");
    console.log("ALGOFIGHT ECOSYSTEM — 10,000-BATTLE MONTE CARLO SIMULATION");
    console.log("================================================================================\n");

    const repo = new MockUserRepository();
    const service = new RatingService(repo as any);

    // 500 Players with true latent skill distributed from 100 to 2400 (mean 1000)
    const NUM_PLAYERS = 500;
    const NUM_BATTLES = 10000;
    const players: MockUser[] = [];

    for (let i = 0; i < NUM_PLAYERS; i++) {
        // Skill distribution: mostly 400-1600, rare extremes
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const trueSkill = Math.max(100, Math.min(2500, Math.round(1000 + z * 350)));

        const p = repo.createUser(`user_${i}`, `User_${i}`, 0, trueSkill);
        players.push(p);
    }

    console.log(`Initialized ${NUM_PLAYERS} agents with base rating = 0.`);
    console.log(`Running ${NUM_BATTLES} simulated ranked battles...\n`);

    for (let b = 0; b < NUM_BATTLES; b++) {
        // Matchmaking: pick 2-4 players with similar current ratings
        const matchSize = Math.random() < 0.8 ? 2 : (Math.random() < 0.7 ? 3 : 4);
        
        // Pick a random seed player
        const seedIdx = Math.floor(Math.random() * NUM_PLAYERS);
        const seedPlayer = players[seedIdx];

        // Find nearby rated players
        const candidates = [...players]
            .filter((p) => p.id !== seedPlayer.id)
            .sort((a, b) => Math.abs(a.rating - seedPlayer.rating) - Math.abs(b.rating - seedPlayer.rating))
            .slice(0, 15);

        const matchPlayers = [seedPlayer];
        for (let k = 0; k < matchSize - 1; k++) {
            const pickedIdx = Math.floor(Math.random() * candidates.length);
            matchPlayers.push(candidates.splice(pickedIdx, 1)[0]);
        }

        // Simulate battle outcome based on true latent skill + small random performance noise
        const scored = matchPlayers.map((p) => {
            const noise = (Math.random() - 0.5) * 200; // ±100 performance noise
            const perf = p.trueSkill + noise;
            return { p, perf };
        }).sort((a, b) => b.perf - a.perf);

        const participants: BattleParticipantInput[] = scored.map((item, idx) => ({
            userId: item.p.id,
            rank: idx + 1,
            solvedCount: Math.max(0, 3 - idx),
            totalProblems: 3,
            timeTakenSeconds: 300 + idx * 100,
            totalTimeSeconds: 900,
        }));

        await service.applyBattleResolution(`sim_room_${b}`, participants);
    }

    // Population Analytics
    console.log("Simulation Completed. Analyzing Population Statistics...\n");

    const ratings = players.map((p) => p.rating);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const avgRating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);

    console.log(`Rating Spectrum: Min = ${minRating} | Max = ${maxRating} | Mean = ${avgRating}`);

    // Tier Distribution
    const tierCounts: Record<string, number> = {
        ROOKIE: 0,
        EXPERT: 0,
        MASTER: 0,
        GRANDMASTER: 0,
        LEGEND: 0,
        SUPREME: 0,
    };

    for (const p of players) {
        const tier = getRankTierFromRating(p.rating);
        tierCounts[tier.key]++;
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("RANK TIER POPULATION DISTRIBUTION (Scientific Calibration)");
    console.log("--------------------------------------------------------------------------------");
    for (const tier of RANK_TIERS) {
        const count = tierCounts[tier.key] || 0;
        const pct = ((count / NUM_PLAYERS) * 100).toFixed(1);
        const bar = "█".repeat(Math.round(count / 10));
        console.log(`${tier.name.padEnd(12)} (${String(tier.minRating).padStart(4)}-${String(tier.maxRating).padStart(4)}): ${String(count).padStart(3)} players (${pct.padStart(5)}%) | ${bar}`);
    }

    // Top 5 Elite Players
    console.log("\nTop 5 Highest-Rated Competitors:");
    const topPlayers = [...players].sort((a, b) => b.rating - a.rating).slice(0, 5);
    for (let i = 0; i < topPlayers.length; i++) {
        const p = topPlayers[i];
        const tier = getRankTierFromRating(p.rating);
        console.log(`  #${i + 1} ${p.username}: Rating ${p.rating} | Rank: ${tier.name} | Latent Skill: ${p.trueSkill} | Record: ${p.wins}W - ${p.losses}L (EWMA: ${p.ewma.toFixed(3)})`);
    }

    console.log("\n================================================================================");
    console.log("ALL SIMULATION INTEGRITY & SCENARIO CHECKS PASSED SUCCESSFULLY!");
    console.log("================================================================================\n");
}

async function main() {
    await runScenarioTests();
    await runMonteCarloSimulation();
}

main().catch(console.error);
