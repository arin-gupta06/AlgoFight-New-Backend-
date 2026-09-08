import { FastifyInstance } from "fastify";
import { BattleController } from "../controllers/battle.controller";
import {
    CreateBattleRoomSchema,
    JoinRoomSchema,
    LeaveRoomSchema,
    KickPlayerSchema,
    ReadyRoomSchema,
    StartBattleSchema,
} from "../validators/battle.validator";
import { requireAuth } from "../plugins/auth.plugin";

const battleController = new BattleController();

export async function battleRoutes(app: FastifyInstance) {
    // 1. Create room
    app.post("/battle/rooms", { preHandler: [requireAuth] }, async (req) => {
        const body = CreateBattleRoomSchema.parse(req.body);
        return battleController.createRoom(
            req.user!,
            body.maxPlayers,
            body.timeLimitMinutes,
            body.difficulty,
            body.questionCount,
            body.isFriendly,
        );
    });

    // 2. Get room details (by UUID or RoomCode like "BTL-ABCD")
    app.get("/battle/rooms/:idOrCode", async (req) => {
        const { idOrCode } = req.params as { idOrCode: string };
        return battleController.getRoom(idOrCode);
    });

    // 3. Join room (Authenticated)
    app.post("/battle/rooms/:idOrCode/join", { preHandler: [requireAuth] }, async (req) => {
        const { idOrCode } = req.params as { idOrCode: string };
        const userId = req.user!.id;
        return battleController.joinRoom(idOrCode, userId);
    });

    // 4. Leave room (Authenticated)
    app.post("/battle/rooms/:id/leave", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        const userId = req.user!.id;
        return battleController.leaveRoom(id, userId);
    });

    // 4b. Kick player from room (Host only)
    app.post("/battle/rooms/:id/kick", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        const body = KickPlayerSchema.parse(req.body);
        const hostId = req.user!.id;
        return battleController.kickPlayer(id, hostId, body.targetUserId);
    });

    // 5. Toggle Ready status (Authenticated)
    app.post("/battle/rooms/:id/ready", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        const body = ReadyRoomSchema.parse(req.body);
        const userId = req.user!.id;
        return battleController.setPlayerReady(id, userId, body.isReady);
    });

    // 6. Start Battle (Host only)
    app.post("/battle/rooms/:id/start", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        const body = StartBattleSchema.parse(req.body);
        const hostId = req.user!.id;
        return battleController.startBattle(id, hostId, body.problemId);
    });

    // 7. Finish Battle (Authenticated participant / host / admin)
    app.post("/battle/rooms/:id/finish", { preHandler: [requireAuth] }, async (req) => {
        const { id } = req.params as { id: string };
        return battleController.finishBattle(id);
    });
}
