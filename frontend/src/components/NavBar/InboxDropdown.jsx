import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBell,
    faBolt,
    faCheckDouble,
    faCrosshairs,
    faInfoCircle,
    faTimes,
    faTrash,
    faTrophy,
    faBullhorn,
    faComments,
    faChevronDown,
    faChevronUp,
    faExpand,
    faCompress,
    faTriangleExclamation,
    faWrench,
    faCalendarCheck,
    faArrowRight,
    faArrowUpRightFromSquare,
    faClock,
    faCheckCircle,
    faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import { getSocket } from '../../services/socket';
import { useNotificationInbox } from '../../contexts/NotificationInboxContext';
import FeedbackForm from '../Feedback/FeedbackForm.jsx';
import WhatsAppDocumentPreview from '../Common/broadcasts/WhatsAppDocumentPreview.jsx';
import './InboxDropdown.css';

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
    if (isNaN(timeMs)) return 'Just now';
    const seconds = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
    if (seconds < 45) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timeMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatExpiryDate(exp) {
    if (!exp) return null;
    try {
        const d = new Date(exp);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(exp);
    }
}

function getEmbedVideoUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // YouTube match
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    }

    // Vimeo match
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // Loom match
    const loomMatch = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    if (loomMatch && loomMatch[1]) {
        return `https://www.loom.com/embed/${loomMatch[1]}`;
    }

    return null;
}

function getNotificationDetails(item) {
    const type = item.type || 'INFO';
    const bType = item.metadata?.broadcastType || type;

    switch (type) {
        case 'CHALLENGE':
            return {
                badge: '1V1 CHALLENGE',
                icon: faCrosshairs,
                tone: 'tone-cyan',
            };
        case 'PUBLIC_CHALLENGE':
            return {
                badge: 'OPEN DUEL',
                icon: faCrosshairs,
                tone: 'tone-gold',
            };
        case 'BATTLE_START':
            return {
                badge: 'BATTLE START',
                icon: faBolt,
                tone: 'tone-green',
            };
        case 'BATTLE_RESULT':
            return {
                badge: 'BATTLE RESULT',
                icon: faTrophy,
                tone: 'tone-gold',
            };
        case 'CHALLENGE_ACCEPTED':
            return {
                badge: 'CHALLENGE ACCEPTED',
                icon: faBolt,
                tone: 'tone-green',
            };
        case 'CHALLENGE_DECLINED':
            return {
                badge: 'CHALLENGE DECLINED',
                icon: faTimes,
                tone: 'tone-pink',
            };
        case 'FEEDBACK':
            return {
                badge: 'FEEDBACK & REVIEW',
                icon: faComments,
                tone: 'tone-purple',
            };
        case 'SYSTEM': {
            switch (bType) {
                case 'WARNING':
                    return { badge: 'CRITICAL NOTICE', icon: faTriangleExclamation, tone: 'tone-pink' };
                case 'MAINTENANCE':
                    return { badge: 'MAINTENANCE', icon: faWrench, tone: 'tone-gold' };
                case 'EVENT':
                    return { badge: 'SPECIAL EVENT', icon: faCalendarCheck, tone: 'tone-purple' };
                case 'UPDATE':
                    return { badge: 'SYSTEM UPDATE', icon: faBullhorn, tone: 'tone-green' };
                case 'FEEDBACK':
                    return { badge: 'FEEDBACK & ALPHA', icon: faComments, tone: 'tone-purple' };
                default:
                    return { badge: 'SYSTEM BROADCAST', icon: faBullhorn, tone: 'tone-cyan' };
            }
        }
        default:
            return {
                badge: 'ANNOUNCEMENT',
                icon: faInfoCircle,
                tone: 'tone-cyan',
            };
    }
}

function getNotificationPreview(item) {
    if (item.type === 'CHALLENGE' && item.metadata?.config) {
        const { timeLimitMinutes = 15, difficulty = 'MEDIUM', problemCount = 1 } = item.metadata.config;
        return `⏱️ ${timeLimitMinutes}m · 🎯 ${difficulty} · 📝 ${problemCount} Question${problemCount > 1 ? 's' : ''} — 1v1 Arena Invitation`;
    }
    if (item.type === 'PUBLIC_CHALLENGE' && item.metadata) {
        const { timeLimitMinutes = 15, difficulty = 'MIX', hostRating = 1200 } = item.metadata;
        return `⏱️ ${timeLimitMinutes}m · 🎯 ${difficulty} · 🏆 ${hostRating} ELO — Open duel challenge in arena`;
    }
    if (item.type === 'FEEDBACK') {
        const isSubmitted = typeof window !== 'undefined' && localStorage.getItem('af_feedback_submitted') === 'true';
        return isSubmitted
            ? '✓ Feedback submitted — Thank you for your review!'
            : 'Rate your platform experience and share feature ideas for AlgoFight';
    }
    if (item.message) {
        return item.message;
    }
    return 'Click to view details and actions';
}

export default function InboxDropdown({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearInbox } = useNotificationInbox();
    const [filter, setFilter] = useState('ALL');
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const listRef = useRef(null);
    const initialAutoExpandedRef = useRef(false);

    // Forward mouse wheel events anywhere on panel to notification scroll area
    const handlePanelWheel = (e) => {
        if (listRef.current && !listRef.current.contains(e.target)) {
            listRef.current.scrollTop += e.deltaY;
        }
    };

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Smart default: when dropdown opens, keep everything neat.
    // If only 1 notification exists, expand it.
    // If multiple exist, expand the first unread challenge (if any) and leave others collapsed.
    useEffect(() => {
        if (!isOpen) {
            initialAutoExpandedRef.current = false;
            return;
        }

        if (!initialAutoExpandedRef.current && notifications.length > 0) {
            initialAutoExpandedRef.current = true;
            setExpandedIds((prev) => {
                if (prev.size > 0) return prev;
                const next = new Set();
                if (notifications.length === 1) {
                    next.add(notifications[0].id);
                } else {
                    const firstActive = notifications.find(
                        (n) => (n.type === 'CHALLENGE' || n.type === 'PUBLIC_CHALLENGE') && !n.read
                    );
                    if (firstActive) {
                        next.add(firstActive.id);
                    }
                }
                return next;
            });
        }
    }, [isOpen, notifications]);

    const handleAcceptChallenge = (e, challengeId, notificationId) => {
        e.stopPropagation();
        const socket = getSocket();
        if (socket) {
            socket.emit("accept_challenge", { challengeId });
        }
        markAsRead(notificationId);
        onClose();
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
        return true;
    });

    const isExpanded = (id) => expandedIds.has(id);

    const toggleExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
        markAsRead(id);
    };

    const allExpanded =
        filteredNotifications.length > 0 &&
        filteredNotifications.every((n) => expandedIds.has(n.id));

    const toggleExpandAll = () => {
        if (allExpanded) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(filteredNotifications.map((n) => n.id)));
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="inbox-dropdown-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={onClose}
            >
                <motion.div
                    className="inbox-dropdown-panel"
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    onWheel={handlePanelWheel}
                >
                    {/* Panel Header */}
                    <div className="inbox-panel-header">
                        <div className="inbox-header-title">
                            <div className="inbox-bell-wrap">
                                <FontAwesomeIcon icon={faBell} />
                            </div>
                            <h3>Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="inbox-unread-count-pill">{unreadCount}</span>
                            )}
                        </div>

                        <div className="inbox-header-actions">
                            {filteredNotifications.length > 1 && (
                                <button
                                    type="button"
                                    className="inbox-header-action-btn tone-expand"
                                    onClick={toggleExpandAll}
                                    title={allExpanded ? "Collapse all messages" : "Expand all messages"}
                                >
                                    <FontAwesomeIcon icon={allExpanded ? faCompress : faExpand} />
                                    <span>{allExpanded ? "Collapse" : "Expand"}</span>
                                </button>
                            )}
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    className="inbox-header-action-btn"
                                    onClick={markAllAsRead}
                                    title="Mark all as read"
                                >
                                    <FontAwesomeIcon icon={faCheckDouble} />
                                    <span>Read all</span>
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    type="button"
                                    className="inbox-header-action-btn tone-clear"
                                    onClick={clearInbox}
                                    title="Clear all notifications"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                            <button
                                type="button"
                                className="inbox-close-btn"
                                onClick={onClose}
                                title="Close"
                                aria-label="Close"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    </div>

                    {/* Filter Segmented Control */}
                    <div className="inbox-filter-bar">
                        <button
                            type="button"
                            className={`inbox-filter-tab ${filter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setFilter('ALL')}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            type="button"
                            className={`inbox-filter-tab ${filter === 'UNREAD' ? 'active' : ''}`}
                            onClick={() => setFilter('UNREAD')}
                        >
                            Unread ({unreadCount})
                        </button>
                    </div>

                    {/* Notification Scrollable List */}
                    <div className="inbox-notification-list" ref={listRef}>
                        {filteredNotifications.length === 0 ? (
                            <div className="inbox-empty-state">
                                <div className="inbox-empty-icon-wrap">
                                    <FontAwesomeIcon icon={faBell} />
                                </div>
                                <h4>No notifications</h4>
                                <p>
                                    {filter === 'UNREAD'
                                        ? "You've read all your notifications!"
                                        : "You're all caught up for now."}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map((item) => {
                                const details = getNotificationDetails(item);
                                const expanded = isExpanded(item.id);
                                const isBroadcast = item.type === 'SYSTEM' || item.metadata?.isBroadcast;
                                const isFeedback = item.type === 'FEEDBACK' || item.metadata?.isFeedback;
                                const isSubmitted =
                                    typeof window !== 'undefined' &&
                                    localStorage.getItem('af_feedback_submitted') === 'true';

                                return (
                                    <div
                                        key={item.id}
                                        className={`inbox-item-card ${!item.read ? 'is-unread' : ''} ${expanded ? 'is-expanded' : ''}`}
                                        onClick={() => toggleExpand(item.id)}
                                    >
                                        {/* Card Header: Clickable to toggle expand/collapse */}
                                        <div className="inbox-item-header">
                                            <div className={`inbox-item-icon ${details.tone}`}>
                                                <FontAwesomeIcon icon={details.icon} />
                                            </div>

                                            <div className="inbox-item-header-content">
                                                <div className="inbox-item-meta-row">
                                                    <span className={`inbox-item-badge ${details.tone}`}>
                                                        {details.badge}
                                                    </span>
                                                    {isBroadcast && (
                                                        <span className="inbox-verified-badge">
                                                            <FontAwesomeIcon icon={faShieldHalved} /> OFFICIAL
                                                        </span>
                                                    )}
                                                    {isFeedback && (
                                                        <span className={`inbox-feedback-status-pill ${isSubmitted ? 'is-submitted' : ''}`}>
                                                            {isSubmitted ? '✓ Submitted' : 'Pending'}
                                                        </span>
                                                    )}
                                                    <span className="inbox-item-time">
                                                        {formatTimeAgo(item.createdAt)}
                                                    </span>
                                                </div>

                                                <h4 className="inbox-item-title">{item.title}</h4>

                                                {!expanded && (
                                                    <p className="inbox-item-preview">
                                                        {getNotificationPreview(item)}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="inbox-item-header-actions">
                                                {!item.read && (
                                                    <span className="inbox-unread-dot" title="Unread" />
                                                )}
                                                <button
                                                    type="button"
                                                    className={`inbox-expand-toggle-btn ${expanded ? 'is-open' : ''}`}
                                                    onClick={(e) => toggleExpand(item.id, e)}
                                                    title={expanded ? "Collapse notification" : "Expand notification"}
                                                    aria-label={expanded ? "Collapse" : "Expand"}
                                                >
                                                    <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expandable Body */}
                                        <AnimatePresence initial={false}>
                                            {expanded && (
                                                <motion.div
                                                    key="expandable-body"
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                                    className="inbox-item-expandable-body"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {/* Full Message Text */}
                                                    {item.message && (
                                                        <p className="inbox-item-full-message">{item.message}</p>
                                                    )}

                                                    {/* Direct 1v1 Challenge Details */}
                                                    {item.type === 'CHALLENGE' && item.metadata?.challengeId && (
                                                        <div className="inbox-challenge-box">
                                                            {item.metadata?.config && (
                                                                <div className="inbox-challenge-specs">
                                                                    <span>⏱️ {item.metadata.config.timeLimitMinutes || 15}m</span>
                                                                    <span>🎯 {item.metadata.config.difficulty || "MEDIUM"}</span>
                                                                    <span>📝 {item.metadata.config.problemCount || 1} Question{item.metadata.config.problemCount > 1 ? "s" : ""}</span>
                                                                </div>
                                                            )}
                                                            {!item.read && (
                                                                <div className="inbox-challenge-buttons">
                                                                    <button
                                                                        type="button"
                                                                        className="inbox-btn-accept"
                                                                        onClick={(e) => handleAcceptChallenge(e, item.metadata.challengeId, item.id)}
                                                                    >
                                                                        <FontAwesomeIcon icon={faBolt} /> Accept Challenge
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="inbox-btn-decline"
                                                                        onClick={(e) => handleDeclineChallenge(e, item.metadata.challengeId, item.id)}
                                                                    >
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Open Public Duel Challenge */}
                                                    {item.type === 'PUBLIC_CHALLENGE' && item.metadata?.roomCode && (
                                                        <div className="inbox-challenge-box">
                                                            <div className="inbox-challenge-specs">
                                                                <span>⏱️ {item.metadata.timeLimitMinutes || 15}m</span>
                                                                <span>🎯 {item.metadata.difficulty || "MIX"}</span>
                                                                <span>🏆 {item.metadata.hostRating || 1200} ELO</span>
                                                            </div>
                                                            <div className="inbox-challenge-buttons">
                                                                <button
                                                                    type="button"
                                                                    className="inbox-btn-accept"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        markAsRead(item.id);
                                                                        onClose();
                                                                        navigate(`/battle/room/${item.metadata.roomCode}`);
                                                                    }}
                                                                >
                                                                    <FontAwesomeIcon icon={faBolt} /> Join Duel Arena
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Broadcast Media Attachments & Actions */}
                                                    {isBroadcast && (
                                                        <div className="inbox-broadcast-extras">
                                                            {item.metadata?.content?.url && (
                                                                <div className="inbox-broadcast-media">
                                                                    {item.metadata.content.type === 'IMAGE' && (
                                                                        <div className="inbox-broadcast-image-wrap">
                                                                            <img
                                                                                src={item.metadata.content.url}
                                                                                alt={item.metadata.content.name || 'Broadcast Attachment'}
                                                                                className="inbox-broadcast-img"
                                                                                loading="lazy"
                                                                                onError={(e) => {
                                                                                    e.target.style.display = 'none';
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )}

                                                                    {item.metadata.content.type === 'VIDEO' && (
                                                                        <div className="inbox-broadcast-video-wrap">
                                                                            {(() => {
                                                                                const embed = getEmbedVideoUrl(item.metadata.content.url);
                                                                                if (embed) {
                                                                                    return (
                                                                                        <iframe
                                                                                            src={embed}
                                                                                            title={item.metadata.content.name || 'Broadcast Video Stream'}
                                                                                            className="inbox-broadcast-iframe"
                                                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                            allowFullScreen
                                                                                        />
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <video
                                                                                        src={item.metadata.content.url}
                                                                                        controls
                                                                                        preload="metadata"
                                                                                        className="inbox-broadcast-video-element"
                                                                                    >
                                                                                        Your browser does not support HTML5 video streaming.
                                                                                    </video>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    )}

                                                                    {item.metadata.content.type === 'DOCUMENT' && (
                                                                        <WhatsAppDocumentPreview content={item.metadata.content} />
                                                                    )}
                                                                </div>
                                                            )}

                                                            {item.metadata?.action?.target && (
                                                                <div className="inbox-broadcast-action-row">
                                                                    <button
                                                                        type="button"
                                                                        className="inbox-btn-action"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            markAsRead(item.id);
                                                                            onClose();
                                                                            if (item.metadata.action.type === 'EXTERNAL_LINK') {
                                                                                window.open(item.metadata.action.target, '_blank', 'noopener,noreferrer');
                                                                            } else {
                                                                                navigate(item.metadata.action.target);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <span>{item.metadata.action.label || 'Take Action'}</span>
                                                                        <FontAwesomeIcon
                                                                            icon={item.metadata.action.type === 'EXTERNAL_LINK' ? faArrowUpRightFromSquare : faArrowRight}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {item.metadata?.expiresAt && (
                                                                <div className="inbox-broadcast-expiry">
                                                                    <FontAwesomeIcon icon={faClock} />
                                                                    <span>Active until {formatExpiryDate(item.metadata.expiresAt)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Feedback Form Integration */}
                                                    {isFeedback && (
                                                        <div className="inbox-feedback-section">
                                                            {isSubmitted ? (
                                                                <div className="inbox-feedback-submitted-pill">
                                                                    <FontAwesomeIcon icon={faCheckCircle} />
                                                                    <span>Feedback submitted. Thank you for making AlgoFight better!</span>
                                                                </div>
                                                            ) : (
                                                                <FeedbackForm
                                                                    isCompact
                                                                    onSubmitted={() => {
                                                                        markAsRead(item.id);
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
