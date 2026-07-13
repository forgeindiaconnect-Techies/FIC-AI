import React, { useState, useEffect } from 'react';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import PosterGenerator from './components/PosterGenerator';
import DocumentGenerator from './components/DocumentGenerator';
import axios from 'axios';
import VideoGenerator from './components/VideoGenerator';
import ThemeToggle from './components/ThemeToggle';
import VoiceSuite from './components/VoiceSuite';
import ResumeBuilder from './components/ResumeBuilder';
import UpgradePlan from './components/UpgradePlan';
import AdminDashboard from './components/AdminDashboard';

import { API_BASE_URL as API_URL } from './config/api';

function App() {
  const [chats, setChats] = useState([]);
  const [chatsAvailable, setChatsAvailable] = useState(true);
  const [activeChatId, setActiveChatId] = useState(() => {
    return localStorage.getItem('fic_active_chat_id') || null;
  });
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('fic_user_email') || '');
  const [currentTab, setCurrentTab] = useState('chat');
  const [imageHistory, setImageHistory] = useState([]);
  const [posterHistory, setPosterHistory] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Splash Screen animation states
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);

  // Auth/Login Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [pendingCallback, setPendingCallback] = useState(null);
  const [loginError, setLoginError] = useState('');

  // Splash screen transition timer
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFade(true), 3000);
    const removeTimer = setTimeout(() => setShowSplash(false), 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Handle global login trigger event and login state sync
  useEffect(() => {
    const handleLoginRequired = (e) => {
      setShowLoginModal(true);
      if (e.detail?.callback) {
        setPendingCallback(() => e.detail.callback);
      } else {
        setPendingCallback(null);
      }
    };
    const handleNavigateTab = (e) => {
      if (e.detail) {
        setCurrentTab(e.detail);
      }
    };
    const handleLoginStateChanged = () => {
      const email = localStorage.getItem('fic_user_email') || '';
      setUserEmail(email);
      if (email === 'forgeindiaconnect0007@gmail.com') {
        setCurrentTab('admin');
      } else if (!email && currentTab === 'admin') {
        setCurrentTab('chat');
      }
    };

    window.addEventListener('fic_login_required', handleLoginRequired);
    window.addEventListener('fic_navigate_tab', handleNavigateTab);
    window.addEventListener('fic_user_login_state_changed', handleLoginStateChanged);

    // Initial check in case user was already logged in as admin
    if (userEmail === 'forgeindiaconnect0007@gmail.com' && currentTab === 'chat') {
      setCurrentTab('admin');
    }

    return () => {
      window.removeEventListener('fic_login_required', handleLoginRequired);
      window.removeEventListener('fic_navigate_tab', handleNavigateTab);
      window.removeEventListener('fic_user_login_state_changed', handleLoginStateChanged);
    };
  }, [userEmail, currentTab]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email) {
      setLoginError('Email is required');
      return;
    }
    // Simple email regex validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      setLoginError('Please enter a valid email address');
      return;
    }

    localStorage.setItem('fic_user_email', email);
    window.dispatchEvent(new Event('fic_user_login_state_changed'));

    setShowLoginModal(false);
    setEmailInput('');
    setLoginError('');

    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem('fic_active_chat_id', activeChatId);
    } else {
      localStorage.removeItem('fic_active_chat_id');
    }
  }, [activeChatId]);

  // Sync plan state from MongoDB on startup or email change
  useEffect(() => {
    if (!userEmail) return;
    axios.get(`${API_URL}/api/user/status?email=${encodeURIComponent(userEmail)}`)
      .then(res => {
        if (res.data?.success && res.data.plan) {
          localStorage.setItem('fic_user_tier', res.data.plan);
          window.dispatchEvent(new Event('fic_user_login_state_changed'));
        }
      })
      .catch(err => console.error('[App] Failed to sync user plan from DB:', err.message));
  }, [userEmail]);

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/chats`);
      const chatsData = res.data?.chats ?? [];
      setChats(Array.isArray(chatsData) ? chatsData : []);
      setChatsAvailable(true);
    } catch (err) {
      console.error('[App] Failed to fetch chats from /api/chats:', err.message);
      setChats([]);
      if (err.response && err.response.status === 404) {
        setChatsAvailable(false);
      }
    }
  };

  useEffect(() => {
    fetchChats();
    const savedImg = localStorage.getItem('fic_image_history');
    if (savedImg) { try { setImageHistory(JSON.parse(savedImg)); } catch (e) {} }
    // Poster history combines both AI poster and editor histories
    const loadPosterHistory = () => {
      const ai = localStorage.getItem('fic_poster_history');
      const ed = localStorage.getItem('fic_poster_editor_history');
      const aiList = ai ? JSON.parse(ai) : [];
      const edList = ed ? JSON.parse(ed) : [];
      setPosterHistory([...edList, ...aiList].slice(0, 30));
    };
    loadPosterHistory();

    const syncImg = () => {
      const s = localStorage.getItem('fic_image_history');
      if (s) { try { setImageHistory(JSON.parse(s)); } catch (e) {} }
    };
    const syncPoster = () => loadPosterHistory();

    window.addEventListener('fic_image_history_updated', syncImg);
    window.addEventListener('fic_poster_history_updated', syncPoster);
    return () => {
      window.removeEventListener('fic_image_history_updated', syncImg);
      window.removeEventListener('fic_poster_history_updated', syncPoster);
    };
  }, []);

  const handleDeleteChat = async (chatId) => {
    if (!chatsAvailable) {
      if (activeChatId === chatId) setActiveChatId(null);
      return;
    }
    try {
      await axios.delete(`${API_URL}/api/chats/${chatId}`);
      // Remove deleted chat from local state
      setChats(prev => (Array.isArray(prev) ? prev : []).filter(c => c.chatId !== chatId));
      // Clear active chat if it was the one removed
      if (activeChatId === chatId) setActiveChatId(null);
    } catch (err) {
      console.error('[App] Failed to delete chat at /api/chats/' + chatId + ':', err.message);
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setCurrentTab('chat');
  };

  const handleSidebarImageUpload = (base64Url) => {
    const saved = localStorage.getItem('fic_image_history');
    const list = saved ? JSON.parse(saved) : [];
    const newItem = { id: `img-${Date.now()}`, url: base64Url, prompt: 'Uploaded Asset', timestamp: Date.now() };
    const updated = [newItem, ...list];
    localStorage.setItem('fic_image_history', JSON.stringify(updated));
    setImageHistory(updated);
    window.dispatchEvent(new Event('fic_image_history_updated'));
    window.dispatchEvent(new CustomEvent('fic_load_image_history', { detail: newItem }));
  };

  const handleSelectImageItem = (item) => window.dispatchEvent(new CustomEvent('fic_load_image_history', { detail: item }));
  const handleSelectPosterItem = (item) => {
    setCurrentTab('poster');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('fic_load_poster_history', { detail: item }));
    }, 150);
  };

  const handleDeleteImageItem = (id) => {
    const saved = localStorage.getItem('fic_image_history');
    if (!saved) return;
    const updated = JSON.parse(saved).filter(i => i.id !== id);
    localStorage.setItem('fic_image_history', JSON.stringify(updated));
    setImageHistory(updated);
    window.dispatchEvent(new Event('fic_image_history_updated'));
  };

  const handleDeletePosterItem = (id) => {
    // Try both storages
    ['fic_poster_history', 'fic_poster_editor_history'].forEach(key => {
      const saved = localStorage.getItem(key);
      if (saved) {
        const updated = JSON.parse(saved).filter(i => i.id !== id);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    });
    window.dispatchEvent(new Event('fic_poster_history_updated'));
  };

  // Helper to render the main content based on currentTab
  const renderContent = () => {
    switch (currentTab) {
      case 'chat':
        return <Chat activeChatId={activeChatId} setActiveChatId={setActiveChatId} onNewMessageSaved={fetchChats} chatsAvailable={chatsAvailable} setCurrentTab={setCurrentTab} chats={chats} />;
      case 'image':
        return <ImageGenerator setCurrentTab={setCurrentTab} />;
      case 'editor':
        return <ImageEditor />;
      case 'docs':
        return <DocumentGenerator />;
      case 'video':
        return <VideoGenerator />;
      case 'voice':
        return <VoiceSuite />;
      case 'resume':
        return <ResumeBuilder />;
      case 'upgrade':
        return <UpgradePlan setCurrentTab={setCurrentTab} />;
      case 'admin':
        return <AdminDashboard userEmail={localStorage.getItem('fic_user_email') || ''} />;
      default:
        return <PosterGenerator />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
      {/* CSS Styles for responsive drawer layout */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-responsive-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 9999;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 280px;
          }
          .sidebar-responsive-wrapper.open {
            transform: translateX(0);
          }
          .sidebar-responsive-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            z-index: 9998;
            animation: fadeInOverlay 0.2s ease-out;
          }
          .mobile-top-header {
            display: flex !important;
          }
          /* Hide default sidebar on mobile */
          aside {
            width: 100% !important;
          }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Theme toggle sits fixed top-right, rendered by ThemeToggle itself */}
      <ThemeToggle />

      {/* Sidebar Responsive Overlay (backdrop) for mobile */}
      {mobileSidebarOpen && (
        <div 
          className="sidebar-responsive-overlay" 
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Wrapper Container */}
      {currentTab !== 'admin' && (
        <div className={`sidebar-responsive-wrapper ${mobileSidebarOpen ? 'open' : ''}`} style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            imageHistory={imageHistory}
            posterHistory={posterHistory}
            onSidebarImageUpload={handleSidebarImageUpload}
            onSelectImageItem={handleSelectImageItem}
            onSelectPosterItem={handleSelectPosterItem}
            onDeleteImageItem={handleDeleteImageItem}
            onDeletePosterItem={handleDeletePosterItem}
            onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      <main 
        className="flex-1 flex flex-col min-w-0 transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, var(--bg-gradient-from), var(--bg-gradient-to))',
        }}
      >
        {/* Mobile Header Bar (ChatGPT style) */}
        {currentTab !== 'admin' && (
          <div className="mobile-top-header" style={{
            display: 'none',
            height: '56px',
            background: '#0a0d1a',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
          }}>
            <button 
              onClick={() => setMobileSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
              }}
            >
              ☰
            </button>
            
            <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 900, letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔮 FIC AI
            </span>

            {/* Spacer block to keep logo layout centered-left on mobile while floating profile stays on right */}
            <div style={{ width: '92px' }}></div>
          </div>
        )}

        {renderContent()}
      </main>

      {/* Premium ForgeIndia Splash Screen */}
      {showSplash && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#060814',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            opacity: splashFade ? 0 : 1,
            transform: splashFade ? 'scale(1.05)' : 'scale(1)',
            pointerEvents: splashFade ? 'none' : 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 10 }}>
            {/* Glowing Aura Ring around Logo */}
            <div
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                borderRadius: '24px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 50px rgba(124, 58, 237, 0.25)',
                animation: 'pulseLogo 2s infinite ease-in-out',
              }}
            >
              <img 
                src="/forge_india_logo.png" 
                alt="Forge India Logo"
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'contain',
                }}
              />
            </div>

            <h1 
              style={{
                fontSize: '24px',
                fontWeight: 900,
                letterSpacing: '0.25em',
                color: '#F8FAFC',
                margin: '10px 0 0 0',
                textAlign: 'center',
                textShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
                animation: 'fadeInText 1.5s ease',
              }}
            >
              FORGE INDIA CONNECT
            </h1>
            <p 
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#06B6D4',
                letterSpacing: '0.4em',
                textAlign: 'center',
                textTransform: 'uppercase',
                margin: 0,
                opacity: 0.8,
              }}
            >
              Neural SaaS Platform
            </p>

            {/* Futuristic Loading Bar */}
            <div 
              style={{
                width: '180px',
                height: '3px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '15px',
              }}
            >
              <div 
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                  animation: 'loadingBarProgress 3s cubic-bezier(0.1, 0.85, 0.25, 1) forwards',
                }}
              />
            </div>
          </div>

          <style>{`
            @keyframes pulseLogo {
              0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15); }
              50% { transform: scale(1.03); box-shadow: 0 12px 48px rgba(6, 182, 212, 0.25); }
            }
            @keyframes fadeInText {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes loadingBarProgress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    {/* Premium Login Modal Wall */}
    {showLoginModal && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.25s ease',
        }}
      >
        <form 
          onSubmit={handleLoginSubmit}
          style={{
            background: 'rgba(15, 18, 28, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '40px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            boxSizing: 'border-box',
            margin: '20px',
            position: 'relative',
            animation: 'modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => { setShowLoginModal(false); setPendingCallback(null); setLoginError(''); }}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '20px',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
          >
            ✕
          </button>

          {/* User Icon */}
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: '#7C3AED',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.15)',
            }}
          >
            👤
          </div>

          {/* Heading */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0', background: 'linear-gradient(135deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Access AI Studio
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
              Please enter your email to continue using AI tools and chats
            </p>
          </div>

          {/* Input Area */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="email"
              placeholder="Enter your email address"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setLoginError(''); }}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: '12px',
                border: loginError ? '1.5px solid #EF4444' : '1.5px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.03)',
                color: '#ffffff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
              onFocus={e => { if (!loginError) e.currentTarget.style.borderColor = '#7C3AED'; }}
              onBlur={e => { if (!loginError) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
            />
            {loginError && (
              <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600, paddingLeft: '4px' }}>
                {loginError}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.95'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Continue to AI Studio
          </button>
        </form>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )}
    </div>
  );
}

export default App;
