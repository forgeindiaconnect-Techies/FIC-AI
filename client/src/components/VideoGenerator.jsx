// client/src/components/VideoGenerator.jsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';
import { useToolHistory, timeAgo } from '../hooks/useToolHistory';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

const LANGUAGES = [
  {
    id: 'english',
    label: 'English',
    flag: '🇬🇧',
    desc: 'Speak & generate in English',
  },
  {
    id: 'tamil',
    label: 'தமிழ்',
    flag: '🇮🇳',
    desc: 'Speak & generate in Tamil',
  },
];

const VOICES = [
  {
    id: 'girl',
    label: 'Girl',
    icon: '👩',
    desc: 'Female voice & character',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.10)',
    border: 'rgba(236,72,153,0.35)',
  },
  {
    id: 'boy',
    label: 'Boy',
    icon: '👨',
    desc: 'Male voice & character',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.35)',
  },
];

const RATIOS = [
  { id: '16:9', label: '16 : 9', icon: '🖥️', desc: 'Landscape' },
  { id: '9:16', label: '9 : 16', icon: '📱', desc: 'Portrait' },
  { id: '1:1',  label: '1 : 1',  icon: '⏹️', desc: 'Square'    },
];

function VideoGenerator() {
  const [prompt,       setPrompt]      = useState('');
  const [language,     setLanguage]    = useState('english');
  const [gender,       setGender]      = useState('girl');
  const [aspectRatio,  setAspectRatio] = useState('16:9');
  const [duration,     setDuration]    = useState(10);
  const [loading,      setLoading]     = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [videoUrl,     setVideoUrl]    = useState(null);
  const [imageUrl,     setImageUrl]    = useState(null);
  const [audioUrl,     setAudioUrl]    = useState(null);
  const [error,        setError]       = useState(null);
  const [providerErrors, setProviderErrors] = useState([]);
  const [progress,     setProgress]    = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('d-id');
  const timerRef = useRef(null);
  const [generatedScript, setGeneratedScript] = useState(null); // video narration text transcript


  const [demoModeActive, setDemoModeActive] = useState(false);
  const [apiErrors,      setApiErrors]      = useState([]);
  const [provider,       setProvider]       = useState(null);

  // ── Custom avatar (user-uploaded photo) ───────────────────────────────────────
  const [avatarFile,     setAvatarFile]     = useState(null);   // raw File object
  const [avatarPreview,  setAvatarPreview]  = useState(null);   // local blob URL for preview
  const [avatarUrl,      setAvatarUrl]      = useState(null);   // D-ID hosted URL after upload
  const [localAvatarUrl, setLocalAvatarUrl] = useState(null);   // Local hosted URL after upload
  const [avatarUploading,setAvatarUploading]= useState(false);  // spinner while uploading
  const [avatarError,    setAvatarError]    = useState(null);   // upload error message
  const [avatarDragOver, setAvatarDragOver] = useState(false);  // drag-highlight
  const avatarInputRef = useRef(null);

  const { history, addToHistory, deleteFromHistory, showPanel, setShowPanel } = useToolHistory('fic_video_history', 40);

  // ── API Key Settings Panel States ───────────────────────────────────────────
  const [showSettings,      setShowSettings]      = useState(false);
  const [didKey,            setDidKey]            = useState('');
  const [heyGenKey,         setHeyGenKey]         = useState('');
  const [apiStatus,         setApiStatus]         = useState(null);
  const [savingKeys,        setSavingKeys]        = useState(false);
  const [settingsError,     setSettingsError]     = useState(null);
  const [settingsSuccess,   setSettingsSuccess]   = useState(null);






  /* ── Avatar upload handler ── */
  const handleAvatarFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setAvatarError('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarUrl(null);  // reset previous D-ID url
    setLocalAvatarUrl(null); // reset previous local url
    setAvatarPreview(URL.createObjectURL(file));

    // Immediately upload to D-ID and get hosted URL
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await axios.post(`${API_URL}/api/video/upload-avatar`, formData, { /* let axios set multipart boundary */
        // let axios set multipart boundary automatically
        timeout: 60000,
      });
      if (res.data?.success) {
        setAvatarUrl(res.data.avatarUrl || null);
        setLocalAvatarUrl(res.data.localAvatarUrl || null);
        setAvatarError(null);
      } else {
        throw new Error(res.data?.error || 'Upload failed');
      }
    } catch (e) {
      const msg = e.response?.data?.detail || e.response?.data?.error || e.message || 'Upload failed';
      setAvatarError(`Photo upload failed: ${msg}`);
      setAvatarUrl(null);
      setLocalAvatarUrl(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    setLocalAvatarUrl(null);
    setAvatarError(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  /* ── fake progress bar while waiting ── */
  const startProgress = () => {
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 90) { clearInterval(timerRef.current); return 90; }
        // Fast at start (D-ID processing), slow near 90%
        const increment = p < 60 ? Math.random() * 4 + 2 : Math.random() * 1.5;
        return Math.min(p + increment, 90);
      });
    }, 400);
  };
  const stopProgress = () => {
    clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 800);
  };

  const [merging,     setMerging]     = useState(false);
  const [mergeError,  setMergeError]  = useState(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const syncAudioWithVideo = (action) => {
    if (!audioRef.current) return;
    try {
      if (action === 'play') {
        audioRef.current.play().catch(err => console.warn('[Sync] Play blocked by browser:', err));
      } else if (action === 'pause') {
        audioRef.current.pause();
      } else if (action === 'seek') {
        if (videoRef.current) {
          audioRef.current.currentTime = videoRef.current.currentTime;
        }
      } else if (action === 'rate') {
        if (videoRef.current) {
          audioRef.current.playbackRate = videoRef.current.playbackRate;
        }
      }
    } catch (e) {
      console.warn('[Sync] Error syncing audio:', e);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!localStorage.getItem('fic_user_email')) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => handleGenerate() }
      }));
      return;
    }
    if (isLimitReached('video')) {
      setShowLimitModal(true);
      return;
    }
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    setAudioUrl(null);
    setImageUrl(null);
    setMergeError(null);
    setDemoModeActive(false);
    setApiErrors([]);
    setProvider(null);
    setProviderErrors([]);
    setGeneratedScript(null); // Clear previous video script
    startProgress();
    try {
      const mappedGender = gender === 'girl' ? 'female' : gender === 'boy' ? 'male' : gender;
      const res = await axios.post(`${API_URL}/api/documents/video`, {
        content: prompt,
        title: '',
        language,
        gender: mappedGender,
        provider: selectedProvider,
        // Pass the D-ID hosted avatar URL if user uploaded a custom photo
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(localAvatarUrl ? { localAvatarUrl } : {}),
      }, { timeout: 600000 });

      if (res.data?.success) {
        setProvider(res.data.provider);
        const finalScript = res.data.script || prompt;
        setGeneratedScript(finalScript);
        const encodedText = encodeURIComponent(finalScript.trim());
        const mappedGenderForTts = gender === 'girl' ? 'female' : gender === 'boy' ? 'male' : gender;
        const ttsUrl = `${API_URL}/api/video/tts?text=${encodedText}&lang=${language}&gender=${mappedGenderForTts}&t=${Date.now()}`;

        if (res.data.demo) {
          setDemoModeActive(true);
          if (res.data.message) {
            const parts = res.data.message.split('D-ID:');
            const errors = [];
            if (parts.length > 1) {
              const subparts = parts[1].split('HeyGen:');
              errors.push(`D-ID: ${subparts[0].replace('Fell back to AI image + TTS video generation. ', '').trim()}`);
              if (subparts.length > 1) {
                errors.push(`HeyGen: ${subparts[1].trim()}`);
              }
            }
            setApiErrors(errors.length > 0 ? errors : ['Insufficient credits or invalid key configuration.']);
          }
        }

        let vUrl = res.data.videoUrl;
        if (vUrl) {
          if (!vUrl.startsWith('http')) {
            vUrl = `${API_URL}${vUrl}`;
          }
          setVideoUrl(vUrl);
          setAudioUrl(ttsUrl);
          incrementUsage('video'); // Increment video usage!
        } else {
          setError('No video URL was returned by the server.');
        }
      } else {
        setError(res.data?.message || 'Video generation failed.');
      }
    } catch (e) {
      console.error('Video generation error:', e);
      const serverData = e.response?.data;
      // Store structured provider errors for detailed UI display
      if (serverData?.providerErrors && Array.isArray(serverData.providerErrors) && serverData.providerErrors.length > 0) {
        setProviderErrors(serverData.providerErrors);
        setError(serverData.error || 'Video generation failed.');
      } else {
        setProviderErrors([]);
        // Build clean error message
        let errMsg = serverData?.error || serverData?.message || e.message || 'Server error. Please try again.';
        // Append each provider detail on a new line
        if (serverData?.details && Array.isArray(serverData.details) && serverData.details.length > 0) {
          errMsg = serverData.details.map(d => `⚠️ ${d}`).join('\n');
        }
        setError(errMsg);
      }
    } finally {
      stopProgress();
      setLoading(false);
    }
  };
  // Save to history whenever a new video or image is generated
  useEffect(() => {
    if (!loading && (videoUrl || imageUrl)) {
      const item = {
        id: `vid-${Date.now()}`,
        title: prompt.trim().slice(0, 80) || 'Untitled Video',
        language,
        gender,
        videoUrl: videoUrl || null,
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null,
        createdAt: Date.now(),
      };
      addToHistory(item);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, imageUrl]);

  // Fetch API key configs on mount
  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/video/config`);
      if (res.data?.success && res.data.status) {
        setApiStatus(res.data.status);
      }
    } catch (err) {
      console.error('Failed to fetch API key configurations:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const res = await axios.post(`${API_URL}/api/video/config`, {
        didApiKey: didKey,
        heyGenApiKey: heyGenKey
      });
      if (res.data?.success) {
        setSettingsSuccess('API Keys saved and updated successfully!');
        await fetchConfig();
        setDidKey('');
        setHeyGenKey('');
      } else {
        throw new Error(res.data?.error || 'Save failed');
      }
    } catch (err) {
      setSettingsError(err.response?.data?.error || err.message || 'Failed to save API keys.');
    } finally {
      setSavingKeys(false);
    }
  };

  const selectedVoice = VOICES.find(v => v.id === gender);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-color)',
      overflowY: 'auto',
    }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '0 28px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--header-border)',
        background: 'var(--header-bg)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📹</span>
          <span style={{ color: 'var(--header-text)', fontSize: 14, fontWeight: 700 }}>FIC AI</span>
          <span style={{ color: 'var(--muted-color)', fontSize: 12 }}>/ AI Video Generator</span>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: '28px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <style>{`
          .video-grid-container {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 32px;
            width: 100%;
            align-items: start;
          }
          @media (max-width: 1024px) {
            .video-grid-container {
              grid-template-columns: 1fr;
              gap: 24px;
            }
          }
        `}</style>
        <div className="video-grid-container">
          
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* API KEY SETTINGS PANEL */}
        {showSettings && (
          <div style={{
            marginBottom: 24,
            padding: '20px',
            borderRadius: 14,
            border: '1.5px solid var(--sidebar-border)',
            background: 'var(--chat-bubble-assistant-bg)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 850, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚙️ API Key Configurations
              </h4>
              <button 
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-color)', fontSize: 14 }}
              >✕</button>
            </div>

            {/* D-ID Config Status & Input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-color)' }}>D-ID API Key</span>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 800,
                  padding: '2px 8px', 
                  borderRadius: 20, 
                  background: apiStatus?.did?.configured ? (apiStatus?.did?.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'rgba(156,163,175,0.1)',
                  color: apiStatus?.did?.configured ? (apiStatus?.did?.valid ? 'var(--accent-color)' : '#f87171') : 'var(--muted-color)',
                }}>
                  {apiStatus?.did?.configured 
                    ? (apiStatus?.did?.valid ? `Active (${apiStatus.did.credits} credits remaining)` : 'Invalid Key / 0 Credits') 
                    : 'Not Configured'}
                </span>
              </div>
              <input
                type="password"
                placeholder={apiStatus?.did?.configured ? "••••••••••••••••••••••••••••" : "Enter D-ID API Key (e.g. Basic ... or raw credentials)"}
                value={didKey}
                onChange={e => setDidKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--sidebar-border)',
                  background: 'var(--chat-input-bg)',
                  color: 'var(--text-color)',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--muted-color)' }}>
                💡 Get a free API Key with 20 credits by signing up at <a href="https://studio.d-id.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>studio.d-id.com</a>.
              </p>
            </div>

            {/* HeyGen Config Status & Input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-color)' }}>HeyGen API Key</span>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 800,
                  padding: '2px 8px', 
                  borderRadius: 20, 
                  background: apiStatus?.heyGen?.configured ? (apiStatus?.heyGen?.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'rgba(156,163,175,0.1)',
                  color: apiStatus?.heyGen?.configured ? (apiStatus?.heyGen?.valid ? 'var(--accent-color)' : '#f87171') : 'var(--muted-color)',
                }}>
                  {apiStatus?.heyGen?.configured 
                    ? (apiStatus?.heyGen?.valid ? `Active ($${apiStatus.heyGen.balance} balance)` : 'Invalid Key / 0 Balance') 
                    : 'Not Configured'}
                </span>
              </div>
              <input
                type="password"
                placeholder={apiStatus?.heyGen?.configured ? "••••••••••••••••••••••••••••" : "Enter HeyGen API Key"}
                value={heyGenKey}
                onChange={e => setHeyGenKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--sidebar-border)',
                  background: 'var(--chat-input-bg)',
                  color: 'var(--text-color)',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Error/Success Feedbacks */}
            {settingsError && (
              <div style={{ color: '#f87171', fontSize: 11, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ {settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div style={{ color: 'var(--accent-color)', fontSize: 11, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✅ {settingsSuccess}
              </div>
            )}

            {/* Save Button */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSaveKeys}
                disabled={savingKeys || (!didKey.trim() && !heyGenKey.trim())}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-color)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: (savingKeys || (!didKey.trim() && !heyGenKey.trim())) ? 'not-allowed' : 'pointer',
                  opacity: (savingKeys || (!didKey.trim() && !heyGenKey.trim())) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {savingKeys ? 'Saving...' : 'Save & Refresh Balances'}
              </button>
              <button
                onClick={() => {
                  setDidKey('');
                  setHeyGenKey('');
                  fetchConfig();
                }}
                disabled={savingKeys}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--sidebar-border)',
                  background: 'none',
                  color: 'var(--text-color)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}



        {/* ── Prompt / Question Input ── */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'var(--muted-color)', marginBottom: 10,
          }}>
            📝 Your Script / Question
          </label>
          <textarea
            rows={5}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={
              language === 'tamil'
                ? 'இங்கே உங்கள் ஸ்கிரிப்ட் அல்லது கேள்வியை உள்ளிடுங்கள்… (e.g. Python என்றால் என்ன? அல்லது வணக்கம்! இது FIC AI வீடியோ…)'
                : 'Enter your script or question here… (e.g. What is HTML? or Hello! Welcome to FIC AI. Today we will explore…)'
            }
            disabled={loading}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 14,
              border: '1.5px solid var(--chat-input-container-border)',
              background: 'var(--chat-input-bg)',
              color: 'var(--chat-input-text)',
              fontSize: 14,
              lineHeight: 1.7,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit',
              opacity: loading ? 0.5 : 1,
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-color)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--chat-input-container-border)'; }}
          />
          <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-color)' }}>
            💡 Write a question (like "What is HTML?") to automatically generate a classroom tutorial video, or enter a custom script for the presenter to speak directly. Press Ctrl+Enter to generate.
          </p>
        </div>

        {/* Language Selection */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'var(--muted-color)', marginBottom: 10,
          }}>
            🌐 Language
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map(lang => {
              const active = language === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  disabled={loading}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: active ? '2px solid var(--accent-color)' : '1.5px solid var(--sidebar-border)',
                    background: active ? 'rgba(16,185,129,0.08)' : 'var(--chat-bubble-assistant-bg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'all 0.2s',
                    boxShadow: active ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none',
                    textAlign: 'left',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 28 }}>{lang.flag}</span>
                  <div>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: active ? 'var(--accent-color)' : 'var(--text-color)',
                    }}>{lang.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-color)', marginTop: 2 }}>{lang.desc}</div>
                  </div>
                  {active && (

                    <span style={{
                      marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--accent-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 900, flexShrink: 0,
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>


        {/* Voice Gender */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            color: 'var(--muted-color)', marginBottom: 10,
          }}>
            🎙️ AI Voice Selection
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VOICES.map(v => {
              const active = gender === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setGender(v.id)}
                  disabled={loading}
                  style={{
                    padding: '20px',
                    borderRadius: 14,
                    border: active ? `2px solid ${v.color}` : '1.5px solid var(--sidebar-border)',
                    background: active ? v.bg : 'var(--chat-bubble-assistant-bg)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: active ? `0 0 0 3px ${v.border}` : 'none',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 36 }}>{v.icon}</span>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: active ? v.color : 'var(--text-color)',
                  }}>{v.label} Voice</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-color)' }}>{v.desc}</div>
                  {active && (
                    <span style={{
                      marginTop: 4, padding: '3px 12px', borderRadius: 20,
                      background: v.color, color: '#fff',
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                    }}>SELECTED</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aspect Ratio + Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">

          {/* Aspect Ratio */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.09em',
              color: 'var(--muted-color)', marginBottom: 10,
            }}>
              📐 Aspect Ratio
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RATIOS.map(r => {
                const active = aspectRatio === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setAspectRatio(r.id)}
                    disabled={loading}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: active ? '2px solid var(--accent-color)' : '1px solid var(--sidebar-border)',
                      background: active ? 'rgba(16,185,129,0.08)' : 'var(--chat-bubble-assistant-bg)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all 0.2s',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{r.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--accent-color)' : 'var(--text-color)' }}>{r.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-color)' }}>{r.desc}</div>
                    </div>
                    {active && <span style={{ marginLeft: 'auto', color: 'var(--accent-color)', fontWeight: 900, fontSize: 14 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.09em',
              color: 'var(--muted-color)', marginBottom: 10,
            }}>
              ⏱️ Duration: <span style={{ color: 'var(--accent-color)' }}>{duration}s</span>
            </label>
            <input
              type="range"
              min={3}
              max={30}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={loading}
              style={{
                width: '100%',
                accentColor: 'var(--accent-color)',
                cursor: 'pointer',
                marginBottom: 8,
                opacity: loading ? 0.5 : 1,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-color)' }}>
              <span>3s</span><span>30s</span>
            </div>

            {/* Summary Card */}
            <div style={{
              marginTop: 16,
              padding: '14px',
              borderRadius: 12,
              border: '1px solid var(--sidebar-border)',
              background: 'var(--chat-bubble-assistant-bg)',
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                🎬 Generation Summary
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['Language', language === 'tamil' ? 'தமிழ் (Tamil)' : 'English'],
                  ['Voice', `${selectedVoice?.icon} ${selectedVoice?.label}`],
                  ['Provider', selectedProvider === 'heygen' ? 'HeyGen (Realistic)' : 'D-ID (Expressive Mia)'],
                  ['Avatar', avatarUrl || localAvatarUrl ? '🖼️ Custom Photo' : selectedProvider === 'heygen' ? '👥 HeyGen Avatar' : '👩 Mia Elegant'],
                  ['Ratio', aspectRatio],
                  ['Duration', `${duration} seconds`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--muted-color)' }}>{k}</span>
                    <span style={{ color: avatarUploading && k === 'Avatar' ? '#f59e0b' : (avatarUrl || localAvatarUrl) && k === 'Avatar' ? 'var(--accent-color)' : 'var(--text-color)', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {loading && progress > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: '100%', height: 6, borderRadius: 6,
              background: 'var(--sidebar-border)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent-color), #06b6d4)',
                borderRadius: 6,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-color)', textAlign: 'center' }}>
              {progress < 30
                ? '🎙️ Preparing your script & voice…'
                : progress < 65
                ? '🤖 AI presenter is speaking your script…'
                : progress < 88
                ? '🎬 Finalising video — almost done…'
                : '✅ Wrapping up…'} {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Error Panel */}
        {error && (() => {
          const hint = 'Add valid API keys via the ⚙️ Settings button above, or top up your D-ID / HeyGen credits.';
          const providerIconMap = { 'D-ID': '👤', 'HeyGen': '🌟', 'Local Fallback': '💻' };
          const providerColorMap = { 'D-ID': '#f87171', 'HeyGen': '#fb923c', 'Local Fallback': '#a78bfa' };

          return (
            <div style={{
              marginBottom: 20,
              borderRadius: 16,
              border: '1.5px solid rgba(239,68,68,0.3)',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(220,38,38,0.03) 100%)',
              overflow: 'hidden',
            }}>
              {/* Header Row */}
              <div style={{
                padding: '14px 16px',
                background: 'rgba(239,68,68,0.10)',
                borderBottom: providerErrors.length > 0 ? '1px solid rgba(239,68,68,0.2)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f87171', fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>
                    Video Generation Failed
                  </div>
                  <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                    {providerErrors.length > 0
                      ? `${providerErrors.length} provider${providerErrors.length > 1 ? 's' : ''} attempted — all failed`
                      : error}
                  </div>
                </div>
                <button
                  onClick={() => { setError(null); setProviderErrors([]); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 4 }}
                  title="Dismiss"
                >✕</button>
              </div>

              {/* Per-Provider Breakdown */}
              {providerErrors.length > 0 && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {providerErrors.map((pe, i) => {
                    const icon = providerIconMap[pe.provider] || '⚠️';
                    const color = providerColorMap[pe.provider] || '#f87171';
                    return (
                      <div key={i} style={{
                        borderRadius: 10,
                        border: `1px solid ${color}30`,
                        background: `${color}08`,
                        padding: '10px 12px',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        {/* Provider Name + Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 14 }}>{icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: '0.04em' }}>
                            {pe.provider}
                          </span>
                          <span style={{
                            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 20,
                            background: `${color}20`, color,
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                          }}>FAILED</span>
                        </div>
                        {/* Reason */}
                        <div style={{ fontSize: 11.5, color: '#fca5a5', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, color: '#f87171' }}>✖ Why: </span>
                          {pe.reason}
                        </div>
                        {/* Fix */}
                        <div style={{
                          fontSize: 11, lineHeight: 1.5,
                          padding: '6px 10px', borderRadius: 7,
                          background: 'rgba(16,185,129,0.07)',
                          border: '1px solid rgba(16,185,129,0.2)',
                          color: '#6ee7b7',
                        }}>
                          <span style={{ fontWeight: 700 }}>✔ Fix: </span>
                          {pe.fix}
                        </div>
                      </div>
                    );
                  })}

                  {/* Global Hint */}
                  <div style={{
                    marginTop: 2,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(251,191,36,0.07)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    fontSize: 11, color: '#fbbf24', lineHeight: 1.5,
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                    <span>{hint}</span>
                  </div>
                </div>
              )}

              {/* Fallback hint when no structured provider errors */}
              {providerErrors.length === 0 && (
                <div style={{ padding: '10px 16px 12px', fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
                  💡 Open Settings (⚙️) to add/update your D-ID or HeyGen API keys, or top up your account credits.{' '}
                  <a href="https://studio.d-id.com/account-settings" target="_blank" rel="noreferrer" style={{ color: '#fb923c', textDecoration: 'underline' }}>
                    Get D-ID credits →
                  </a>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Generate Video Button ── */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim() || avatarUploading}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            cursor: (loading || !prompt.trim() || avatarUploading) ? 'not-allowed' : 'pointer',
            background: avatarUploading ? 'rgba(245,158,11,0.7)' : 'var(--chat-send-btn-bg)',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: (loading || !prompt.trim() || avatarUploading) ? (avatarUploading ? 0.85 : 0.4) : 1,
            transition: 'all 0.2s',
            marginBottom: 28,
            boxShadow: '0 4px 20px rgba(16,185,129,0.25)',
          }}
          onMouseEnter={e => { if (!loading && prompt.trim() && !avatarUploading) e.currentTarget.style.filter = 'brightness(1.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
        >
          {avatarUploading ? (
            <>
              <svg style={{ animation: 'spin 1s linear infinite', width: 18, height: 18 }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Uploading your photo to D-ID…
            </>
          ) : loading ? (
            <>
              <svg style={{ animation: 'spin 1s linear infinite', width: 18, height: 18 }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Generating {language === 'tamil' ? 'Tamil' : 'English'} {selectedVoice?.label} Voice Video…
            </>
          ) : (
            <>
              <span style={{ fontSize: 18 }}>🎬</span>
              Generate {language === 'tamil' ? 'Tamil' : 'English'} {selectedVoice?.label} AI Video
            </>
          )}
        </button>
          </div> {/* End Left Column */}

          {/* RIGHT COLUMN: PREVIEW CANVAS & RESULTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            

            {/* Empty Preview Placeholder */}
            {!videoUrl && !loading && (
              <div style={{
                border: '1.5px dashed var(--sidebar-border)',
                borderRadius: 16,
                padding: '60px 40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}>
                <span style={{ fontSize: 48 }}>🎬</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-color)' }}>
                  AI Video Preview Canvas
                </h4>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-color)', lineHeight: 1.6, maxWidth: 280 }}>
                  Configure your script and voice settings on the left, then click generate to compile your talking presenter!
                </p>
              </div>
            )}

        {/* Result: Unified Video Player */}
        {videoUrl && (
          <div style={{
            marginBottom: 28, padding: '24px',
            borderRadius: 14, border: '1px solid var(--chat-bubble-assistant-border)',
            background: 'var(--chat-bubble-assistant-bg)',
          }}>
            <p style={{ margin: '0 0 14px 0', fontSize: 12, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🎬 Generated AI Talking Video
            </p>

            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, background: '#000', marginBottom: 16 }}>
              {provider === 'local-fallback' && audioUrl ? (
                <>
                  {/\.(jpg|jpeg|png|webp)$/i.test(videoUrl) ? (
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--chat-bubble-assistant-bg)' }}>
                      <img
                        src={videoUrl}
                        alt="AI Presenter"
                        style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 }}
                      />
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        style={{ width: '100%' }}
                      />
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        loop
                        muted
                        style={{ width: '100%', display: 'block', maxHeight: 400 }}
                      />
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        controls
                        style={{ width: '100%', display: 'block', marginTop: 10 }}
                        onPlay={() => { if (videoRef.current) videoRef.current.play(); }}
                        onPause={() => { if (videoRef.current) videoRef.current.pause(); }}
                        onEnded={() => { if (videoRef.current) videoRef.current.pause(); }}
                      />
                      <div style={{
                        padding: '8px 12px', background: 'rgba(16,185,129,0.1)',
                        borderTop: '1px solid rgba(16,185,129,0.15)',
                        color: 'var(--accent-color)', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        <span>🗣️ Custom Voice Sync Enabled</span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  style={{ width: '100%', display: 'block', maxHeight: 400 }}
                />
              )}
            </div>

            {/* Structured Video Transcript Box */}
            {generatedScript && (
              <div style={{
                marginBottom: 20,
                borderRadius: 12,
                border: '1px solid rgba(16,185,129,0.18)',
                background: 'rgba(16,185,129,0.02)',
                padding: '14px 16px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--accent-color)',
                  marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>📝 Video script & Lesson breakdown</span>
                </div>
                
                {(() => {
                  const sections = [
                    { label: '📖 Introduction & Definition', color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.18)' },
                    { label: '🎯 Purpose — Why It Matters',   color: '#34d399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.18)' },
                    { label: '🌐 Real-World Uses',            color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.18)' },
                    { label: '✅ Key Takeaway',               color: '#c4b5fd', bg: 'rgba(196,181,253,0.07)', border: 'rgba(196,181,253,0.18)' },
                  ];

                  const text = generatedScript.trim();
                  // Split the script by sentences and group into 4 parts
                  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
                  const total = sentences.length;
                  const chunkSize = Math.max(1, Math.ceil(total / 4));
                  const parts = [0, 1, 2, 3].map(i =>
                    sentences.slice(i * chunkSize, (i + 1) * chunkSize).join(' ').trim()
                  ).filter(p => p.length > 0);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {parts.map((part, i) => {
                        const sec = sections[i] || sections[sections.length - 1];
                        return (
                          <div key={i} style={{
                            borderRadius: 8, padding: '10px 12px',
                            background: sec.bg,
                            border: `1px solid ${sec.border}`,
                          }}>
                            <div style={{
                              fontSize: 9, fontWeight: 800, color: sec.color,
                              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                            }}>
                              {sec.label}
                            </div>
                            <div style={{
                              fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-color)',
                            }}>
                              {part}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {videoUrl && (
                <a
                  href={videoUrl}
                  download="fic-ai-video.mp4"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: 'var(--accent-color)', fontWeight: 700,
                    textDecoration: 'none', background: 'rgba(16,185,129,0.08)',
                    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)'
                  }}
                >
                  ⬇️ Download Video file
                </a>
              )}
              {audioUrl && (
                <a
                  href={audioUrl}
                  download="fic-ai-narration.mp3"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: 'var(--accent-color)', fontWeight: 700,
                    textDecoration: 'none', background: 'rgba(16,185,129,0.08)',
                    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)'
                  }}
                >
                  🔊 Download Audio track
                </a>
              )}
            </div>
            
            <p style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--muted-color)' }}>
              Tip: The video contains the synced voice narration. Press play on the video player above to watch and listen.
            </p>
          </div>
        )}
          </div> {/* End Right Column */}
        </div> {/* End Split Grid */}
      </div>

      {/* ── 30-Day History Panel ── */}
      {history.length > 0 && (
        <div style={{
          margin: '0 28px 28px',
          borderRadius: 14,
          border: '1.5px solid var(--border-color)',
          background: 'var(--chat-bubble-assistant-bg)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowPanel(p => !p)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '14px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: showPanel ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'var(--text-color)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🕐 Video History
              <span style={{ background: 'var(--accent-color)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 900 }}>{history.length}</span>
            </span>
            <span style={{ color: 'var(--muted-color)', fontSize: 12 }}>{showPanel ? '▲' : '▼'}</span>
          </button>

          {showPanel && (
            <div style={{ padding: '16px 20px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, color: 'var(--muted-color)' }}>Showing last 30 days · Items auto-delete after 30 days</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {history.map(item => (
                  <div key={item.id} style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: '1.5px solid var(--border-color)',
                    background: 'var(--bg-color)',
                    transition: 'transform 0.2s, border-color 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#111', overflow: 'hidden' }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="thumbnail" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎬</div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      <p style={{ margin: '3px 0 8px', fontSize: 10, color: 'var(--muted-color)' }}>{timeAgo(item.createdAt)} · {item.gender}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {item.videoUrl && (
                          <a href={item.videoUrl} download="fic-video.mp4"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--accent-color)', background: 'rgba(16,185,129,0.08)', padding: '6px 0', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', textDecoration: 'none' }}
                          >⬇️ Video</a>
                        )}
                        {item.audioUrl && (
                          <a href={item.audioUrl} download="fic-audio.mp3"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', padding: '6px 0', borderRadius: 8, border: '1px solid rgba(167,139,250,0.2)', textDecoration: 'none' }}
                          >🔊 Audio</a>
                        )}
                        <button
                          onClick={() => deleteFromHistory(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-color)', fontSize: 12, padding: '4px 6px', borderRadius: 6, transition: 'color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-color)'}
                          title="Delete"
                        >✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kenburns { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
      `}</style>

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails('video')}
      />
    </div>
  );
}

export default VideoGenerator;
