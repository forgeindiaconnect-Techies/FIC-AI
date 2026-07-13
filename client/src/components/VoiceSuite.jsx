// client/src/components/VoiceSuite.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

const LANGUAGES = [
  { id: 'english', label: 'English 🇬🇧', locale: 'en-US' },
  { id: 'tamil', label: 'Tamil 🇮🇳', locale: 'ta-IN' },
  { id: 'hindi', label: 'Hindi 🇮🇳', locale: 'hi-IN' },
];

export default function VoiceSuite() {
  const [activeTab, setActiveTab] = useState('tts'); // 'tts', 'chat', 'clone'
  
  // Voices lists
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('ErXwobaYiN019atkyzla'); // default Antoni

  // TTS States
  const [ttsText, setTtsText] = useState('');
  const [generatingTts, setGeneratingTts] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [ttsMessage, setTtsMessage] = useState(null);
  const [ttsError, setTtsError] = useState(null);
  
  // TTS Settings
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0.0);

  // Cloning States
  const [cloneName, setCloneName] = useState('');
  const [cloneDesc, setCloneDesc] = useState('');
  const [cloneFile, setCloneFile] = useState(null);
  const [cloning, setCloning] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(null);
  const [cloneError, setCloneError] = useState(null);

  // Voice Chat States
  const [chatStatus, setChatStatus] = useState('idle'); // 'idle', 'listening', 'thinking', 'speaking'
  const [chatLanguage, setChatLanguage] = useState('english');
  const [chatHistory, setChatHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [chatVoice, setChatVoice] = useState('boy'); // 'boy' or 'girl'
  
  const recognitionRef = useRef(null);
  const chatAudioRef = useRef(new Audio());
  const chatEndRef = useRef(null);

  // Fetch voices list on mount
  const fetchVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await axios.get(`${API_URL}/api/voice/list`);
      if (res.data?.success) {
        setVoices(res.data.voices || []);
        if (res.data.voices?.length > 0) {
          setSelectedVoice(res.data.voices[0].voiceId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch voices:', err);
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    fetchVoices();
  }, []);

  // Scroll to bottom of chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Handle TTS synthesis
  const handleGenerateTts = async () => {
    if (!ttsText.trim()) return;
    if (isLimitReached('voice')) {
      setShowLimitModal(true);
      return;
    }
    setGeneratingTts(true);
    setTtsError(null);
    setTtsMessage(null);
    setTtsAudioUrl(null);

    try {
      const res = await axios.post(`${API_URL}/api/voice/generate`, {
        text: ttsText,
        voiceId: selectedVoice,
        stability,
        similarityBoost: similarity,
        style,
      });

      if (res.data?.success) {
        let url = res.data.audioUrl;
        if (!url.startsWith('http')) {
          url = `${API_URL}${url}`;
        }
        setTtsAudioUrl(url);
        if (res.data.message) {
          setTtsMessage(res.data.message);
        }
        incrementUsage('voice'); // Increment voice usage!
      } else {
        throw new Error(res.data?.error || 'TTS generation failed');
      }
    } catch (err) {
      setTtsError(err.response?.data?.error || err.message || 'Failed to synthesize speech.');
    } finally {
      setGeneratingTts(false);
    }
  };

  // Handle voice clone upload
  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!cloneFile || !cloneName.trim()) return;
    
    setCloning(true);
    setCloneError(null);
    setCloneSuccess(null);

    const formData = new FormData();
    formData.append('file', cloneFile);
    formData.append('name', cloneName);
    formData.append('description', cloneDesc);

    try {
      const res = await axios.post(`${API_URL}/api/voice/clone`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setCloneSuccess(`Successfully cloned voice: "${res.data.name}"!`);
        setCloneName('');
        setCloneDesc('');
        setCloneFile(null);
        // Refresh voices list
        await fetchVoices();
      } else {
        throw new Error(res.data?.error || 'Voice cloning failed');
      }
    } catch (err) {
      setCloneError(err.response?.data?.error || err.message || 'Voice cloning failed.');
    } finally {
      setCloning(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VOICE CHAT (PHONE CALL) SYSTEM
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Setup SpeechRecognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support Speech Recognition. Please use Google Chrome or Microsoft Edge.');
      return null;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    
    const activeLang = LANGUAGES.find(l => l.id === chatLanguage);
    rec.lang = activeLang ? activeLang.locale : 'en-US';

    rec.onstart = () => {
      setChatStatus('listening');
      setTranscript('');
    };

    rec.onresult = async (event) => {
      const resultText = event.results[0][0].transcript;
      if (!resultText.trim()) return;
      
      console.log('[Voice Chat] User spoke:', resultText);
      setChatHistory(prev => [...prev, { role: 'user', text: resultText }]);
      setChatStatus('thinking');

      // Send to AI chat agent
      try {
        const response = await axios.post(`${API_URL}/api/chat`, { message: resultText });
        const aiText = response.data?.reply || response.data?.response || '';
        
        if (aiText) {
          setChatHistory(prev => [...prev, { role: 'assistant', text: aiText }]);
          playResponseTTS(aiText);
        } else {
          throw new Error('No reply from AI');
        }
      } catch (err) {
        console.error('[Voice Chat] Error fetching AI response:', err);
        setChatHistory(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error. Let us try speaking again.' }]);
        setChatStatus('listening');
        startListening();
      }
    };

    rec.onerror = (e) => {
      console.warn('[Voice Chat] Speech Recognition error:', e.error);
      if (e.error === 'no-speech') {
        // Just restart listening if they paused
        startListening();
      } else {
        setChatStatus('idle');
      }
    };

    rec.onend = () => {
      // Don't auto-restart if we are thinking or speaking
      if (chatStatus === 'listening') {
        startListening();
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  const startListening = () => {
    if (!recognitionRef.current) initSpeechRecognition();
    try {
      recognitionRef.current.start();
    } catch (_) {}
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
  };

  const playResponseTTS = async (text) => {
    setChatStatus('speaking');
    try {
      // Choose ElevenLabs premium voice ID based on selected gender
      const voiceId = chatVoice === 'boy' ? 'NbkKnEAZ7Bqw4EAkVEaz' : '21m00Tcm4TlvDq8ikWAM';
      
      console.log(`[Voice Chat] Synthesizing speech with ElevenLabs Voice ID: ${voiceId}...`);
      const response = await axios.post(`${API_URL}/api/voice/generate`, {
        text: text.trim(),
        voiceId
      });

      if (response.data?.success && response.data.audioUrl) {
        let playUrl = response.data.audioUrl;
        if (!playUrl.startsWith('http')) {
          playUrl = `${API_URL}${playUrl}`;
        }
        
        chatAudioRef.current.src = playUrl;
        chatAudioRef.current.load();
      } else {
        throw new Error('ElevenLabs API response invalid, falling back');
      }
    } catch (err) {
      console.warn('[Voice Chat] Premium ElevenLabs TTS synthesis failed, falling back to standard voice engine:', err.message);
      // Fallback: Synthesize using standard free tts route
      const cleanText = encodeURIComponent(text.trim());
      const resUrl = `${API_URL}/api/video/tts?text=${cleanText}&lang=${chatLanguage}&gender=${chatVoice === 'boy' ? 'male' : 'female'}&t=${Date.now()}`;
      
      chatAudioRef.current.src = resUrl;
      chatAudioRef.current.load();
    }

    try {
      chatAudioRef.current.onended = () => {
        // Start listening again once AI finishes speaking
        setChatStatus('listening');
        startListening();
      };
      await chatAudioRef.current.play();
    } catch (playErr) {
      console.error('[Voice Chat] Audio playback error:', playErr.message);
      // Resume listening loop on play error to prevent call hanging
      setChatStatus('listening');
      startListening();
    }
  };

  const startPhoneCall = () => {
    if (isLimitReached('voice')) {
      setShowLimitModal(true);
      return;
    }
    setChatHistory([{ role: 'assistant', text: chatLanguage === 'tamil' ? 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?' : 'Hello! I am connected. What would you like to talk about today?' }]);
    const initialText = chatLanguage === 'tamil' ? 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?' : 'Hello! I am connected. What would you like to talk about today?';
    
    initSpeechRecognition();
    playResponseTTS(initialText);
  };

  const endPhoneCall = () => {
    stopListening();
    chatAudioRef.current.pause();
    setChatStatus('idle');
    setChatHistory([]);
  };

  // Cleanup audio/speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      chatAudioRef.current.pause();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-color)',
      overflowY: 'auto',
    }}>
      {/* HEADER */}
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
          <span style={{ fontSize: 20 }}>🎙️</span>
          <span style={{ color: 'var(--header-text)', fontSize: 14, fontWeight: 700 }}>FIC AI</span>
          <span style={{ color: 'var(--muted-color)', fontSize: 12 }}>/ Voice AI Suite</span>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, padding: '28px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* TAB BUTTONS */}
        <div style={{
          display: 'flex',
          gap: 10,
          background: 'rgba(0,0,0,0.1)',
          padding: 6,
          borderRadius: 14,
          marginBottom: 28,
        }}>
          {[
            { id: 'tts', label: '📢 Text to Speech Studio' },
            { id: 'chat', label: '🤖 Voice Chat Call' },
            { id: 'clone', label: '👥 Voice Cloning Studio' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                endPhoneCall();
                setActiveTab(tab.id);
              }}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                transition: 'all 0.2s',
                background: activeTab === tab.id ? 'var(--accent-color)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--muted-color)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 📢 TAB 1: TEXT TO SPEECH STUDIO */}
        {activeTab === 'tts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Input Script */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-color)' }}>
                Enter Script to Speak
              </label>
              <textarea
                rows={5}
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                placeholder="Type your script here. Adjust settings below and generate premium neural voice speech..."
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 14,
                  border: '1.5px solid var(--sidebar-border)',
                  background: 'var(--chat-input-bg)',
                  color: 'var(--text-color)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Voice select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-color)' }}>
                Select AI Voice Model
              </label>
              {loadingVoices ? (
                <div style={{ fontSize: 12, color: 'var(--muted-color)' }}>Loading voices library...</div>
              ) : (
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1.5px solid var(--sidebar-border)',
                    background: 'var(--chat-input-bg)',
                    color: 'var(--text-color)',
                    outline: 'none',
                  }}
                >
                  {voices.map(v => (
                    <option key={v.voiceId} value={v.voiceId}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Premium ElevenLabs Settings Sliders */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--sidebar-border)',
              padding: 20,
              borderRadius: 14,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                🎛️ Premium Voice Tuning (ElevenLabs)
              </p>
              
              {/* Stability */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>Stability (Emotion Control)</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(stability * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={stability} onChange={e => setStability(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
                <span style={{ fontSize: 10, color: 'var(--muted-color)' }}>
                  Lower stability adds more expressive emotions and speech fluctuations. Higher stability is monotone.
                </span>
              </div>

              {/* Similarity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>Clarity & Similarity Boost</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(similarity * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={similarity} onChange={e => setSimilarity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>

              {/* Style exaggeration */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>Style Exaggeration</span>
                  <span style={{ fontWeight: 700 }}>{Math.round(style * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={style} onChange={e => setStyle(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>
            </div>

            {/* Error/Info messages */}
            {ttsError && (
              <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12 }}>
                ⚠️ {ttsError}
              </div>
            )}
            {ttsMessage && (
              <div style={{ padding: 14, background: 'rgba(16,185,129,0.1)', color: 'var(--accent-color)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12 }}>
                ℹ️ {ttsMessage}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerateTts}
              disabled={generatingTts || !ttsText.trim()}
              style={{
                padding: '16px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: (generatingTts || !ttsText.trim()) ? 'not-allowed' : 'pointer',
                opacity: (generatingTts || !ttsText.trim()) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {generatingTts ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Synthesizing Speech...
                </>
              ) : '📢 Generate Speech Output'}
            </button>

            {/* Result player */}
            {ttsAudioUrl && (
              <div style={{
                marginTop: 10,
                padding: 20,
                borderRadius: 14,
                border: '1.5px solid var(--sidebar-border)',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  🔊 synthesized audio player
                </span>
                <audio src={ttsAudioUrl} controls style={{ width: '100%' }} />
                <a
                  href={ttsAudioUrl}
                  download="fic-synthesized-speech.mp3"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'var(--accent-color)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  📥 Download MP3 Audio
                </a>
              </div>
            )}
          </div>
        )}

        {/* 🤖 TAB 2: INTERACTIVE VOICE CHAT CALL */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* CALL CONFIG PANEL */}
            {chatStatus === 'idle' ? (
              <div style={{
                padding: '24px',
                borderRadius: 16,
                border: '1.5px solid var(--sidebar-border)',
                background: 'var(--chat-bubble-assistant-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-color)' }}>
                  📞 Initialize Interactive AI Voice Call
                </h4>
                
                {/* Language Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-color)' }}>Select Conversation Language</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {LANGUAGES.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setChatLanguage(l.id)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: chatLanguage === l.id ? '2px solid var(--accent-color)' : '1px solid var(--sidebar-border)',
                          background: chatLanguage === l.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                          color: chatLanguage === l.id ? 'var(--accent-color)' : 'var(--text-color)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice Gender select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-color)' }}>Select AI Voice</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'boy', label: '👨 Male Voice (Brian)', color: '#3b82f6' },
                      { id: 'girl', label: '👩 Female Voice (Emma)', color: '#ec4899' }
                    ].map(v => (
                      <button
                        key={v.id}
                        onClick={() => setChatVoice(v.id)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: chatVoice === v.id ? `2px solid ${v.color}` : '1px solid var(--sidebar-border)',
                          background: chatVoice === v.id ? 'rgba(59,130,246,0.05)' : 'transparent',
                          color: chatVoice === v.id ? v.color : 'var(--text-color)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Call Start button */}
                <button
                  onClick={startPhoneCall}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  🟢 Start Voice Call
                </button>
              </div>
            ) : (
              /* CALL ACTIVE PANEL */
              <div style={{
                padding: '30px',
                borderRadius: 20,
                border: '1.5px solid var(--accent-color)',
                background: 'rgba(5, 7, 12, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                boxShadow: '0 12px 48px rgba(16, 185, 129, 0.15)',
              }}>
                {/* Visualizer Pulse Indicator */}
                <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Outer glowing rings during speech/listening */}
                  {chatStatus !== 'idle' && (
                    <>
                      <div style={{
                        position: 'absolute', inset: -15, borderRadius: '50%',
                        background: chatStatus === 'listening' ? 'rgba(16,185,129,0.06)' : chatStatus === 'speaking' ? 'rgba(59,130,246,0.06)' : 'rgba(245,158,11,0.04)',
                        animation: 'pulse 1.8s infinite ease-in-out',
                      }} />
                      <div style={{
                        position: 'absolute', inset: -30, borderRadius: '50%',
                        background: chatStatus === 'listening' ? 'rgba(16,185,129,0.03)' : chatStatus === 'speaking' ? 'rgba(59,130,246,0.03)' : 'rgba(245,158,11,0.02)',
                        animation: 'pulse 2.2s infinite ease-in-out 0.4s',
                      }} />
                    </>
                  )}
                  {/* Central Avatar */}
                  <div style={{
                    width: 76, height: 76, borderRadius: '50%',
                    background: chatStatus === 'listening' ? 'var(--accent-color)' : chatStatus === 'speaking' ? '#3b82f6' : '#f59e0b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                    boxShadow: chatStatus === 'listening' ? '0 0 30px rgba(16,185,129,0.4)' : chatStatus === 'speaking' ? '0 0 30px rgba(59,130,246,0.4)' : '0 0 30px rgba(245,158,11,0.4)',
                    transition: 'all 0.3s ease',
                  }}>
                    {chatVoice === 'boy' ? '👨' : '👩'}
                  </div>
                </div>

                {/* Connection Status Subtitle */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    margin: '0 0 4px 0', fontSize: 16, fontWeight: 800,
                    color: chatStatus === 'listening' ? '#10b981' : chatStatus === 'speaking' ? '#3b82f6' : '#f59e0b',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {chatStatus === 'listening' ? '🎙️ Listening to You' : chatStatus === 'speaking' ? '🗣️ Speaking' : '⚡ Thinking...'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-color)' }}>
                    Call Language: {LANGUAGES.find(l => l.id === chatLanguage)?.label}
                  </p>
                </div>

                {/* Mini scrolling transcription screen */}
                <div style={{
                  width: '100%',
                  height: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--sidebar-border)',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.3)',
                  padding: '16px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}>
                  {chatHistory.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: h.role === 'user' ? 'flex-end' : 'flex-start',
                        background: h.role === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        padding: '10px 14px',
                        borderRadius: 12,
                        maxWidth: '85%',
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      {h.text}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Hang up call button */}
                <button
                  onClick={endPhoneCall}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 24,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
                  }}
                >
                  🔴 Hang Up Call
                </button>
              </div>
            )}
          </div>
        )}

        {/* 👥 TAB 3: VOICE CLONING STUDIO */}
        {activeTab === 'clone' && (
          <form onSubmit={handleCloneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: 'rgba(124, 58, 237, 0.05)',
              border: '1px dashed rgba(124, 58, 237, 0.35)',
              borderRadius: 16,
              padding: 24,
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 32 }}>🎙️</span>
              <h4 style={{ margin: '10px 0 6px 0', fontSize: 15, fontWeight: 800, color: 'var(--text-color)' }}>
                Instant AI Voice Cloning (ElevenLabs)
              </h4>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-color)', lineHeight: 1.6 }}>
                Upload a 5-second to 2-minute clear audio clip speaking in a microphone (MP3/WAV format). The AI will create a cloned voice that sounds exactly like the recording speaker!
              </p>
            </div>

            {/* Voice Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-color)' }}>
                Voice Name
              </label>
              <input
                type="text"
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                placeholder="e.g. My Voice Model, Vaidee Voice"
                required
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--sidebar-border)',
                  background: 'var(--chat-input-bg)',
                  color: 'var(--text-color)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Voice Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-color)' }}>
                Description
              </label>
              <input
                type="text"
                value={cloneDesc}
                onChange={e => setCloneDesc(e.target.value)}
                placeholder="Describe the cloned speaker voice tone (e.g. deep male, soft female)"
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--sidebar-border)',
                  background: 'var(--chat-input-bg)',
                  color: 'var(--text-color)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Audio File upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-color)' }}>
                Upload Voice Recording File
              </label>
              <input
                type="file"
                accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav"
                required
                onChange={e => setCloneFile(e.target.files[0])}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--sidebar-border)',
                  color: 'var(--text-color)',
                }}
              />
            </div>

            {/* Status alerts */}
            {cloneError && (
              <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12 }}>
                ⚠️ {cloneError}
              </div>
            )}
            {cloneSuccess && (
              <div style={{ padding: 14, background: 'rgba(16,185,129,0.1)', color: 'var(--accent-color)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12 }}>
                ✅ {cloneSuccess}
              </div>
            )}

            {/* Clone Button */}
            <button
              type="submit"
              disabled={cloning || !cloneFile || !cloneName.trim()}
              style={{
                padding: '16px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: (cloning || !cloneFile || !cloneName.trim()) ? 'not-allowed' : 'pointer',
                opacity: (cloning || !cloneFile || !cloneName.trim()) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {cloning ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Uploading and Cloning Voice...
                </>
              ) : '👥 Clone and Add Custom Voice'}
            </button>
          </form>
        )}
      </div>

      {/* Embedded visual styles for visual visualizer pulse */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.6; }
        }
      `}</style>

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails('voice')}
      />
    </div>
  );
}
