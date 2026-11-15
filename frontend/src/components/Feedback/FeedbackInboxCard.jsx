import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faStar, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import FeedbackForm from './FeedbackForm';
import './FeedbackInboxCard.css';

export default function FeedbackInboxCard({ item, onCompleted, defaultExpanded = false }) {
    const isAlreadySubmitted = localStorage.getItem('af_feedback_submitted') === 'true';
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <article className={`inbox-feedback-card ${!item.read ? 'is-unread' : ''}`}>
            <div className="inbox-feedback-header" onClick={() => setIsExpanded((prev) => !prev)}>
                <div className="inbox-feedback-icon-wrap">
                    <FontAwesomeIcon icon={faCommentDots} />
                </div>

                <div className="inbox-feedback-meta">
                    <div className="inbox-feedback-tag-row">
                        <span className="inbox-feedback-badge">FEEDBACK & REVIEW</span>
                        <span className="inbox-feedback-status">
                            {isAlreadySubmitted ? '✓ Submitted' : 'Pending Review'}
                        </span>
                    </div>
                    <h4 className="inbox-feedback-title">{item.title || 'Platform Feedback & Suggestions'}</h4>
                    <p className="inbox-feedback-desc">
                        {item.message || 'Rate your AlgoFight experience and share features or improvements you want to see.'}
                    </p>
                </div>

                <button
                    type="button"
                    className="inbox-feedback-toggle-btn"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                </button>
            </div>

            {isExpanded && (
                <div className="inbox-feedback-form-wrapper">
                    <FeedbackForm
                        isCompact
                        onSubmitted={(data) => {
                            if (onCompleted) {
                                onCompleted(item.id, data);
                            }
                        }}
                    />
                </div>
            )}
        </article>
    );
}
