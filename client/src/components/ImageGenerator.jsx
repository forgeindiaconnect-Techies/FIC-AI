import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

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

const PRESET_SIZES = [
  { label: 'Square (1:1)', width: 512, height: 512, desc: '512 × 512 px', icon: '⏹️' },
  { label: 'Portrait (2:3)', width: 512, height: 768, desc: '512 × 768 px', icon: '📱' },
  { label: 'Landscape (3:2)', width: 768, height: 512, desc: '768 × 512 px', icon: '🖥️' },
];

const formatElapsed = (seconds = 0) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) {
    return `${secs}s`;
  }
  return `${mins}m ${secs}s`;
};

export default function ImageGenerator({ setCurrentTab }) {
  // fastMode removed – GPU only
  const [prompt, setPrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const testImage = "https://picsum.photos/1024/1024";
  const [history, setHistory] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hd, setHd] = useState(true); // HD toggle default true
  const [reqSteps, setReqSteps] = useState(35);
  const [reqCfg, setReqCfg] = useState(7);
  const [style, setStyle] = useState('realistic'); // realistic, poster, cartoon, product, logo
  const [lastRequest, setLastRequest] = useState(null);


  const timerRef = useRef(null);
  const elapsedRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fic_image_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (_) {}

    const handleLoadEvent = (e) => {
      if (e.detail) {
        setError(null);
        setCurrentImage(e.detail.url);
        setPrompt(e.detail.prompt || '');
      }
    };
    const handleSync = () => {
      try {
        const s = localStorage.getItem('fic_image_history');
        setHistory(s ? JSON.parse(s) : []);
      } catch (_) {}
    };

    window.addEventListener('fic_load_image_history', handleLoadEvent);
    window.addEventListener('fic_image_history_updated', handleSync);
    return () => {
      window.removeEventListener('fic_load_image_history', handleLoadEvent);
      window.removeEventListener('fic_image_history_updated', handleSync);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Update timer while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    console.log("generatedImage:", generatedImage);
  }, [generatedImage]);

  const saveHistory = (items) => {
    setHistory(items);
    try {
      localStorage.setItem('fic_image_history', JSON.stringify(items));
    } catch (e) {
      console.warn("Storage quota exceeded. Truncating old images from history.");
      // Keep only the 2 most recent generated images to save space
      const truncated = items.slice(0, 2);
      try {
        localStorage.setItem('fic_image_history', JSON.stringify(truncated));
        setHistory(truncated);
      } catch (err) {
        console.error("Failed to save history even after truncation:", err);
      }
    }
    window.dispatchEvent(new Event('fic_image_history_updated'));
  };


  const handleDownload = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `fic-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteHistory = (id, e) => {
    e.stopPropagation();
    const updated = history.filter((i) => i.id !== id);
    saveHistory(updated);
    const deleted = history.find((i) => i.id === id);
    if (deleted && currentImage === deleted.url) setCurrentImage(null);
  };

  // Helper to send generation request
  const generateImage = async (request) => {
    const { prompt: reqPrompt, width: reqW, height: reqH, hd: reqHd, steps, cfg, style: reqStyle } = request;
    
    // Start a 30 s safety timeout
    const timeoutId = setTimeout(() => {
      console.log('IMAGE REQUEST TIMEOUT');
      setError('Image generation timed out. Try again.');
      setLoading(false);
    }, 30000);
    
    setError(null);
    setLoading(true);
    setCurrentImage(null);
    setGeneratedImage(null);
    setElapsed(0);
    
    try {
      const res = await axios.post(
        `${API_URL}/api/image/generate`,
        {
          prompt: reqPrompt,
          width: reqW,
          height: reqH,
          hd: reqHd,
          steps: steps,
          cfg: cfg,
          style: reqStyle,
          fast: false
        },
        { timeout: 960000 }
      );
      console.log('Full API Response:', res.data);
      const data = res.data;
      const rawUrl = data?.imageUrl;
      const imageUrl = rawUrl && !rawUrl.startsWith('http')
        ? `${API_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`
        : rawUrl;
      console.log('Final Image URL:', imageUrl);

      if ((data?.success || data?.status === 'success') && imageUrl) {
        console.log(`ORIGINAL PROMPT: ${reqPrompt}`);
        console.log(`ENHANCED PROMPT: ${data.enhancedPrompt || reqPrompt}`);
        console.log(`POLLINATIONS URL: ${imageUrl}`);
        // Clear any previous error
        setError(null);
        // Set the generated image for display
        setGeneratedImage(imageUrl);
        setCurrentImage(imageUrl);
        const newItem = { id: `img-${Date.now()}`, url: imageUrl, prompt: reqPrompt, timestamp: Date.now() };
        setSelectedItem(newItem);
        saveHistory([newItem, ...history]);
        incrementUsage('image');
      } else {
        const detailedError = data ? JSON.stringify(data) : 'No response data';
        setError(data?.error || `Image generation failed. Response: ${detailedError}`);
      }
    } catch (err) {
      console.error('IMAGE GENERATION ERROR:', err.response?.data || err.message || err);
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Image generation timed out. Try again with fewer steps or lower resolution.');
      } else {
        const msg = err.response?.data?.error || err.message || 'Image generation failed.';
        setError(msg);
      }
    } finally {
      // Always clear loading state and any pending timeout
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    console.log('GENERATE BUTTON CLICKED');
    console.log('CURRENT PROMPT:', prompt);
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('Please enter a prompt');
      return;
    }
    if (!localStorage.getItem('fic_user_email')) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => handleGenerate() }
      }));
      return;
    }
    if (isLimitReached('image')) {
      setShowLimitModal(true);
      return;
    }
    if (loading) return;
    const request = {
      prompt: trimmed,
      width,
      height,
      hd,
      steps: reqSteps,
      cfg: reqCfg,
      style,
    };
    setLastRequest(request);
    await generateImage(request);
  };

  const handleRetry = () => {
    if (lastRequest) {
      generateImage(lastRequest);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent select-none animate-fadeIn">

      {/* ── HEADER ── */}
      <div className="h-16 border-b border-white/5 bg-[#0B1020]/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            FIC Neural Image Generator
          </span>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── LEFT: OUTPUT CANVAS ── */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Output Canvas
            </span>

            <div
              style={{
                width: "100%",
                height: "500px",
                background: "#111",
                borderRadius: "16px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {generatedImage && !error ? (
                <img
                  src={getHistoryImageUrl(generatedImage)}
                  alt="AI Generated"
                  style={{
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                    display: "block"
                  }}
                  onLoad={(e) => {
                    console.log("IMAGE LOADED SUCCESS");
                    console.log("IMAGE LOADED: true");
                    console.log("Natural Width:", e.target.naturalWidth);
                    console.log("Natural Height:", e.target.naturalHeight);
                  }}
                  onError={(e) => {
                    console.log("IMAGE FAILED:", generatedImage);
                    const fallbackPrompt = selectedItem?.prompt || prompt;
                    if (generatedImage && (generatedImage.includes('/uploads/') || generatedImage.includes('/generated/') || generatedImage.includes('onrender.com') || generatedImage.includes('localhost')) && fallbackPrompt) {
                      console.log("Attempting Pollinations AI fallback for prompt:", fallbackPrompt);
                      const encodedPrompt = encodeURIComponent(fallbackPrompt);
                      const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
                      setGeneratedImage(fallbackUrl);
                      setCurrentImage(fallbackUrl);
                    } else {
                      e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80";
                      setError("Image URL invalid or expired");
                    }
                  }}
                />
              ) : (
                <div style={{ color: "white", padding: "20px", textAlign: "center" }}>
                  {error || "No Image Generated"}
                  {error && (
                    <button onClick={handleRetry} className="mt-2 px-3 py-1 bg-violet-600 text-white rounded">
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: CONTROLS PANEL ── */}
          <div className="lg:col-span-5 space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Generation Controls
            </span>

            <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-5 space-y-5">

              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                  placeholder="A beautiful sunset over mountains, photorealistic, 8k, cinematic lighting..."
                  rows={5}
                  disabled={loading}
                  className="w-full bg-black/30 border border-white/[0.06] focus:border-violet-500/40 rounded-xl p-3 outline-none text-xs text-white placeholder-slate-600 resize-none transition-all leading-relaxed disabled:opacity-40"
                />
                <p className="text-[9px] text-slate-600">Tip: Press Ctrl+Enter to generate</p>
              </div>

              {/* Advanced Options Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-all flex items-center gap-1"
                >
                  {showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options'}
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-4 pt-3 border-t border-white/5 animate-fadeIn">
                  {/* Size Presets */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Output Size</label>
                    <div className="grid grid-cols-1 gap-2">
                      {PRESET_SIZES.map((p) => {
                        const selected = width === p.width && height === p.height;
                        return (
                          <button
                            key={p.label}
                            onClick={() => { setWidth(p.width); setHeight(p.height); }}
                            disabled={loading}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all duration-200 disabled:opacity-40 ${
                              selected
                                ? 'bg-violet-600/10 border-violet-500 text-white'
                                : 'bg-black/20 border-white/[0.06] text-slate-400 hover:border-white/15 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span>{p.icon}</span>
                              <div className="text-left">
                                <p className="text-xs font-bold">{p.label}</p>
                                <p className="text-[9px] opacity-60">{p.desc}</p>
                              </div>
                            </div>
                            {selected && <span className="w-2 h-2 rounded-full bg-violet-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fast mode removed – GPU only */}
                  <div className="text-xs text-slate-400 italic">GPU‑accelerated generation (HD) enabled</div>

                  {/* HD toggle */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="hdToggle"
                      checked={hd}
                      onChange={(e) => setHd(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 text-violet-600 bg-gray-700 border-gray-600 rounded cursor-pointer"
                    />
                    <label htmlFor="hdToggle" className="text-xs font-medium text-slate-400 cursor-pointer select-none">
                      Enable HD (1024×1024, higher steps)
                    </label>
                  </div>

                  {/* Steps input */}
                  <div className="flex items-center gap-2 mt-2">
                    <label htmlFor="steps" className="text-xs font-medium text-slate-400">Steps:</label>
                    <input
                      type="number"
                      id="steps"
                      min="10"
                      max="100"
                      value={reqSteps}
                      onChange={(e) => setReqSteps(Number(e.target.value) || 30)}
                      disabled={loading}
                      className="w-16 text-xs bg-black/30 border border-white/[0.06] rounded px-2 py-1 focus:border-violet-500/40 outline-none text-white"
                    />
                  </div>

                  {/* CFG input */}
                  <div className="flex items-center gap-2 mt-2">
                    <label htmlFor="cfg" className="text-xs font-medium text-slate-400">CFG:</label>
                    <input
                      type="number"
                      id="cfg"
                      min="1"
                      max="20"
                      step="0.5"
                      value={reqCfg}
                      onChange={(e) => setReqCfg(Number(e.target.value) || 8)}
                      disabled={loading}
                      className="w-16 text-xs bg-black/30 border border-white/[0.06] rounded px-2 py-1 focus:border-violet-500/40 outline-none text-white"
                    />
                  </div>

                  {/* Style selector */}
                  <div className="flex items-center gap-2 mt-2">
                    <label htmlFor="style" className="text-xs font-medium text-slate-400">Style:</label>
                    <select
                      id="style"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      disabled={loading}
                      className="text-xs bg-black/30 border border-white/[0.06] rounded px-2 py-1 focus:border-violet-500/40 outline-none text-white"
                    >
                      <option value="realistic">Realistic</option>
                      <option value="poster">Poster</option>
                      <option value="cartoon">Cartoon</option>
                      <option value="product">Product</option>
                      <option value="logo">Logo</option>
                    </select>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      `${reqSteps} steps`,
                      `CFG ${reqCfg}`,
                      'DPM++ 2M Karras',
                      `${width}x${height}`,
                      'SDXL'
                    ].map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[9px] font-bold text-slate-500 border border-white/[0.06] rounded-full bg-white/[0.02]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating... ({formatElapsed(elapsed)})
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── HISTORY GALLERY ── */}
        {history.length > 0 && (
          <div className="max-w-5xl mx-auto mt-6 rounded-2xl border border-white/[0.07] bg-black/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">📚</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">History</h3>
              </div>
              <span className="text-[9px] text-slate-500 font-bold">{history.length} images</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setError(null);
                    setGeneratedImage(item.url);
                    setCurrentImage(item.url);
                    setPrompt(item.prompt || '');
                    setSelectedItem(item);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border group transition-all duration-200 ${
                    currentImage === item.url
                      ? 'border-violet-500 ring-2 ring-violet-500/20'
                      : 'border-white/[0.06] hover:border-violet-500/40'
                  }`}
                >
                  <img 
                    src={getHistoryImageUrl(item.url)} 
                    alt="history" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    onError={(e) => {
                      if (item.prompt) {
                        e.target.src = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.prompt)}?width=256&height=256&nologo=true`;
                      } else {
                        e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.url); }}
                      className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all"
                      title="Download"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDeleteHistory(item.id, e)}
                      className="p-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-300 transition-all"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails('image')}
      />
    </div>
  );
}
