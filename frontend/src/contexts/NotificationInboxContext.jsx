import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    fetchUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearUserNotifications,
} from '../services/api';
import { connectSocket } from '../services/socket';

const NotificationInboxContext = createContext();

export function NotificationInboxProvider({ children }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const userId = user?.uid || user?.email;

    const fetchInbox = useCallback(async () => {
        if (!userId) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        setIsLoading(true);
        try {
            const data = await fetchUserNotifications(userId);
            const rawList = data?.notifications || [];
            const now = Date.now();

            // Filter out any expired broadcast items
            const activeList = rawList.filter((n) => {
                if (n.metadata?.expiresAt) {
                    return new Date(n.metadata.expiresAt).getTime() > now;
                }
                return true;
            });

            // Calculate active unread count
            const validUnread = activeList.filter((n) => !n.read).length;

            setNotifications(activeList);
            setUnreadCount(validUnread);
        } catch (err) {
            console.error("Failed to load notification inbox:", err);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Initial load on user login
    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    // Periodic 10s auto-expiry pruning timer for client-side instant cleanup
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setNotifications((prev) => {
                const filtered = prev.filter((n) => {
                    if (n.metadata?.expiresAt) {
                        return new Date(n.metadata.expiresAt).getTime() > now;
                    }
                    return true;
                });
                if (filtered.length !== prev.length) {
                    setUnreadCount(filtered.filter((n) => !n.read).length);
                    return filtered;
                }
                return prev;
            });
        }, 10000);

        return () => clearInterval(timer);
    }, []);

    // Live WebSocket inbox event sync
    useEffect(() => {
        if (!user) return;

        let active = true;

        const setupSocket = async () => {
            const token = await user.getIdToken().catch(() => null);
            if (!active) return;

            const currentUserId = user?.uid || user?.email || "Guest";
            const currentUsername = user?.displayName || user?.email?.split("@")[0] || "Player";
            const socket = connectSocket(token, currentUserId, currentUsername);

            const handleInboxNotification = (newNotif) => {
                const now = Date.now();
                if (newNotif.metadata?.expiresAt && new Date(newNotif.metadata.expiresAt).getTime() <= now) {
                    return; // Ignore expired
                }

                setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
                setUnreadCount((prev) => prev + 1);
            };

            const handleBroadcastAnnouncement = (broadcast) => {
                const now = Date.now();
                if (broadcast.expiresAt && new Date(broadcast.expiresAt).getTime() <= now) {
                    return;
                }

                const notifItem = {
                    id: broadcast.id,
                    userId: currentUserId,
                    type: "SYSTEM",
                    title: broadcast.title,
                    message: broadcast.message,
                    read: false,
                    createdAt: Date.now(),
                    metadata: {
                        isBroadcast: true,
                        broadcastType: broadcast.type,
                        flashBanner: broadcast.flashBanner,
                        expiresAt: broadcast.expiresAt,
                        content: broadcast.content,
                        action: broadcast.action,
                    },
                };

                setNotifications((prev) => [notifItem, ...prev.filter((n) => n.id !== broadcast.id)]);
                setUnreadCount((prev) => prev + 1);
            };

            const handleBroadcastRevoked = ({ broadcastId }) => {
                setNotifications((prev) => {
                    const filtered = prev.filter((n) => n.id !== broadcastId);
                    setUnreadCount(filtered.filter((n) => !n.read).length);
                    return filtered;
                });
            };

            socket.on("inbox_notification", handleInboxNotification);
            socket.on("system_broadcast_announcement", handleBroadcastAnnouncement);
            socket.on("system_broadcast_revoked", handleBroadcastRevoked);

            return () => {
                socket.off("inbox_notification", handleInboxNotification);
                socket.off("system_broadcast_announcement", handleBroadcastAnnouncement);
                socket.off("system_broadcast_revoked", handleBroadcastRevoked);
            };
        };

        const cleanupPromise = setupSocket();

        return () => {
            active = false;
            cleanupPromise.then((cleanup) => {
                if (typeof cleanup === "function") cleanup();
            });
        };
    }, [user]);

    const markAsRead = async (notificationId) => {
        if (!userId || !notificationId) return;

        // Optimistic UI update
        setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            await markNotificationAsRead(userId, notificationId);
        } catch (err) {
            console.error("Failed to mark notification read:", err);
            fetchInbox(); // Re-sync on failure
        }
    };

    const markAllAsRead = async () => {
        if (!userId) return;

        // Optimistic UI update
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);

        try {
            await markAllNotificationsAsRead(userId);
        } catch (err) {
            console.error("Failed to mark all notifications read:", err);
            fetchInbox();
        }
    };

    const clearInbox = async () => {
        if (!userId) return;

        setNotifications([]);
        setUnreadCount(0);

        try {
            await clearUserNotifications(userId);
        } catch (err) {
            console.error("Failed to clear inbox:", err);
            fetchInbox();
        }
    };

    return (
        <NotificationInboxContext.Provider
            value={{
                notifications,
                unreadCount,
                isLoading,
                fetchInbox,
                markAsRead,
                markAllAsRead,
                clearInbox,
            }}
        >
            {children}
        </NotificationInboxContext.Provider>
    );
}

export function useNotificationInbox() {
    const context = useContext(NotificationInboxContext);
    if (!context) {
        throw new Error("useNotificationInbox must be used within a NotificationInboxProvider");
    }
    return context;
}
