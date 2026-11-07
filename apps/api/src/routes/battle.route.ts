import { FastifyInstance } from "fastify";
import { BattleController } from "../controllers/battle.controller";
import {
    CreateBattleRoomSchema,
    JoinRoomSchema,
    LeaveRoomSchema,
    KickPlayerSchema,
    ReadyRoomSchema,
    StartBattleSchema,
    JoinSquadTeamSchema,
    SquadApprovalSchema,
    KickSquadMemberSchema,
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
            body.problemIds,
            body.isPublic,
            body.battleMode,
            body.squadSize,
            body.hostRole,
        );
    });

    // 1c. Toggle Host role between PARTICIPANT and VIEWER in lobby
    app.post("/battle/rooms/:idOrCode/role", { preHandler: [requireAuth] }, async (req) => {
        const { idOrCode } = req.params as { idOrCode: string };
        const body = (req.body || {}) as { role?: "PARTICIPANT" | "VIEWER" };
        return battleController.toggleHostRole(idOrCode, req.user!.id, body.role);
    });

    // 1b. Get active public rooms for arena / home display
    app.get("/battle/public-rooms", async () => {
        return battleController.getPublicRooms();
    });

    // 2. Get room details (by UUID or RoomCode like "BTL-ABCD") - High allowance for 2.5s lobby polling
    app.get(
        "/battle/rooms/:idOrCode",
        {
            config: {
                rateLimit: {
                    max: 600,
                    timeWindow: "1 minute",
                },
            },
        },
        async (req) => {
            const { idOrCode } = req.params as { idOrCode: string };
            const query = (req.query as any) || {};
            const userId = (req as any).user?.id || query.userId;
            return battleController.getRoom(idOrCode, userId);
        },
    );

    // 2b. Persist combatant time remaining when user gets out / navigates
    app.post(
        "/battle/rooms/:idOrCode/persist-time",
        async (req) => {
            const { idOrCode } = req.params as { idOrCode: string };
            let body: any = req.body;
            if (typeof body === "string") {
                try { body = JSON.parse(body); } catch {}
            }
            const userId = body?.userId || (req as any).user?.id;
            const timeRemaining = typeof body?.timeRemaining === "number" ? body.timeRemaining : parseInt(body?.timeRemaining, 10);
            return battleController.persistPlayerTime(idOrCode, userId, timeRemaining);
        },
    );

    // 3. Join room (Authenticated - increased joining limit)
    app.post(
        "/battle/rooms/:idOrCode/join",
        {
            preHandler: [requireAuth],
            config: {
                rateLimit: {
                    max: 300,
                    timeWindow: "1 minute",
                },
            },
        },
        async (req) => {
            const { idOrCode } = req.params as { idOrCode: string };
            const body = req.body as any;
            const callerId = req.user!.id;
            const targetUserId = body?.userId || callerId;
            return battleController.joinRoom(idOrCode, targetUserId, req.user);
        },
    );

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

    // 8. Squad Battle: Join Squad Team via Team Invitation Code (e.g. SQ-ALP-XXXX or SQ-BET-XXXX)
    app.post("/battle/squad/join-team", { preHandler: [requireAuth] }, async (req) => {
        const body = JoinSquadTeamSchema.parse(req.body);
        return battleController.joinSquadTeam(req.user!, body.teamCode);
    });

    // 9. Squad Battle: Captain Approval Toggle
    app.post("/battle/squad/:idOrCode/approve", { preHandler: [requireAuth] }, async (req) => {
        const { idOrCode } = req.params as { idOrCode: string };
        const body = SquadApprovalSchema.parse(req.body);
        return battleController.setSquadApproval(req.user!, idOrCode, body.isApproved);
    });

    // 10. Squad Battle: Captain Kick Member from Squad
    app.post("/battle/squad/:idOrCode/kick", { preHandler: [requireAuth] }, async (req) => {
        const { idOrCode } = req.params as { idOrCode: string };
        const body = KickSquadMemberSchema.parse(req.body);
        return battleController.kickSquadMember(req.user!, idOrCode, body.targetUserId);
    });
}
