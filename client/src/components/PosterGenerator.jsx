import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import PosterEditor from './PosterEditor';
import { useToolHistory, timeAgo } from '../hooks/useToolHistory';
import { API_BASE_URL as API_URL } from '../config/api';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

// ── Suggestion Presets ─────────────────────────────────────────────────────────
const PRESET_SUGGESTIONS = [
  { text: 'birthday poster for child', title: '🎂 Birthday Poster', desc: 'Colorful balloons, cakes, and festive vibes' },
  { text: 'grand opening restaurant shop', title: '🎊 Grand Opening', desc: 'Ribbons, balloons, and celebratory shop design' },
  { text: 'we are hiring senior developer', title: '💼 Hiring Announcement', desc: 'Professional layout for job openings and careers' },
  { text: 'Diwali festive greeting wishes', title: '🪔 Diwali Festival', desc: 'Traditional oil lamps, sparkles, and rangoli style' },
  { text: 'restaurant special burger food offer', title: '🍽️ Restaurant Offer', desc: 'Appetizing food background and promo typography' },
  { text: '50% discount clearance sale offer', title: '🏷️ Clearance Sale', desc: 'High-energy discount badge and retail style' },
];

// ── Category → Color map for the enhancement panel ──────────────────────────
const CATEGORY_COLORS = {
  'Birthday':      { bg: 'from-pink-500/30 to-yellow-500/20', border: 'border-pink-500/40',    text: 'text-pink-600 dark:text-pink-400',    icon: '🎂',  solidBg: '#ec4899' },
  'Festival':      { bg: 'from-orange-500/30 to-amber-500/20', border: 'border-orange-500/40', text: 'text-orange-600 dark:text-orange-400',  icon: '✨',  solidBg: '#f97316' },
  'Grand Opening': { bg: 'from-yellow-500/30 to-amber-500/20', border: 'border-yellow-500/40', text: 'text-yellow-600 dark:text-yellow-400',  icon: '🎊',  solidBg: '#eab308' },
  'Hiring':        { bg: 'from-blue-500/30 to-purple-500/20', border: 'border-blue-500/40',    text: 'text-blue-600 dark:text-blue-400',    icon: '💼',  solidBg: '#3b82f6' },
  'Restaurant':    { bg: 'from-red-500/30 to-orange-500/20', border: 'border-red-500/40',      text: 'text-red-600 dark:text-red-400',      icon: '🍽️', solidBg: '#ef4444' },
  'Real Estate':   { bg: 'from-amber-500/30 to-stone-500/20', border: 'border-amber-500/40',   text: 'text-amber-600 dark:text-amber-400',  icon: '🏠',  solidBg: '#f59e0b' },
  'Education':     { bg: 'from-emerald-500/30 to-green-500/20', border: 'border-green-500/40', text: 'text-emerald-600 dark:text-green-400', icon: '🎓', solidBg: '#10b981' },
  'Healthcare':    { bg: 'from-teal-500/30 to-blue-500/20', border: 'border-teal-500/40',     text: 'text-teal-600 dark:text-teal-400',    icon: '🏥',  solidBg: '#14b8a6' },
  'Sale / Offer':  { bg: 'from-rose-500/30 to-orange-500/20', border: 'border-rose-500/40',    text: 'text-rose-600 dark:text-red-400',     icon: '🏷️', solidBg: '#f43f5e' },
  'Event':         { bg: 'from-purple-500/30 to-pink-500/20', border: 'border-purple-500/40',  text: 'text-purple-600 dark:text-purple-400', icon: '📅', solidBg: '#a855f7' },
  'Product Launch':{ bg: 'from-indigo-500/30 to-blue-500/20', border: 'border-indigo-500/40', text: 'text-indigo-600 dark:text-indigo-400', icon: '🚀',  solidBg: '#6366f1' },
  'Corporate':     { bg: 'from-slate-500/30 to-blue-500/20', border: 'border-slate-500/40',   text: 'text-slate-600 dark:text-slate-400',  icon: '🏢',  solidBg: '#64748b' },
};

// ── AI Understanding Panel ────────────────────────────────────────────────────
function AIUnderstandingPanel({ enhancement }) {
  const [expanded, setExpanded] = useState(false);
  if (!enhancement) return null;

  const colors = CATEGORY_COLORS[enhancement.detectedCategory] || CATEGORY_COLORS['Corporate'];

  return (
    <div className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-4 space-y-3 animate-fadeIn w-full`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{colors.icon}</span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${colors.text}`}>
            ✨ AI Understanding
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
            Score: {enhancement.qualityScore}/100
          </span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[9px] text-white/40 hover:text-white/70 uppercase tracking-wider transition-colors"
        >
          {expanded ? 'Less ▲' : 'More ▼'}
        </button>
      </div>

      {/* Core grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-black/25 border border-white/5 space-y-0.5">
          <p className="text-[9px] text-white/40 uppercase tracking-wider">🏷️ Category</p>
          <p className="text-[11px] font-bold text-white">{enhancement.detectedCategory}</p>
          {enhancement.detectedOccasion && (
            <p className="text-[9px] text-white/50 capitalize">{enhancement.detectedOccasion}</p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-black/25 border border-white/5 space-y-0.5">
          <p className="text-[9px] text-white/40 uppercase tracking-wider">🏭 Industry</p>
          <p className="text-[11px] font-bold text-white">{enhancement.detectedIndustry}</p>
          <p className="text-[9px] text-white/50">{enhancement.detectedMood}</p>
        </div>
      </div>

      {/* Color palette row */}
      {enhancement.colorPalette && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/40 uppercase tracking-wider shrink-0">🎨 Colors</span>
          <div className="flex gap-1.5">
            {enhancement.colorPalette.map((c, i) => (
              <div
                key={i}
                title={c}
                className="w-5 h-5 rounded-full border border-white/10 shadow-inner cursor-pointer"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main visual */}
      <div className="px-3 py-2 rounded-xl bg-black/20 border border-white/5">
        <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">🖼️ Main Visual</p>
        <p className="text-[10px] text-white/70 leading-relaxed line-clamp-2">{enhancement.mainVisual}</p>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          {enhancement.missingDetails && enhancement.missingDetails.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-yellow-950/30 border border-yellow-500/15">
              <p className="text-[9px] text-yellow-400 uppercase tracking-wider mb-1">⚠️ Tip: Add These for Better Results</p>
              {enhancement.missingDetails.map((d, i) => (
                <p key={i} className="text-[9px] text-yellow-200/60">• {d}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Progress step indicator ───────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { msg: '🔍 Analyzing your prompt...', ms: 0 },
  { msg: '🧠 Detecting category & intent...', ms: 1200 },
  { msg: '✨ Expanding & enhancing prompt...', ms: 2200 },
  { msg: '🎨 Building visual design brief...', ms: 3500 },
  { msg: '🖼️ Generating background image...', ms: 5000 },
  { msg: '🖌️ Assembling poster layout...', ms: 7000 },
  { msg: '⚡ Finalizing your design...', ms: 9000 },
];
const resolveUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default function PosterGenerator() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [posterData, setPosterData] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [enhancement, setEnhancement] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [posterStyle, setPosterStyle] = useState('full_image');

  const { history, addToHistory, deleteFromHistory, showPanel, setShowPanel } = useToolHistory('fic_poster_history', 40);

  const textareaRef = useRef(null);
  const chatFeedRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, loading, scrollToBottom]);

  // Listen to sidebar history click
  useEffect(() => {
    const handleLoadPosterHistory = (e) => {
      if (e.detail) {
        const item = e.detail;
        if (item.posterData) {
          setPosterData(item.posterData);
          if (item.posterData.promptEnhancement) {
            setEnhancement(item.posterData.promptEnhancement);
          }
          setEditMode(true);
        } else if (item.imageUrl) {
          const mockData = {
            success: true,
            imageUrl: item.imageUrl,
            poster: {
              backgroundImageUrl: item.imageUrl,
              backgroundType: 'image',
              title: item.title,
              heading: item.title,
              subheading: '',
              bullets: [],
              colors: ['#090D1A', '#06B6D4', '#7C3AED'],
              typography: { primary: 'Montserrat', secondary: 'Inter' }
            }
          };
          setPosterData(mockData);
          setEditMode(true);
        }
      }
    };
    window.addEventListener('fic_load_poster_history', handleLoadPosterHistory);
    return () => {
      window.removeEventListener('fic_load_poster_history', handleLoadPosterHistory);
    };
  }, []);

  const handleSend = async () => {
    const activePrompt = prompt.trim();
    if (!activePrompt || loading) return;

    if (!localStorage.getItem('fic_user_email')) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => handleSend() }
      }));
      return;
    }

    if (isLimitReached('poster')) {
      setShowLimitModal(true);
      return;
    }

    // Add User message
    const userMsg = { role: 'user', content: activePrompt };
    setChatMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);
    setError('');
    setProgressStep(0);
    setProgressMsg(PROGRESS_STEPS[0].msg);

    // Schedule progress messages
    const timers = PROGRESS_STEPS.slice(1).map((step, i) =>
      setTimeout(() => {
        setProgressMsg(step.msg);
        setProgressStep(i + 1);
      }, step.ms)
    );

    try {
      const res = await axios.post(`${API_URL}/api/poster/generate`, {
        prompt: activePrompt,
        style: posterStyle
      }, { timeout: 900000 });

      timers.forEach(clearTimeout);

      if (res.data?.success) {
        const thumbUrl = res.data.imageUrl || res.data.url || res.data.image ||
          res.data.poster?.backgroundImageUrl || null;

        // Add Assistant message
        const assistantMsg = {
          role: 'assistant',
          posterData: res.data,
          enhancement: res.data.promptEnhancement || null,
          imageUrl: thumbUrl,
          error: null
        };
        setChatMessages(prev => [...prev, assistantMsg]);

        // Save to 30-day history
        addToHistory({
          id: `poster-${Date.now()}`,
          title: activePrompt.slice(0, 80),
          imageUrl: thumbUrl,
          createdAt: Date.now(),
          posterData: res.data
        });
        window.dispatchEvent(new Event('fic_poster_history_updated'));
        incrementUsage('poster'); // Increment poster usage!
      } else {
        const errorMsg = 'AI service temporarily unavailable. Using smart fallback layout.';
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          error: errorMsg
        }]);
      }
    } catch (err) {
      timers.forEach(clearTimeout);
      console.error('[Generate API] Poster generation failed:', err);
      const errorMsg = 'AI service temporarily unavailable. Using smart fallback layout.';
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        error: errorMsg
      }]);
    } finally {
      setLoading(false);
      setProgressMsg('');
      setProgressStep(0);
    }
  };

  const handleReset = () => {
    setPosterData(null);
    setEditMode(false);
    setError('');
  };

  // ── Show editor ────────────────────────────────────────────────────────────
  if (posterData && editMode) {
    return <PosterEditor posterData={posterData} onReset={handleReset} />;
  }

  // ── Main ChatGPT Page Redesign ─────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none" style={{ background: 'var(--bg-color)', color: 'var(--text-color)' }}>
      
      {/* Header */}
      <div className="h-16 px-6 pr-28 flex items-center justify-between shrink-0 z-10" style={{ borderBottom: '1px solid var(--header-border)', background: 'var(--header-bg)' }}>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED] animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--header-text)' }}>Poster Generator AI</span>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div 
        ref={chatFeedRef}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-thin scroll-smooth"
      >
        {chatMessages.length === 0 && !loading ? (
          // Welcome View
          <div className="min-h-full flex flex-col items-center justify-center p-4 max-w-3xl mx-auto w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#00FFFF] text-[10px] font-black uppercase tracking-widest">
                <span>✨</span> AI-Powered Poster Generator
              </div>
              <h2 className="text-3xl font-black tracking-tight uppercase" style={{ color: 'var(--text-color)' }}>What poster shall we design today?</h2>
              <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted-color)' }}>
                Describe your poster topic, or tap one of the template suggestions below to begin generating.
              </p>
            </div>

            {/* Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {PRESET_SUGGESTIONS.map((card) => (
                <button
                  key={card.title}
                  onClick={() => {
                    setPrompt(card.text);
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="p-4 text-left rounded-2xl transition-all group duration-200 cursor-pointer space-y-1 relative hover:border-[#7C3AED]/60"
                  style={{
                    background: 'var(--chat-bubble-assistant-bg)',
                    border: '1.5px solid var(--border-color)',
                  }}
                >
                  <div className="text-xs font-black group-hover:text-[#7C3AED] transition-colors uppercase tracking-wider" style={{ color: 'var(--text-color)' }}>{card.title}</div>
                  <div className="text-[10px] leading-normal" style={{ color: 'var(--muted-color)' }}>{card.desc}</div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[#7C3AED] text-xs">➔</div>
                </button>
              ))}
            </div>

            {/* Supported Categories Quick Selector */}
            <div className="w-full space-y-3 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="text-[9px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--muted-color)' }}>Supported Categories (Auto-Detected)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(CATEGORY_COLORS).map(([name, style]) => (
                  <button
                    key={name}
                    onClick={() => {
                      setPrompt(name.toLowerCase() + ' poster');
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className={`py-2 px-3 text-left rounded-xl bg-gradient-to-br ${style.bg} border ${style.border} hover:opacity-90 transition-all flex items-center gap-2`}
                  >
                    <span className="text-sm shrink-0">{style.icon}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wider truncate ${style.text}`}>{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Message Feed
          <div className="max-w-3xl mx-auto w-full space-y-6">
            {chatMessages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full animate-fadeIn`}>
                  {/* Role Header */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    {isUser ? (
                      <>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">You</span>
                        <span className="text-xs">👤</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs">🤖</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#06B6D4]">Poster AI</span>
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  {isUser ? (
                    <div className="bg-purple-600/20 border border-purple-500/30 px-5 py-3 rounded-2xl rounded-tr-none text-white text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl rounded-tl-none text-white text-sm w-full leading-relaxed space-y-4 shadow-xl">
                      {msg.enhancement && (
                        <AIUnderstandingPanel enhancement={msg.enhancement} />
                      )}

                      {msg.error ? (
                        <div className="p-3.5 bg-red-950/20 border border-red-500/20 text-red-400 text-xs rounded-xl font-bold uppercase tracking-wider text-center">
                          ⚠️ {msg.error}
                        </div>
                      ) : msg.imageUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-[4/5] w-full max-w-sm sm:max-w-xs mx-auto shadow-2xl group">
                          <img 
                            src={resolveUrl(msg.imageUrl)} 
                            alt="Generated Poster Preview" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3">
                            <button 
                              onClick={() => {
                                setPosterData(msg.posterData);
                                if (msg.enhancement) setEnhancement(msg.enhancement);
                                setEditMode(true);
                              }}
                              className="py-2.5 px-5 bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg"
                            >
                              ✏️ Edit in Studio
                            </button>
                            <a 
                              href={resolveUrl(msg.imageUrl)} 
                              download={`poster-${Date.now()}.png`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="py-2.5 px-5 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              📥 Download
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <span className="text-4xl block mb-2">⚠️</span>
                          <div className="text-sm font-bold text-gray-300">Image failed to load.</div>
                        </div>
                      )}

                      {/* Explicit Actions Row (Easy access without hover) */}
                      {!msg.error && (
                        <div className="flex gap-3 justify-center max-w-xs mx-auto w-full">
                          <button 
                            onClick={() => {
                              setPosterData(msg.posterData);
                              if (msg.enhancement) setEnhancement(msg.enhancement);
                              setEditMode(true);
                            }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg text-center"
                          >
                            ✏️ Edit Layout
                          </button>
                          {msg.imageUrl && (
                            <a 
                              href={resolveUrl(msg.imageUrl)} 
                              download={`poster-${Date.now()}.png`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex-1 py-2.5 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-gray-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all text-center flex items-center justify-center"
                            >
                              📥 Download
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Active Loading progress bubble */}
            {loading && (
              <div className="flex flex-col items-start w-full animate-fadeIn">
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-xs">🤖</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#06B6D4]">Poster AI</span>
                </div>
                <div className="bg-slate-900/60 border border-white/5 p-5 rounded-2xl rounded-tl-none text-white text-sm w-full space-y-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-4 w-4 text-[#06B6D4] shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs text-white/70 font-medium">{progressMsg}</span>
                  </div>
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                          i <= progressStep ? 'bg-gradient-to-r from-[#7C3AED] to-[#06B6D4]' : 'bg-white/5'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* anchored prompt input container */}
      <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--chat-input-container-bg)' }}>
        <div className="max-w-3xl mx-auto w-full relative">
          <div className="rounded-2xl p-2.5 shadow-lg focus-within:ring-2 focus-within:ring-[#7C3AED]/40 transition-all flex flex-col gap-1.5 relative" style={{ background: 'var(--chat-input-bg)', border: '1.5px solid var(--chat-input-container-border)' }}>
            {/* Poster Style Selector */}
            <div className="flex gap-2 mb-1 px-3 pt-1">
              <button
                type="button"
                onClick={() => setPosterStyle('full_image')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  posterStyle === 'full_image'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white border-transparent shadow-sm'
                    : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white'
                }`}
              >
                🎨 Premium AI Graphic
              </button>
              <button
                type="button"
                onClick={() => setPosterStyle('layered_canvas')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                  posterStyle === 'layered_canvas'
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white border-transparent shadow-sm'
                    : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:text-white'
                }`}
              >
                📐 Editable Layout
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message Poster AI..."
              rows={1}
              className="w-full bg-transparent border-none outline-none text-sm transition-all font-medium resize-none max-h-40 py-2 px-3 leading-relaxed"
              style={{ color: 'var(--chat-input-text)', height: 'auto' }}
            />
            
            <div className="flex items-center justify-between px-3 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="text-[9px] flex items-center gap-2" style={{ color: 'var(--muted-color)' }}>
                <span>💡 Enter to send • Shift + Enter for new line</span>
                {chatMessages.length > 0 && (
                  <>
                    <span>•</span>
                    <button 
                      onClick={() => setChatMessages([])} 
                      className="text-purple-400/70 hover:text-purple-400 bg-transparent border-none cursor-pointer font-bold uppercase tracking-wider text-[8px]"
                    >
                      Clear Chat
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={loading || !prompt.trim()}
                className="w-8 h-8 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-95 disabled:opacity-20 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shrink-0"
                title="Send message"
              >
                <svg className="w-3.5 h-3.5 transform rotate-90 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-2.5 p-2 bg-red-950/20 border border-red-500/20 text-red-400 text-[10px] rounded-lg font-bold uppercase tracking-wider text-center">
              ⚠️ {error}
            </div>
          )}

          {/* History Collapsible Panel */}
          {history.length > 0 && (
            <div className="mt-3 rounded-xl overflow-hidden" style={{ background: 'var(--chat-bubble-assistant-bg)', border: '1.5px solid var(--border-color)' }}>
              <button
                onClick={() => setShowPanel(p => !p)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-none cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--muted-color)' }}>
                  🕐 History Log
                  <span className="px-1.5 py-0.2 rounded-full bg-[#7C3AED]/20 text-[#a78bfa] text-[8px] font-black">{history.length}</span>
                </span>
                <span className="text-[9px]" style={{ color: 'var(--muted-color)' }}>{showPanel ? '▲' : '▼'}</span>
              </button>

              {showPanel && (
                <div className="px-4 pb-4 max-h-48 overflow-y-auto scrollbar-thin">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {history.map(item => (
                      <div key={item.id} className="rounded-lg overflow-hidden border border-white/5 hover:border-[#7C3AED]/40 transition-all group bg-black/20 relative">
                        <div className="relative w-full" style={{ paddingBottom: '60%' }}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="poster thumbnail" className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-lg bg-[#0B0F1D]">🎨</div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                if (item.posterData) {
                                  setPosterData(item.posterData);
                                  if (item.posterData.promptEnhancement) {
                                    setEnhancement(item.posterData.promptEnhancement);
                                  }
                                  setEditMode(true);
                                }
                              }}
                              className="px-2 py-1 bg-[#7C3AED] text-[8px] font-bold rounded hover:opacity-90"
                            >Edit</button>
                            <button
                              onClick={() => deleteFromHistory(item.id)}
                              className="px-2 py-1 bg-red-600/40 text-[8px] font-bold rounded hover:bg-red-600/60"
                            >Del</button>
                          </div>
                        </div>
                        <div className="p-1 text-center" style={{ background: 'var(--chat-bubble-assistant-bg)' }}>
                          <p className="text-[8px] font-bold truncate" style={{ color: 'var(--text-color)' }}>{item.title}</p>
                          <p className="text-[7px]" style={{ color: 'var(--muted-color)' }}>{timeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[9px] text-center mt-2.5" style={{ color: 'var(--muted-color)' }}>
            Poster AI can make mistakes. Consider checking important details.
          </p>
        </div>
      </div>
      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails('poster')}
      />
    </div>
  );
}
