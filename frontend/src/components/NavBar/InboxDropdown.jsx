import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBell,
    faBolt,
    faCheckDouble,
    faCrosshairs,
    faFire,
    faTimes,
    faTrash,
    faTrophy,
    faInfoCircle,
    faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import { getSocket } from '../../services/socket';
import { useNotificationInbox } from '../../contexts/NotificationInboxContext';
import SystemBroadcastCard from '../Common/SystemBroadcastCard.jsx';
import './InboxDropdown.css';

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function getNotificationIcon(type) {
    switch (type) {
        case 'SYSTEM':
            return faBullhorn;
        case 'CHALLENGE':
            return faCrosshairs;
        case 'CHALLENGE_ACCEPTED':
            return faBolt;
        case 'CHALLENGE_DECLINED':
            return faTimes;
        case 'BATTLE_START':
        case 'BATTLE_RESULT':
            return faTrophy;
        default:
            return faInfoCircle;
    }
}

function getNotificationTone(type) {
    switch (type) {
        case 'SYSTEM':
            return 'tone-cyan';
        case 'CHALLENGE':
            return 'tone-cyan';
        case 'CHALLENGE_ACCEPTED':
            return 'tone-green';
        case 'CHALLENGE_DECLINED':
            return 'tone-pink';
        case 'BATTLE_START':
        case 'BATTLE_RESULT':
            return 'tone-gold';
        default:
            return 'tone-cyan';
    }
}

export default function InboxDropdown({ isOpen, onClose }) {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearInbox } = useNotificationInbox();
    const [filter, setFilter] = useState('ALL');

    const handleAcceptChallenge = (e, challengeId, notificationId) => {
        e.stopPropagation();
        const socket = getSocket();
        if (socket) {
            socket.emit("accept_challenge", { challengeId });
        }
        markAsRead(notificationId);
        onClose(); // Optional: close the inbox dropdown when accepting
    };

    const handleDeclineChallenge = (e, challengeId, notificationId) => {
        e.stopPropagation();
        const socket = getSocket();
        if (socket) {
            socket.emit("decline_challenge", { challengeId });
        }
        markAsRead(notificationId);
    };

    if (!isOpen) return null;

    const filteredNotifications = notifications.filter((item) => {
        if (filter === 'UNREAD') return !item.read;
        if (filter === 'SYSTEM') return item.type === 'SYSTEM' || item.metadata?.isBroadcast;
        if (filter === 'CHALLENGES') return item.type && item.type.startsWith('CHALLENGE');
        if (filter === 'BATTLES') return item.type && item.type.startsWith('BATTLE');
        return true;
    });

    return (
        <AnimatePresence>
            <motion.div
                className="inbox-dropdown-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="inbox-dropdown-panel"
                    initial={{ opacity: 0, y: -12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="inbox-panel-header">
                        <div className="inbox-header-title">
                            <FontAwesomeIcon icon={faBell} className="inbox-bell-icon" />
                            <h3>INBOX NOTIFICATIONS</h3>
                            {unreadCount > 0 && <span className="inbox-unread-pill">{unreadCount} UNREAD</span>}
                        </div>

                        <div className="inbox-header-actions">
                            {unreadCount > 0 && (
                                <button
                                    className="inbox-action-btn"
                                    onClick={markAllAsRead}
                                    title="Mark all notifications as read"
                                >
                                    <FontAwesomeIcon icon={faCheckDouble} /> Read All
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    className="inbox-action-btn tone-danger"
                                    onClick={clearInbox}
                                    title="Clear all notifications"
                                >
                                    <FontAwesomeIcon icon={faTrash} /> Clear
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="inbox-filter-bar">
                        <button
                            className={`inbox-filter-chip ${filter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setFilter('ALL')}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            className={`inbox-filter-chip ${filter === 'UNREAD' ? 'active' : ''}`}
                            onClick={() => setFilter('UNREAD')}
                        >
                            Unread ({unreadCount})
                        </button>
                        <button
                            className={`inbox-filter-chip ${filter === 'SYSTEM' ? 'active' : ''}`}
                            onClick={() => setFilter('SYSTEM')}
                        >
                            System
                        </button>
                        <button
                            className={`inbox-filter-chip ${filter === 'CHALLENGES' ? 'active' : ''}`}
                            onClick={() => setFilter('CHALLENGES')}
                        >
                            Challenges
                        </button>
                        <button
                            className={`inbox-filter-chip ${filter === 'BATTLES' ? 'active' : ''}`}
                            onClick={() => setFilter('BATTLES')}
                        >
                            Battles
                        </button>
                    </div>

                    <div className="inbox-notification-list">
                        {filteredNotifications.length === 0 ? (
                            <div className="inbox-empty-state">
                                <FontAwesomeIcon icon={faBell} className="inbox-empty-icon" />
                                <p>No notifications found</p>
                                <span>Your persistent inbox is up to date!</span>
                            </div>
                        ) : (
                            filteredNotifications.map((item) => {
                                const isBroadcast = item.type === 'SYSTEM' || item.metadata?.isBroadcast;

                                if (isBroadcast) {
                                    return (
                                        <div
                                            key={item.id}
                                            className={`inbox-broadcast-wrapper ${!item.read ? 'is-unread' : ''}`}
                                            onClick={() => markAsRead(item.id)}
                                        >
                                            <SystemBroadcastCard
                                                broadcast={{
                                                    id: item.id,
                                                    title: item.title,
                                                    message: item.message,
                                                    type: item.metadata?.broadcastType || 'INFO',
                                                    createdAt: item.createdAt,
                                                    expiresAt: item.metadata?.expiresAt,
                                                    content: item.metadata?.content,
                                                    action: item.metadata?.action,
                                                }}
                                                isUnread={!item.read}
                                                onActionClick={() => {
                                                    markAsRead(item.id);
                                                    onClose();
                                                }}
                                            />
                                        </div>
                                    );
                                }

                                return (
                                    <article
                                        key={item.id}
                                        className={`inbox-item-card ${!item.read ? 'is-unread' : ''}`}
                                        onClick={() => markAsRead(item.id)}
                                    >
                                        <div className={`inbox-item-icon ${getNotificationTone(item.type)}`}>
                                            <FontAwesomeIcon icon={getNotificationIcon(item.type)} />
                                        </div>

                                        <div className="inbox-item-content">
                                            <div className="inbox-item-row">
                                                <h4>{item.title}</h4>
                                                <span className="inbox-item-time">{formatTimeAgo(item.createdAt)}</span>
                                            </div>
                                            <p>{item.message}</p>
                                            
                                            {item.type === 'CHALLENGE' && !item.read && item.metadata?.challengeId && (
                                                <div className="inbox-challenge-actions">
                                                    <button
                                                        className="inbox-action-btn tone-green"
                                                        onClick={(e) => handleAcceptChallenge(e, item.metadata.challengeId, item.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faBolt} /> Accept
                                                    </button>
                                                    <button
                                                        className="inbox-action-btn tone-danger"
                                                        onClick={(e) => handleDeclineChallenge(e, item.metadata.challengeId, item.id)}
                                                    >
                                                        <FontAwesomeIcon icon={faTimes} /> Decline
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!item.read && <span className="inbox-unread-dot" title="Unread notification" />}
                                    </article>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

