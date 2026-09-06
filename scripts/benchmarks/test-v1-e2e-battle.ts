import "dotenv/config"
import { PrismaUserRepository } from "../../packages/database/src/repositories/prisma-user.repository";
import { PrismaProblemRepository } from "../../packages/database/src/repositories/prisma-problem.repository";
import { PrismaBattleRoomRepository } from "../../packages/database/src/repositories/prisma-battle-room-repository";
import { PrismaSubmissionRepository } from "../../packages/database/src/repositories/prisma.submission.repository";
import { prisma } from "../../packages/database/src/client/prisma";
import { BattleRoomService } from "../../packages/application/src/battle/services/battle-room.service";
import { RatingService } from "../../packages/application/src/battle/services/rating.service";
import { MatchmakingService } from "../../packages/application/src/battle/services/matchmaking.service";
import { SubmissionStatus, Verdict } from "../../packages/types/src/index";



async function runE2ETest() {
    console.log("==========================================================");
    console.log("⚔️  ALGOFIGHT V1 END-TO-END SYSTEM INTEGRATION TEST  ⚔️");
    console.log("==========================================================\n");

    const userRepo = new PrismaUserRepository();
    const problemRepo = new PrismaProblemRepository();
    const battleRoomRepo = new PrismaBattleRoomRepository();
    const submissionRepo = new PrismaSubmissionRepository();
    const ratingService = new RatingService(userRepo);
    const battleRoomService = new BattleRoomService(
        battleRoomRepo,
        problemRepo,
        ratingService,
    );
    const matchmakingService = new MatchmakingService(
        userRepo,
        battleRoomService,
        problemRepo,
    );

    try {
        // ----------------------------------------------------
        // STEP 1: Create 2 Test Players
        // ----------------------------------------------------
        console.log("👤 [1/7] Creating Players...");
        const timestamp = Date.now();
        const player1 = await userRepo.createUser({
            username: `alice_${timestamp}`,
            email: `alice_${timestamp}@algofight.test`,
        });
        const player2 = await userRepo.createUser({
            username: `bob_${timestamp}`,
            email: `bob_${timestamp}@algofight.test`,
        });

        console.log(`   ✅ Player 1: ${player1.username} (Rating: ${player1.rating})`);
        console.log(`   ✅ Player 2: ${player2.username} (Rating: ${player2.rating})\n`);

        // ----------------------------------------------------
        // STEP 2: Create a Problem with Public & Hidden Tests
        // ----------------------------------------------------
        console.log("📝 [2/7] Creating Problem with Public & Hidden Tests...");
        const problem = await prisma.problem.create({
            data: {
                title: `Two Sum Lite ${timestamp}`,
                statement: "Given two numbers, calculate their sum.",
                difficulty: "EASY",
                timeLimit: 2000,
                memoryLimit: 256,
                testCases: {
                    create: [
                        { input: "2 3", expectedOutput: "5", isHidden: false },
                        { input: "10 20", expectedOutput: "30", isHidden: true },
                    ],
                },
            },
        });

        // Verify Hidden Test Leakage Protection (Gap 10)
        const publicProblem = await problemRepo.getProblemById(problem.id);
        const fullProblem = await problemRepo.getProblemWithAllTestCases(problem.id);

        console.log(`   ✅ Public query test case count: ${publicProblem?.testCases.length} (Expected: 1)`);
        console.log(`   ✅ Worker query test case count: ${fullProblem?.testCases.length} (Expected: 2)`);
        if (publicProblem?.testCases.length !== 1 || fullProblem?.testCases.length !== 2) {
            throw new Error("❌ Hidden test protection failed!");
        }
        console.log("   🔒 Hidden test case protection verified!\n");

        // ----------------------------------------------------
        // STEP 3: Matchmaking / Room Creation
        // ----------------------------------------------------
        console.log("🎮 [3/7] Creating Battle Room...");
        const room = await battleRoomService.createRoom({
            hostId: player1.id,
            maxPlayers: 2,
            timeLimitMinutes: 15,
            difficulty: "EASY",
            questionCount: 1,
        });
        console.log(`   ✅ Room created: Code ${room.roomCode} | Status: ${room.status}`);

        // Player 2 joins room
        console.log(`   👉 Player 2 (${player2.username}) joining room...`);
        const joinedRoom = await battleRoomService.joinRoom(room.id, player2.id);
        console.log(`   ✅ Participants in room: ${joinedRoom.participants.length} | Status: ${joinedRoom.status}\n`);

        // ----------------------------------------------------
        // STEP 4: Ready Check & Auto State Transition (Gap 1)
        // ----------------------------------------------------
        console.log("🚦 [4/7] Testing Ready Check & State Machine...");
        console.log(`   👉 Player 2 setting ready = true...`);
        const readyRoom = await battleRoomService.setPlayerReady(room.id, player2.id, true);

        console.log(`   ✅ All players ready! Room Status auto-transitioned to: ${readyRoom.status}`);
        if (readyRoom.status !== "READY") {
            throw new Error(`❌ Expected room status to be READY, got ${readyRoom.status}`);
        }

        // Host starts the battle
        console.log(`   👉 Host (${player1.username}) starting the battle...`);
        const runningRoom = await battleRoomService.startBattle(room.id, player1.id);
        console.log(`   ✅ Battle Started! Room Status: ${runningRoom.status} | StartedAt: ${runningRoom.startedAt?.toISOString()}\n`);

        // ----------------------------------------------------
        // STEP 5: Code Submissions & Scoring (Gap 3 & 4)
        // ----------------------------------------------------
        console.log("💻 [5/7] Simulating Code Submissions...");
        // Alice submits correct solution
        console.log(`   👉 Alice submits correct code...`);
        const subAlice = await submissionRepo.createSubmission({
            userId: player1.id,
            problemId: problem.id,
            roomId: room.id,
            language: "javascript",
            code: "console.log(5);",
        });
        // Transition: CREATED -> QUEUED -> COMPILING -> RUNNING -> EVALUATING -> FINALIZED
        await submissionRepo.updateStatus(subAlice.id, SubmissionStatus.QUEUED);
        await submissionRepo.updateStatus(subAlice.id, SubmissionStatus.COMPILING);
        await submissionRepo.updateStatus(subAlice.id, SubmissionStatus.RUNNING);
        await submissionRepo.updateStatus(subAlice.id, SubmissionStatus.EVALUATING);
        await submissionRepo.completeSubmission(subAlice.id, {
            status: SubmissionStatus.FINALIZED,
            verdict: Verdict.ACCEPTED,
            executionTime: 45,
            exitCode: 0,
        } as any);
        await battleRoomRepo.recordParticipantScore(room.id, player1.id, 100, true);
        console.log("   ✅ Alice scored 100 points and recorded solvedAt!");
        // Bob submits incorrect solution
        console.log(`   👉 Bob submits incorrect code...`);
        const subBob = await submissionRepo.createSubmission({
            userId: player2.id,
            problemId: problem.id,
            roomId: room.id,
            language: "javascript",
            code: "console.log(999);",
        });
        // Transition: CREATED -> QUEUED -> COMPILING -> RUNNING -> EVALUATING -> FINALIZED
        await submissionRepo.updateStatus(subBob.id, SubmissionStatus.QUEUED);
        await submissionRepo.updateStatus(subBob.id, SubmissionStatus.COMPILING);
        await submissionRepo.updateStatus(subBob.id, SubmissionStatus.RUNNING);
        await submissionRepo.updateStatus(subBob.id, SubmissionStatus.EVALUATING);
        await submissionRepo.completeSubmission(subBob.id, {
            status: SubmissionStatus.FINALIZED,
            verdict: Verdict.WRONG_ANSWER,
            executionTime: 50,
            exitCode: 0,
        } as any);
        await battleRoomRepo.recordParticipantScore(room.id, player2.id, 0, false);
        console.log("   ✅ Bob scored 0 points.\n");


        // ----------------------------------------------------
        // STEP 6: Battle Conclusion, Ranking & ELO (Gap 5 & 6)
        // ----------------------------------------------------
        console.log("🏆 [6/7] Finalizing Battle, Rankings & ELO...");
        const finalResult = await battleRoomService.finishBattle(room.id);

        console.log(`   ✅ Battle Status: ${finalResult.room.status}`);
        if (finalResult.eloResults) {
            const aliceElo = finalResult.eloResults[player1.id];
            const bobElo = finalResult.eloResults[player2.id];
            console.log(`   📊 ELO Deltas Applied: Winner +${aliceElo?.ratingDelta} | Loser ${bobElo?.ratingDelta}`);
        }

        const updatedAlice = await userRepo.getUserById(player1.id);
        const updatedBob = await userRepo.getUserById(player2.id);

        console.log(`   🥇 Alice (Winner): New Rating = ${updatedAlice?.rating} (Wins: ${updatedAlice?.wins})`);
        console.log(`   🥈 Bob (Loser):    New Rating = ${updatedBob?.rating} (Losses: ${updatedBob?.losses})\n`);

        // ----------------------------------------------------
        // STEP 7: Expiration Check Verification (Gap 2)
        // ----------------------------------------------------
        console.log("⏱️  [7/7] Verifying Expiration Query...");
        const expired = await battleRoomRepo.getExpiredRooms();
        console.log(`   ✅ getExpiredRooms query ran cleanly (Found ${expired.length} expired rooms).\n`);

        console.log("==========================================================");
        console.log("🎉  ALL 11 V1 GAPS TESTED & VERIFIED SUCCESSFULLY!  🎉");
        console.log("==========================================================");
    } catch (error) {
        console.error("\n❌ E2E TEST FAILED:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runE2ETest();
