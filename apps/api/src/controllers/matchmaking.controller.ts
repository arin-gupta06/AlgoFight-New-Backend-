import {
    BattleRoomService,
    MatchmakingService,
    MatchmakingTicket,
    RatingService
} from "@algofight/application";

import {
    PrismaBattleRoomRepository,
    PrismaProblemRepository,
    PrismaUserRepository,
} from "@algofight/database";
import { stat } from "node:fs";

export class MatchmakingController {
    private readonly matchmakingService: MatchmakingService;
    constructor() {
        const userRepository = new PrismaUserRepository();
        const battleRoomRepository = new PrismaBattleRoomRepository();
        const problemRepository = new PrismaProblemRepository();
        const ratingService = new RatingService(userRepository);
        const battleRoomService = new BattleRoomService(
            battleRoomRepository,
            problemRepository,
            ratingService
        );
        this.matchmakingService = new MatchmakingService(
            userRepository,
            battleRoomService,
            problemRepository
        );
    }

    async joinQueue(userId: string) {
        const match = await
            this.matchmakingService.joinQueue(userId);
        return {
            status: match ? "MATCHED" : "QUEUED",
            match,
        };
    }

    async cancelQueue(userId: string) {
        const cancelled = await this.matchmakingService.cancelQueue(userId);
        return {
            status: cancelled ? "CANCELLED" : "NOT_IN_QUEUE",
        };
    }

    async getStatus(userId: string) {
        const isQueued = await this.matchmakingService.isQueued(userId);
        return {
            isQueued,
        };
    }
}