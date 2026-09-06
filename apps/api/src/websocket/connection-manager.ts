import { WebSocket } from "ws";
import { logger } from "@algofight/logger";

export type PlayerPresenceStatus = "AVAILABLE" | "IN_BATTLE" | "IN_LOBBY";

export interface UserPresence {
    userId: string;
    username: string;
    rating?: number;
    platformCode?: string;
    userType?: string;
    institutionName?: string;
    status: PlayerPresenceStatus;
    roomId?: string;
    connectedAt: number;
    lastActiveAt: number;
}

export interface DirectChallenge {
    challengeId: string;
    fromUserId: string;
    fromUsername: string;
    fromRating?: number;
    targetUserId: string;
    targetUsername: string;
    createdAt: number;
    expiresAt: number;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
}

export class ConnectionManager {
    // Map of userId -> WebSocket
    public readonly userSockets = new Map<string, WebSocket>();

    // Map of roomId -> Set of WebSockets
    public readonly roomSockets = new Map<string, Set<WebSocket>>();

    // Real-time presence registry: userId -> UserPresence
    private readonly presenceMap = new Map<string, UserPresence>();

    // Active direct 1v1 challenges: challengeId -> DirectChallenge
    private readonly challenges = new Map<string, DirectChallenge>();

    // Rolling timestamps of broadcast events for real-time fan-out telemetry
    private readonly broadcastTimestamps: number[] = [];
    public totalBroadcastEvents = 0;

    private recordBroadcastEvents(count = 1): void {
        const now = Date.now();
        this.totalBroadcastEvents += count;
        for (let i = 0; i < count; i++) {
            this.broadcastTimestamps.push(now);
        }
        // Retain max 10,000 recent points to avoid memory growth
        if (this.broadcastTimestamps.length > 10000) {
            this.broadcastTimestamps.splice(0, this.broadcastTimestamps.length - 10000);
        }
    }

    public getFanOutRate(windowMs = 60000): number {
        const cutoff = Date.now() - windowMs;
        let count = 0;
        for (let i = this.broadcastTimestamps.length - 1; i >= 0; i--) {
            if (this.broadcastTimestamps[i] < cutoff) break;
            count++;
        }
        const seconds = Math.max(1, windowMs / 1000);
        return Number((count / seconds).toFixed(1));
    }

    public getActiveSocketCount(): number {
        let count = 0;
        for (const ws of this.userSockets.values()) {
            if (ws.readyState === WebSocket.OPEN) count++;
        }
        return count;
    }

    public getActiveRoomCount(): number {
        return this.roomSockets.size;
    }

    // Register user socket on connect/auth
    registerUser(userId: string, socket: WebSocket, metadata?: Partial<UserPresence>): void {
        this.userSockets.set(userId, socket);

        const existing = this.presenceMap.get(userId);
        const now = Date.now();
        const presence: UserPresence = {
            userId,
            username: metadata?.username || existing?.username || "Player",
            rating: metadata?.rating ?? existing?.rating ?? 0,
            platformCode: metadata?.platformCode || existing?.platformCode || "",
            userType: metadata?.userType || existing?.userType || "INDIVIDUAL",
            institutionName: metadata?.institutionName || existing?.institutionName,
            status: metadata?.status || existing?.status || "AVAILABLE",
            roomId: metadata?.roomId || existing?.roomId,
            connectedAt: existing?.connectedAt || now,
            lastActiveAt: now,
        };

        this.presenceMap.set(userId, presence);
        logger.info({ userId, username: presence.username }, "User registered in ConnectionManager & Presence registry");
    }

    // Update real-time status of a player
    updatePresenceStatus(userId: string, status: PlayerPresenceStatus, roomId?: string): void {
        const presence = this.presenceMap.get(userId);
        if (presence) {
            presence.status = status;
            presence.roomId = roomId;
            presence.lastActiveAt = Date.now();
            this.presenceMap.set(userId, presence);
            this.broadcastToAll("player_presence_update", presence);
        }
    }

    // Get all online players list
    getAllOnlinePresences(): UserPresence[] {
        const list: UserPresence[] = [];
        for (const [userId, presence] of this.presenceMap.entries()) {
            const socket = this.userSockets.get(userId);
            if (socket && socket.readyState === WebSocket.OPEN) {
                list.push(presence);
            }
        }
        return list;
    }

    // Get presence for single user
    getPresence(userId: string): UserPresence | undefined {
        return this.presenceMap.get(userId);
    }

    // Unregister user socket on disconnect
    unregisterUser(userId: string, socket: WebSocket): void {
        if (this.userSockets.get(userId) === socket) {
            this.userSockets.delete(userId);
            this.presenceMap.delete(userId);
        }

        // Cancel any pending challenges involving this user
        for (const [challengeId, challenge] of this.challenges.entries()) {
            if (challenge.fromUserId === userId || challenge.targetUserId === userId) {
                if (challenge.status === "PENDING") {
                    challenge.status = "CANCELLED";
                    const otherUserId = challenge.fromUserId === userId ? challenge.targetUserId : challenge.fromUserId;
                    this.sendToUser(otherUserId, "challenge_cancelled", {
                        challengeId,
                        reason: "Player disconnected",
                    });
                }
                this.challenges.delete(challengeId);
            }
        }

        // Clean up from all rooms
        for (const [roomId, sockets] of this.roomSockets.entries()) {
            if (sockets.has(socket)) {
                sockets.delete(socket);
                if (sockets.size === 0) {
                    this.roomSockets.delete(roomId);
                }
            }
        }

        this.broadcastToAll("player_offline", { userId });
        logger.info({ userId }, "User disconnected from WebSocket & removed from presence");
    }

    // Join a battle room channel
    joinRoom(roomId: string, socket: WebSocket): void {
        if (!this.roomSockets.has(roomId)) {
            this.roomSockets.set(roomId, new Set());
        }
        this.roomSockets.get(roomId)!.add(socket);
        logger.debug({ roomId }, "Socket joined room channel");
    }

    // Leave a battle room channel
    leaveRoom(roomId: string, socket: WebSocket): void {
        const sockets = this.roomSockets.get(roomId);
        if (sockets) {
            sockets.delete(socket);
            if (sockets.size === 0) {
                this.roomSockets.delete(roomId);
            }
        }
    }

    // Resolve any socket matching userId, presence username, or platformCode
    private getSocketByIdentifier(identifier: string): { userId: string; socket: WebSocket } | null {
        if (!identifier) return null;

        // 1. Direct match on userSockets map
        const directSocket = this.userSockets.get(identifier);
        if (directSocket && directSocket.readyState === WebSocket.OPEN) {
            return { userId: identifier, socket: directSocket };
        }

        // 2. Fallback match in presenceMap by userId, username, or platformCode
        const searchKey = identifier.toLowerCase();
        for (const [uid, presence] of this.presenceMap.entries()) {
            if (
                uid.toLowerCase() === searchKey ||
                presence.userId.toLowerCase() === searchKey ||
                presence.username?.toLowerCase() === searchKey ||
                presence.platformCode?.toLowerCase() === searchKey
            ) {
                const s = this.userSockets.get(uid);
                if (s && s.readyState === WebSocket.OPEN) {
                    return { userId: uid, socket: s };
                }
            }
        }

        return null;
    }

    // Send an event to a single user
    sendToUser<T>(userId: string, event: string, payload: T): boolean {
        const found = this.getSocketByIdentifier(userId);
        if (found) {
            found.socket.send(JSON.stringify({ event, payload }));
            this.recordBroadcastEvents(1);
            return true;
        }
        return false;
    }

    // Broadcast an event to all participants in a room
    broadcastToRoom<T>(roomId: string, event: string, payload: T, excludeSocket?: WebSocket): void {
        const sockets = this.roomSockets.get(roomId);
        if (!sockets) return;

        let delivered = 0;
        const message = JSON.stringify({ event, payload });
        for (const socket of sockets) {
            if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
                socket.send(message);
                delivered++;
            }
        }
        if (delivered > 0) {
            this.recordBroadcastEvents(delivered);
        }
    }

    // Broadcast an event to all globally connected users
    broadcastToAll<T>(event: string, payload: T, excludeSocket?: WebSocket): void {
        let delivered = 0;
        const message = JSON.stringify({ event, payload });
        for (const socket of this.userSockets.values()) {
            if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
                socket.send(message);
                delivered++;
            }
        }
        if (delivered > 0) {
            this.recordBroadcastEvents(delivered);
        }
    }

    // Check if user is online
    isUserOnline(userId: string): boolean {
        return !!this.getSocketByIdentifier(userId);
    }


    // ============================================
    // Direct Challenge System
    // ============================================

    createChallenge(params: {
        fromUserId: string;
        fromUsername: string;
        fromRating?: number;
        targetUserId: string;
        targetUsername: string;
    }): DirectChallenge | null {
        const { fromUserId, fromUsername, fromRating, targetUserId, targetUsername } = params;

        const resolvedTarget = this.getSocketByIdentifier(targetUserId);
        if (!resolvedTarget) {
            return null;
        }

        const actualTargetUserId = resolvedTarget.userId;
        const challengeId = `chal_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const now = Date.now();
        const challenge: DirectChallenge = {
            challengeId,
            fromUserId,
            fromUsername,
            fromRating: fromRating ?? 0,
            targetUserId: actualTargetUserId,
            targetUsername,
            createdAt: now,
            expiresAt: now + 30000, // 30 seconds expiration
            status: "PENDING",
        };

        this.challenges.set(challengeId, challenge);

        // Auto-expire after 30 seconds
        setTimeout(() => {
            const current = this.challenges.get(challengeId);
            if (current && current.status === "PENDING") {
                current.status = "EXPIRED";
                this.challenges.delete(challengeId);
                this.sendToUser(fromUserId, "challenge_expired", { challengeId });
                this.sendToUser(actualTargetUserId, "challenge_expired", { challengeId });
            }
        }, 30000);

        return challenge;
    }

    getChallenge(challengeId: string): DirectChallenge | undefined {
        return this.challenges.get(challengeId);
    }

    removeChallenge(challengeId: string): boolean {
        return this.challenges.delete(challengeId);
    }
}
