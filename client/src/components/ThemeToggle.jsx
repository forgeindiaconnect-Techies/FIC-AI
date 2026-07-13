// client/src/components/ThemeToggle.jsx
import React, { useEffect, useState, useRef } from 'react';

const ThemeToggle = () => {
  const getInitialTheme = () => {
    const stored = localStorage.getItem('fic_theme');
    if (stored) return stored === 'light';
    return false; // Default is dark mode
  };

  const [isLight, setIsLight] = useState(getInitialTheme);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('fic_user_email') || '');
  const [userTier, setUserTier] = useState(localStorage.getItem('fic_user_tier') || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Synchronize theme class on html document and localStorage
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fic_theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('fic_theme', 'dark');
    }
  }, [isLight]);

  // Listen for login/logout/tier state changes across components
  useEffect(() => {
    const handleLoginState = () => {
      setUserEmail(localStorage.getItem('fic_user_email') || '');
      setUserTier(localStorage.getItem('fic_user_tier') || '');
    };
    window.addEventListener('fic_user_login_state_changed', handleLoginState);
    return () => window.removeEventListener('fic_user_login_state_changed', handleLoginState);
  }, []);

  // Listen to external theme toggles (like from sidebar)
  useEffect(() => {
    const handleToggleEvent = (e) => {
      if (e.detail === 'light') {
        setIsLight(true);
      } else if (e.detail === 'dark') {
        setIsLight(false);
      } else {
        setIsLight(prev => !prev);
      }
    };
    window.addEventListener('fic_toggle_theme', handleToggleEvent);
    return () => window.removeEventListener('fic_toggle_theme', handleToggleEvent);
  }, []);

  // Close dropdown on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleToggle = () => {
    setIsLight(prev => !prev);
  };

  const handleLoginRequest = () => {
    window.dispatchEvent(new Event('fic_login_required'));
  };

  const handleLogout = () => {
    localStorage.removeItem('fic_user_email');
    window.dispatchEvent(new Event('fic_user_login_state_changed'));
    setShowDropdown(false);
  };

  const avatarChar = userEmail ? userEmail.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className="theme-toggle-floating-container">
      {/* Theme Toggle Button (Light = 🐘 Elephant, Dark = 💎 Diamond) */}
      <button
        onClick={handleToggle}
        title={isLight ? 'Switch to Dark Mode (Diamond)' : 'Switch to Light Mode (Elephant)'}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1.5px solid var(--border-color)',
          background: 'var(--sidebar-bg)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          color: 'var(--text-color)',
        }}
        aria-label="Toggle Theme"
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.borderColor = 'var(--accent-color)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        {isLight ? '🐘' : '💎'}
      </button>

      {/* Profile/Auth Controller */}
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        {userEmail ? (
          /* Logged In - User Avatar */
          <button
            onClick={() => setShowDropdown(prev => !prev)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '1.5px solid var(--accent-color)',
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124,58,237,0.25)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {avatarChar}
          </button>
        ) : (
          /* Logged Out - Sign In Button */
          <button
            onClick={handleLoginRequest}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1.5px solid var(--border-color)',
              background: 'var(--sidebar-bg)',
              color: 'var(--text-color)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-color)';
              e.currentTarget.style.background = 'var(--accent-color)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.background = 'var(--sidebar-bg)';
              e.currentTarget.style.color = 'var(--text-color)';
            }}
          >
            Sign In
          </button>
        )}

        {/* Dropdown Menu */}
        {showDropdown && userEmail && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              background: 'rgba(15, 18, 28, 0.98)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              width: '240px',
              padding: '16px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'fadeInUp 0.2s ease',
            }}
          >
            {/* User Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
                {userEmail}
              </span>
            </div>

            {/* Custom Theme Badge */}
            <div 
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: userTier === 'pro' 
                  ? 'rgba(124, 58, 237, 0.1)' 
                  : userTier === 'business' 
                    ? 'rgba(245, 158, 11, 0.1)' 
                    : isLight 
                      ? 'rgba(230, 81, 0, 0.1)' 
                      : 'rgba(6, 182, 212, 0.1)',
                border: `1px solid ${
                  userTier === 'pro' 
                    ? 'rgba(124, 58, 237, 0.2)' 
                    : userTier === 'business' 
                      ? 'rgba(245, 158, 11, 0.2)' 
                      : isLight 
                        ? 'rgba(230, 81, 0, 0.2)' 
                        : 'rgba(6, 182, 212, 0.2)'
                }`,
                color: userTier === 'pro' 
                  ? '#a78bfa' 
                  : userTier === 'business' 
                    ? '#F59E0B' 
                    : isLight 
                      ? '#FF8C00' 
                      : '#06B6D4',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{
                userTier === 'pro' 
                  ? '⭐ Pro Tier' 
                  : userTier === 'business' 
                    ? '👑 Business Tier' 
                    : isLight 
                      ? '🐘 Elephant Tier' 
                      : '💎 Diamond Tier'
              }</span>
            </div>

            {/* Admin Dashboard Button - only for admin email */}
            {userEmail === 'forgeindiaconnect0007@gmail.com' && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('fic_navigate_tab', { detail: 'admin' }));
                  setShowDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid rgba(16, 185, 129, 0.3)',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
                  color: '#34d399',
                  fontSize: '11px',
                  fontWeight: 850,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.18) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span>🛡️</span>
                <span>Admin Dashboard</span>
              </button>
            )}

            {/* Upgrade Plan Button */}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('fic_navigate_tab', { detail: 'upgrade' }));
                setShowDropdown(false);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid rgba(124, 58, 237, 0.3)',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
                color: '#a78bfa',
                fontSize: '11px',
                fontWeight: 850,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)';
                e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(124, 58, 237, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)';
                e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span>👑</span>
              <span>Upgrade Plan</span>
            </button>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EF4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = '#EF4444';
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ThemeToggle;
