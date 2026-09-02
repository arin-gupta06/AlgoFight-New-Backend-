import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faTriangleExclamation,
  faCircleInfo,
  faCommentDots,
  faWrench,
  faCalendarCheck,
  faArrowUpRightFromSquare,
  faArrowRight,
  faFileLines,
  faClock,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons';
import './SystemBroadcastCard.css';

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

export default function SystemBroadcastCard({ broadcast, isPreview = false, isUnread = false, onActionClick }) {
  const navigate = useNavigate();

  if (!broadcast) return null;

  const {
    title = 'System Announcement',
    message = '',
    type = 'INFO',
    createdAt,
    expiresAt,
    content,
    action,
  } = broadcast;

  // Format type icon and colors
  const getTypeBadge = (bType) => {
    switch (bType) {
      case 'WARNING':
        return { label: 'CRITICAL NOTICE', icon: faTriangleExclamation, className: 'badge-warning' };
      case 'FEEDBACK':
        return { label: 'FEEDBACK & ALPHA', icon: faCommentDots, className: 'badge-feedback' };
      case 'MAINTENANCE':
        return { label: 'MAINTENANCE', icon: faWrench, className: 'badge-maintenance' };
      case 'EVENT':
        return { label: 'SPECIAL EVENT', icon: faCalendarCheck, className: 'badge-event' };
      case 'UPDATE':
        return { label: 'SYSTEM UPDATE', icon: faBullhorn, className: 'badge-update' };
      case 'INFO':
      default:
        return { label: 'SYSTEM BROADCAST', icon: faCircleInfo, className: 'badge-info' };
    }
  };

  const badgeInfo = getTypeBadge(type);

  // Format expiry date
  const formatExpiry = (exp) => {
    if (!exp) return null;
    try {
      const date = new Date(exp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(exp);
    }
  };

  const handleAction = (e) => {
    e.stopPropagation();
    if (onActionClick) onActionClick(action);

    if (isPreview || !action?.target) return;

    if (action.type === 'EXTERNAL_LINK') {
      window.open(action.target, '_blank', 'noopener,noreferrer');
    } else {
      navigate(action.target);
    }
  };

  return (
    <div className={`system-broadcast-card type-${(type || 'INFO').toLowerCase()} ${isUnread ? 'card-unread' : ''}`}>
      {/* Top Header Bar */}
      <div className="broadcast-card-header">
        <div className="broadcast-header-left">
          <div className={`broadcast-type-pill ${badgeInfo.className}`}>
            <FontAwesomeIcon icon={badgeInfo.icon} className="badge-icon" />
            <span>{badgeInfo.label}</span>
          </div>
          {isUnread && <span className="broadcast-new-pill">NEW</span>}
        </div>
        <div className="broadcast-verified-tag">
          <FontAwesomeIcon icon={faShieldHalved} className="verified-icon" />
          <span>OFFICIAL</span>
        </div>
      </div>

      {/* Title */}
      <h4 className="broadcast-card-title">{title}</h4>

      {/* Message Body */}
      <div className="broadcast-card-message">{message}</div>

      {/* Optional Media Content */}
      {content?.url && (
        <div className="broadcast-media-container">
          {content.type === 'IMAGE' && (
            <div className="broadcast-image-wrapper">
              <img
                src={content.url}
                alt={content.name || 'Broadcast Attachment'}
                className="broadcast-image-element"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {content.type === 'VIDEO' && (
            <div className="broadcast-video-wrapper">
              {(() => {
                const embed = getEmbedVideoUrl(content.url);
                if (embed) {
                  return (
                    <iframe
                      src={embed}
                      title={content.name || 'Broadcast Video Stream'}
                      className="broadcast-video-iframe"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <video
                    src={content.url}
                    controls
                    preload="metadata"
                    className="broadcast-video-element"
                  >
                    Your browser does not support HTML5 video streaming.
                  </video>
                );
              })()}
            </div>
          )}

          {content.type === 'DOCUMENT' && (
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              download={content.url.startsWith('data:') ? (content.name || 'document') : undefined}
              className="broadcast-doc-link"
            >
              <FontAwesomeIcon icon={faFileLines} className="doc-icon" />
              <div className="doc-meta">
                <span className="doc-name">{content.name || 'System Document Attachment'}</span>
                {content.size && (
                  <span className="doc-size">({(content.size / 1024).toFixed(1)} KB)</span>
                )}
              </div>
              <span className="doc-action-text">
                {content.url.startsWith('data:') ? 'Download Document' : 'View Document'}
              </span>
            </a>
          )}
        </div>
      )}

      {/* Optional Interactive Action Button */}
      {action?.target && (
        <div className="broadcast-action-container">
          <button
            type="button"
            className={`broadcast-action-btn ${action.type === 'EXTERNAL_LINK' ? 'btn-external' : 'btn-internal'}`}
            onClick={handleAction}
          >
            <span>{action.label || 'Take Action'}</span>
            <FontAwesomeIcon
              icon={action.type === 'EXTERNAL_LINK' ? faArrowUpRightFromSquare : faArrowRight}
              className="action-btn-icon"
            />
          </button>
        </div>
      )}

      {/* Expiry / Timestamp Footer */}
      <div className="broadcast-card-footer">
        {expiresAt && (
          <div className="broadcast-expiry-tag">
            <FontAwesomeIcon icon={faClock} className="clock-icon" />
            <span>Active until {formatExpiry(expiresAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
