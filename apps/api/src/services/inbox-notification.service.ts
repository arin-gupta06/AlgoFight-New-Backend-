import { redisConnection } from "@algofight/queue/src/client/redis";
import { SystemBroadcastService } from "./system-broadcast.service";

export interface InboxNotification {
    id: string;
    userId: string;
    type: "CHALLENGE" | "CHALLENGE_ACCEPTED" | "CHALLENGE_DECLINED" | "BATTLE_START" | "BATTLE_RESULT" | "SYSTEM";
    title: string;
    message: string;
    read: boolean;
    createdAt: number;
    metadata?: Record<string, any>;
}

export class InboxNotificationService {
    private static MAX_ITEMS = 50;

    private static getKey(userId: string): string {
        return `user:notifications:${userId}`;
    }

    private static getReadBroadcastsKey(userId: string): string {
        return `user:broadcasts:read:${userId}`;
    }

    /**
     * Push a new notification to a user's persistent Redis inbox
     */
    static async pushNotification(params: {
        userId: string;
        type: InboxNotification["type"];
        title: string;
        message: string;
        metadata?: Record<string, any>;
    }): Promise<InboxNotification> {
        const { userId, type, title, message, metadata } = params;
        const notification: InboxNotification = {
            id: `notif_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
            userId,
            type,
            title,
            message,
            read: false,
            createdAt: Date.now(),
            metadata: metadata || {},
        };

        const key = this.getKey(userId);
        const serialized = JSON.stringify(notification);

        await redisConnection.lpush(key, serialized);
        await redisConnection.ltrim(key, 0, this.MAX_ITEMS - 1);

        return notification;
    }

    /**
     * Retrieve notifications for a user (combining persistent notifications + active system broadcasts)
     */
    static async getNotifications(userId: string, limit = 50, offset = 0): Promise<{
        notifications: InboxNotification[];
        unreadCount: number;
        total: number;
    }> {
        const key = this.getKey(userId);
        const rawItems = await redisConnection.lrange(key, offset, offset + limit - 1);

        const userNotifications: InboxNotification[] = [];
        let unreadCount = 0;

        for (const raw of rawItems) {
            try {
                const item: InboxNotification = JSON.parse(raw);
                userNotifications.push(item);
                if (!item.read) unreadCount++;
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Dynamically fetch and merge active, non-expired system broadcasts
        let systemInboxItems: InboxNotification[] = [];
        try {
            const activeBroadcasts = await SystemBroadcastService.getActiveBroadcasts();
            const readKey = this.getReadBroadcastsKey(userId);
            const readIds = new Set(await redisConnection.smembers(readKey));

            systemInboxItems = activeBroadcasts.map((b) => {
                const isRead = readIds.has(b.id);
                if (!isRead) unreadCount++;

                return {
                    id: b.id,
                    userId,
                    type: "SYSTEM",
                    title: b.title,
                    message: b.message,
                    read: isRead,
                    createdAt: new Date(b.createdAt).getTime(),
                    metadata: {
                        isBroadcast: true,
                        broadcastType: b.type,
                        flashBanner: b.flashBanner,
                        expiresAt: b.expiresAt,
                        content: b.content,
                        action: b.action,
                    },
                };
            });
        } catch (bErr) {
            // Non-fatal if broadcast service fails
        }

        const totalUserNotifs = await redisConnection.llen(key);
        const mergedNotifications = [...systemInboxItems, ...userNotifications];

        return {
            notifications: mergedNotifications,
            unreadCount,
            total: totalUserNotifs + systemInboxItems.length,
        };
    }

    /**
     * Mark a specific notification as read
     */
    static async markAsRead(userId: string, notificationId: string): Promise<boolean> {
        // Check if this is a system broadcast ID
        const readKey = this.getReadBroadcastsKey(userId);
        await redisConnection.sadd(readKey, notificationId);

        const key = this.getKey(userId);
        const rawItems = await redisConnection.lrange(key, 0, -1);

        let updated = false;
        const newItems: string[] = [];

        for (const raw of rawItems) {
            try {
                const item: InboxNotification = JSON.parse(raw);
                if (item.id === notificationId && !item.read) {
                    item.read = true;
                    updated = true;
                }
                newItems.push(JSON.stringify(item));
            } catch (e) {
                newItems.push(raw);
            }
        }

        if (updated) {
            await redisConnection.del(key);
            if (newItems.length > 0) {
                await redisConnection.rpush(key, ...newItems);
            }
        }

        return true;
    }

    /**
     * Mark all notifications for a user as read
     */
    static async markAllAsRead(userId: string): Promise<number> {
        // Mark all active broadcasts as read for this user
        try {
            const activeBroadcasts = await SystemBroadcastService.getActiveBroadcasts();
            if (activeBroadcasts.length > 0) {
                const readKey = this.getReadBroadcastsKey(userId);
                await redisConnection.sadd(readKey, ...activeBroadcasts.map((b) => b.id));
            }
        } catch (bErr) {}

        const key = this.getKey(userId);
        const rawItems = await redisConnection.lrange(key, 0, -1);

        let count = 0;
        const newItems: string[] = [];

        for (const raw of rawItems) {
            try {
                const item: InboxNotification = JSON.parse(raw);
                if (!item.read) {
                    item.read = true;
                    count++;
                }
                newItems.push(JSON.stringify(item));
            } catch (e) {
                newItems.push(raw);
            }
        }

        if (count > 0) {
            await redisConnection.del(key);
            if (newItems.length > 0) {
                await redisConnection.rpush(key, ...newItems);
            }
        }

        return count;
    }

    /**
     * Clear all inbox notifications for a user
     */
    static async clearNotifications(userId: string): Promise<void> {
        const key = this.getKey(userId);
        await redisConnection.del(key);
    }
}

