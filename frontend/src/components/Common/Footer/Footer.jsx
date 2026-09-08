import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faDiscord, faXTwitter, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faLocationDot, faClock } from '@fortawesome/free-solid-svg-icons';
import logoIcon from '../../../assets/algofight-logo.png';
import PublicInfoModal from '../modals/PublicInfoModal.jsx';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import './Footer.css';

export default function Footer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('about');

  const handleOpenModal = (tabKey) => {
    setActiveModalTab(tabKey);
    setIsModalOpen(true);
  };

  const handlePlatformNav = (path) => {
    if (user) {
      navigate(path);
    } else {
      navigate('/login');
    }
  };

  return (
    <>
      <footer className="page-footer">
        <div className="footer-columns-wrapper">
          {/* Col 1: Brand */}
          <div className="footer-col-brand">
            <div className="footer-crest-mini">
              <img src={logoIcon} alt="AlgoFight Logo" className="footer-logo-img" />
            </div>
            <p className="footer-mission-text">
              AlgoFight is a competitive coding platform built for developers who thrive under pressure and love to dominate.
            </p>
            <div className="footer-social-icons">
              <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub">
                <FontAwesomeIcon icon={faGithub} />
              </a>
              <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord">
                <FontAwesomeIcon icon={faDiscord} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
                <FontAwesomeIcon icon={faXTwitter} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <FontAwesomeIcon icon={faLinkedin} />
              </a>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">PLATFORM</h4>
            <ul className="footer-list">
              <li><a onClick={() => handlePlatformNav('/practice')}>Practice</a></li>
              <li><a onClick={() => handlePlatformNav('/battle')}>Battle</a></li>
              <li><a onClick={() => handlePlatformNav('/leaderboard')}>Leaderboard</a></li>
              <li><a onClick={() => handlePlatformNav('/rewards')}>Rewards</a></li>
            </ul>
          </div>

          {/* Col 3: Company */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">COMPANY</h4>
            <ul className="footer-list">
              <li><a onClick={() => handleOpenModal('about')}>About Us</a></li>
              <li><a onClick={() => handleOpenModal('blog')}>DevLog</a></li>
              <li><a onClick={() => handleOpenModal('careers')}>Careers</a></li>
              <li><a onClick={() => navigate('/developer')}>Developers</a></li>
            </ul>
          </div>

          {/* Col 4: Support */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">SUPPORT</h4>
            <ul className="footer-list">
              <li><a onClick={() => handleOpenModal('help')}>Help Center</a></li>
              <li><a onClick={() => handleOpenModal('contact')}>Contact Us</a></li>
              <li><a onClick={() => handleOpenModal('privacy')}>Privacy Policy</a></li>
              <li><a onClick={() => handleOpenModal('terms')}>Terms of Service</a></li>
            </ul>
          </div>

          {/* Col 5: Get In Touch */}
          <div className="footer-col-links">
            <h4 className="footer-col-title">GET IN TOUCH</h4>
            <ul className="footer-contact-items">
              <li>
                <FontAwesomeIcon icon={faEnvelope} className="c-icon" />
                <a href="mailto:supportalgofight@gmail.com" className="footer-contact-link">supportalgofight@gmail.com</a>
              </li>
              <li>
                <FontAwesomeIcon icon={faLocationDot} className="c-icon" />
                <span>India</span>
              </li>
              <li>
                <FontAwesomeIcon icon={faClock} className="c-icon" />
                <span>Mon - Fri, 10AM - 6PM IST</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-line">
          <span>© {new Date().getFullYear()} AlgoFight. All rights reserved.</span>
          <div className="footer-dev-avatars">
            <a onClick={() => navigate('/developer')} className="dev-avatar-circle dev-a" title="Arin Gupta">A</a>
            <a onClick={() => navigate('/developer')} className="dev-avatar-circle dev-v" title="Vivek Chaurasiya">V</a>
            <a onClick={() => navigate('/developer')} className="dev-avatar-circle dev-k" title="Krish Dargar">K</a>
          </div>
        </div>
      </footer>

      {/* Public Info Overlay Modal */}
      <PublicInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeTab={activeModalTab}
        onSelectTab={setActiveModalTab}
      />
    </>
  );
}
