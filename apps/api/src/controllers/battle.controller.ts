import { BattleRoomService, RatingService } from "@algofight/application";
import {
    PrismaBattleRoomRepository,
    PrismaProblemRepository,
    PrismaUserRepository,
} from "@algofight/database";

export class BattleController {
    private readonly battleRoomService: BattleRoomService;
    private readonly ratingService: RatingService;
    private readonly userRepository: PrismaUserRepository;

    constructor() {
        const battleRoomRepository = new PrismaBattleRoomRepository();
        const problemRepository = new PrismaProblemRepository();
        const userRepository = new PrismaUserRepository();

        this.userRepository = userRepository;
        this.ratingService = new RatingService(userRepository);
        this.battleRoomService = new BattleRoomService(
            battleRoomRepository,
            problemRepository,
            this.ratingService
        );
    }

    private async resolveUser(authUser: { id: string; email?: string; username?: string }): Promise<string> {
        let user = await this.userRepository.getUserById(authUser.id);
        if (!user) {
            // Upsert user if they don't exist in the database (e.g., due to frontend sync failure)
            user = await this.userRepository.upsertUser({
                id: authUser.id,
                email: authUser.email || "",
                username: authUser.username || "Guest_" + Math.random().toString(36).substring(2, 8),
            });
        }
        return user.id;
    }

    async createRoom(authUser: { id: string; email?: string; username?: string }, maxPlayers = 2, timeLimitMinutes = 15, difficulty = "MIX", questionCount = 3, isFriendly?: boolean) {
        const resolvedHostId = await this.resolveUser(authUser);
        return this.battleRoomService.createRoom({
            hostId: resolvedHostId,
            maxPlayers,
            timeLimitMinutes,
            difficulty,
            questionCount,
            isFriendly,
        });
    }

    async getRoom(idOrCode: string) {
        return this.battleRoomService.getRoom(idOrCode);
    }

    async joinRoom(idOrCode: string, userId: string) {
        const resolvedUserId = await this.resolveUserId(userId);
        return this.battleRoomService.joinRoom(idOrCode, resolvedUserId);
    }

    async leaveRoom(roomId: string, userId: string) {
        const resolvedUserId = await this.resolveUserId(userId);
        return this.battleRoomService.leaveRoom(roomId, resolvedUserId);
    }

    async kickPlayer(roomId: string, hostId: string, targetUserId: string) {
        const resolvedHostId = await this.resolveUserId(hostId);
        const resolvedTargetUserId = await this.resolveUserId(targetUserId);
        return this.battleRoomService.kickPlayer(roomId, resolvedHostId, resolvedTargetUserId);
    }

    async setPlayerReady(roomId: string, userId: string, isReady: boolean) {
        const resolvedUserId = await this.resolveUserId(userId);
        return this.battleRoomService.setPlayerReady(roomId, resolvedUserId, isReady);
    }

    async startBattle(roomId: string, hostId: string, problemId?: string) {
        const resolvedHostId = await this.resolveUserId(hostId);
        return this.battleRoomService.startBattle(roomId, resolvedHostId, problemId);
    }

    async finishBattle(roomId: string) {
        return this.battleRoomService.finishBattle(roomId);
    }
}
