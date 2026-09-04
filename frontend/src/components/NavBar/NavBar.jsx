import React, { useState } from 'react';
import './NavBar.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
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
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active-link' : '';
  };

  const isAdmin = isAdminUser(user);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/home" className="navbar-brand">
            <img src={logoIcon} alt="AlgoFight Logo" className="brand-logo-img" />
          </Link>

          <div className="navbar-links">
            <ul className="nav-menu">
              <li><Link to="/practice" className={isActive('/practice')}>Practice</Link></li>
              <li><Link to="/battle" className={isActive('/battle')}>Battle</Link></li>
              <li><Link to="/leaderboard" className={isActive('/leaderboard')}>Leaderboard</Link></li>
              <li><Link to="/rewards" className={isActive('/rewards')}>Rewards</Link></li>
              <li><Link to="/about" className={isActive('/about')}>About</Link></li>
              <li><Link to="/developer" className={isActive('/developer')}>Developers</Link></li>
              {isAdmin && (
                <li>
                  <Link to="/admin" className={isActive('/admin')} style={{ color: '#00e5ff' }}>
                    Control Hub
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className='navbar-actions'>
            {user ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <button
                  className={`nav-bell-trigger ${isInboxOpen ? 'is-active' : ''}`}
                  onClick={() => setIsInboxOpen((prev) => !prev)}
                  title="View Persistent Notification Inbox"
                >
                  <FontAwesomeIcon icon={faBell} />
                  {unreadCount > 0 && (
                    <span className="nav-bell-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                <Link
                  to="/profile"
                  className={`nav-profile-circle ${isActive('/profile')}`}
                  title={user.displayName ? `${user.displayName} (${user.email || ''})` : user.email || "Profile"}
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

                <button onClick={handleLogout} className="btn-nav-outline">
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/" className="nav-sign-in">Sign In</Link>
                <Link to="/signup" className="nav-get-started">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <InboxDropdown isOpen={isInboxOpen} onClose={() => setIsInboxOpen(false)} />
    </>
  );
};

export default Navbar;