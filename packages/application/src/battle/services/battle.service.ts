import { createRedisClient } from "../../utils/redis.client";
import { logger } from "@algofight/logger";
import { BattleRoomRepository } from "@algofight/database";
import { BattleRoomService } from "./battle-room.service";

export class BattleService {
    private readonly redis = createRedisClient();

    constructor(
        private readonly battleRoomRepo?:
            BattleRoomRepository,
        private readonly battleRoomService?: BattleRoomService
    ) { }

    async createBattle(roomId: string): Promise<void> {
        if (this.battleRoomService) {
            // Already created via battleRoomService
            return;
        }
    }

    async startBattle(roomId: string, hostId?: string): Promise<void> {
        if (this.battleRoomService && hostId) {
            await this.battleRoomService.startBattle(roomId, hostId);
        }
    }

    async finishBattle(roomId: string, reason: string, winnerId?: string,
        forfeitedUserId?: string
    ): Promise<void> {
        try {
            const stateKey = `battle_state:${roomId}`;
            const rawState = await this.redis.get(stateKey);
            if (!rawState) {
                logger.warn({ roomId }, "No battle state found in Redis during finalization");
                return;
            }
            const state = JSON.parse(rawState);
            state.status = "FINISHED";
            for (const player of state.players) {
                if (player.userId != "bot" && this.battleRoomRepo) {
                    await this.battleRoomRepo.recordParticipantScore(
                        roomId,
                        player.userId,
                        player.points,
                        player.solvedCount > 0
                    ).catch(() => { });
                }
            }

            let eloResults;
            if (this.battleRoomService) {
                const result = await this.battleRoomService.finishBattle(
                    roomId, forfeitedUserId
                );
                eloResults = result.eloResults;
            }
            await this.redis.del(stateKey);

            const eventPayload = {
                event: "BATTLE_FINISHED",
                roomId,
                winnerId: winnerId || null,
                forfeitedUserId: forfeitedUserId || null,
                reason,
                finalState: state,
                eloResults
            };

            await this.redis.publish("battle-events",
                JSON.stringify(eventPayload)
            );
            logger.info({ roomId, reason }, "Battle finshed successfully.")
        } catch (error) {
            logger.error({
                error, roomId
            }, "Failed to finish battle")

        }
    }

    async processEvaluationResult(
        roomId: string,
        userId: string,
        problemId: string,
        isAccepted: boolean,
        points: number = 100
    ): Promise<void> {
        try {
            if (!isAccepted) return; // Only process correct answers for battle points

            const stateKey = `battle_state:${roomId}`;
            const rawState = await this.redis.get(stateKey);

            if (!rawState) {
                logger.warn({ roomId }, "Battle state not found in Redis, cannot update score");
                return;
            }

            const state = JSON.parse(rawState);
            const player = state.players.find((p: any) => p.userId === userId);

            if (!player) {
                logger.warn({ roomId, userId }, "Player not found in battle state");
                return;
            }

            // Check if already solved
            const alreadySolved = player.solvedProblems.some((sp: any) => sp.problemId === problemId);
            if (alreadySolved) {
                return; // Prevent duplicate points
            }

            const elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);

            player.points += points;
            player.solvedCount += 1;
            player.solvedProblems.push({
                problemId,
                timeSeconds: elapsedSeconds,
                timeString: this.formatTime(elapsedSeconds)
            });

            // Save updated state back to Redis
            await this.redis.set(stateKey, JSON.stringify(state), "EX", state.timeLimitSeconds + 300);

            // Publish an event via Pub/Sub so WebSocket servers can pick it up
            const eventPayload = {
                event: "PLAYER_SOLVED",
                roomId,
                userId,
                username: player.username,
                pointsAdded: points,
                totalPoints: player.points,
                solvedCount: player.solvedCount,
                problemId,
                newState: state // Passing full state to sync
            };

            await this.redis.publish("battle-events", JSON.stringify(eventPayload));

            logger.info({ roomId, userId, problemId }, "Player solved problem in battle, event published");
            if (player.solvedCount >= state.totalQuestions) {
                await this.finishBattle(roomId, "ALL_SOLVED", userId)
                return;
            }

        } catch (error) {
            logger.error({ error, roomId, userId }, "Failed to process evaluation result for battle");
        }
    }

    private formatTime(seconds: number) {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    }
}