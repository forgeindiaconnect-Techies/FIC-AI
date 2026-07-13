import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE_URL as API_URL } from '../config/api.js';
import ReactMarkdown from 'react-markdown';
import LoadingDots from './LoadingDots';
import axios from 'axios';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';
import { PDFDocument } from 'pdf-lib';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/* ── Markdown overrides so code/headings look good on dark BG ── */

// Utility to safely extract string text from various Gemini JSON formats
function normalizeText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value)) {
      return value
        .map(v => (typeof v === 'string' ? v : v?.text))
        .filter(Boolean)
        .join(' ');
    }
  }
  console.warn('Unexpected text value encountered:', value);
  return '';
}
const mdComponents = {
  p:    ({ children }) => <p style={{ margin: '0 0 10px 0', lineHeight: 1.75 }}>{children}</p>,
  ul:   ({ children }) => <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: '8px 0' }}>{children}</ul>,
  ol:   ({ children }) => <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>,
  li:   ({ children, ordered }) => (
    <li style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: '8px', listStyleType: ordered ? 'decimal' : 'none' }}>
      {!ordered && <span style={{ color: 'var(--accent-color)', fontSize: '13px', marginTop: '3px', flexShrink: 0 }}>✓</span>}
      <div>{children}</div>
    </li>
  ),
  h1:   ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h1>,
  h2:   ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 700, margin: '10px 0 5px' }}>{children}</h2>,
  h3:   ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h3>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  img:  ({ src, alt }) => (
    <img
      src={src}
      alt={alt}
      onLoad={() => console.log("IMAGE LOADED: true")}
      onError={() => console.log("IMAGE LOADED: false")}
      style={{
        maxWidth: '100%',
        maxHeight: '400px',
        borderRadius: '16px',
        border: '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
        marginTop: '10px',
        display: 'block'
      }}
    />
  ),
  code: ({ inline, className, children }) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ borderRadius: 8, margin: '8px 0' }}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace', fontSize: 13 }}>{children}</code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid #7c3aed', paddingLeft: 12, margin: '8px 0', color: '#94A3B8' }}>{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      style={{ 
        color: 'var(--accent-color, #7c3aed)', 
        textDecoration: 'underline', 
        fontWeight: 600,
        transition: 'color 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--accent-color, #7c3aed)'}
    >
      {children}
    </a>
  ),
};

// Helper: Extracts download details from a message containing a Markdown download link
const getDocDetails = (content) => {
  if (!content) return null;
  const regex = /\[Download\]\((\/downloads\/[a-zA-Z0-9\-_.]+\.([a-z0-9]+))\)/i;
  const match = content.match(regex);
  if (match) {
    const url = match[1];
    const ext = match[2].toLowerCase();
    const cleanText = content.replace(regex, '').trim();
    return { url, ext, text: cleanText };
  }
  return null;
};

// Helper: Extracts poster details from message
const getPosterDetails = (content) => {
  if (!content) return null;
  const regex = /\[Poster Layout\]\(([\s\S]*)\)/i;
  const match = content.match(regex);
  if (match) {
    let jsonStr = match[1].trim();
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace !== -1) {
      jsonStr = jsonStr.substring(0, lastBrace + 1);
    }
    try {
      const posterData = JSON.parse(jsonStr);
      const cleanText = content.replace(regex, '').trim();
      return { poster: posterData, text: cleanText };
    } catch (e) {
      console.warn("Failed to parse poster layout JSON:", e.message);
    }
  }
  return null;
};

// Helper: sanitizes color strings and provides fallback values
const sanitizeColor = (color, defaultColor) => {
  if (!color || typeof color !== 'string') return defaultColor;
  let trimmed = color.trim();
  // If it's a 3 or 6 digit hex without #
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(trimmed)) {
    trimmed = '#' + trimmed;
  }
  
  // Test validity using Option style test
  try {
    const s = new Option().style;
    s.color = trimmed;
    if (s.color !== '') {
      return trimmed;
    }
  } catch (e) {
    // Ignore error and fall back
  }
  return defaultColor;
};

// Helper: Draws poster on HTML5 canvas
const drawPosterToCanvas = (poster, canvas) => {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  const isPongal = normalizeText(poster.heading)?.toUpperCase().includes('PONGAL') || 
                   normalizeText(poster.subheading)?.toUpperCase().includes('PONGAL') || 
                   normalizeText(poster.details)?.toUpperCase().includes('PONGAL');

  const c1 = sanitizeColor(poster.colors?.[0], isPongal ? '#FFF8DC' : '#090D1A');
  const c2 = sanitizeColor(poster.colors?.[1], isPongal ? '#FF8C00' : '#16112C');
  const c3 = sanitizeColor(poster.colors?.[2] || poster.colors?.[1], isPongal ? '#2E7D32' : '#7C3AED');

  const drawAll = (bgImg = null) => {
    if (!canvas || !canvas.getContext) return;
    ctx.save();
    
    // Scale the rendering context so we can draw everything using a 1080x1080 design coordinate system!
    const scale = width / 1080;
    ctx.scale(scale, scale);

    // 1. Draw Background
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, 1080, 1080);
    } else {
      if (isPongal) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1080);
        bgGrad.addColorStop(0, '#FFFDD0');
        bgGrad.addColorStop(1, '#FFF8DC');
        ctx.fillStyle = bgGrad;
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1080);
        bgGrad.addColorStop(0, c1);
        bgGrad.addColorStop(1, '#000000');
        ctx.fillStyle = bgGrad;
      }
      ctx.fillRect(0, 0, 1080, 1080);
    }

    // 2. Draw Decorative elements based on template
    let layout = poster.template || 'hiring';
    if (layout === 'mernhiring') layout = 'hiring';

    if (layout === 'hiring') {
      // left border accent bar
      const barGrad = ctx.createLinearGradient(0, 0, 0, 1080);
      barGrad.addColorStop(0, c3);
      barGrad.addColorStop(1, c2);
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, 0, 25, 1080);

      // Decorative glow circles
      ctx.fillStyle = 'rgba(124, 58, 237, 0.08)';
      ctx.beginPath();
      ctx.arc(100, 100, 250, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.beginPath();
      ctx.arc(1080 - 100, 1080 - 100, 300, 0, Math.PI * 2);
      ctx.fill();
    } else if (layout === 'festival') {
      // Outer border
      ctx.strokeStyle = c2;
      ctx.lineWidth = 6;
      ctx.strokeRect(50, 50, 980, 980);

      if (isPongal) {
        // Draw Traditional Sun
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(540, 180, 60, 0, Math.PI * 2);
        ctx.fill();

        // Rays
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        for (let angle = 0; angle < 360; angle += 30) {
          const rad = (angle * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(540 + Math.cos(rad) * 75, 180 + Math.sin(rad) * 75);
          ctx.lineTo(540 + Math.cos(rad) * 100, 180 + Math.sin(rad) * 100);
          ctx.stroke();
        }

        // Draw Sugarcane stalks on left (150) and right (930)
        const drawSugarcane2D = (x) => {
          ctx.fillStyle = '#5C2D91'; // purple stalk
          ctx.fillRect(x - 8, 350, 16, 600);

          // segmented node rings
          ctx.fillStyle = '#FFD700';
          for (let yPos = 400; yPos < 900; yPos += 80) {
            ctx.fillRect(x - 10, yPos, 20, 4);
          }

          // leaves at top
          ctx.fillStyle = '#2E7D32';
          ctx.beginPath();
          ctx.arc(x - 20, 320, 25, 0, Math.PI * 2);
          ctx.arc(x + 20, 320, 25, 0, Math.PI * 2);
          ctx.fill();
        };
        drawSugarcane2D(150);
        drawSugarcane2D(930);

        // Kolam star outline behind clay pot
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(540, 820);
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          ctx.strokeRect(-30, -30, 60, 60);
        }
        ctx.restore();

        // Clay pot base
        ctx.fillStyle = '#D2691E';
        ctx.beginPath();
        ctx.arc(540, 820, 75, 0, Math.PI * 2);
        ctx.fill();

        // Pot Neck
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(540 - 45, 720, 90, 30);

        // Rim
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(540 - 55, 705, 110, 15);

        // Boiling milk overflow
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(540, 700, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (layout === 'internship') {
      ctx.fillStyle = c2;
      ctx.fillRect(0, 0, 1080, 20);
    } else if (layout === 'education') {
      // border accent lines
      ctx.strokeStyle = c2;
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 1000, 1000);
    } else if (layout === 'infographic') {
      // border accent lines
      ctx.strokeStyle = c2;
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, 1000, 1000);
      // Draw three metrics blocks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(100, 280, 260, 220);
      ctx.fillRect(410, 280, 260, 220);
      ctx.fillRect(720, 280, 260, 220);
    }

    // 3. Draw Brand/Company Name
    ctx.fillStyle = isPongal ? '#2E7D32' : '#06B6D4';
    ctx.font = 'bold 24px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isPongal ? 'PONGAL CELEBRATION' : 'FIC PLATFORM', 1080 / 2, 90);

    // 4. Draw Main Heading
    ctx.fillStyle = isPongal ? '#2E7D32' : '#FFFFFF';
    ctx.font = '900 64px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const headingText = ((normalizeText(poster.heading) || 'HAPPY PONGAL')).toUpperCase();
    ctx.fillText(headingText, 1080 / 2, 280);

    // 5. Draw Subheading
    ctx.fillStyle = isPongal ? '#E65100' : c2;
    ctx.font = 'bold 32px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(normalizeText(poster.subheading) || 'Celebrate Harvest & Joy', 1080 / 2, 380);

    // 6. Draw Details text (wrapped)
    ctx.fillStyle = isPongal ? '#1E293B' : '#E5E7EB';
    ctx.font = '22px Inter, sans-serif';
    ctx.textAlign = 'center';
    const detailsText = normalizeText(poster.details) || '';
    const words = detailsText.split(' ');
    let line = '';
    let y = 470;
    const maxWidth = 720;
    const lineHeight = 36;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 1080 / 2, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 1080 / 2, y);

    // 7. Draw CTA button
    const ctaY = y + 120;
    const ctaText = (normalizeText(poster.cta) || 'CELEBRATE').toUpperCase();
    ctx.font = 'bold 26px Montserrat, sans-serif';
    const textWidth = ctx.measureText(ctaText).width;
    const btnWidth = Math.max(textWidth + 60, 240);
    const btnHeight = 65;

    ctx.fillStyle = isPongal ? '#E65100' : c3;
    const rx = 1080 / 2 - btnWidth / 2;
    const ry = ctaY - btnHeight / 2 - 10;
    ctx.beginPath();
    ctx.roundRect(rx, ry, btnWidth, btnHeight, 15);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(ctaText, 1080 / 2, ctaY + 10);

    // 8. Draw Contact Info
    ctx.fillStyle = isPongal ? '#334155' : '#94A3B8';
    ctx.font = '20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(normalizeText(poster.contactInfo) || 'Wishing You a Joyful Pongal', 1080 / 2, 1080 - 100);

    ctx.restore();
  };

  const bgUrl = poster.backgroundImageUrl || poster.imageUrl;
  if (bgUrl) {
    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.onload = () => {
      drawAll(bgImg);
    };
    bgImg.onerror = () => {
      drawAll(null);
    };
    bgImg.src = bgUrl;
  } else {
    drawAll(null);
  }
};;

// PosterCard sub-component
function PosterCard({ poster, text, setCurrentTab }) {
  const canvasRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = 540;
      canvasRef.current.height = 540;
      drawPosterToCanvas(poster, canvasRef.current);
    }
  }, [poster]);

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 1080;
      offscreen.height = 1080;
      drawPosterToCanvas(poster, offscreen);

      const dataUrl = offscreen.toDataURL('image/png');

      if (type === 'png') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `poster-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        axios.post(`${API_URL}/api/poster/export`, { dataUrl, fileType: 'png' })
          .catch(e => console.error('Failed backend PNG export sync:', e.message));
      } else if (type === 'pdf') {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([1080, 1080]);
        const pngImage = await pdfDoc.embedPng(dataUrl);
        page.drawImage(pngImage, { x: 0, y: 0, width: 1080, height: 1080 });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `poster-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          axios.post(`${API_URL}/api/poster/export`, { dataUrl: reader.result, fileType: 'pdf' })
            .catch(e => console.error('Failed backend PDF export sync:', e.message));
        };
      }
    } catch (err) {
      console.error('Export failed:', err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleEdit = () => {
    if (setCurrentTab) setCurrentTab('poster');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('fic_load_poster_layout', { detail: poster }));
    }, 150);
  };

  return (
    <div>
      <ReactMarkdown components={mdComponents}>{text}</ReactMarkdown>
      <div style={{
        marginTop: '12px',
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        maxWidth: '360px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          background: '#090D1A'
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('png')}
            disabled={exporting}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.25)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Download PNG
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Download PDF
          </button>
          <button
            onClick={handleEdit}
            style={{
              width: '100%',
              marginTop: '4px',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            ✏️ Edit in Poster Studio
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORIZED_TEMPLATES = {
  marketing: {
    label: '📈 Marketing',
    items: [
      { name: 'Instagram Caption', icon: '📸', prompt: 'Generate a creative, engaging Instagram caption with emojis and hashtags for: ' },
      { name: 'LinkedIn Post', icon: '💼', prompt: 'Write a professional LinkedIn post summarizing: ' },
      { name: 'YouTube Title', icon: '🎥', prompt: 'Suggest 5 click-worthy, SEO-optimized YouTube video titles for: ' },
      { name: 'SEO Blog Writer', icon: '📝', prompt: 'Write a comprehensive, SEO-friendly blog post outline and content for: ' },
      { name: 'Email Generator', icon: '✉️', prompt: 'Write a professional marketing email copy promoting: ' },
      { name: 'Social Media Post', icon: '📱', prompt: 'Create a high-engaging social media post for: ' },
      { name: 'Advertisement Copy', icon: '📢', prompt: 'Draft a high-conversion ad copy (headline + body) for: ' },
      { name: 'Hashtag Generator', icon: '🏷️', prompt: 'Generate 20 relevant, high-volume hashtags for: ' },
      { name: 'Product Description', icon: '🛍️', prompt: 'Write a compelling product description highlighting benefits for: ' },
      { name: 'Facebook Post', icon: '👥', prompt: 'Create an engaging Facebook post for: ' },
      { name: 'Twitter/X Post', icon: '🐦', prompt: 'Write an engaging Twitter/X post (within 280 characters) with hashtags for: ' }
    ]
  },
  business: {
    label: '📊 Business',
    items: [
      { name: 'Invoice Generator', icon: '🧾', prompt: 'Generate a professional business Invoice template/details for: ' },
      { name: 'Business Plan', icon: '🏢', prompt: 'Write a detailed, structured business plan for: ' },
      { name: 'Business Proposal', icon: '🤝', prompt: 'Draft a professional business proposal for: ' },
      { name: 'SWOT Analysis', icon: '⚖️', prompt: 'Perform a comprehensive SWOT Analysis for: ' },
      { name: 'Quotation', icon: '💲', prompt: 'Create a professional pricing quotation template for: ' },
      { name: 'Meeting Minutes', icon: '⏱️', prompt: 'Format these raw notes into professional Meeting Minutes: ' },
      { name: 'Business Letter', icon: '✉️', prompt: 'Write a formal business letter regarding: ' },
      { name: 'Project Report', icon: '📊', prompt: 'Generate a structured project progress report for: ' },
      { name: 'Company Profile', icon: '🏢', prompt: 'Write a compelling company profile overview for: ' },
      { name: 'Sales Pitch', icon: '🎙️', prompt: 'Draft a persuasive sales pitch script for: ' }
    ]
  },
  education: {
    label: '🎓 Education',
    items: [
      { name: 'Quiz Generator', icon: '📝', prompt: 'Create a 5-question quiz with answers and explanations on: ' },
      { name: 'Flashcard Maker', icon: '🎴', prompt: 'Generate a list of 5 flashcard Q&As for studying: ' },
      { name: 'Notes Summarizer', icon: '📖', prompt: 'Summarize the following notes into bullet points: ' },
      { name: 'Explain Any Topic', icon: '💡', prompt: 'Explain the following topic simply, as if I am 10 years old: ' },
      { name: 'Assignment Helper', icon: '🤝', prompt: 'Help me solve or outline my assignment on: ' },
      { name: 'Q&A Generator', icon: '❓', prompt: 'Generate a list of common questions and answers about: ' },
      { name: 'MCQ Generator', icon: '🔘', prompt: 'Create 5 multiple choice questions (MCQs) on: ' },
      { name: 'Study Notes', icon: '📓', prompt: 'Generate high-quality, comprehensive study notes on: ' },
      { name: 'Homework Assistant', icon: '✏️', prompt: 'Provide step-by-step guidance on this homework topic: ' },
      { name: 'Concept Simplifier', icon: '🔍', prompt: 'Simplify this complex academic concept: ' }
    ]
  },
  writing: {
    label: '✍️ Writing',
    items: [
      { name: 'Blog Writer', icon: '📝', prompt: 'Write an engaging blog post about: ' },
      { name: 'Article Writer', icon: '📰', prompt: 'Write a detailed article on: ' },
      { name: 'Essay Writer', icon: '✍️', prompt: 'Write a structured essay with an introduction, body, and conclusion on: ' },
      { name: 'Email Writer', icon: '📧', prompt: 'Draft a polite and clear email regarding: ' },
      { name: 'Cover Letter', icon: '💼', prompt: 'Write a tailored professional cover letter for: ' },
      { name: 'Resume Summary', icon: '📄', prompt: 'Write a strong resume objective/summary for a candidate specializing in: ' },
      { name: 'Speech Writer', icon: '🗣️', prompt: 'Write a persuasive, inspiring 3-minute speech on: ' },
      { name: 'Story Generator', icon: '📖', prompt: 'Write a creative short story about: ' },
      { name: 'Script Writer', icon: '🎬', prompt: 'Write an engaging video script (intro, body, outro) for: ' },
      { name: 'Grammar & Rewrite', icon: '🖍️', prompt: 'Rewrite the following text to improve grammar, clarity, and tone: ' }
    ]
  },
  design: {
    label: '🎨 Design',
    items: [
      { name: 'Logo Generator', icon: '✨', prompt: 'logo', tab: 'image' },
      { name: 'Poster Generator', icon: '🖼️', prompt: 'poster', tab: 'poster' },
      { name: 'Banner Generator', icon: '🎞️', prompt: 'banner', tab: 'image' },
      { name: 'Thumbnail Creator', icon: '📸', prompt: 'thumbnail', tab: 'image' },
      { name: 'Business Card', icon: '📇', prompt: 'business card', tab: 'poster' },
      { name: 'Flyer Generator', icon: '📄', prompt: 'flyer', tab: 'poster' },
      { name: 'Social Media Post', icon: '📱', prompt: 'social media', tab: 'image' },
      { name: 'Invitation Card', icon: '💌', prompt: 'invitation card', tab: 'poster' },
      { name: 'Brochure Design', icon: '📖', prompt: 'brochure', tab: 'poster' },
      { name: 'Presentation Cover', icon: '📔', prompt: 'presentation cover', tab: 'poster' }
    ]
  }
};

export default function Chat({ activeChatId, setActiveChatId, onNewMessageSaved, chatsAvailable = true, setCurrentTab, chats = [] }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [modelName, setModelName] = useState('TinyLlama');
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitFeature, setLimitFeature] = useState('chat');
  const [activeTemplateTab, setActiveTemplateTab] = useState('marketing');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/health`)
      .then(res => {
        if (res.data?.model) {
          setModelName(res.data.model);
        }
      })
      .catch(() => {});
  }, []);

  const safeMessages = Array.isArray(messages) ? messages : [];

  // Auto-scroll whenever messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!activeChatId || !chatsAvailable) {
      setMessages([]);
      return;
    }
    axios.get(`${API_URL}/api/chats/${activeChatId}`)
      .then(res => {
        const raw  = res.data;
        const list = Array.isArray(raw) ? raw : (raw.messages || []);
        const formatted = list
          .map(m => ({ role: m.role, content: String(m.content || m.message || m.text || m.reply || m.response || '') }))
          .filter(m => m.content && m.content.trim());
        setMessages(Array.isArray(formatted) ? formatted : []);
      })
      .catch(err => {
        console.error('[Chat] Failed history route /api/chats/' + activeChatId + ':', err.message);
        setMessages([]);
      });
  }, [activeChatId, chatsAvailable]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Check if user is logged in
    if (!localStorage.getItem('fic_user_email')) {
      window.dispatchEvent(new CustomEvent('fic_login_required', {
        detail: { callback: () => sendMessage() }
      }));
      return;
    }
    
    // Ensure we have a chatId before sending
    let chatId = activeChatId;
    if (!chatId) {
      chatId = `chat_${Date.now()}`;
      setActiveChatId(chatId);
    }

    // Helper: detect document intent and file type
    const detectDocIntent = (message) => {
      const msg = message.toLowerCase().trim();
      
      // If it mentions poster, it's NOT a document generation intent
      if (msg.includes('poster') || msg.includes('flyer') || msg.includes('banner')) {
        return null;
      }
      
      const docKeywords = ['pdf', 'word', 'ppt', 'excel', 'document', 'download', 'docx', 'xlsx', 'pptx', 'spreadsheet', 'presentation'];
      if (docKeywords.some(k => msg.includes(k))) {
        if (msg.includes('pdf')) return 'pdf';
        if (msg.includes('word') || msg.includes('docx') || msg.includes('document')) return 'docx';
        if (msg.includes('excel') || msg.includes('xlsx') || msg.includes('sheet') || msg.includes('spreadsheet')) return 'xlsx';
        if (msg.includes('ppt') || msg.includes('pptx') || msg.includes('presentation')) return 'pptx';
        return 'pdf'; // Default fallback
      }
      return null;
    };

    const detectedFileType = detectDocIntent(text);

    if (detectedFileType) {
      // Document Generator Limit Check
      if (isLimitReached('docs')) {
        setLimitFeature('docs');
        setShowLimitModal(true);
        return;
      }

      // Find last assistant message
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      const lastMsg = assistantMessages[assistantMessages.length - 1];
      let lastAssistantMessage = lastMsg ? lastMsg.content : null;

      // Extract clean text if it was a document or poster layout
      if (lastAssistantMessage) {
        const docInfo = getDocDetails(lastAssistantMessage);
        if (docInfo) {
          lastAssistantMessage = docInfo.text;
        }
        const posterInfo = getPosterDetails(lastAssistantMessage);
        if (posterInfo) {
          lastAssistantMessage = posterInfo.text;
        }
      }

      if (!lastAssistantMessage) {
        const fallbackText = detectedFileType === 'pdf'
          ? 'Please ask a question first, then I can create a PDF from the answer.'
          : 'Please ask something first, then I can create a Word document.';
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: fallbackText }]);
        return;
      }

      // Optimistically add user message
      setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'user', content: text }]);
      setInput('');
      setLoading(true);

      try {
        const currentChat = (chats || []).find(c => c.chatId === chatId);
        const currentChatTitle = currentChat ? currentChat.title : null;

        const res = await axios.post(`${API_URL}/api/documents/generate`, {
          chatId,
          fileType: detectedFileType,
          content: lastAssistantMessage,
          title: currentChatTitle || 'FIC AI Document'
        }, { timeout: 120000 });

        if (res.data.success) {
          const relativeUrl = `/downloads/${res.data.fileName || res.data.filename}`;
          const reply = `${res.data.message} [Download](${relativeUrl})`;
          setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: reply }]);
          incrementUsage('docs'); // Increment document generator usage!
        } else {
          const errMsg = `⚠️ ${res.data.error || 'Failed to generate document'}`;
          setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: errMsg }]);
        }
      } catch (err) {
        console.error('[Chat] Document generation request failed:', err.message);
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: `⚠️ Connection error generating ${detectedFileType.toUpperCase() === 'PDF' ? 'PDF' : 'Word document'}.` }]);
      } finally {
        setLoading(false);
        if (onNewMessageSaved) onNewMessageSaved();
      }
      return;
    }

    // AI Chat Limit Check
    if (isLimitReached('chat')) {
      setLimitFeature('chat');
      setShowLimitModal(true);
      return;
    }

    // Optimistically add user message for standard chat
    setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/chat`, { message: text, chatId }, { timeout: 120000 });
      // Process response
      console.log('FULL API RESPONSE:', res.data);
      
      const aiReply = res.data.response || res.data.reply || (res.data.message !== 'Chat route working' ? res.data.message : null);

      if (res.data.success || aiReply) {
        let finalReply = '';
        if (res.data.type === 'document') {
          finalReply = `${res.data.message} [Download](${res.data.downloadUrl})`;
        } else if (res.data.type === 'poster') {
          const imageUrl = res.data?.imageUrl || res.data?.image || res.data?.url || res.data?.result?.imageUrl || null;
          const poster = res.data?.poster || {};
          if (imageUrl) {
            poster.backgroundImageUrl = imageUrl;
            poster.imageUrl = imageUrl;
          }
          finalReply = `${res.data?.message || 'Done — I designed the poster layout for you.'} [Poster Layout](${JSON.stringify(poster)})`;
        } else {
          finalReply = aiReply;
        }

        if (finalReply) {
          console.log('REPLY:', finalReply);
          setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: finalReply }]);
          incrementUsage('chat'); // Increment AI Chat usage!
        } else {
          const errMsg = '⚠️ AI provider returned empty response';
          console.error(errMsg);
          setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: errMsg }]);
        }
      } else {
        const errMsg = `⚠️ ${res.data.error || 'All AI chat providers failed. Please check your connection.'}`;
        console.error('ERROR FROM BACKEND:', errMsg);
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: errMsg }]);
      }

      // Update chatId if server generated a different one
      if (res.data?.chatId && res.data.chatId !== chatId) {
        setActiveChatId(res.data.chatId);
      }
    } catch (err) {
      console.error('[Chat] Failed send message route /api/chat:', err.message);
      setMessages(prev => [...(Array.isArray(prev) ? prev : []), { role: 'assistant', content: '⚠️ Connection error.' }]);
    } finally {
      setLoading(false);
      if (onNewMessageSaved) onNewMessageSaved();
    }
  };



  // ── Speech Recognition (Mic) ──────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    recognition.onerror = (e) => console.warn('[Mic] Speech recognition error:', e.error);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // Close attach menu on outside click
  useEffect(() => {
    const handler = () => setShowAttachMenu(false);
    if (showAttachMenu) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg-color)' }}>

      {/* Header */}
      <div style={{
        padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--header-border)',
        background: 'var(--header-bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ color: 'var(--header-text)', fontSize: 14, fontWeight: 700 }}>FIC AI</span>
          <span style={{ color: 'var(--muted-color)', fontSize: 12 }}>/ Chat</span>
        </div>
          {/* model name badge hidden */}
      </div>

      {/* Message Feed */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
        padding: '24px 0',
        background: 'var(--bg-color)',
      }}>

        {/* Empty state */}
        {safeMessages.length === 0 && !loading && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 28px',
            boxSizing: 'border-box',
            width: '100%'
          }}>
            <div style={{
              maxWidth: '900px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🔮</span>
                <h2 style={{ 
                  fontSize: '24px', 
                  fontWeight: 950, 
                  margin: '0 0 6px 0', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em',
                  background: 'linear-gradient(135deg, #06B6D4 0%, #7C3AED 50%, #EC4899 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block'
                }}>
                  Welcome Back to FIC AI
                </h2>
                <p style={{ color: 'var(--muted-color)', fontSize: '12px', margin: 0 }}>Select a template below to pre-fill the chat and execute your task instantly.</p>
              </div>

              {/* Tabs */}
              <div style={{
                display: 'flex',
                gap: '6px',
                borderBottom: '1px solid var(--header-border)',
                paddingBottom: '8px',
                overflowX: 'auto',
                scrollbarWidth: 'none'
              }}>
                {Object.entries(CATEGORIZED_TEMPLATES).map(([key, cat]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTemplateTab(key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      background: activeTemplateTab === key ? 'var(--chat-send-btn-bg)' : 'transparent',
                      color: activeTemplateTab === key ? 'var(--chat-send-btn-text)' : 'var(--muted-color)'
                    }}
                    onMouseEnter={e => {
                      if (activeTemplateTab !== key) e.currentTarget.style.color = 'var(--text-color)';
                    }}
                    onMouseLeave={e => {
                      if (activeTemplateTab !== key) e.currentTarget.style.color = 'var(--muted-color)';
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Grid of templates */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                maxHeight: '360px',
                overflowY: 'auto',
                paddingRight: '4px'
              }} className="scrollbar-thin">
                {CATEGORIZED_TEMPLATES[activeTemplateTab].items.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (item.tab) {
                        if (setCurrentTab) setCurrentTab(item.tab);
                      } else {
                        setInput(item.prompt);
                        const chatInputEl = document.getElementById('chat-input');
                        if (chatInputEl) chatInputEl.focus();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--header-border)',
                      background: 'var(--chat-bubble-assistant-bg)',
                      color: 'var(--text-color)',
                      fontSize: '12px',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-color)';
                      e.currentTarget.style.background = 'var(--chat-input-container-bg)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--header-border)';
                      e.currentTarget.style.background = 'var(--chat-bubble-assistant-bg)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {safeMessages.map((msg, i) => {
          if (!msg.content) return null;
          const isUser = msg.role === 'user';

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                padding: '0 28px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Role label */}
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 6,
                color: isUser ? '#a78bfa' : '#06B6D4',
              }}>
                {isUser ? 'You' : 'FIC AI'}
              </div>

              {/* Message body */}
              <div style={{
                maxWidth: isUser ? '70%' : '850px',
                width: isUser ? 'auto' : '100%',
                background: isUser
                  ? 'var(--chat-bubble-user-bg)'
                  : 'var(--chat-bubble-assistant-bg)',
                border: isUser ? 'none' : '1.5px solid var(--chat-bubble-assistant-border)',
                borderRadius: isUser ? '18px 18px 4px 18px' : '16px',
                padding: isUser ? '14px 18px' : '18px 22px',
                /* Text */
                color: isUser ? 'var(--chat-bubble-user-text)' : 'var(--chat-bubble-assistant-text)',
                fontSize:   isUser ? 15 : 16,
                fontWeight: 400,
                lineHeight: isUser ? 1.6 : 1.75,
                whiteSpace: isUser ? 'pre-wrap' : undefined,
                wordBreak:  'break-word',
                /* Force visible */
                opacity:    1,
                visibility: 'visible',
                overflow:   'visible',
                position: 'relative',
              }}>
                {!isUser && (
                  <span style={{ position: 'absolute', top: '14px', right: '16px', fontSize: '18px' }} title="FIC AI Sparkle">✨</span>
                )}
                {isUser ? (
                  msg.content
                ) : (() => {
                  const docInfo = getDocDetails(msg.content);
                  if (docInfo) {
                    const colors = {
                      pdf:   { icon: '📄', label: 'PDF Document',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
                      docx:  { icon: '📝', label: 'Word Document', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                      doc:   { icon: '📝', label: 'Word Document', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                      pptx:  { icon: '📊', label: 'Presentation',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
                      ppt:   { icon: '📊', label: 'Presentation',  color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
                      xlsx:  { icon: '📈', label: 'Spreadsheet',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                      excel: { icon: '📈', label: 'Spreadsheet',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' }
                    };
                    const meta = colors[docInfo.ext] || { icon: '📄', label: 'Document', color: '#64748b', bg: 'rgba(100,116,139,0.12)' };
                    
                    return (
                      <div>
                        <ReactMarkdown components={mdComponents}>{docInfo.text}</ReactMarkdown>
                        <div style={{
                          marginTop: '12px',
                          padding: '16px',
                          background: 'var(--sidebar-tab-hover-bg)',
                          borderRadius: '12px',
                          border: '1px solid var(--sidebar-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              background: meta.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '22px'
                            }}>
                              {meta.icon}
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
                                {meta.label}
                              </h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted-color)' }}>Ready to download</p>
                            </div>
                          </div>
                          <a
                            href={`${API_URL}${docInfo.url}`}
                            download
                            style={{
                              padding: '8px 16px',
                              background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                              color: '#ffffff',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                              display: 'inline-flex',
                              alignItems: 'center',
                              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
                            }}
                            onMouseEnter={e => e.target.style.opacity = '0.9'}
                            onMouseLeave={e => e.target.style.opacity = '1'}
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  }

                  const posterInfo = getPosterDetails(msg.content);
                  if (posterInfo) {
                    return <PosterCard poster={posterInfo.poster} text={posterInfo.text} setCurrentTab={setCurrentTab} />;
                  }

                  return <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>;
                })()
                }
              </div>
            </div>
          );
        })}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '0 28px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#06B6D4' }}>
              FIC AI
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px 18px 18px 18px', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
              color: '#64748B', fontSize: 13,
            }}>
              <LoadingDots />
              FIC AI is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: 0 }} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 28px', borderTop: '1px solid var(--header-border)', background: 'var(--header-bg)', flexShrink: 0, position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: 'var(--chat-input-container-bg)', border: '1.5px solid var(--chat-input-container-border)',
          borderRadius: 14, padding: '10px 12px', maxWidth: 900, margin: '0 auto',
        }}>

          {/* + Attach Button */}
          <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2 }}>
            <button
              id="chat-attach-btn"
              title="Attach file or image (coming soon)"
              onClick={(e) => { e.stopPropagation(); setShowAttachMenu(prev => !prev); }}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: showAttachMenu ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
                color: '#94A3B8', fontSize: 20, lineHeight: '34px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s, transform 0.2s',
                transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.25)'; e.currentTarget.style.color = '#c4b5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = showAttachMenu ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94A3B8'; }}
            >
              <span style={{ fontSize: 18, fontWeight: 300, marginTop: -1 }}>+</span>
            </button>
            {/* Attach menu tooltip */}
            {showAttachMenu && (
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', bottom: 44, left: 0,
                background: 'rgba(15,18,28,0.97)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '10px 0', minWidth: 180,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)', zIndex: 99,
              }}>
                {[
                  { icon: '🖼️', label: 'Image (coming soon)', disabled: true },
                  { icon: '📁', label: 'File (coming soon)', disabled: true },
                  { icon: '🖌️', label: 'Generate Poster', disabled: false, action: () => { setCurrentTab && setCurrentTab('poster'); setShowAttachMenu(false); } },
                  { icon: '🎨', label: 'Image Generator', disabled: false, action: () => { setCurrentTab && setCurrentTab('image'); setShowAttachMenu(false); } },
                ].map((item, idx) => (
                  <button key={idx}
                    onClick={item.disabled ? undefined : item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 16px',
                      background: 'transparent', border: 'none', cursor: item.disabled ? 'default' : 'pointer',
                      color: item.disabled ? '#475569' : '#CBD5E1', fontSize: 13, textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 15 }}>{item.icon}</span> {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Message FIC AI…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontSize: 14, color: 'var(--chat-input-text)', lineHeight: 1.6,
              maxHeight: 140, overflowY: 'auto', padding: '4px 2px',
            }}
          />

          {/* Mic Button */}
          <button
            id="chat-mic-btn"
            title={isRecording ? 'Stop recording' : 'Speak a message'}
            onClick={startRecording}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isRecording ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)',
              color: isRecording ? '#ef4444' : '#94A3B8',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2,
              transition: 'background 0.2s, color 0.2s',
              boxShadow: isRecording ? '0 0 0 3px rgba(239,68,68,0.3)' : 'none',
              animation: isRecording ? 'mic-pulse 1.2s ease-in-out infinite' : 'none',
            }}
            onMouseEnter={e => { if (!isRecording) { e.currentTarget.style.background = 'rgba(6,182,212,0.2)'; e.currentTarget.style.color = '#06b6d4'; } }}
            onMouseLeave={e => { if (!isRecording) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94A3B8'; } }}
          >
            {/* Mic SVG icon */}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
            </svg>
          </button>

          {/* Send Button */}
          <button
            id="send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--chat-send-btn-bg)',
              color: 'var(--chat-send-btn-text)', fontSize: 13, fontWeight: 700, flexShrink: 0,
              opacity: (loading || !input.trim()) ? 0.3 : 1, transition: 'opacity 0.2s',
              alignSelf: 'flex-end', marginBottom: 2,
            }}
          >
            Send
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.3)', marginTop: 8 }}>
          FIC AI — Local, secure, private.
        </p>
      </div>

       {/* Mic pulse keyframe */}
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0.08); }
        }
      `}</style>

      <LimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        {...getFeatureLimitDetails(limitFeature)}
      />
    </div>
  );
}
