import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/api.js';
import { useToolHistory, timeAgo } from '../hooks/useToolHistory';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

// ── Format definitions ──────────────────────────────────────────────────────
const DOC_META = {
  pdf:   { icon: '📄', label: 'PDF Document',      color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   desc: 'Export as publication-ready PDF' },
  docx:  { icon: '📝', label: 'Word Document',     color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', desc: 'Export as editable Word file' },
  pptx:  { icon: '📊', label: 'Presentation (PPT)',color: '#a855f7', bg: 'rgba(168,85,247,0.08)', desc: 'Export as PowerPoint slides' },
  xlsx:  { icon: '📈', label: 'Excel Spreadsheet', color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  desc: 'Export as formatted data sheet' },
  video: { icon: '🎬', label: 'AI Presenter Video',color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', desc: 'Generate video with AI speaker' },
};

const getDocMeta = (key) => {
  const norm = key === 'word' ? 'docx' : (key === 'ppt' ? 'pptx' : (key === 'excel' ? 'xlsx' : key));
  return DOC_META[norm] || DOC_META.pdf;
};

const QUICK_PROMPTS = [
  { label: 'MERN Stack Full Explain',   prompt: 'Explain MERN Stack' },
  { label: 'OOP Concepts Full Guide',   prompt: 'Explain OOPs Concepts' },
  { label: 'React.js Complete Guide',   prompt: 'Explain React.js' },
  { label: 'Python Full Tutorial',      prompt: 'Explain Python programming language' },
  { label: 'Data Structures & Algo',   prompt: 'Explain Data Structures and Algorithms' },
  { label: 'Machine Learning Guide',    prompt: 'Explain Machine Learning' },
  { label: 'SQL Database Complete',     prompt: 'Explain SQL and Databases' },
  { label: 'Node.js Backend Guide',     prompt: 'Explain Node.js' },
];

const mdComponents = {
  p:    ({ children }) => <p style={{ margin: '0 0 12px 0', lineHeight: 1.8, fontSize: '13.5px' }}>{children}</p>,
  ul:   ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '10px 0' }}>{children}</ul>,
  ol:   ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '20px', margin: '10px 0' }}>{children}</ol>,
  li:   ({ children }) => <li style={{ marginBottom: 6, fontSize: '13px' }}>{children}</li>,
  h1:   ({ children }) => <h1 style={{ fontSize: '22px', fontWeight: 900, margin: '24px 0 12px', color: 'var(--text-color)', fontFamily: 'Outfit, sans-serif', borderBottom: '2px solid var(--border-color)', paddingBottom: 8 }}>{children}</h1>,
  h2:   ({ children }) => <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '20px 0 10px', color: 'var(--text-color)', fontFamily: 'Outfit, sans-serif' }}>{children}</h2>,
  h3:   ({ children }) => <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-color)', fontFamily: 'Outfit, sans-serif' }}>{children}</h3>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  table: ({ children }) => <div style={{ overflowX: 'auto', margin: '12px 0' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table></div>,
  th:    ({ children }) => <th style={{ background: 'var(--chat-bubble-assistant-bg)', padding: '8px 12px', border: '1px solid var(--border-color)', fontWeight: 700, textAlign: 'left' }}>{children}</th>,
  td:    ({ children }) => <td style={{ padding: '7px 12px', border: '1px solid var(--border-color)', verticalAlign: 'top' }}>{children}</td>,
  code: ({ inline, children }) => (
    inline ? (
      <code style={{ background: 'rgba(0,0,0,0.07)', borderRadius: 4, padding: '2px 5px', fontFamily: 'Consolas, monospace', fontSize: '12px' }}>{children}</code>
    ) : (
      <pre style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px', overflowX: 'auto', margin: '14px 0' }}>
        <code style={{ fontFamily: 'Consolas, monospace', fontSize: '12px', lineHeight: 1.6 }}>{children}</code>
      </pre>
    )
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '4px solid var(--accent-color)', paddingLeft: 14, margin: '14px 0', color: 'var(--muted-color)', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>{children}</blockquote>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />,
};

export default function DocumentGenerator() {
  const [prompt, setPrompt]           = useState('');
  const [status, setStatus]           = useState('idle');
  const [draftText, setDraftText]     = useState('');
  const [docTitle, setDocTitle]       = useState('');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [presenterGender, setPresenterGender] = useState('male');
  const [result, setResult]           = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitFeature, setLimitFeature] = useState('docs');
  const { history, addToHistory, deleteFromHistory, showPanel, setShowPanel } = useToolHistory('fic_doc_history', 50);

  const docVideoRef = useRef(null);
  const docAudioRef = useRef(null);

  const [editMode, setEditMode]       = useState('edit');
  const [inputFocused, setInputFocused] = useState(false);
  const [wordCount, setWordCount]     = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const words = draftText.trim() ? draftText.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }, [draftText]);

  const saveToHistory = (item) => {
    addToHistory({ ...item, createdAt: item.createdAt || Date.now() });
  };

  // Step 1: Prepare the content (AI draft)
  const handleDraftContent = async (customPrompt) => {
    const text = (customPrompt || prompt).trim();
    if (!text) return;

    if (!localStorage.getItem('fic_user_email')) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => handleDraftContent(customPrompt) }
      }));
      return;
    }

    setStatus('drafting');
    setResult(null);
    setErrorMsg('');
    setDraftText('');
    setEditMode('edit');

    try {
      const baseUrl = import.meta.env.VITE_API_URL || API_BASE_URL;
      const res = await axios.post(`${baseUrl}/api/documents/prepare`, { prompt: text }, {
        timeout: 180000,
      });

      if (res.data.success) {
        setDraftText(res.data.content);
        setDocTitle(res.data.title || text);
        setStatus('drafted');

        // Auto-detect best format
        const lower = text.toLowerCase();
        if (lower.includes('ppt') || lower.includes('presentation') || lower.includes('slide')) {
          setSelectedFormat('pptx');
        } else if (lower.includes('excel') || lower.includes('sheet') || lower.includes('xlsx')) {
          setSelectedFormat('xlsx');
        } else if (lower.includes('word') || lower.includes('docx') || lower.includes('doc')) {
          setSelectedFormat('docx');
        } else if (lower.includes('video')) {
          setSelectedFormat('video');
        } else {
          setSelectedFormat('pdf');
        }
      } else {
        throw new Error(res.data.error || 'Failed to draft document content');
      }
    } catch (err) {
      console.error('[DocGen Draft]', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Unknown error');
      setStatus('error');
    }
  };

  // Step 2: Generate the final file or video
  const handleCompileDocument = async () => {
    if (!draftText.trim()) return;

    if (selectedFormat === 'video') {
      if (isLimitReached('video')) {
        setLimitFeature('video');
        setShowLimitModal(true);
        return;
      }
    } else {
      if (isLimitReached('docs')) {
        setLimitFeature('docs');
        setShowLimitModal(true);
        return;
      }
    }

    setStatus('generating');
    setErrorMsg('');

    try {
      const baseUrl = import.meta.env.VITE_API_URL || API_BASE_URL;

      // ── VIDEO PATH ─────────────────────────────────────────────────────────
      if (selectedFormat === 'video') {
        const res = await axios.post(`${baseUrl}/api/documents/video`, {
          content: draftText,
          title: docTitle,
          gender: presenterGender,
          language: 'english',
        }, { timeout: 300000 });

        if (res.data.success) {
          const item = {
            id:        `vid-${Date.now()}`,
            prompt:    docTitle,
            docType:   'video',
            fileUrl:   `${baseUrl}${res.data.videoUrl}`,
            filename:  res.data.videoUrl?.split('/').pop() || 'video.mp4',
            timestamp: Date.now(),
            provider:  res.data.provider,
            gender:    res.data.gender,
            script:    res.data.script,
          };
          setResult(item);
          saveToHistory(item);
          setStatus('done');
          incrementUsage('video'); // Increment video usage!
        } else {
          throw new Error(res.data.error || 'Video generation failed');
        }
        return;
      }

      // ── DOCUMENT PATH ──────────────────────────────────────────────────────
      const res = await axios.post(`${baseUrl}/api/documents/generate`, {
        content: draftText,
        fileType: selectedFormat,
        title: docTitle
      }, { timeout: 120000 });

      if (res.data.success) {
        const item = {
          id:        `doc-${Date.now()}`,
          prompt:    docTitle,
          docType:   res.data.fileType === 'docx' ? 'docx' : (res.data.fileType === 'pptx' ? 'pptx' : (res.data.fileType === 'xlsx' ? 'xlsx' : 'pdf')),
          fileUrl:   res.data.downloadUrl,
          filename:  res.data.fileName || res.data.filename,
          timestamp: Date.now(),
        };
        setResult(item);
        saveToHistory(item);
        setStatus('done');
        downloadFile(res.data.downloadUrl, item.filename);
        incrementUsage('docs'); // Increment document generator usage!
      } else {
        throw new Error(res.data.error || 'Document compile failed');
      }
    } catch (err) {
      console.error('[DocGen Compile]', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Unknown error');
      setStatus('error');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDraftContent(); }
  };

  const downloadFile = (fileUrl, filename) => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteHistory = (id, e) => {
    e.stopPropagation();
    deleteFromHistory(id);
  };

  const isVideo = selectedFormat === 'video';
  const isGenerating = status === 'generating';
  const isDrafting = status === 'drafting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', color: 'var(--text-color)', fontFamily: 'Outfit, Inter, sans-serif' }}>

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📁</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>FIC AI</span>
          <span style={{ fontSize: 12, color: 'var(--muted-color)' }}>/ Document Generator Studio</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Input Card ── */}
        <div style={{ background: 'var(--chat-bubble-assistant-bg)', border: '1.5px solid var(--border-color)', borderRadius: 16, padding: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 10 }}>
            Enter Topic or Subject
          </label>
          <div className="flex flex-col sm:flex-row gap-3" style={{ alignItems: 'stretch' }}>
            <textarea
              ref={inputRef}
              rows={2}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="e.g. Explain MERN Stack · Explain OOPs Concepts · Explain React.js · Machine Learning Guide"
              style={{
                flex: 1,
                background: 'var(--bg-color)',
                border: inputFocused ? '1.5px solid var(--accent-color)' : '1.5px solid var(--border-color)',
                borderRadius: 10,
                padding: '12px 14px',
                color: 'var(--text-color)',
                fontSize: 14,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                boxShadow: inputFocused ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none'
              }}
            />
            <button
              onClick={() => handleDraftContent()}
              disabled={isDrafting || isGenerating || !prompt.trim()}
              style={{
                padding: '12px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent-color), #06b6d4)',
                color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
                opacity: (isDrafting || isGenerating || !prompt.trim()) ? 0.4 : 1,
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
                justifyContent: 'center'
              }}
            >
              {isDrafting ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 1s linear infinite' }} />
                  Preparing...
                </>
              ) : 'Prepare Content ✨'}
            </button>
          </div>

          {/* Quick Prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => { setPrompt(qp.prompt); handleDraftContent(qp.prompt); }}
                disabled={isDrafting || isGenerating}
                style={{
                  padding: '5px 13px', borderRadius: 20,
                  border: '1.5px solid var(--border-color)',
                  background: 'var(--bg-color)', color: 'var(--text-color)',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                  opacity: (isDrafting || isGenerating) ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (!isDrafting && !isGenerating) {
                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                    e.currentTarget.style.color = 'var(--accent-color)';
                    e.currentTarget.style.background = 'rgba(16,185,129,0.06)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-color)';
                  e.currentTarget.style.background = 'var(--bg-color)';
                }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Drafting Loader ── */}
        {isDrafting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 24px', background: 'var(--chat-bubble-assistant-bg)', border: '1.5px dashed var(--border-color)', borderRadius: 16, animation: 'fadeInUp 0.3s ease-out' }}>
            <div style={{ position: 'relative', width: 52, height: 52 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(16,185,129,0.1)', borderTop: '3px solid var(--accent-color)', animation: 'spin 1s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid rgba(6,182,212,0.15)', borderBottom: '2px solid #06b6d4', animation: 'spin 1.5s linear infinite reverse' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-color)', fontSize: 15, fontWeight: 800, margin: '0 0 6px' }}>AI is generating your comprehensive document...</p>
              <p style={{ color: 'var(--muted-color)', fontSize: 12, margin: 0 }}>Covering all topics, subtopics, examples, and interview questions. This may take 30–60 seconds.</p>
            </div>
          </div>
        )}

        {/* ── Main Editor Block (shown after draft ready) ── */}
        {(status === 'drafted' || isGenerating || status === 'done' || (status === 'error' && draftText)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeInUp 0.3s ease-out' }}>

            {/* Format Selection Cards */}
            <div>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>
                Choose Output Format
              </h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Object.entries(DOC_META).map(([key, meta]) => {
                  const isSel = selectedFormat === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedFormat(key)}
                      style={{
                        flex: '1 1 150px', padding: '11px 14px', borderRadius: 12,
                        background: isSel ? meta.bg : 'var(--chat-bubble-assistant-bg)',
                        border: isSel ? `2px solid ${meta.color}` : '1.5px solid var(--border-color)',
                        cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 10,
                        boxShadow: isSel ? `0 4px 16px ${meta.color}18` : 'none',
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = meta.color; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                      <span style={{ fontSize: 22 }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: isSel ? meta.color : 'var(--text-color)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</p>
                        <p style={{ fontSize: 10, color: 'var(--muted-color)', margin: 0 }}>{meta.desc}</p>
                      </div>
                      {isSel && <span style={{ color: meta.color, fontSize: 14, fontWeight: 900, flexShrink: 0 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Presenter Selection (only for Video) */}
            {isVideo && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '16px 20px', animation: 'fadeInUp 0.25s ease-out' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                  🎤 AI Presenter Selection
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { val: 'male',   label: '👨 Male Presenter',   desc: 'Male voice & character' },
                    { val: 'female', label: '👩 Female Presenter',  desc: 'Female voice & character' },
                  ].map(opt => (
                    <div
                      key={opt.val}
                      onClick={() => setPresenterGender(opt.val)}
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
                        background: presenterGender === opt.val ? 'rgba(245,158,11,0.12)' : 'var(--bg-color)',
                        border: presenterGender === opt.val ? '2px solid #f59e0b' : '1.5px solid var(--border-color)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: presenterGender === opt.val ? '#f59e0b' : 'var(--text-color)' }}>{opt.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted-color)' }}>{opt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blueprint Editor */}
            <div style={{ background: 'var(--chat-bubble-assistant-bg)', border: '1.5px solid var(--border-color)', borderRadius: 16, overflow: 'hidden' }}>
              {/* Tabs bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['edit', '📝 Edit Draft'], ['preview', '👁️ Preview']].map(([mode, label]) => (
                    <button key={mode} onClick={() => setEditMode(mode)} style={{
                      padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.18s',
                      background: editMode === mode ? 'var(--accent-color)' : 'transparent',
                      color: editMode === mode ? '#fff' : 'var(--muted-color)',
                    }}>{label}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted-color)' }}>
                  <span>{wordCount.toLocaleString()} words</span>
                  <span>{draftText.length.toLocaleString()} chars</span>
                </div>
              </div>

              {/* Title field */}
              <div style={{ padding: '14px 20px 0 20px' }}>
                <input
                  type="text"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="Document Title"
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: 18, fontWeight: 800, color: 'var(--text-color)',
                    paddingBottom: 10, outline: 'none', fontFamily: 'Outfit, sans-serif'
                  }}
                />
              </div>

              {/* Body */}
              <div style={{ padding: 20, minHeight: 320 }}>
                {editMode === 'edit' ? (
                  <textarea
                    rows={18}
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    placeholder="AI-generated content will appear here. You can review and edit before generating the final file..."
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: 'var(--text-color)', fontSize: 13, resize: 'vertical',
                      outline: 'none', lineHeight: 1.75, fontFamily: 'Consolas, monospace',
                    }}
                  />
                ) : (
                  <div style={{
                    background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                    borderRadius: 12, padding: '24px 28px', overflowY: 'auto',
                    maxHeight: 500, lineHeight: 1.75, textAlign: 'left'
                  }}>
                    <ReactMarkdown components={mdComponents}>{draftText}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.01)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted-color)' }}>
                  {isVideo
                    ? `🎬 Will generate AI ${presenterGender} presenter video`
                    : `📄 Will compile as ${DOC_META[selectedFormat]?.label}`}
                </span>
                <button
                  onClick={handleCompileDocument}
                  disabled={isGenerating || !draftText.trim()}
                  style={{
                    padding: '11px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: isVideo
                      ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                      : 'linear-gradient(135deg, var(--accent-color), #10b981)',
                    color: '#fff', fontSize: 13, fontWeight: 900,
                    opacity: (isGenerating || !draftText.trim()) ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(16,185,129,0.25)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {isGenerating ? (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', animation: 'spin 1s linear infinite' }} />
                      {isVideo ? 'Generating Video...' : 'Compiling File...'}
                    </>
                  ) : (
                    isVideo ? '🎬 Generate Video' : '⚙️ Generate File'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Success Result Card ── */}
        {status === 'done' && result && (
          <div style={{
            background: result.docType === 'video' ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.07)',
            border: result.docType === 'video' ? '1.5px solid rgba(245,158,11,0.35)' : '1.5px solid rgba(16,185,129,0.35)',
            borderRadius: 16, padding: '20px 24px',
            animation: 'fadeInUp 0.3s ease-out',
            boxShadow: result.docType === 'video' ? '0 4px 24px rgba(245,158,11,0.1)' : '0 4px 24px rgba(16,185,129,0.1)',
          }}>
            {result.docType === 'video' ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#f59e0b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎬 AI Presenter Video Ready!
                </p>
                {result.provider === 'local-fallback' && result.script ? (
                  <>
                    <video
                      ref={docVideoRef}
                      loop
                      muted
                      style={{ width: '100%', maxHeight: 420, borderRadius: 12, border: '1px solid var(--border-color)', background: '#000', display: 'block' }}
                      src={result.fileUrl}
                    />
                    <audio
                      ref={docAudioRef}
                      src={`${baseUrl}/api/video/tts?text=${encodeURIComponent(result.script.trim())}&lang=english&gender=${result.gender === 'girl' ? 'female' : result.gender === 'boy' ? 'male' : result.gender || 'male'}&t=${Date.now()}`}
                      controls
                      style={{ width: '100%', display: 'block', marginTop: 12 }}
                      onPlay={() => { if (docVideoRef.current) docVideoRef.current.play(); }}
                      onPause={() => { if (docVideoRef.current) docVideoRef.current.pause(); }}
                      onEnded={() => { if (docVideoRef.current) docVideoRef.current.pause(); }}
                    />
                  </>
                ) : (
                  <video
                    controls
                    autoPlay
                    style={{ width: '100%', maxHeight: 420, borderRadius: 12, border: '1px solid var(--border-color)', background: '#000', display: 'block' }}
                    src={result.fileUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--muted-color)', margin: 0 }}>{result.filename}</p>
                  <a
                    href={result.fileUrl}
                    download={result.filename}
                    style={{
                      padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: '#fff', fontSize: 12, fontWeight: 800, textDecoration: 'none'
                    }}
                  >
                    Download Video 📥
                  </a>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <span style={{ fontSize: 32 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent-color)', margin: '0 0 4px' }}>Document Generated Successfully!</p>
                  <p style={{ fontSize: 13, color: 'var(--text-color)', margin: '0 0 2px', fontWeight: 600 }}>Title: {result.prompt}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-color)', margin: 0 }}>File: {result.filename}</p>
                </div>
                <button
                  onClick={() => downloadFile(result.fileUrl, result.filename)}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer', flexShrink: 0
                  }}
                >
                  Download 📥
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Error State ── */}
        {status === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: 20, animation: 'fadeInUp 0.3s ease-out' }}>
            <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ Generation Failed
            </p>
            <p style={{ color: 'var(--text-color)', fontSize: 12, margin: 0, lineHeight: 1.7 }}>{errorMsg}</p>
          </div>
        )}

        {/* ── Idle Format Guide ── */}
        {status === 'idle' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'fadeInUp 0.3s ease-out' }}>
            {Object.entries(DOC_META).map(([type, m]) => (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px', borderRadius: 12,
                background: m.bg, border: `1.5px solid ${m.color}22`,
                flex: '1 1 calc(33% - 12px)', minWidth: 200
              }}>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 800, color: m.color, margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: 'var(--muted-color)', margin: '2px 0 0' }}>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── History ── */}
        {history.length > 0 && (
          <div style={{ borderTop: '1.5px solid var(--border-color)', paddingTop: 20 }}>
            <button
              onClick={() => setShowPanel(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 0', marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted-color)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                🕐 Document History
              </span>
              <span style={{ background: 'var(--accent-color)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 900 }}>{history.length}</span>
              <span style={{ color: 'var(--muted-color)', fontSize: 11, marginLeft: 4 }}>{showPanel ? '▲' : '▼'}</span>
            </button>

            {showPanel && (
              <>
                <p style={{ margin: '0 0 12px', fontSize: 10, color: 'var(--muted-color)' }}>Items auto-delete after 30 days</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {history.map(item => {
                    const m = getDocMeta(item.docType);
                    return (
                      <div key={item.id}
                        onClick={() => item.docType !== 'video' && downloadFile(item.fileUrl, item.filename)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '13px 18px',
                          background: 'var(--chat-bubble-assistant-bg)',
                          border: '1.5px solid var(--border-color)',
                          borderRadius: 12, cursor: item.docType !== 'video' ? 'pointer' : 'default',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          if (item.docType !== 'video') {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.borderColor = m.color;
                            e.currentTarget.style.boxShadow = `0 4px 12px ${m.color}12`;
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{m.icon}</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: m.color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-color)', margin: '2px 0 0', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.prompt}</p>
                          {item.createdAt && (
                            <p style={{ fontSize: 10, color: 'var(--muted-color)', margin: '3px 0 0' }}>{timeAgo(item.createdAt)}</p>
                          )}
                        </div>
                        <button
                          onClick={e => deleteHistory(item.id, e)}
                          style={{ background: 'none', border: 'none', color: 'var(--muted-color)', cursor: 'pointer', padding: 6, fontSize: 12, transition: 'color 0.2s', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-color)'}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails(limitFeature)}
      />
    </div>
  );
}
