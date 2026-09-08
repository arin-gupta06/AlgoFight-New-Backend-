import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './NavBar.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBars, faTimes, faRightFromBracket, faShieldHalved, faUser, faChevronDown, faInfoCircle, faCode, faCompass } from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationInbox } from '../../contexts/NotificationInboxContext';
import { isAdminUser } from '../../constants/admins';
import InboxDropdown from './InboxDropdown';
import logoIcon from '../../assets/algofight-logo.png';

const getInitials = (user) => {
  if (!user) return 'U';
  const name = user.displayName?.trim() || user.email?.split('@')[0] || 'User';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate("/");
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active-link' : '';
  };

  const isExploreActive = ['/about', '/developer', '/admin'].includes(location.pathname);
  const isAdmin = isAdminUser(user);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Brand Logo */}
          <Link to="/home" className="navbar-brand">
            <img src={logoIcon} alt="AlgoFight Logo" className="brand-logo-img" />
          </Link>

          {/* Streamlined Desktop Navigation Links */}
          <div className="navbar-links desktop-links">
            <ul className="nav-menu">
              <li><Link to="/battle" className={`nav-link-pill ${isActive('/battle')}`}>Battle</Link></li>
              <li><Link to="/practice" className={`nav-link-pill ${isActive('/practice')}`}>Practice</Link></li>
              <li><Link to="/leaderboard" className={`nav-link-pill ${isActive('/leaderboard')}`}>Leaderboard</Link></li>
              <li><Link to="/rewards" className={`nav-link-pill ${isActive('/rewards')}`}>Rewards</Link></li>
              <li
                className="nav-explore-wrapper"
                onMouseEnter={() => setIsMoreOpen(true)}
                onMouseLeave={() => setIsMoreOpen(false)}
              >
                <button
                  className={`nav-link-pill nav-explore-btn ${isExploreActive ? 'active-link' : ''}`}
                  onClick={() => setIsMoreOpen((prev) => !prev)}
                >
                  <span>Explore</span>
                  <FontAwesomeIcon icon={faChevronDown} className={`explore-arrow ${isMoreOpen ? 'open' : ''}`} />
                </button>

                <AnimatePresence>
                  {isMoreOpen && (
                    <motion.div
                      className="explore-dropdown-menu"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <Link to="/about" className={`explore-item ${isActive('/about')}`}>
                        <FontAwesomeIcon icon={faInfoCircle} className="explore-icon" />
                        <span>About</span>
                      </Link>
                      <Link to="/developer" className={`explore-item ${isActive('/developer')}`}>
                        <FontAwesomeIcon icon={faCode} className="explore-icon" />
                        <span>Developers</span>
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" className={`explore-item admin-item ${isActive('/admin')}`}>
                          <FontAwesomeIcon icon={faShieldHalved} className="explore-icon admin-icon" />
                          <span>Control Hub</span>
                        </Link>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            </ul>
          </div>

          {/* Right Action Items */}
          <div className="navbar-actions">
            {user ? (
              <div className="user-action-group">
                {/* Notification Bell */}
                <button
                  className={`nav-bell-trigger ${isInboxOpen ? 'is-active' : ''}`}
                  onClick={() => setIsInboxOpen((prev) => !prev)}
                  title="Notifications Inbox"
                  aria-label="Notifications"
                >
                  <FontAwesomeIcon icon={faBell} />
                  {unreadCount > 0 && (
                    <span className="nav-bell-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Profile Circle */}
                <Link
                  to="/profile"
                  className={`nav-profile-circle ${isActive('/profile')}`}
                  title={user.displayName || user.email || "Profile"}
                  aria-label="User Profile"
                >
                  {user.photoURL && !avatarError ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User Avatar"}
                      className="nav-profile-avatar-img"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="nav-profile-initials">
                      {getInitials(user)}
                    </span>
                  )}
                  <span className="nav-profile-status-dot" title="Online" />
                </Link>

                {/* Desktop Logout Button */}
                <button onClick={handleLogout} className="btn-nav-outline desktop-only" title="Logout">
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-buttons desktop-only">
                <Link to="/login" className="nav-sign-in">Sign In</Link>
                <Link to="/signup" className="nav-get-started">Get Started</Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              <FontAwesomeIcon icon={isMobileMenuOpen ? faTimes : faBars} />
            </button>
          </div>
        </div>

        {/* Mobile Full-Screen / Drawer Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              className="mobile-menu-drawer"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <ul className="mobile-nav-list">
                <li><Link to="/practice" className={isActive('/practice')}>Practice</Link></li>
                <li><Link to="/battle" className={isActive('/battle')}>Battle</Link></li>
                <li><Link to="/leaderboard" className={isActive('/leaderboard')}>Leaderboard</Link></li>
                <li><Link to="/rewards" className={isActive('/rewards')}>Rewards</Link></li>
                <li><Link to="/about" className={isActive('/about')}>About</Link></li>
                <li><Link to="/developer" className={isActive('/developer')}>Developers</Link></li>
                {isAdmin && (
                  <li>
                    <Link to="/admin" className={`mobile-admin-link ${isActive('/admin')}`}>
                      <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '8px' }} />
                      Control Hub
                    </Link>
                  </li>
                )}
              </ul>

              <div className="mobile-drawer-footer">
                {user ? (
                  <div className="mobile-user-profile-bar">
                    <div className="mobile-user-info">
                      <Link to="/profile" className="mobile-avatar-link">
                        {user.photoURL && !avatarError ? (
                          <img src={user.photoURL} alt="Avatar" className="mobile-avatar-img" />
                        ) : (
                          <div className="mobile-avatar-placeholder">{getInitials(user)}</div>
                        )}
                      </Link>
                      <div className="mobile-user-text">
                        <span className="mobile-user-name">{user.displayName || 'Combatant'}</span>
                        <span className="mobile-user-email">{user.email}</span>
                      </div>
                    </div>
                    <button onClick={handleLogout} className="mobile-logout-btn">
                      <FontAwesomeIcon icon={faRightFromBracket} /> Logout
                    </button>
                  </div>
                ) : (
                  <div className="mobile-auth-actions">
                    <Link to="/login" className="mobile-btn-signin">Sign In</Link>
                    <Link to="/signup" className="mobile-btn-signup">Get Started</Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Persistent Notification Inbox Modal */}
      <InboxDropdown isOpen={isInboxOpen} onClose={() => setIsInboxOpen(false)} />
    </>
  );
};

export default Navbar;