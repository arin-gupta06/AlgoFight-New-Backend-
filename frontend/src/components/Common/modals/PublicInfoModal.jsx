import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faCircleInfo,
  faNewspaper,
  faBriefcase,
  faCircleQuestion,
  faEnvelope,
  faShieldHalved,
  faFileContract
} from '@fortawesome/free-solid-svg-icons';
import logoIcon from '../../../assets/algofight-logo.png';
import AboutContent from '../../About/AboutContent';
import BlogContent from '../../Blog/BlogContent';
import CareersContent from '../../Careers/CareersContent';
import HelpContent from '../../Help/HelpContent';
import ContactContent from '../../Contact/ContactContent';
import PrivacyContent from '../../Legal/PrivacyContent';
import TermsContent from '../../Legal/TermsContent';
import './PublicInfoModal.css';

const TABS_CONFIG = {
  about: {
    id: 'about',
    label: 'About Us',
    group: 'Company',
    icon: faCircleInfo,
    title: 'About AlgoFight'
  },
  blog: {
    id: 'blog',
    label: 'DevLog',
    group: 'Company',
    icon: faNewspaper,
    title: 'Engineering Blog & Updates'
  },
  careers: {
    id: 'careers',
    label: 'Careers',
    group: 'Company',
    icon: faBriefcase,
    title: 'Careers at AlgoFight'
  },
  help: {
    id: 'help',
    label: 'Help Center',
    group: 'Support',
    icon: faCircleQuestion,
    title: 'Help Center & Documentation'
  },
  contact: {
    id: 'contact',
    label: 'Contact Us',
    group: 'Support',
    icon: faEnvelope,
    title: 'Contact Engineering Support'
  },
  privacy: {
    id: 'privacy',
    label: 'Privacy Policy',
    group: 'Support',
    icon: faShieldHalved,
    title: 'Privacy Policy'
  },
  terms: {
    id: 'terms',
    label: 'Terms of Service',
    group: 'Support',
    icon: faFileContract,
    title: 'Terms of Service'
  }
};

export default function PublicInfoModal({
  isOpen,
  onClose,
  activeTab = 'about',
  onSelectTab
}) {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTab = TABS_CONFIG[activeTab] || TABS_CONFIG.about;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutContent isModal={true} onCloseModal={onClose} />;
      case 'blog':
        return <BlogContent isModal={true} />;
      case 'careers':
        return <CareersContent isModal={true} />;
      case 'help':
        return <HelpContent isModal={true} onSelectTab={onSelectTab} />;
      case 'contact':
        return <ContactContent isModal={true} />;
      case 'privacy':
        return <PrivacyContent isModal={true} />;
      case 'terms':
        return <TermsContent isModal={true} />;
      default:
        return <AboutContent isModal={true} onCloseModal={onClose} />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="public-modal-backdrop"
        onClick={handleBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-info-modal-title"
      >
        <motion.div
          className="public-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="public-modal-header">
            <div className="public-modal-brand">
              <img src={logoIcon} alt="AlgoFight Logo" className="public-modal-logo" />
              <div className="public-modal-heading-block">
                <div className="public-modal-kicker">
                  <span className="public-modal-pulse-dot" />
                  SYSTEM TELEMETRY // {currentTab.group.toUpperCase()}
                </div>
                <h2 id="public-info-modal-title" className="public-modal-title-text">
                  ALGO<span>FIGHT</span> // {currentTab.label}
                </h2>
              </div>
            </div>

            <button
              className="public-modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          {/* Cyber Segmented Navigation Switcher */}
          <div className="public-modal-nav-bar" role="tablist">
            <div className="modal-nav-segment">
              <span className="modal-nav-segment-label">COMPANY</span>
              {['about', 'blog', 'careers'].map((tabKey) => {
                const tab = TABS_CONFIG[tabKey];
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    className={`modal-nav-tab ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectTab(tabKey)}
                  >
                    <FontAwesomeIcon icon={tab.icon} className="modal-tab-icon" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="modal-nav-segment">
              <span className="modal-nav-segment-label">SUPPORT</span>
              {['help', 'contact', 'privacy', 'terms'].map((tabKey) => {
                const tab = TABS_CONFIG[tabKey];
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    className={`modal-nav-tab ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectTab(tabKey)}
                  >
                    <FontAwesomeIcon icon={tab.icon} className="modal-tab-icon" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Body Content */}
          <div className="public-modal-body">{renderContent()}</div>

          {/* Modal Footer Status Bar */}
          <div className="public-modal-footer">
            <div className="modal-footer-status">
              <span className="modal-status-indicator" />
              STATUS: PUBLIC ACCESS // ZERO AUTH REQUIRED
            </div>
            <div className="modal-esc-hint">
              Press <span className="kbd-badge">ESC</span> to dismiss
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
