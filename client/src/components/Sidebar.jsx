import React, { useRef, useState } from 'react';

const TABS = [
  { id: 'chat',   icon: '💬', label: 'Chat AI' },
  { id: 'image',  icon: '🎨', label: 'Image Generator' },
  { id: 'editor', icon: '🖌️', label: 'Image Editor' },
  { id: 'docs',   icon: '📁', label: 'Doc Generator' },
  { id: 'poster', icon: '✏️', label: 'Poster Generator' },
  { id: 'video',  icon: '📹', label: 'Video Generator' },
  { id: 'voice',  icon: '🎙️', label: 'Voice AI Suite' },
  { id: 'resume', icon: '📄', label: 'AI Resume Builder' },
  { id: 'upgrade', icon: '👑', label: 'Upgrade Plan' },
];

const formatTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Just now';
  }
};
const getHistoryImageUrl = (url) => {
  if (!url) return '';
  let cleanUrl = url;

  const isLocalClient = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const hasRemoteBase = import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') && !import.meta.env.VITE_API_URL.includes('127.0.0.1');

  const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1):5001/i;
  if (localhostPattern.test(cleanUrl)) {
    if (!isLocalClient || hasRemoteBase) {
      const base = import.meta.env.VITE_API_URL || 'https://fic-ai.onrender.com';
      cleanUrl = cleanUrl.replace(localhostPattern, base);
    }
  }
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }
  let base = import.meta.env.VITE_API_URL;
  if (!base) {
    base = isLocalClient ? 'http://localhost:5001' : 'https://fic-ai.onrender.com';
  }
  const cleanPath = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  return `${base}${cleanPath}`;
};

function Sidebar({
  chats, activeChatId, setActiveChatId, onDeleteChat, onNewChat,
  currentTab, setCurrentTab,
  imageHistory = [], posterHistory = [],
  onSidebarImageUpload, onSelectImageItem, onSelectPosterItem,
  onDeleteImageItem, onDeletePosterItem,
  onCloseMobileSidebar
}) {
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [chatToDelete, setChatToDelete] = useState(null);
  const fileInputRef = useRef(null);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && onSidebarImageUpload) {
      const reader = new FileReader();
      reader.onload = (ev) => onSidebarImageUpload(ev.target.result);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const showUpload = currentTab === 'image' || currentTab === 'poster';
  const uploadLabel = currentTab === 'poster' ? '+ Upload Background' : '+ Upload Image';
  const safeChats = Array.isArray(chats) ? chats : [];

  return (
    <aside 
      className="w-72 p-5 flex flex-col h-full shrink-0 select-none transition-all duration-300"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

      {/* Brand Logo – Forge India Connect Pvt. Ltd */}
      <div className="flex flex-col items-center mb-6">
        <div style={{
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--sidebar-border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          marginBottom: '8px',
          minHeight: '88px',
        }}>
          <img
            src="/forge_india_logo.png"
            alt="Forge India Connect Pvt. Ltd – Shaping Future"
            style={{
              width: '100%',
              maxHeight: '72px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
        <p 
          className="text-[9px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center"
          style={{ color: 'var(--logo-subtext-color)' }}
        >
          <span style={{ fontSize: '10px' }}>✦</span>
          AI PLATFORM • SHAPING FUTURE
          <span style={{ fontSize: '10px' }}>✦</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-3 select-none" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {/* Dropdown Toggle Header Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-full py-3 px-4 rounded-xl flex items-center justify-between text-sm font-bold transition-all duration-200 border mb-3 select-none"
        style={{
          background: 'rgba(124, 58, 237, 0.08)',
          borderColor: 'rgba(124, 58, 237, 0.25)',
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        <span className="flex items-center gap-2">
          <span>🔮</span>
          FIC AI Studio
        </span>
        <span style={{
          transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '10px'
        }}>▼</span>
      </button>

      {/* Interactive Menu Tabs Dropdown Panel */}
      {dropdownOpen && (
        <div className="space-y-1.5 mb-5 transition-all duration-200">
          {TABS.map(tab => {
            const isActive = currentTab === tab.id;
            const isUpgrade = tab.id === 'upgrade';
            
            const activeBg = isUpgrade ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)' : 'var(--sidebar-tab-selected-bg)';
            const activeColor = isUpgrade ? '#c084fc' : 'var(--sidebar-tab-selected-text)';
            const activeBorder = isUpgrade ? 'rgba(167, 139, 250, 0.4)' : 'var(--sidebar-border)';
            const activeShadow = isUpgrade ? '0 4px 15px rgba(124, 58, 237, 0.15)' : '0 2px 8px rgba(0,0,0,0.05)';

            const inactiveBg = isUpgrade ? 'rgba(124, 58, 237, 0.05)' : 'transparent';
            const inactiveColor = isUpgrade ? '#a78bfa' : 'var(--sidebar-tab-text)';
            const inactiveBorder = isUpgrade ? 'rgba(124, 58, 237, 0.15)' : 'transparent';

            const hoverBg = isUpgrade ? 'rgba(124, 58, 237, 0.12)' : 'var(--sidebar-tab-hover-bg)';
            const hoverColor = isUpgrade ? '#c084fc' : 'var(--sidebar-tab-selected-text)';
            const hoverBorder = isUpgrade ? 'rgba(124, 58, 237, 0.35)' : 'transparent';

            return (
              <button
                key={tab.id}
                onClick={() => { setCurrentTab(tab.id); onCloseMobileSidebar?.(); }}
                className="w-full py-3 px-4 rounded-xl flex items-center gap-3 text-sm font-medium transition-all duration-200 border group"
                style={{
                  background: isActive ? activeBg : inactiveBg,
                  color: isActive ? activeColor : inactiveColor,
                  borderColor: isActive ? activeBorder : inactiveBorder,
                  boxShadow: isActive ? activeShadow : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = hoverBg;
                    e.currentTarget.style.color = hoverColor;
                    e.currentTarget.style.borderColor = hoverBorder;
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = inactiveBg;
                    e.currentTarget.style.color = inactiveColor;
                    e.currentTarget.style.borderColor = inactiveBorder;
                  }
                }}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
                <svg className="w-3.5 h-3.5 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      )}



      {/* Dynamic Action Callout */}
      {currentTab === 'chat' ? (
        <button
          onClick={onNewChat}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--chat-send-btn-bg)',
            color: 'var(--chat-send-btn-text)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginBottom: '16px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
          }}>
            +
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Chat</span>
            <span style={{ display: 'block', fontSize: '9px', opacity: 0.8 }}>Start a new conversation</span>
          </div>
        </button>
      ) : currentTab === 'editor' ? (
        <div 
          className="mb-4 p-4 rounded-2xl border"
          style={{ background: 'var(--upgrade-card-bg)', borderColor: 'var(--sidebar-border)' }}
        >
          <p style={{ margin: 0, fontSize: '10px', color: 'var(--accent-color)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🖌️ Image Editor</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: 'var(--muted-color)', lineHeight: 1.5 }}>Upload → Brush Mask → Enter Edit prompt → Apply dynamic ComfyUI transformations.</p>
        </div>
      ) : currentTab === 'poster' ? null : showUpload ? (
        <button
          onClick={handleUploadClick}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--chat-send-btn-bg)',
            color: 'var(--chat-send-btn-text)',
            borderRadius: '12px',
            border: 'none',
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '16px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.filter = 'none';
          }}
        >
          <span>➕</span>
          {uploadLabel}
        </button>
      ) : null}

      {/* Conversations Grid */}
      {currentTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted-color)' }}>Conversations</h2>
            <button 
              className="text-[10px] font-bold transition-colors flex items-center gap-1 uppercase tracking-wider bg-transparent border-none cursor-pointer"
              style={{ color: 'var(--accent-color)' }}
            >
              View all
              <span className="text-xs">→</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2 scrollbar-thin">

            {safeChats.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <span className="text-2xl mb-2 block">💬</span>
                <p className="text-xs" style={{ color: 'var(--muted-color)' }}>No active chat sessions</p>
              </div>
            ) : safeChats.map(chat => {
              const isActive = chat.chatId === activeChatId;
              const titleText = chat.title || (chat.messages && chat.messages[0] && (chat.messages[0].content || chat.messages[0].text)) || "New Chat";
              const timeString = formatTime(chat.updatedAt || chat.createdAt);
              
              return (
                <div
                  key={chat.chatId}
                  onClick={() => { setActiveChatId(chat.chatId); onCloseMobileSidebar?.(); }}
                  className="group flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all duration-200"
                  style={{
                    background: isActive ? 'var(--sidebar-tab-selected-bg)' : 'transparent',
                    borderColor: isActive ? 'var(--sidebar-border)' : 'transparent',
                    color: isActive ? 'var(--sidebar-tab-selected-text)' : 'var(--sidebar-tab-text)',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--sidebar-tab-hover-bg)';
                      e.currentTarget.style.color = 'var(--sidebar-tab-selected-text)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--sidebar-tab-text)';
                    }
                  }}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
                    {/* Chat Icon Container */}
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: isActive ? 'rgba(16,185,129,0.15)' : 'var(--sidebar-tab-hover-bg)',
                        color: isActive ? 'var(--accent-color)' : 'var(--muted-color)',
                      }}
                    >
                      <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    {/* Title */}
                    <div className="flex flex-col overflow-hidden text-left justify-center">
                      <span className="text-xs truncate font-medium" style={{ color: isActive ? 'var(--sidebar-tab-selected-text)' : 'var(--text-color)' }}>{titleText}</span>
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setChatToDelete(chat.chatId);
                    }}
                    className="opacity-70 md:opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                    title="Delete Conversation"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}

          </div>
        </div>
      )}

      {/* Image history */}
      {(currentTab === 'image' || currentTab === 'editor') && (
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">AI Image Gallery</h2>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 scrollbar-thin">
            {imageHistory.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <span className="text-2xl mb-2 block">🎨</span>
                <p className="text-xs text-[#94A3B8]">Gallery is empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-4">
                {imageHistory.map(item => (
                  <div
                    key={item.id}
                    onClick={() => { onSelectImageItem?.(item); onCloseMobileSidebar?.(); }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-[#7C3AED]/40 transition-all duration-300 group bg-black/40"
                  >
                    <img 
                      src={getHistoryImageUrl(item.url)} 
                      alt="thumb" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" 
                      onError={(e) => {
                        if (item.prompt) {
                          e.target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.prompt)}?width=256&height=256&nologo=true`;
                        } else {
                          e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                        }
                      }}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteImageItem?.(item.id); }}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Poster history */}
      {currentTab === 'poster' && (
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Saved Poster Gallery</h2>
          <div className="flex-1 overflow-y-auto -mx-2 px-2 scrollbar-thin">
            {posterHistory.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <span className="text-2xl mb-2 block">📋</span>
                <p className="text-xs text-[#94A3B8]">No poster templates saved</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-4">
                {posterHistory.map(item => (
                  <div
                    key={item.id}
                    onClick={() => { onSelectPosterItem?.(item); onCloseMobileSidebar?.(); }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-[#06B6D4]/40 transition-all duration-300 group bg-black/40"
                  >
                    <img 
                      src={getHistoryImageUrl(item.imageUrl || item.url)} 
                      alt="thumb" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" 
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60"; }}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); onDeletePosterItem?.(item.id); }}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Bottom Profile and Settings Bar */}
      <div 
        style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Theme toggles: Elephant / Diamond */}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('fic_toggle_theme', { detail: 'light' }))}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              opacity: document.documentElement.classList.contains('dark') ? 0.4 : 1,
              transition: 'opacity 0.2s',
            }}
            title="Light Mode (Elephant)"
          >
            🐘
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('fic_toggle_theme', { detail: 'dark' }))}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              opacity: document.documentElement.classList.contains('dark') ? 1 : 0.4,
              transition: 'opacity 0.2s',
            }}
            title="Dark Mode (Diamond)"
          >
            💎
          </button>
        </div>

        {/* User profile picture */}
        <div style={{ position: 'relative' }}>
          <img 
            src="/forge_india_logo_user.svg" 
            alt="User Avatar"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80";
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '2px solid var(--accent-color)',
              objectFit: 'cover',
            }}
          />
          <span 
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid var(--sidebar-bg)',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.9) translateY(30px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes backdropFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(8px); }
        }
      `}</style>

      {chatToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'backdropFadeIn 0.2s ease-out forwards',
        }}>
          <div style={{
            background: 'var(--sidebar-bg, #0B0F19)',
            border: '1.5px solid var(--sidebar-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '24px',
            padding: '32px 28px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.05)',
            textAlign: 'center',
            animation: 'modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🗑️</span>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: 800, 
              color: '#FFFFFF', 
              margin: '0 0 10px 0',
              fontFamily: 'Inter, sans-serif'
            }}>
              Delete Conversation?
            </h3>
            <p style={{ 
              fontSize: '13px', 
              color: 'var(--muted-color, #9CA3AF)', 
              margin: '0 0 24px 0',
              lineHeight: '1.6'
            }}>
              Are you sure you want to delete this chat session? This action is permanent and cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setChatToDelete(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--sidebar-border, rgba(255, 255, 255, 0.15))',
                  background: 'transparent',
                  color: '#E5E7EB',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--sidebar-border, rgba(255, 255, 255, 0.15))';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteChat(chatToDelete);
                  if (chatToDelete === activeChatId) {
                    setActiveChatId(null);
                  }
                  setChatToDelete(null);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.filter = 'none';
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
