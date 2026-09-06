import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faXmark,
  faArrowUpRightFromSquare,
  faArrowRight,
  faCommentDots,
  faTriangleExclamation,
  faCircleInfo,
  faWrench,
  faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons';
import { fetchActiveSystemAnnouncements } from '../../../services/api';
import { getSocket } from '../../../services/socket';
import './SystemBroadcastBanner.css';

export default function SystemBroadcastBanner() {
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  const syncActiveBroadcast = useCallback(async () => {
    try {
      const data = await fetchActiveSystemAnnouncements();
      const list = data?.broadcasts || [];
      const now = Date.now();

      // Find the latest active announcement with flashBanner = true and not expired
      const valid = list.find(
        (b) => b.flashBanner && new Date(b.expiresAt).getTime() > now
      );

      if (valid) {
        const dismissed = sessionStorage.getItem(`af_dismissed_broadcast_${valid.id}`);
        if (!dismissed) {
          setActiveBroadcast(valid);
          setIsDismissed(false);

          // Schedule auto-expiry timer
          const remainingMs = new Date(valid.expiresAt).getTime() - now;
          if (remainingMs > 0 && remainingMs < 2147483647) {
            const timer = setTimeout(() => {
              setActiveBroadcast(null);
            }, remainingMs);
            return () => clearTimeout(timer);
          }
        }
      } else {
        setActiveBroadcast(null);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    syncActiveBroadcast();

    // Periodic client-side expiry check every 10 seconds
    const interval = setInterval(syncActiveBroadcast, 10000);

    // Live WebSocket listener
    const socket = getSocket();
    const handleBroadcastAnnouncement = (newBroadcast) => {
      if (newBroadcast?.flashBanner && new Date(newBroadcast.expiresAt).getTime() > Date.now()) {
        const dismissed = sessionStorage.getItem(`af_dismissed_broadcast_${newBroadcast.id}`);
        if (!dismissed) {
          setActiveBroadcast(newBroadcast);
          setIsDismissed(false);
        }
      }
    };

    const handleBroadcastRevoked = ({ broadcastId }) => {
      setActiveBroadcast((current) => (current?.id === broadcastId ? null : current));
    };

    if (socket) {
      socket.on('system_broadcast_announcement', handleBroadcastAnnouncement);
      socket.on('system_broadcast_revoked', handleBroadcastRevoked);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('system_broadcast_announcement', handleBroadcastAnnouncement);
        socket.off('system_broadcast_revoked', handleBroadcastRevoked);
      }
    };
  }, [syncActiveBroadcast]);

  if (!activeBroadcast || isDismissed) return null;

  const now = Date.now();
  const isExpired = new Date(activeBroadcast.expiresAt).getTime() <= now;
  if (isExpired) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    setIsDismissed(true);
    if (activeBroadcast?.id) {
      sessionStorage.setItem(`af_dismissed_broadcast_${activeBroadcast.id}`, 'true');
    }
  };

  const handleAction = (e) => {
    e.stopPropagation();
    if (!activeBroadcast.action?.target) return;

    if (activeBroadcast.action.type === 'EXTERNAL_LINK') {
      window.open(activeBroadcast.action.target, '_blank', 'noopener,noreferrer');
    } else {
      navigate(activeBroadcast.action.target);
    }
  };

  const getIcon = (bType) => {
    switch (bType) {
      case 'WARNING':
        return faTriangleExclamation;
      case 'FEEDBACK':
        return faCommentDots;
      case 'MAINTENANCE':
        return faWrench;
      case 'EVENT':
        return faCalendarCheck;
      default:
        return faBolt;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`system-flash-banner-wrapper type-${(activeBroadcast.type || 'INFO').toLowerCase()}`}
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -25 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flash-banner-inner">
          <div className="flash-banner-badge">
            <FontAwesomeIcon icon={getIcon(activeBroadcast.type)} className="banner-icon-pulse" />
            <span>{activeBroadcast.type || 'SYSTEM'}</span>
          </div>

          <div className="flash-banner-text-content">
            <strong className="flash-banner-title">{activeBroadcast.title}:</strong>
            <span className="flash-banner-message">{activeBroadcast.message}</span>
          </div>

          {activeBroadcast.action?.target && (
            <button
              type="button"
              className={`flash-banner-action-btn ${activeBroadcast.action.type === 'EXTERNAL_LINK' ? 'btn-ext' : 'btn-int'}`}
              onClick={handleAction}
            >
              <span>{activeBroadcast.action.label || 'Learn More'}</span>
              <FontAwesomeIcon
                icon={activeBroadcast.action.type === 'EXTERNAL_LINK' ? faArrowUpRightFromSquare : faArrowRight}
                className="btn-icon-tiny"
              />
            </button>
          )}

          <button
            type="button"
            className="flash-banner-close-btn"
            onClick={handleDismiss}
            aria-label="Dismiss Announcement"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
