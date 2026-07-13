import React, { useEffect, useRef, useState } from 'react';
import * as fabric from "fabric";
import axios from 'axios';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';
import { API_BASE_URL } from '../config/api';

// Resolve the correct fabric namespace dynamically to prevent "Canvas is not a constructor" bugs
const fabricObj = fabric.fabric || fabric.default || fabric;

const FONT_FAMILIES = ['Poppins', 'Playfair Display', 'Bebas Neue', 'Montserrat', 'Inter'];

const TEMPLATE_PRESETS = {
  luxury_gold: {
    title: 'GRAND OPENING',
    subtitle: 'Experience Premium Luxury & Style',
    cta: 'JOIN US NOW',
    bullets: ['Luxury Redefined', 'Exclusive VIP Access', 'Special Launch Offers'],
    colors: ['#0A0907', '#D4AF37', '#8A6E17'],
    details: 'FIC Center • Invitation Only Event',
    theme: 'luxury_gold',
    imageUrl: 'https://image.pollinations.ai/prompt/luxury%20grand%20opening%20background%2C%20elegant%20gold%20frame%2C%20gold%20balloons%2C%20red%20ribbons%2C%20stage%20lights%2C%20gold%20confetti%20sparkles%2C%20soft%20glow%20lights%2C%20realistic%20photo%2C%204k%20resolution%2C%20no%20text%2C%20no%20words?width=1080&height=1350&nologo=true&seed=888'
  },
  dark_premium: {
    title: 'EXCLUSIVE LAUNCH',
    subtitle: 'Future of Digital Intelligence',
    cta: 'PRE-ORDER NOW',
    bullets: ['Quantum Computing Power', 'Decentralized Architecture', 'Zero Latency Integration'],
    colors: ['#0F0F1A', '#3B82F6', '#7C3AED'],
    details: 'Unlocking intelligent developer solutions.',
    theme: 'dark_premium',
    imageUrl: 'https://image.pollinations.ai/prompt/futuristic%20premium%20abstract%20background%2C%20glowing%20neon%20violet%20and%20blue%20lines%2C%20digital%20network%20patterns%2C%20dark%20space%20aesthetic%2C%20ultra%20detailed%203d%20render%2C%204k%20resolution%2C%20no%20text?width=1080&height=1350&nologo=true&seed=999'
  },
  modern_corporate: {
    title: 'FORGE GLOBAL INC',
    subtitle: 'Empowering Business Scalability',
    cta: 'GET SOLUTIONS',
    bullets: ['Advanced Automation', 'Dedicated Support 24/7', 'Strategic Roadmap Plans'],
    colors: ['#0A0F1D', '#0EA5E9', '#FFFFFF'],
    details: 'Visit www.forgeindia.com for more info.',
    theme: 'modern_corporate',
    imageUrl: 'https://image.pollinations.ai/prompt/modern%20professional%20corporate%20office%20background%2C%20elegant%20clean%20glass%20and%20metal%20skyscrapers%2C%20soft%20sunset%20warm%20light%20reflection%2C%20executive%20look%2C%20depth%20of%20field%2C%20no%20text?width=1080&height=1350&nologo=true&seed=777'
  },
  festival: {
    title: 'HAPPY DIWALI',
    subtitle: 'May the festival of lights bring joy and prosperity',
    cta: 'CELEBRATE',
    bullets: ['Bright diyas & sparkles', 'Warm festive greetings', 'FIC family celebrations'],
    colors: ['#1E0F2E', '#FFD700', '#F97316'],
    details: 'Wishing you a safe and prosperous Diwali!',
    theme: 'festival',
    imageUrl: 'https://image.pollinations.ai/prompt/happy%20diwali%20festival%20celebration%20background%2C%20glowing%20golden%20diyas%2C%20beautiful%20rangoli%20patterns%2C%20sparkles%2C%20warm%20golden%20festive%20lights%2C%20creative%20celebration%20decorations%2C%20no%20text?width=1080&height=1350&nologo=true&seed=555'
  },
  hiring: {
    title: 'WE ARE HIRING',
    subtitle: 'Join our team of creative developers',
    cta: 'APPLY NOW',
    bullets: ['React & Next.js experts', 'Collaborative environment', 'Competitive stipend/salary'],
    colors: ['#090D1A', '#06B6D4', '#7C3AED'],
    details: 'Send your resume to careers@forgeindia.com',
    theme: 'hiring',
    imageUrl: 'https://image.pollinations.ai/prompt/creative%20tech%20office%20workspace%20background%2C%20modern%20desk%20with%20glowing%20code%20on%20monitor%2C%20plant%2C%20soft%20warm%20ambience%2C%20shallow%20depth%20of%20field%2C%20no%20text?width=1080&height=1350&nologo=true&seed=111'
  }
};

export default function PosterEditor({ posterData, onReset }) {
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const fileInputRef = useRef(null);

  // Core Editor States
  const [isDark, setIsDark] = useState(true);
  const toggleTheme = () => {
    setIsDark(prev => !prev);
    const newBg = !isDark ? '#0A0E1A' : '#FFFFFF';
    setBgColor(newBg);
  };
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedObj, setSelectedObj] = useState(null);
  const [canvasError, setCanvasError] = useState('');
  const [canvasReady, setCanvasReady] = useState(false);
  const [layers, setLayers] = useState([]);
  const [bgColor, setBgColor] = useState('#0A0E1A'); // default dark background
  
  // Font / Style Properties
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState('Montserrat');
  const [fontWeight, setFontWeight] = useState('bold');
  const [shapeColor, setShapeColor] = useState('#00FFFF');

  // Canvas size constraints
  const canvasWidth = 1080;
  const canvasHeight = 1528; // Standard A4 Aspect Ratio (1:1.414)
  const [scaleFactor, setScaleFactor] = useState(0.4); // Responsive scale
  const canvasContainerRef = useRef(null);

  // Dynamically recalculate scale so canvas always fits the available area
  useEffect(() => {
    const updateScale = () => {
      const el = canvasContainerRef.current;
      if (!el) return;
      // Subtract horizontal padding (p-3 = 24px on mobile, p-8 = 64px on desktop)
      const paddingH = window.innerWidth < 768 ? 24 : 64;
      const availWidth = el.clientWidth - paddingH;
      if (!availWidth || availWidth <= 0) return;
      const maxScale = 0.4;
      const newScale = Math.min(maxScale, availWidth / canvasWidth);
      setScaleFactor(parseFloat(newScale.toFixed(4)));
    };

    // Small delay ensures layout has settled before measuring
    const timer = setTimeout(updateScale, 50);
    const ro = new ResizeObserver(updateScale);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  // AI Editor States
  const [aiEditInput, setAiEditInput] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [aiEditResult, setAiEditResult] = useState(null);
  const [aiEditHistory, setAiEditHistory] = useState([]);

  // Sync layers panel from canvas objects list
  const updateLayers = (canvas) => {
    if (!canvas) return;
    const objects = canvas.getObjects().map((obj, idx) => ({
      id: obj.id || `layer-${idx}-${obj.type}`,
      name: obj.name || `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} ${idx + 1}`,
      type: obj.type,
      ref: obj
    }));
    setLayers(objects.reverse());
  };

  // 1. Initialize canvas once on mount
  useEffect(() => {
    // Dynamic Google Fonts configuration load
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800;900&family=Montserrat:wght@400;700;900&family=Playfair+Display:ital,wght@0,700;1,400&family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    if (!canvasRef.current || fabricCanvas.current) return;

    // Create Fabric.Canvas directly using the element ref
    const canvas = new fabricObj.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: bgColor,
      preserveObjectStacking: true,
    });
    fabricCanvas.current = canvas;
    setCanvasReady(true);

    // Event handlers
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => setSelectedObj(null));

    canvas.on('object:added', () => updateLayers(canvas));
    canvas.on('object:removed', () => updateLayers(canvas));
    canvas.on('object:modified', () => updateLayers(canvas));

    return () => {
      document.head.removeChild(link);
      if (canvas) {
        try {
          canvas.dispose();
        } catch (e) {
          console.warn('Canvas disposal error on unmount:', e);
        }
      }
      fabricCanvas.current = null;
      setCanvasReady(false);
    };
  }, []);

  const [originalBgUrl, setOriginalBgUrl] = useState('');

  // 2. Watch for posterData updates or canvas readiness
  useEffect(() => {
    if (posterData) {
      const bg = posterData.imageUrl || posterData.url || posterData.poster?.backgroundImageUrl;
      if (bg) {
        setOriginalBgUrl(bg);
      }
    }
  }, [posterData]);

  useEffect(() => {
    if (canvasReady && posterData && fabricCanvas.current) {
      renderPoster(posterData);
    }
  }, [canvasReady, posterData, originalBgUrl]);

  // Selection handler
  const handleSelection = (e) => {
    const obj = e.target;
    setSelectedObj(obj);
    if (obj) {
      if (obj.type === 'textbox' || obj.type === 'text') {
        setTextColor(obj.fill || '#FFFFFF');
        setFontSize(obj.fontSize || 32);
        setFontFamily(obj.fontFamily || 'Montserrat');
        setFontWeight(obj.fontWeight || 'bold');
      } else {
        setShapeColor(obj.fill || '#00FFFF');
      }
    }
  };

  const updateProp = (prop, val) => {
    const canvas = fabricCanvas.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, val);
    obj.setCoords();
    canvas.renderAll();
    setSelectedObj({ ...obj, [prop]: val });
    updateLayers(canvas);
  };

  // Change canvas background color
  const changeBackgroundColor = (color) => {
    setBgColor(color);
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
  };

  // ── AI POSTER EDITOR: Apply action plan from posterEditPlanner ──────────────
  const applyEditToPoster = async () => {
    const editRequest = aiEditInput.trim();
    if (!editRequest || aiEditLoading) return;

    const canvas = fabricCanvas.current;
    if (!canvas) {
      setAiEditResult({ ok: false, msg: 'Canvas not ready. Please generate a poster first.' });
      return;
    }

    setAiEditLoading(true);
    setAiEditResult(null);

    try {
      const backendUrl = import.meta.env.VITE_API_URL || API_BASE_URL;
      const canvasObjects = canvas.getObjects().map(o => ({ name: o.name || '', type: o.type }));
      const res = await axios.post(`${backendUrl}/api/poster/edit`, {
        posterJSON: { objects: canvasObjects },
        editRequest
      }, { timeout: 30000 });

      if (!res.data.success) throw new Error(res.data.error || 'Unknown error');

      const plan = res.data.actionPlan;
      console.log('[AI Editor] Action plan:', plan);

      if (plan.action === 'unknown') {
        setAiEditResult({ ok: false, msg: plan.description || 'Could not understand the request. Try: "Change title color to red"' });
        setAiEditLoading(false);
        return;
      }

      let applied = false;

      const findObj = (target) => {
        const objects = canvas.getObjects();
        let found = objects.find(o => o.name === target);
        if (!found) found = objects.find(o => o.name && o.name.toLowerCase().includes(target.toLowerCase()));
        if (!found && target === 'title') found = objects.find(o => o.type === 'textbox' || o.type === 'text');
        if (!found && target === 'heroImage') found = objects.find(o => o.type === 'image');
        return found;
      };

      switch (plan.action) {
        case 'update': {
          if (plan.target === 'background' && plan.changes.fill) {
            canvas.setBackgroundColor(plan.changes.fill, canvas.renderAll.bind(canvas));
            applied = true;
          } else {
            const obj = findObj(plan.target);
            if (obj) {
              const safeChanges = { ...plan.changes };
              if (safeChanges.text && (obj.type === 'textbox' || obj.type === 'text')) {
                obj.set('text', safeChanges.text);
                delete safeChanges.text;
              }
              obj.set(safeChanges);
              obj.setCoords();
              applied = true;
            }
          }
          break;
        }
        case 'move': {
          const obj = findObj(plan.target);
          if (obj && plan.changes) {
            if (plan.changes.left !== undefined) obj.set('left', plan.changes.left);
            if (plan.changes.top !== undefined) obj.set('top', plan.changes.top);
            obj.setCoords();
            applied = true;
          }
          break;
        }
        case 'resize': {
          const obj = findObj(plan.target);
          if (obj && plan.changes) {
            if (plan.changes.scaleX !== undefined) obj.set('scaleX', plan.changes.scaleX);
            if (plan.changes.scaleY !== undefined) obj.set('scaleY', plan.changes.scaleY);
            if (plan.changes.fontSize !== undefined) obj.set('fontSize', plan.changes.fontSize);
            obj.setCoords();
            applied = true;
          }
          break;
        }
        case 'delete': {
          const obj = findObj(plan.target);
          if (obj) { canvas.remove(obj); applied = true; }
          break;
        }
        case 'add': {
          if (plan.changes && plan.changes.text) {
            const newText = new fabricObj.Textbox(plan.changes.text, {
              left: plan.changes.left || 200,
              top: plan.changes.top || 200,
              fontSize: plan.changes.fontSize || 48,
              fill: plan.changes.fill || '#ffffff',
              fontFamily: plan.changes.fontFamily || 'Montserrat',
              fontWeight: 'bold',
              name: plan.target || 'newText'
            });
            canvas.add(newText);
            applied = true;
          }
          break;
        }
        case 'replace': {
          if (plan.changes && plan.changes.src) {
            const obj = findObj(plan.target);
            if (obj && obj.type === 'image') {
              fabricObj.Image.fromURL(plan.changes.src, (img) => {
                const scaleX = obj.width / img.width;
                const scaleY = obj.height / img.height;
                img.set({ left: obj.left, top: obj.top, scaleX, scaleY, name: obj.name });
                canvas.remove(obj);
                canvas.add(img);
                canvas.renderAll();
              }, { crossOrigin: 'anonymous' });
              applied = true;
            }
          }
          break;
        }
        default:
          break;
      }

      canvas.renderAll();
      updateLayers(canvas);

      const entry = { request: editRequest, result: plan.description, ok: applied };
      setAiEditHistory(prev => [entry, ...prev.slice(0, 9)]);
      setAiEditResult({
        ok: applied,
        msg: applied ? plan.description : `Could not find element "${plan.target}" on canvas.`
      });
      if (applied) setAiEditInput('');

    } catch (err) {
      console.error('[AI Editor] Error:', err.message);
      setAiEditResult({ ok: false, msg: `Error: ${err.message}` });
    } finally {
      setAiEditLoading(false);
    }
  };


  // Client-side layout composition mapper for preset template fallback
  const getClientLayout = (p) => {
    const layoutType = p.layoutType || p.template || p.theme || 'hiring';
    
    // Respect user dark/light toggle
    let theme = isDark ? (layoutType.toLowerCase().includes('light') ? 'festival' : 'hiring') : 'festival';
    const lowerType = layoutType.toLowerCase();
    // fallback logic retained for explicit theme names
    if (lowerType.includes('hiring') || lowerType.includes('dark') || lowerType.includes('modern')) theme = 'hiring';
    else if (lowerType.includes('course') || lowerType.includes('education') || lowerType.includes('academy')) theme = 'course';
    else if (lowerType.includes('corporate') || lowerType.includes('business') || lowerType.includes('sale')) theme = 'business';
    else if (lowerType.includes('festival') || lowerType.includes('diwali') || lowerType.includes('celebration') || lowerType.includes('christmas') || lowerType.includes('pongal')) theme = 'festival';

    const canvasWidth = 1080;
    const canvasHeight = 1350;
    const marginX = 100;

    let palette = p.colors || p.colorPalette || [];
    if (palette.length === 0) {
      if (theme === 'hiring') palette = ['#0B0F19', '#06B6D4', '#7C3AED'];
      else if (theme === 'festival') palette = ['#1E0F2E', '#FFD700', '#F97316'];
      else if (theme === 'course') palette = ['#0A0F1E', '#3B82F6', '#10B981'];
      else if (theme === 'business') palette = ['#080C14', '#D97706', '#E2E8F0'];
      else palette = ['#0A0E1A', '#06B6D4', '#7C3AED'];
    }

    const primaryColor = palette[1] || '#06B6D4';
    const accentColor = palette[2] || '#7C3AED';
    const textColor = '#FFFFFF';
    const subtitleColor = palette[1] || '#00FFFF';

    let layout = {
      theme,
      layoutStyle: 'asymmetric',
      titleX: marginX,
      titleY: 200,
      titleSize: 85,
      titleAlign: 'left',
      titleColor: textColor,
      
      subtitleX: marginX,
      subtitleY: 340,
      subtitleSize: 26,
      subtitleAlign: 'left',
      subtitleColor: subtitleColor,
      
      bulletsX: marginX,
      bulletsY: 460,
      bulletsSize: 22,
      bulletsLayout: 'vertical',
      bulletsColor: '#E2E8F0',
      
      ctaX: marginX,
      ctaY: 1050,
      ctaWidth: 320,
      ctaHeight: 70,
      ctaColor: accentColor,
      ctaTextColor: '#FFFFFF',
      
      footerX: marginX,
      footerY: 1200,
      footerSize: 16,
      footerColor: '#64748B',
      
      decorations: []
    };

    if (theme === 'festival') {
      layout.layoutStyle = 'festive-card';
      layout.titleSize = 90;
      layout.titleY = 240;
      layout.subtitleY = 380;
      layout.bulletsY = 490;
      
      layout.decorations.push({
        type: 'rect',
        left: 80,
        top: 160,
        width: 920,
        height: 980,
        rx: 24,
        ry: 24,
        fill: isDark ? '#090514' : '#FFF5E1',
        opacity: 0.65,
        stroke: primaryColor,
        strokeWidth: 1.5,
        name: 'Glassmorphic Backdrop'
      });

      layout.decorations.push({
        type: 'corner-accent',
        left: 90,
        top: 170,
        width: 60,
        height: 60,
        color: primaryColor,
        name: 'Top Left Accent'
      });
      layout.decorations.push({
        type: 'corner-accent',
        left: 930,
        top: 1070,
        width: 60,
        height: 60,
        color: primaryColor,
        name: 'Bottom Right Accent',
        flip: true
      });
    }
    else if (theme === 'hiring') {
      layout.layoutStyle = 'split-recruitment';
      layout.titleX = marginX;
      layout.titleY = 280;
      layout.titleSize = 80;
      
      layout.subtitleX = marginX;
      layout.subtitleY = 460;
      layout.subtitleSize = 24;

      layout.bulletsX = 580;
      layout.bulletsY = 320;
      layout.bulletsSize = 20;
      layout.bulletsLayout = 'vertical';

      layout.ctaX = marginX;
      layout.ctaY = 960;
      layout.ctaWidth = 320;
      layout.ctaHeight = 70;


      
      layout.decorations.push({
        type: 'line',
        left: marginX,
        top: 240,
        width: 120,
        height: 6,
        fill: primaryColor,
        name: 'Cyber Accent Line'
      });
    }
    else if (theme === 'course') {
      layout.layoutStyle = 'grid-education';
      layout.titleAlign = 'center';
      layout.titleX = canvasWidth / 2;
      layout.titleY = 160;
      layout.titleSize = 75;

      layout.subtitleAlign = 'center';
      layout.subtitleX = canvasWidth / 2;
      layout.subtitleY = 280;
      layout.subtitleSize = 24;

      layout.bulletsX = marginX;
      layout.bulletsY = 440;
      layout.bulletsSize = 20;
      layout.bulletsLayout = 'grid';

      layout.ctaX = 390;
      layout.ctaY = 1050;
      layout.ctaWidth = 300;
      layout.ctaHeight = 70;

      layout.footerAlign = 'center';
      layout.footerX = canvasWidth / 2;
      layout.footerY = 1220;

      layout.decorations.push({
        type: 'line',
        left: 100,
        top: 360,
        width: 880,
        height: 2,
        fill: primaryColor,
        opacity: 0.3,
        name: 'Header Divider Line'
      });
      
      layout.decorations.push({
        type: 'line',
        left: 100,
        top: 980,
        width: 880,
        height: 2,
        fill: primaryColor,
        opacity: 0.3,
        name: 'Footer Divider Line'
      });
    }
    else if (theme === 'business') {
      layout.layoutStyle = 'corporate-clean';
      layout.titleX = marginX + 40;
      layout.titleY = 260;
      layout.titleSize = 85;

      layout.subtitleX = marginX + 40;
      layout.subtitleY = 430;
      layout.subtitleSize = 24;

      layout.bulletsX = marginX + 40;
      layout.bulletsY = 560;
      
      layout.ctaX = marginX + 40;
      layout.ctaY = 940;
      layout.ctaWidth = 280;
      layout.ctaHeight = 70;

      layout.decorations.push({
        type: 'rect',
        left: marginX,
        top: 260,
        width: 8,
        height: 720,
        rx: 4,
        ry: 4,
        fill: accentColor,
        name: 'Executive Accent Bar'
      });
    }

    const estHeadingHeight = (p.heading || p.posterTitle || '').length > 25 ? (layout.titleSize * 2.2) : (layout.titleSize * 1.2);
    const minSubtitleY = layout.titleY + estHeadingHeight + 20;
    if (layout.subtitleY < minSubtitleY) {
      layout.subtitleY = minSubtitleY;
    }

    const minBulletsY = layout.subtitleY + (layout.subtitleSize * 1.5) + 40;
    if (layout.bulletsY < minBulletsY) {
      layout.bulletsY = minBulletsY;
    }

    return layout;
  };

  // Render poster graphics using computed AI composition engine coordinates
  // Helper to fetch SVG icons from Iconify API dynamically based on category color
  const getIconUrl = (iconKey, colorHex) => {
    const emojiMap = {
      'code': 'code-tags', 'briefcase': 'briefcase', 'award': 'trophy', 'star': 'star',
      'rocket': 'rocket-launch', 'calendar': 'calendar', 'graduationcap': 'school',
      'shield': 'shield-check', 'users': 'account-group', 'trendingup': 'trending-up',
      'home': 'home', 'building': 'office-building', 'light': 'lightbulb-on',
      'check': 'check-circle', 'info': 'information', 'globe': 'web', 'target': 'target',
      'chart': 'chart-bar', 'lock': 'lock', 'wrench': 'wrench', 'gears': 'cog',
      'heart': 'heart', 'sparkles': 'creation', 'bell': 'bell'
    };
    const iconName = emojiMap[(iconKey || 'star').toLowerCase().replace(/[^a-z]/g, '')] || 'star';
    const cleanColor = (colorHex || '#06B6D4').replace('#', '');
    return `https://api.iconify.design/mdi:${iconName}.svg?color=%23${cleanColor}`;
  };  // Render poster graphics using dynamic Fabric.js text measurements and auto-layout coordinates
  const renderPoster = (data) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;

    canvas.clear();
    canvas.discardActiveObject();
    setCanvasError('');

    // Extract details safely
    const poster = data?.poster || data || {};
    const bgUrl = data?.imageUrl || poster?.backgroundImageUrl || poster?.imageUrl || originalBgUrl;

    const layout = poster.layout || {};
    const colors = poster.colors || { primary: '#06B6D4', accent: '#7C3AED', bg: '#090D1A', text: '#FFFFFF' };
    const decorations = poster.decorations || [];

    const category = poster.category || 'Hiring';

    // 1. Color Palette and Typography Setup based on Category
    const themeColors = {
      'Real Estate': {
        bg: '#0A0A0A',
        primary: '#D4AF37',
        accent: '#FAF6EE',
        text: '#FFFFFF',
        muted: '#EAD8C0',
        fontTitle: 'Playfair Display',
        fontBody: 'Montserrat'
      },
      'Hiring': {
        bg: '#090D1A',
        primary: '#3B82F6',
        accent: '#8B5CF6',
        text: '#FFFFFF',
        muted: '#94A3B8',
        fontTitle: 'Montserrat',
        fontBody: 'Inter'
      },
      'Restaurant': {
        bg: '#1A120B',
        primary: '#F97316',
        accent: '#EF4444',
        text: '#FAF6EE',
        muted: '#FAF6EE',
        fontTitle: 'Playfair Display',
        fontBody: 'Montserrat'
      },
      'Festival': {
        bg: '#2A0815',
        primary: '#FFD700',
        accent: '#EF4444',
        text: '#FFFFFF',
        muted: '#FBBF24',
        fontTitle: 'Playfair Display',
        fontBody: 'Montserrat'
      },
      'Grand Opening': {
        bg: '#0A0907',
        primary: '#D4AF37',
        accent: '#E6C65B',
        text: '#FFFFFF',
        muted: '#A88D32',
        fontTitle: 'Playfair Display',
        fontBody: 'Montserrat'
      },
      'Sale / Offer': {
        bg: '#120202',
        primary: '#EF4444',
        accent: '#FBBF24',
        text: '#FFFFFF',
        muted: '#F87171',
        fontTitle: 'Bebas Neue',
        fontBody: 'Inter'
      },
      'Corporate': {
        bg: '#0B0F19',
        primary: '#0EA5E9',
        accent: '#38BDF8',
        text: '#FFFFFF',
        muted: '#94A3B8',
        fontTitle: 'Poppins',
        fontBody: 'Inter'
      },
      'Education': {
        bg: '#0A0F24',
        primary: '#3B82F6',
        accent: '#10B981',
        text: '#FFFFFF',
        muted: '#A5B4FC',
        fontTitle: 'Montserrat',
        fontBody: 'Inter'
      },
      'Event': {
        bg: '#0F0B24',
        primary: '#8B5CF6',
        accent: '#EC4899',
        text: '#FFFFFF',
        muted: '#C084FC',
        fontTitle: 'Poppins',
        fontBody: 'Inter'
      },
      'Product Launch': {
        bg: '#09090E',
        primary: '#10B981',
        accent: '#06B6D4',
        text: '#FFFFFF',
        muted: '#94A3B8',
        fontTitle: 'Montserrat',
        fontBody: 'Inter'
      },
      'Default': {
        bg: '#0A0E1A',
        primary: '#06B6D4',
        accent: '#7C3AED',
        text: '#FFFFFF',
        muted: '#94A3B8',
        fontTitle: 'Poppins',
        fontBody: 'Inter'
      }
    };

    const style = themeColors[category] || themeColors['Default'];
    setBgColor(style.bg);

    const fontPrimary = style.fontTitle;
    const fontSecondary = style.fontBody;

    // Helper to scale text to fit max height
    const scaleText = (box, maxHeight, minSize) => {
      box.initDimensions();
      while (box.height > maxHeight && box.fontSize > minSize) {
        box.set('fontSize', box.fontSize - 2);
        box.initDimensions();
      }
    };

    const getSafeText = (val, defaultVal = '') => {
      if (!val) return defaultVal;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') return val.text || val.title || defaultVal;
      return defaultVal;
    };

    // ─── LAYOUT A: Hero Split ─────────────────────────────────────────────────
    // For: Grand Opening, Festival, Restaurant, Sale/Offer, Birthday, Wedding
    // Structure: Full-bleed image top, diagonal gradient band, spaced text at bottom
    const renderLayoutHeroSplit = (htmlImg) => {
      // ── 1. Base image (100% full bleed canvas coverage) ──────────────────
      if (htmlImg) {
        const scale = Math.max(canvasWidth / htmlImg.width, canvasHeight / htmlImg.height);
        canvas.add(new fabricObj.Image(htmlImg, {
          left: (canvasWidth - htmlImg.width * scale) / 2,
          top: (canvasHeight - htmlImg.height * scale) / 2,
          scaleX: scale, scaleY: scale,
          selectable: false, evented: false, name: 'Full Bleed Image'
        }));
      } else {
        canvas.add(new fabricObj.Rect({
          left: 0, top: 0, width: canvasWidth, height: canvasHeight,
          fill: style.bg, selectable: false, name: 'Fallback BG'
        }));
      }

      // ── 2. Readability overlays (Top & Bottom Vignettes) ──────────────────
      // Top dark gradient to ensure header badge and title stand out
      canvas.add(new fabricObj.Rect({
        left: 0, top: 0, width: canvasWidth, height: 420,
        fill: new fabricObj.Gradient({
          type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: 420 },
          colorStops: [
            { offset: 0, color: 'rgba(0,0,0,0.85)' },
            { offset: 0.5, color: 'rgba(0,0,0,0.5)' },
            { offset: 1, color: 'transparent' }
          ]
        }),
        selectable: false, evented: false, name: 'Top Vignette'
      }));

      // Bottom dark gradient to ensure features, CTA, and footer stand out
      canvas.add(new fabricObj.Rect({
        left: 0, top: canvasHeight - 750, width: canvasWidth, height: 750,
        fill: new fabricObj.Gradient({
          type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: 750 },
          colorStops: [
            { offset: 0, color: 'transparent' },
            { offset: 0.4, color: 'rgba(0,0,0,0.6)' },
            { offset: 1, color: 'rgba(0,0,0,0.95)' }
          ]
        }),
        selectable: false, evented: false, name: 'Bottom Vignette'
      }));

      // ── 3. Category Badge ──────────────────────────────────────────────────
      const categoryBadgeMap = {
        'Grand Opening': '🎊  GRAND OPENING',
        'Festival':      '✨  FESTIVAL CELEBRATION',
        'Restaurant':    '🍽  GOURMET EXPERIENCE',
        'Sale / Offer':  '🔥  EXCLUSIVE OFFER',
        'Birthday':      '🎂  HAPPY BIRTHDAY',
        'Wedding':       '💍  WEDDING CELEBRATION'
      };
      const badgeText = categoryBadgeMap[category] || ('✦  ' + category.toUpperCase());
      canvas.add(new fabricObj.Textbox(badgeText, {
        left: canvasWidth / 2, top: 90, width: 800,
        fontSize: 16, fontFamily: fontSecondary, fontWeight: 'bold',
        fill: style.primary, textAlign: 'center', originX: 'center', charSpacing: 250,
        selectable: false, name: 'Category Badge'
      }));

      canvas.add(new fabricObj.Rect({
        left: canvasWidth / 2 - 80, top: 116, width: 160, height: 2,
        fill: style.primary + 'AA', selectable: false, name: 'Badge Divider'
      }));

      // ── 4. Main Title — Very prominent, glowing 3D-effect shadow ──────────
      const rawTitle = getSafeText(poster.title || poster.heading || category, category);
      const formattedTitle = rawTitle.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      const titleBox = new fabricObj.Textbox(formattedTitle, {
        left: canvasWidth / 2, top: 145, width: 960,
        fontSize: 96, fontFamily: fontPrimary, fontWeight: '900',
        fill: '#FFFFFF', textAlign: 'center', originX: 'center', lineHeight: 1.06,
        shadow: new fabricObj.Shadow({ color: style.primary, blur: 24, offsetX: 0, offsetY: 4 }),
        selectable: true, name: 'Poster Title'
      });
      scaleText(titleBox, 220, 44);
      canvas.add(titleBox);
      let currentY = titleBox.top + titleBox.height + 25;

      // ── 5. Ribbon/Accent Banner Box (Subtitle Banner) ────────────────────
      const rawSub = getSafeText(poster.subtitle || poster.subheading || '');
      if (rawSub) {
        const formattedSub = rawSub.charAt(0).toUpperCase() + rawSub.slice(1).toLowerCase();
        const bannerW = 840, bannerH = 75;
        const bannerX = (canvasWidth - bannerW) / 2;

        // Premium translucent accent ribbon banner
        canvas.add(new fabricObj.Rect({
          left: bannerX, top: currentY, width: bannerW, height: bannerH, rx: 12, ry: 12,
          fill: style.accent, opacity: 0.9,
          shadow: new fabricObj.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 15, offsetY: 5 }),
          selectable: true, name: 'Subtitle Banner'
        }));

        canvas.add(new fabricObj.Textbox(formattedSub, {
          left: canvasWidth / 2, top: currentY + bannerH / 2, width: bannerW - 60,
          fontSize: 22, fontFamily: fontSecondary, fontWeight: '700',
          fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center',
          selectable: true, name: 'Poster Subtitle'
        }));
        currentY += bannerH + 45;
      }

      // ── 6. Horizontal Feature Cards (3 side-by-side cards) ─────────────────
      const features = poster.features || poster.bullets || [];
      if (features.length > 0) {
        const cardW = 280, cardH = 175, cardGap = 40;
        const totalGridW = 3 * cardW + 2 * cardGap;
        const startX = (canvasWidth - totalGridW) / 2;
        const featSlice = features.slice(0, 3);
        const cardIcons = {
          'Grand Opening': ['🎁', '🎟', '🎉'],
          'Festival':      ['🪔', '🏮', '✨'],
          'Restaurant':    ['🍷', '🍽', '👨‍🍳'],
          'Sale / Offer':  ['⚡', '🛍', '🎁'],
          'Birthday':      ['🍰', '🎈', '🎁'],
          'Wedding':       ['🥂', '💍', '💐']
        }[category] || ['✦', '★', '✦'];

        featSlice.forEach((feat, idx) => {
          const t = typeof feat === 'string' ? feat : (feat.title || '');
          const cardX = startX + idx * (cardW + cardGap);
          const formattedCardText = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

          // Card Background Panel (translucent glassmorphic)
          canvas.add(new fabricObj.Rect({
            left: cardX, top: currentY, width: cardW, height: cardH, rx: 16, ry: 16,
            fill: 'rgba(0,0,0,0.65)', stroke: style.primary + '55', strokeWidth: 1.5,
            shadow: new fabricObj.Shadow({ color: 'rgba(0,0,0,0.4)', blur: 12, offsetY: 4 }),
            selectable: true, name: `Feature Card ${idx}`
          }));

          // Card Icon
          canvas.add(new fabricObj.Textbox(cardIcons[idx] || '✦', {
            left: cardX + cardW / 2, top: currentY + 45, width: 80,
            fontSize: 28, textAlign: 'center', originX: 'center', originY: 'center',
            selectable: false
          }));

          // Card Text
          canvas.add(new fabricObj.Textbox(formattedCardText, {
            left: cardX + cardW / 2, top: currentY + 115, width: cardW - 30,
            fontSize: 15, fontFamily: fontSecondary, fontWeight: 'bold',
            fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center', lineHeight: 1.2,
            selectable: true, name: `Feature Text ${idx}`
          }));
        });
        currentY += cardH + 50;
      }

      // ── 7. CTA Button — Premium glow ───────────────────────────────────────
      const rawCta = getSafeText(poster.cta || 'Learn More');
      const ctaText = rawCta.charAt(0).toUpperCase() + rawCta.slice(1).toLowerCase();
      const btnW = 380, btnH = 68, btnX = (canvasWidth - btnW) / 2;
      canvas.add(new fabricObj.Rect({
        left: btnX, top: currentY, width: btnW, height: btnH, rx: btnH / 2, ry: btnH / 2,
        fill: new fabricObj.Gradient({
          type: 'linear', coords: { x1: 0, y1: 0, x2: btnW, y2: 0 },
          colorStops: [{ offset: 0, color: style.primary }, { offset: 1, color: style.accent }]
        }),
        shadow: new fabricObj.Shadow({ color: style.primary + 'AA', blur: 24, offsetY: 6 }),
        selectable: true, name: 'CTA Button Bg'
      }));
      canvas.add(new fabricObj.Textbox(ctaText, {
        left: canvasWidth / 2, top: currentY + btnH / 2, width: btnW - 40,
        fontSize: 20, fontFamily: fontPrimary, fontWeight: 'bold',
        fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center',
        selectable: true, name: 'CTA Button Text'
      }));
      currentY += btnH + 35;

      // ── 8. Footer ───────────────────────────────────────────────────────────
      const rawFooter = getSafeText(poster.footer || poster.details || '');
      if (rawFooter) {
        const formattedFooter = rawFooter.charAt(0).toUpperCase() + rawFooter.slice(1);
        canvas.add(new fabricObj.Textbox(formattedFooter, {
          left: canvasWidth / 2, top: currentY, width: 900,
          fontSize: 16, fontFamily: fontSecondary, fontWeight: '500',
          fill: style.muted || '#A8C3E5', textAlign: 'center', originX: 'center',
          selectable: true, name: 'Footer Text'
        }));
      }

      // ── 9. Sector ornaments ────────────────────────────────────────────────
      if (category === 'Restaurant') {
        canvas.add(new fabricObj.Textbox('★  ★  ★  ★  ★', {
          left: canvasWidth / 2, top: 58, width: 400,
          fontSize: 14, fontFamily: fontSecondary,
          fill: style.primary, textAlign: 'center', originX: 'center', charSpacing: 120, selectable: false
        }));
      } else if (category === 'Festival') {
        [[75, 75], [canvasWidth - 105, 75], [75, canvasHeight - 110], [canvasWidth - 105, canvasHeight - 110]].forEach(([lx, ly]) => {
          canvas.add(new fabricObj.Textbox('✦', { left: lx, top: ly, fontSize: 32, fill: '#FFD700', opacity: 0.8, selectable: false }));
        });
      } else if (category === 'Sale / Offer') {
        canvas.add(new fabricObj.Rect({ left: 65, top: 50, width: 155, height: 42, rx: 8, ry: 8, fill: '#EF4444', angle: -8, selectable: false }));
        canvas.add(new fabricObj.Textbox('HOT DEAL', { left: 142, top: 71, width: 140, fontSize: 14, fontFamily: fontPrimary, fontWeight: 'bold', fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center', angle: -8, selectable: false }));
      }

      // ── 10. Border frames ──────────────────────────────────────────────────
      canvas.add(new fabricObj.Rect({ left: 24, top: 24, width: canvasWidth - 48, height: canvasHeight - 48, fill: 'transparent', stroke: style.primary, strokeWidth: 3.5, selectable: false, name: 'Outer Border' }));
      canvas.add(new fabricObj.Rect({ left: 38, top: 38, width: canvasWidth - 76, height: canvasHeight - 76, fill: 'transparent', stroke: style.accent + '44', strokeWidth: 1.5, selectable: false, name: 'Inner Border' }));
    };

    // ─── LAYOUT B: Corporate Card ─────────────────────────────────────────────
    // For: Hiring, Corporate, Education, Healthcare
    // Structure: Left-aligned text, right clipped image column, vertical accent line, fully distributed height
    const renderLayoutCorporateCard = (htmlImg) => {
      // Full dark background
      canvas.add(new fabricObj.Rect({
        left: 0, top: 0, width: canvasWidth, height: canvasHeight,
        fill: new fabricObj.Gradient({
          type: 'linear', coords: { x1: 0, y1: 0, x2: canvasWidth, y2: canvasHeight },
          colorStops: [{ offset: 0, color: style.bg }, { offset: 1, color: '#030509' }]
        }),
        selectable: false, evented: false, name: 'Corporate BG'
      }));

      // Right image column (42% width)
      const imgColW = 450, imgColLeft = canvasWidth - imgColW;
      if (htmlImg) {
        const scale = Math.max(imgColW / htmlImg.width, canvasHeight / htmlImg.height);
        const clipRect = new fabricObj.Rect({ left: imgColLeft, top: 0, width: imgColW, height: canvasHeight, absolutePositioned: true });
        canvas.add(new fabricObj.Image(htmlImg, {
          left: imgColLeft + (imgColW - htmlImg.width * scale) / 2,
          top: (canvasHeight - htmlImg.height * scale) / 2,
          scaleX: scale, scaleY: scale,
          clipPath: clipRect, selectable: false, evented: false, name: 'Right Image Column'
        }));
        // Right image vignette gradient
        canvas.add(new fabricObj.Rect({
          left: imgColLeft, top: 0, width: imgColW, height: canvasHeight,
          fill: new fabricObj.Gradient({
            type: 'linear', coords: { x1: 0, y1: 0, x2: imgColW, y2: 0 },
            colorStops: [{ offset: 0, color: style.bg + 'FF' }, { offset: 0.4, color: style.bg + '00' }]
          }),
          selectable: false, evented: false, name: 'Right Image Vignette'
        }));
      }

      // Vertical accent bar
      canvas.add(new fabricObj.Rect({
        left: 72, top: 60, width: 5, height: canvasHeight - 120,
        fill: new fabricObj.Gradient({
          type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: canvasHeight },
          colorStops: [{ offset: 0, color: style.primary }, { offset: 1, color: style.accent }]
        }),
        rx: 3, ry: 3, selectable: false, name: 'Vertical Accent Bar'
      }));

      // Ambient glow in background
      canvas.add(new fabricObj.Circle({
        left: -100, top: 200, radius: 400,
        fill: new fabricObj.Gradient({ type: 'radial', coords: { x1: 400, y1: 400, r1: 0, x2: 400, y2: 400, r2: 400 },
          colorStops: [{ offset: 0, color: style.primary + '1C' }, { offset: 1, color: 'transparent' }] }),
        selectable: false, evented: false, name: 'Left Glow'
      }));

      // Category badge
      const catIcons = { 'Hiring': '👥', 'Corporate': '🏢', 'Education': '🎓', 'Healthcare': '⚕️' };
      const catIcon = catIcons[category] || '✦';
      canvas.add(new fabricObj.Textbox(`${catIcon} ${category.toUpperCase()}`, {
        left: 100, top: 90, width: 500, fontSize: 13,
        fontFamily: fontSecondary, fontWeight: 'bold', fill: style.primary,
        textAlign: 'left', charSpacing: 220, selectable: false, name: 'Category Badge'
      }));

      // Horizontal rule under badge
      canvas.add(new fabricObj.Rect({ left: 100, top: 114, width: 220, height: 2, fill: style.primary + '66', selectable: false, name: 'Badge Divider' }));

      // Main title — left aligned, large, multi-line, positioned lower for A4 distribution
      const rawTitle = getSafeText(poster.title || poster.heading || category, category).toUpperCase();
      const titleBox = new fabricObj.Textbox(rawTitle, {
        left: 100, top: 230, width: 530,
        fontSize: 72, fontFamily: fontPrimary, fontWeight: '900',
        fill: '#FFFFFF', textAlign: 'left', lineHeight: 1.02,
        shadow: new fabricObj.Shadow({ color: style.primary + '44', blur: 15, offsetY: 3 }),
        selectable: true, name: 'Poster Title'
      });
      scaleText(titleBox, 280, 36);
      canvas.add(titleBox);
      let currentY = titleBox.top + titleBox.height + 30;

      // Subtitle
      const rawSub = getSafeText(poster.subtitle || '');
      if (rawSub) {
        const subBox = new fabricObj.Textbox(rawSub, {
          left: 100, top: currentY, width: 530,
          fontSize: 20, fontFamily: fontSecondary, fontWeight: '600',
          fill: style.primary, textAlign: 'left', selectable: true, name: 'Poster Subtitle'
        });
        scaleText(subBox, 80, 14);
        canvas.add(subBox);
        currentY = subBox.top + subBox.height + 35;
      }

      // Horizontal divider
      canvas.add(new fabricObj.Rect({ left: 100, top: currentY, width: 340, height: 1.5, fill: style.primary + '44', selectable: false, name: 'Section Divider' }));
      currentY += 40;

      // Feature bullets — left aligned icon list, highly spaced for A4 sheet distribution
      const features = poster.features || poster.bullets || [];
      const featSlice = features.slice(0, 4);
      const bulletIcons = ['▶', '▶', '▶', '▶'];
      featSlice.forEach((feat, i) => {
        const featText = typeof feat === 'string' ? feat : (feat.title || '');
        if (!featText) return;
        const bulletRow = new fabricObj.Textbox(`${bulletIcons[i]}   ${featText.toUpperCase()}`, {
          left: 100, top: currentY, width: 530,
          fontSize: 16, fontFamily: fontSecondary, fontWeight: '600',
          fill: '#FFFFFF', textAlign: 'left', charSpacing: 40, selectable: true, name: `Feature ${i + 1}`
        });
        canvas.add(bulletRow);
        currentY += 46;
      });
      currentY += 40;

      // CTA button — left aligned pill
      const rawCta = getSafeText(poster.cta || 'APPLY NOW').toUpperCase();
      const btnW = 280, btnH = 58;
      canvas.add(new fabricObj.Rect({
        left: 100, top: currentY, width: btnW, height: btnH, rx: btnH / 2, ry: btnH / 2,
        fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: btnW, y2: 0 },
          colorStops: [{ offset: 0, color: style.primary }, { offset: 1, color: style.accent }] }),
        shadow: new fabricObj.Shadow({ color: style.primary + '55', blur: 18, offsetY: 5 }),
        selectable: true, name: 'CTA Button Bg'
      }));
      canvas.add(new fabricObj.Textbox(rawCta, {
        left: 100 + btnW / 2, top: currentY + btnH / 2, width: btnW - 20,
        fontSize: 15, fontFamily: fontPrimary, fontWeight: 'bold',
        fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center',
        selectable: true, name: 'CTA Button Text'
      }));
      currentY += btnH + 50;

      // Footer
      const rawFooter = getSafeText(poster.footer || poster.details || '');
      if (rawFooter) {
        canvas.add(new fabricObj.Textbox(rawFooter, {
          left: 100, top: currentY, width: 530,
          fontSize: 12, fontFamily: fontSecondary, fontWeight: '600',
          fill: '#64748B', textAlign: 'left', selectable: true, name: 'Footer Text'
        }));
      }

      // Sector-Specific Decorative Icons (e.g. Floating tags)
      if (category === 'Hiring') {
        canvas.add(new fabricObj.Textbox('</>', { left: canvasWidth - 150, top: 70, fontSize: 32, fontFamily: 'monospace', fill: style.primary, opacity: 0.4, selectable: false }));
      } else if (category === 'Education') {
        canvas.add(new fabricObj.Textbox('🎓', { left: canvasWidth - 150, top: 70, fontSize: 36, opacity: 0.4, selectable: false }));
      }

      // Company branding top-right
      const rawBrand = getSafeText(poster.companyName || 'FORGE INDIA CONNECT').toUpperCase();
      canvas.add(new fabricObj.Textbox(rawBrand, {
        left: canvasWidth - 250, top: 60, width: 220,
        fontSize: 11, fontFamily: fontSecondary, fontWeight: 'bold',
        fill: style.primary + 'B2', textAlign: 'right', charSpacing: 250,
        selectable: false, name: 'Brand Header'
      }));

      // Outer thin border
      canvas.add(new fabricObj.Rect({ left: 28, top: 28, width: canvasWidth - 56, height: canvasHeight - 56, fill: 'transparent', stroke: style.primary + '44', strokeWidth: 2, selectable: false, name: 'Outer Border' }));
    };

    // ─── LAYOUT C: Luxury Frame ───────────────────────────────────────────────
    // For: Real Estate, Product Launch
    // Structure: Centered image in larger frame, double ornate borders, serif typography, well spaced
    const renderLayoutLuxuryFrame = (htmlImg) => {
      // Rich dark background
      canvas.add(new fabricObj.Rect({
        left: 0, top: 0, width: canvasWidth, height: canvasHeight,
        fill: style.bg, selectable: false, evented: false, name: 'Luxury BG'
      }));
      // Subtle radial texture overlay
      canvas.add(new fabricObj.Rect({
        left: 0, top: 0, width: canvasWidth, height: canvasHeight,
        fill: new fabricObj.Gradient({ type: 'radial',
          coords: { x1: canvasWidth / 2, y1: 400, r1: 0, x2: canvasWidth / 2, y2: 400, r2: 800 },
          colorStops: [{ offset: 0, color: style.primary + '0D' }, { offset: 1, color: 'transparent' }] }),
        selectable: false, evented: false, name: 'Luxury Texture'
      }));

      // Outer double gold border
      canvas.add(new fabricObj.Rect({ left: 22, top: 22, width: canvasWidth - 44, height: canvasHeight - 44, fill: 'transparent', stroke: style.primary, strokeWidth: 3.5, selectable: false, name: 'Outer Gold Frame' }));
      canvas.add(new fabricObj.Rect({ left: 34, top: 34, width: canvasWidth - 68, height: canvasHeight - 68, fill: 'transparent', stroke: style.primary + '55', strokeWidth: 1, selectable: false, name: 'Inner Thin Frame' }));

      // Corner ornaments
      [[44, 44], [canvasWidth - 44, 44], [44, canvasHeight - 44], [canvasWidth - 44, canvasHeight - 44]].forEach(([cx, cy], i) => {
        canvas.add(new fabricObj.Circle({ left: cx, top: cy, radius: 4.5, fill: style.primary, originX: 'center', originY: 'center', selectable: false, name: `Corner Gem ${i}` }));
      });

      // Brand header
      const rawBrand = getSafeText(poster.companyName || (category === 'Real Estate' ? 'EXCLUSIVE REALTY' : 'FORGE INDIA CONNECT')).toUpperCase();
      canvas.add(new fabricObj.Textbox(rawBrand, {
        left: canvasWidth / 2, top: 65, width: 700,
        fontSize: 12, fontFamily: fontSecondary, fontWeight: 'bold',
        fill: style.primary, textAlign: 'center', originX: 'center', charSpacing: 300,
        selectable: false, name: 'Brand Header'
      }));

      // Horizontal rule
      canvas.add(new fabricObj.Rect({ left: canvasWidth / 2 - 120, top: 88, width: 240, height: 1, fill: style.primary + '88', selectable: false, name: 'Top Divider' }));

      // Inner image frame (enlarged to 780px height to fill A4 sheet gorgeously)
      const frameLeft = 80, frameTop = 130, frameW = canvasWidth - 160, frameH = 780;
      if (htmlImg) {
        const scaleX = frameW / htmlImg.width;
        const scaleY = frameH / htmlImg.height;
        const scale = Math.max(scaleX, scaleY);
        const clipRect = new fabricObj.Rect({ left: frameLeft, top: frameTop, width: frameW, height: frameH, absolutePositioned: true });
        canvas.add(new fabricObj.Image(htmlImg, {
          left: frameLeft + (frameW - htmlImg.width * scale) / 2,
          top: frameTop + (frameH - htmlImg.height * scale) / 2,
          scaleX: scale, scaleY: scale,
          clipPath: clipRect, selectable: false, evented: false, name: 'Hero Image'
        }));
        // Gradient overlay on image bottom
        canvas.add(new fabricObj.Rect({
          left: frameLeft, top: frameTop + frameH * 0.5, width: frameW, height: frameH * 0.5,
          fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: frameH * 0.5 },
            colorStops: [{ offset: 0, color: 'transparent' }, { offset: 1, color: style.bg + 'FA' }] }),
          selectable: false, evented: false, name: 'Hero Vignette'
        }));
      } else {
        canvas.add(new fabricObj.Rect({
          left: frameLeft, top: frameTop, width: frameW, height: frameH,
          fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: frameW, y2: frameH },
            colorStops: [{ offset: 0, color: style.primary + '22' }, { offset: 1, color: style.accent + '11' }] }),
          selectable: false, name: 'Hero Fallback'
        }));
      }
      // Frame border over image
      canvas.add(new fabricObj.Rect({ left: frameLeft, top: frameTop, width: frameW, height: frameH, fill: 'transparent', stroke: style.primary, strokeWidth: 2, selectable: false, name: 'Image Gold Frame' }));

      // Text zone
      let currentY = frameTop + frameH + 28;

      // Main title — centered serif title
      const rawTitle = getSafeText(poster.title || poster.heading || category, category);
      const titleBox = new fabricObj.Textbox(rawTitle, {
        left: canvasWidth / 2, top: currentY, width: 880,
        fontSize: 58, fontFamily: fontPrimary, fontWeight: '700',
        fill: style.primary, textAlign: 'center', originX: 'center', lineHeight: 1.1,
        shadow: new fabricObj.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 8, offsetY: 2 }),
        selectable: true, name: 'Poster Title'
      });
      scaleText(titleBox, 120, 32);
      canvas.add(titleBox);
      currentY = titleBox.top + titleBox.height + 15;

      // Ornamental separator
      canvas.add(new fabricObj.Textbox('— ✦ —', {
        left: canvasWidth / 2, top: currentY, width: 300,
        fontSize: 16, fontFamily: fontPrimary, fill: style.primary + 'CC',
        textAlign: 'center', originX: 'center', selectable: false, name: 'Ornament Divider'
      }));
      currentY += 40;

      // Subtitle small-caps
      const rawSub = getSafeText(poster.subtitle || '');
      if (rawSub) {
        const subBox = new fabricObj.Textbox(rawSub.toUpperCase(), {
          left: canvasWidth / 2, top: currentY, width: 860,
          fontSize: 16, fontFamily: fontSecondary, fontWeight: '700',
          fill: style.accent, textAlign: 'center', originX: 'center', charSpacing: 100,
          selectable: true, name: 'Poster Subtitle'
        });
        canvas.add(subBox);
        currentY += 45;
      }

      // Feature bullet points inline row
      const features = poster.features || poster.bullets || [];
      if (features.length > 0) {
        const featText = features.slice(0, 3).map(f => typeof f === 'string' ? f : (f.title || '')).join('   |   ').toUpperCase();
        canvas.add(new fabricObj.Textbox(featText, {
          left: canvasWidth / 2, top: currentY, width: 860,
          fontSize: 12.5, fontFamily: fontSecondary, fontWeight: 'bold',
          fill: style.muted || '#D4AF37', textAlign: 'center', originX: 'center', charSpacing: 60,
          selectable: true, name: 'Features Row'
        }));
        currentY += 45;
      }

      // CTA Rectangular golden button
      const rawCta = getSafeText(poster.cta || 'ENQUIRE NOW').toUpperCase();
      const btnW = 320, btnH = 55, btnX = (canvasWidth - btnW) / 2;
      canvas.add(new fabricObj.Rect({
        left: btnX, top: currentY, width: btnW, height: btnH, rx: 0, ry: 0,
        fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: btnW, y2: 0 },
          colorStops: [{ offset: 0, color: style.primary }, { offset: 1, color: '#E5C158' }] }),
        stroke: style.primary + 'AA', strokeWidth: 1,
        shadow: new fabricObj.Shadow({ color: style.primary + '44', blur: 14, offsetY: 4 }),
        selectable: true, name: 'CTA Button Bg'
      }));
      canvas.add(new fabricObj.Textbox(rawCta, {
        left: canvasWidth / 2, top: currentY + btnH / 2, width: btnW - 20,
        fontSize: 14, fontFamily: fontPrimary, fontWeight: 'bold',
        fill: '#080808', textAlign: 'center', originX: 'center', originY: 'center', charSpacing: 150,
        selectable: true, name: 'CTA Button Text'
      }));
      currentY += btnH + 30;

      // Footer
      const rawFooter = getSafeText(poster.footer || poster.details || '');
      if (rawFooter) {
        canvas.add(new fabricObj.Textbox(rawFooter, {
          left: canvasWidth / 2, top: currentY, width: 820,
          fontSize: 12, fontFamily: fontSecondary, fontWeight: '600',
          fill: style.primary + '80', textAlign: 'center', originX: 'center',
          selectable: true, name: 'Footer Text'
        }));
      }
    };

    // ─── LAYOUT D: Minimal Modern ─────────────────────────────────────────────
    // For: Event, Default
    // Structure: Full-width color band, massive display title, bold minimal grid
    const renderLayoutMinimalModern = (htmlImg) => {
      // Pure black background base
      canvas.add(new fabricObj.Rect({ left: 0, top: 0, width: canvasWidth, height: canvasHeight, fill: '#050507', selectable: false, name: 'Pure Black BG' }));

      // Background image clipped to top 48% height
      const imgHeight = canvasHeight * 0.48;
      if (htmlImg) {
        const scale = Math.max(canvasWidth / htmlImg.width, imgHeight / htmlImg.height);
        const clipRect = new fabricObj.Rect({ left: 0, top: 0, width: canvasWidth, height: imgHeight, absolutePositioned: true });
        canvas.add(new fabricObj.Image(htmlImg, {
          left: (canvasWidth - htmlImg.width * scale) / 2, top: 0,
          scaleX: scale, scaleY: scale,
          clipPath: clipRect, selectable: false, evented: false, name: 'Top Image'
        }));
        // Dark vignette top and bottom of image
        canvas.add(new fabricObj.Rect({
          left: 0, top: 0, width: canvasWidth, height: imgHeight,
          fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: imgHeight },
            colorStops: [{ offset: 0, color: '#050507B3' }, { offset: 0.65, color: 'transparent' }, { offset: 1, color: '#050507FF' }] }),
          selectable: false, evented: false, name: 'Top Vignette'
        }));
      }

      // Full-width color band
      const bandY = imgHeight - 35;
      const bandH = 80;
      canvas.add(new fabricObj.Rect({
        left: 0, top: bandY, width: canvasWidth, height: bandH,
        fill: new fabricObj.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: canvasWidth, y2: 0 },
          colorStops: [{ offset: 0, color: style.primary }, { offset: 0.5, color: style.accent }, { offset: 1, color: style.primary }] }),
        selectable: false, name: 'Color Band'
      }));

      // Category label on the band
      const catLabel = category.toUpperCase();
      canvas.add(new fabricObj.Textbox(catLabel, {
        left: canvasWidth / 2, top: bandY + (bandH / 2), width: 850,
        fontSize: 22, fontFamily: fontSecondary, fontWeight: 'bold',
        fill: '#FFFFFF', textAlign: 'center', originX: 'center', originY: 'center', charSpacing: 350,
        shadow: new fabricObj.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 8, offsetY: 1 }),
        selectable: false, name: 'Band Label'
      }));

      // Big display title below band
      const rawTitle = getSafeText(poster.title || poster.heading || category, category).toUpperCase();
      const titleBox = new fabricObj.Textbox(rawTitle, {
        left: canvasWidth / 2, top: bandY + bandH + 45, width: 980,
        fontSize: 85, fontFamily: fontPrimary, fontWeight: '900',
        fill: '#FFFFFF', textAlign: 'center', originX: 'center', lineHeight: 0.95,
        shadow: new fabricObj.Shadow({ color: style.primary + '66', blur: 25, offsetY: 4 }),
        selectable: true, name: 'Poster Title'
      });
      scaleText(titleBox, 220, 36);
      canvas.add(titleBox);
      let currentY = titleBox.top + titleBox.height + 30;

      // Subtitle with wide letter spacing
      const rawSub = getSafeText(poster.subtitle || '');
      if (rawSub) {
        const subBox = new fabricObj.Textbox(rawSub.toUpperCase(), {
          left: canvasWidth / 2, top: currentY, width: 920,
          fontSize: 16, fontFamily: fontSecondary, fontWeight: '700',
          fill: style.primary + 'E6', textAlign: 'center', originX: 'center', charSpacing: 150,
          selectable: true, name: 'Poster Subtitle'
        });
        canvas.add(subBox);
        currentY = subBox.top + subBox.height + 35;
      }

      // Thin separator line
      canvas.add(new fabricObj.Rect({ left: 60, top: currentY, width: canvasWidth - 120, height: 1.5, fill: style.primary + '33', selectable: false, name: 'Separator Line' }));
      currentY += 35;

      // Feature grid — 2 columns, spaced out vertical rows for A4 layout balance
      const features = poster.features || poster.bullets || [];
      const featSlice = features.slice(0, 4);
      const colW = (canvasWidth - 180) / 2;
      featSlice.forEach((feat, i) => {
        const featText = typeof feat === 'string' ? feat : (feat.title || '');
        if (!featText) return;
        const col = i % 2, row = Math.floor(i / 2);
        const fx = 90 + col * (colW + 40);
        const fy = currentY + row * 65;
        canvas.add(new fabricObj.Textbox(`→   ${featText.toUpperCase()}`, {
          left: fx, top: fy, width: colW,
          fontSize: 14.5, fontFamily: fontSecondary, fontWeight: 'bold',
          fill: '#FFFFFF', textAlign: 'left', charSpacing: 40, selectable: true, name: `Feature ${i}`
        }));
      });
      currentY += Math.ceil(featSlice.length / 2) * 65 + 30;

      // Bottom CTA outline button
      const rawCta = getSafeText(poster.cta || 'REGISTER NOW').toUpperCase();
      const btnW = 380, btnH = 62, btnX = (canvasWidth - btnW) / 2;
      canvas.add(new fabricObj.Rect({
        left: btnX, top: currentY, width: btnW, height: btnH, rx: 8, ry: 8,
        fill: 'transparent', stroke: style.primary, strokeWidth: 2,
        selectable: true, name: 'CTA Button Bg'
      }));
      canvas.add(new fabricObj.Textbox(rawCta, {
        left: canvasWidth / 2, top: currentY + btnH / 2, width: btnW - 30,
        fontSize: 16, fontFamily: fontPrimary, fontWeight: 'bold',
        fill: style.primary, textAlign: 'center', originX: 'center', originY: 'center', charSpacing: 180,
        selectable: true, name: 'CTA Button Text'
      }));
      currentY += btnH + 35;

      // Footer
      const rawFooter = getSafeText(poster.footer || poster.details || '');
      if (rawFooter) {
        canvas.add(new fabricObj.Textbox(rawFooter, {
          left: canvasWidth / 2, top: currentY, width: 840,
          fontSize: 12, fontFamily: fontSecondary, fontWeight: 'bold',
          fill: '#505869', textAlign: 'center', originX: 'center',
          selectable: true, name: 'Footer Text'
        }));
      }

      // Add digital focus reticle corners (modern event graphic theme)
      const borderOffset = 45;
      const reticleLen = 30;
      const strokeW = 2;
      const drawReticles = () => {
        // Top Left
        canvas.add(new fabricObj.Rect({ left: borderOffset, top: borderOffset, width: reticleLen, height: strokeW, fill: style.primary + '88', selectable: false }));
        canvas.add(new fabricObj.Rect({ left: borderOffset, top: borderOffset, width: strokeW, height: reticleLen, fill: style.primary + '88', selectable: false }));
        // Top Right
        canvas.add(new fabricObj.Rect({ left: canvasWidth - borderOffset - reticleLen, top: borderOffset, width: reticleLen, height: strokeW, fill: style.primary + '88', selectable: false }));
        canvas.add(new fabricObj.Rect({ left: canvasWidth - borderOffset, top: borderOffset, width: strokeW, height: reticleLen, fill: style.primary + '88', selectable: false }));
        // Bottom Left
        canvas.add(new fabricObj.Rect({ left: borderOffset, top: canvasHeight - borderOffset, width: reticleLen, height: strokeW, fill: style.primary + '88', selectable: false }));
        canvas.add(new fabricObj.Rect({ left: borderOffset, top: canvasHeight - borderOffset - reticleLen, width: strokeW, height: reticleLen, fill: style.primary + '88', selectable: false }));
        // Bottom Right
        canvas.add(new fabricObj.Rect({ left: canvasWidth - borderOffset - reticleLen, top: canvasHeight - borderOffset, width: reticleLen, height: strokeW, fill: style.primary + '88', selectable: false }));
        canvas.add(new fabricObj.Rect({ left: canvasWidth - borderOffset, top: canvasHeight - borderOffset - reticleLen, width: strokeW, height: reticleLen, fill: style.primary + '88', selectable: false }));
      };
      drawReticles();
    };

    // ─── Layout Dispatcher ────────────────────────────────────────────────────
    const renderTextContent = (htmlImg) => {
      // Draw background image full-bleed first (only for layered canvas mode; full_image layouts manage their own bg)
      if (htmlImg && !poster.fullImageMode) {
        const scaleX = canvasWidth / htmlImg.width;
        const scaleY = canvasHeight / htmlImg.height;
        const scale = Math.max(scaleX, scaleY);
        const bgImg = new fabricObj.Image(htmlImg, {
          left: (canvasWidth - htmlImg.width * scale) / 2,
          top: (canvasHeight - htmlImg.height * scale) / 2,
          scaleX: scale, scaleY: scale,
          selectable: false, evented: false, name: 'Background Image Cover'
        });
        canvas.add(bgImg);
      }

      // Note: full_image mode still dispatches to layout renderers to draw text on top of the image

      // Dispatch to the correct layout template based on category
      const heroSplitCategories    = ['Grand Opening', 'Festival', 'Restaurant', 'Sale / Offer', 'Birthday', 'Wedding'];
      const corporateCardCategories = ['Hiring', 'Corporate', 'Education', 'Healthcare'];
      const luxuryFrameCategories  = ['Real Estate', 'Product Launch'];
      const minimalModernCategories = ['Event', 'Default'];

      if (heroSplitCategories.includes(category)) {
        renderLayoutHeroSplit(htmlImg);
      } else if (corporateCardCategories.includes(category)) {
        renderLayoutCorporateCard(htmlImg);
      } else if (luxuryFrameCategories.includes(category)) {
        renderLayoutLuxuryFrame(htmlImg);
      } else {
        // Default to Minimal Modern for Event and everything else
        renderLayoutMinimalModern(htmlImg);
      }

      // Bounds clip enforcement
      canvas.getObjects().forEach(obj => {
        if (obj.selectable && obj.name !== 'Outer Border' && obj.name !== 'Inner Border') {
          if (obj.left < 40 && obj.originX !== 'center') obj.left = 40;
          if (obj.top < 40) obj.top = 40;
          if (obj.left + obj.width > canvasWidth - 40 && obj.originX !== 'center') {
            obj.width = canvasWidth - 40 - obj.left;
          }
          if (obj.top + obj.height > canvasHeight - 40) {
            obj.top = canvasHeight - 40 - obj.height;
          }
          obj.setCoords();
        }
      });

      canvas.renderAll();
      updateLayers(canvas);
    };

    const getProxyUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('data:image') || url.startsWith('blob:')) return url;
      
      let cleanUrl = url;
      const hostPattern = /https?:\/\/(localhost|127\.0\.0\.1):5001/i;
      if (hostPattern.test(cleanUrl)) {
        cleanUrl = cleanUrl.replace(hostPattern, '');
      }

      const backendUrl = import.meta.env.VITE_API_URL || API_BASE_URL;
      const resolvedBackend = backendUrl ? (backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl) : window.location.origin;

      let absoluteUrl = cleanUrl;
      if (cleanUrl.startsWith('/')) {
        absoluteUrl = `${resolvedBackend}${cleanUrl}`;
      } else if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        absoluteUrl = `${resolvedBackend}/${cleanUrl}`;
      }

      return `${resolvedBackend}/api/poster/proxy-image?url=${encodeURIComponent(absoluteUrl)}`;
    };

    if (bgUrl) {
      const htmlImg = new Image();
      htmlImg.crossOrigin = 'anonymous';
      htmlImg.onload = () => {
        renderTextContent(htmlImg);
      };
      htmlImg.onerror = () => {
        console.warn('[Poster Editor] Background image load failed. Using fallback gradient.');
        renderTextContent(null);
      };
      htmlImg.src = getProxyUrl(bgUrl);
    } else {
      renderTextContent(null);
    }
  };

  const applyFallbackGradient = (color1, color2, callback) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const grad = new fabricObj.Gradient({
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: 0, y2: canvasHeight },
      colorStops: [
        { offset: 0, color: color1 },
        { offset: 1, color: color2 }
      ]
    });
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    canvas.setBackgroundColor(grad, callback);
  };

  // Direct element creation
  const addText = (textVal) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const textbox = new fabricObj.Textbox(textVal, {
      left: 540,
      top: 675,
      width: 400,
      fontSize: 32,
      fill: '#FFFFFF',
      fontFamily: 'Montserrat',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
      selectable: true,
      name: 'Custom Text'
    });
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  };

  const addShape = (type) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const common = {
      left: 540,
      top: 675,
      fill: shapeColor,
      originX: 'center',
      originY: 'center',
      selectable: true,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Block`
    };
    let shape;
    if (type === 'rect') {
      shape = new fabricObj.Rect({ ...common, width: 150, height: 150, rx: 10, ry: 10 });
    } else if (type === 'circle') {
      shape = new fabricObj.Circle({ ...common, radius: 75 });
    } else if (type === 'line') {
      shape = new fabricObj.Rect({ ...common, width: 300, height: 8 });
    }
    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Upload logo/image and add to canvas
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.onload = () => {
        const fabricImg = new fabricObj.Image(imgObj, {
          left: 540,
          top: 675,
          scaleX: 0.35,
          scaleY: 0.35,
          originX: 'center',
          originY: 'center',
          selectable: true,
          name: 'Uploaded Image'
        });
        const canvas = fabricCanvas.current;
        if (canvas) {
          canvas.add(fabricImg);
          canvas.setActiveObject(fabricImg);
          canvas.renderAll();
        }
      };
      imgObj.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Delete selected object
  const deleteSelected = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;
    canvas.remove(activeObj);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelectedObj(null);
  };

  // Select layer from list
  const selectLayer = (layer) => {
    const canvas = fabricCanvas.current;
    if (!canvas || !layer.ref) return;
    canvas.setActiveObject(layer.ref);
    canvas.renderAll();
    setSelectedObj(layer.ref);
  };

  // Download high-resolution PNG
  const downloadPNG = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 1 // logical 1080x1350 scale
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `fic-ai-poster-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download PDF
  const downloadPDF = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 1
    });
    // Create PDF with size matching standard A4 dimensions (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297);
    pdf.save(`fic-ai-poster-${Date.now()}.pdf`);
  };

  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0E1A] select-none">
      {/* TOP HEADER */}
      <div className="border-b border-white/[0.06] bg-[#0A0E1A]/80 backdrop-blur-md px-3 md:px-6 py-2 md:py-0 md:h-16 flex items-center justify-between shrink-0 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
          <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-white">Vision Studio Poster Editor</span>
        </div>
        
        {/* pr-28 gives clearance for fixed ThemeToggle at top-right */}
        <div className="flex items-center gap-2 md:pr-28">
          {onReset && (
            <button
              onClick={onReset}
              className="py-1.5 px-3 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-gray-300 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              ← Back
            </button>
          )}
          <button
            onClick={downloadPDF}
            className="py-1.5 px-3 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-gray-300 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
          >
            PDF
          </button>
          <button
            onClick={downloadPNG}
            className="py-1.5 px-3 bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-95 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
          >
            📥 Export PNG
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left tabs selector — DESKTOP only */}
        <div className="hidden md:flex w-[72px] border-r border-white/5 bg-[#080B15] flex-col items-center py-4 gap-4 shrink-0">
          {[
            { id: 'templates', label: 'Templates', icon: '🎨' },
            { id: 'ai_edit',   label: 'AI Edit',   icon: '🤖' },
            { id: 'layers',    label: 'Layers',    icon: '🥞' },
            { id: 'text',      label: 'Type',      icon: '🔤' },
            { id: 'shapes',    label: 'Shapes',    icon: '📐' },
            { id: 'uploads',   label: 'Uploads',   icon: '📤' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#7C3AED]/20 to-[#06B6D4]/10 text-white border border-[#7C3AED]/35'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span className="text-xl mb-1">{tab.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Expandable sidebar panel — DESKTOP only */}
        <div className="hidden md:block w-[280px] border-r border-white/5 bg-[#0B0F1D]/80 backdrop-blur-md overflow-y-auto p-5 shrink-0 scrollbar-thin">

          {/* ── AI EDITOR TAB ────────────────────────────────────────── */}
          {activeTab === 'ai_edit' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🤖</span>
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">AI Poster Editor</h4>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Describe an edit in plain English. AI will apply it to the canvas.
              </p>

              {/* Quick example chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Change title color to red',
                  'Make button larger',
                  'Move image to left',
                  'Change background to gold',
                  'Remove feature cards',
                  'Set title font to Bebas Neue',
                  'Center align subtitle',
                  'Increase title size',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setAiEditInput(example)}
                    className="text-[9px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-gray-400 hover:border-[#7C3AED]/40 hover:text-gray-200 hover:bg-white/[0.07] transition-all"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {/* Text input */}
              <div className="space-y-2">
                <textarea
                  value={aiEditInput}
                  onChange={e => setAiEditInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyEditToPoster(); } }}
                  placeholder="e.g. Change title color to gold..."
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-gray-200 placeholder-gray-600 resize-none outline-none focus:border-[#7C3AED]/50 transition-colors"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
                <button
                  onClick={applyEditToPoster}
                  disabled={aiEditLoading || !aiEditInput.trim()}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    aiEditLoading || !aiEditInput.trim()
                      ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white shadow-lg hover:opacity-90'
                  }`}
                >
                  {aiEditLoading ? '⚙️ Applying...' : '✨ Apply AI Edit'}
                </button>
              </div>

              {/* Result feedback */}
              {aiEditResult && (
                <div className={`p-3 rounded-xl text-[10px] border ${
                  aiEditResult.ok
                    ? 'bg-green-950/30 border-green-500/20 text-green-400'
                    : 'bg-red-950/30 border-red-500/20 text-red-400'
                }`}>
                  {aiEditResult.ok ? '✅' : '⚠️'} {aiEditResult.msg}
                </div>
              )}

              {/* Edit history */}
              {aiEditHistory.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-[9px] font-black text-gray-600 uppercase tracking-wider border-t border-white/5 pt-3">Recent Edits</h5>
                  {aiEditHistory.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                      <p className="text-[9px] text-gray-400 italic truncate">"{h.request}"</p>
                      <p className={`text-[9px] ${h.ok ? 'text-green-500' : 'text-red-400'}`}>
                        {h.ok ? '✓' : '✗'} {h.result}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Template Presets</h4>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'luxury_gold', name: '👑 Luxury Gold', desc: 'Premium luxury grand opening layout.' },
                  { id: 'dark_premium', name: '🌌 Dark Premium', desc: 'Futuristic digital intelligence launch.' },
                  { id: 'modern_corporate', name: '🏢 Modern Corporate', desc: 'Professional enterprise business layout.' },
                  { id: 'festival', name: '✨ Festival Celebration', desc: 'Warm holiday greetings layout.' },
                  { id: 'hiring', name: '💼 Hiring Recruitment', desc: 'Clean corporate recruitment layout.' }
                ].map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => renderPoster(TEMPLATE_PRESETS[tmpl.id])}
                    className="w-full text-left p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#7C3AED]/35 hover:bg-white/[0.04] transition-all group"
                  >
                    <span className="block text-[11px] font-black uppercase tracking-wider text-white group-hover:text-[#06B6D4] transition-colors">
                      {tmpl.name}
                    </span>
                    <span className="block text-[9px] text-gray-500 mt-1 leading-normal">{tmpl.desc}</span>
                  </button>
                ))}
              </div>

              {/* Background Color selector */}
              <div className="space-y-2 pt-4 border-t border-white/5">
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Background Color</h4>
                <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => changeBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono uppercase font-bold text-white">{bgColor}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Canvas Layers</h4>
                {selectedObj && (
                  <button
                    onClick={deleteSelected}
                    className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
              
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {layers.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">No layers on canvas yet.</p>
                ) : (
                  layers.map((layer) => {
                    const isSelected = selectedObj === layer.ref;
                    return (
                      <button
                        key={layer.id}
                        onClick={() => selectLayer(layer)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white'
                            : 'bg-white/[0.01] border-white/5 text-gray-400 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{layer.type === 'textbox' || layer.type === 'text' ? '🔤' : layer.type === 'image' ? '🖼️' : '📐'}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[150px]">{layer.name}</span>
                        </div>
                        <span className="text-[8px] opacity-40 font-mono">{layer.type}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Typography</h4>
              <div className="space-y-2">
                <button
                  onClick={() => addText('ADD HEADING TITLE')}
                  className="w-full py-2.5 bg-[#7C3AED] hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Add Heading
                </button>
                <button
                  onClick={() => addText('Add subtitle description')}
                  className="w-full py-2.5 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Add Subtitle
                </button>
              </div>

              {selectedObj && (selectedObj.type === 'textbox' || selectedObj.type === 'text') && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h5 className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider">Text Properties</h5>
                  
                  {/* Font Family selector */}
                  <div className="space-y-1">
                    <label className="text-[8px] text-[#64748B] font-bold uppercase">Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => {
                        setFontFamily(e.target.value);
                        updateProp('fontFamily', e.target.value);
                      }}
                      className="w-full bg-black/45 border border-white/10 rounded-xl p-2 text-xs text-white outline-none"
                    >
                      {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Font Size selector */}
                  <div className="space-y-1">
                    <label className="text-[8px] text-[#64748B] font-bold uppercase">Font Size ({fontSize}px)</label>
                    <input
                      type="range"
                      min="12"
                      max="120"
                      value={fontSize}
                      onChange={(e) => {
                        const sz = parseInt(e.target.value, 10);
                        setFontSize(sz);
                        updateProp('fontSize', sz);
                      }}
                      className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Color selector */}
                  <div className="space-y-1">
                    <label className="text-[8px] text-[#64748B] font-bold uppercase">Color</label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => {
                        setTextColor(e.target.value);
                        updateProp('fill', e.target.value);
                      }}
                      className="w-full h-8 cursor-pointer rounded-lg bg-transparent border-0"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'shapes' && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Shapes</h4>
              
              <div className="space-y-1.5 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <label className="text-[8px] font-bold text-[#94A3B8] uppercase block">Shape Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={shapeColor}
                    onChange={(e) => {
                      setShapeColor(e.target.value);
                      updateProp('fill', e.target.value);
                    }}
                    className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-xs font-mono uppercase font-bold text-white">{shapeColor}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['rect', 'circle', 'line'].map((type) => (
                  <button
                    key={type}
                    onClick={() => addShape(type)}
                    className="flex flex-col items-center justify-center p-3 bg-white/[0.02] border border-white/5 hover:border-[#06B6D4]/35 hover:bg-white/[0.04] rounded-xl transition-all"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'uploads' && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Upload Assets</h4>
              
              <div className="space-y-2">
                <label className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border-2 border-dashed border-white/10 hover:border-[#7C3AED]/40 hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all">
                  <span className="text-3xl mb-2">📤</span>
                  <span className="text-[10px] font-black uppercase text-gray-300">Upload Image / Logo</span>
                  <span className="text-[8px] text-gray-500 mt-1">PNG, JPG formats supported</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Canvas Workspace container */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-y-auto flex items-start md:items-center justify-center p-3 md:p-8 scrollbar-thin relative bg-slate-950"
        >
          {canvasError ? (
            <div className="max-w-md w-full p-6 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-400 text-center space-y-4">
              <span className="text-4xl">⚠️</span>
              <h4 className="text-lg font-bold uppercase tracking-wider">Design Studio Error</h4>
              <p className="text-xs text-gray-300 font-mono bg-black/40 p-4 rounded-xl border border-red-500/10 text-left">
                {canvasError}
              </p>
              {onReset && (
                <button
                  onClick={onReset}
                  className="py-2.5 px-6 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-gray-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Back to Generator
                </button>
              )}
            </div>
          ) : (
            <div
              id="canvas-wrapper-capture"
              className="relative rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] border border-white/5 bg-slate-900 mx-auto shrink-0"
              style={{
                width: `${Math.round(canvasWidth * scaleFactor)}px`,
                height: `${Math.round(canvasHeight * scaleFactor)}px`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `scale(${scaleFactor})`,
                  transformOrigin: 'top left',
                  width: `${canvasWidth}px`,
                  height: `${canvasHeight}px`
                }}
              >
                <canvas ref={canvasRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM TAB BAR */}
      <div className="md:hidden flex border-t border-white/5 bg-[#080B15] shrink-0">
        {[
          { id: 'templates', label: 'Templates', icon: '🎨' },
          { id: 'ai_edit',   label: 'AI Edit',   icon: '🤖' },
          { id: 'layers',    label: 'Layers',    icon: '🥞' },
          { id: 'text',      label: 'Type',      icon: '🔤' },
          { id: 'shapes',    label: 'Shapes',    icon: '📐' },
          { id: 'uploads',   label: 'Uploads',   icon: '📤' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setMobilePanelOpen(prev => activeTab === tab.id ? !prev : true);
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all ${
              activeTab === tab.id && mobilePanelOpen
                ? 'text-[#06B6D4]'
                : 'text-gray-500'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* MOBILE BOTTOM DRAWER PANEL */}
      {mobilePanelOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMobilePanelOpen(false)}>
          <div
            className="bg-[#0B0F1D] border-t border-white/10 rounded-t-3xl max-h-[70vh] overflow-y-auto p-5 scrollbar-thin"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-white uppercase tracking-wider">
                {activeTab === 'templates' && '🎨 Templates'}
                {activeTab === 'ai_edit' && '🤖 AI Edit'}
                {activeTab === 'layers' && '🥞 Layers'}
                {activeTab === 'text' && '🔤 Type'}
                {activeTab === 'shapes' && '📐 Shapes'}
                {activeTab === 'uploads' && '📤 Uploads'}
              </span>
              <button onClick={() => setMobilePanelOpen(false)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white">✕</button>
            </div>

            {/* Templates */}
            {activeTab === 'templates' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'luxury_gold', name: '👑 Luxury Gold', desc: 'Premium luxury grand opening layout.' },
                    { id: 'dark_premium', name: '🌌 Dark Premium', desc: 'Futuristic digital intelligence launch.' },
                    { id: 'modern_corporate', name: '🏢 Modern Corporate', desc: 'Professional enterprise business layout.' },
                    { id: 'festival', name: '✨ Festival Celebration', desc: 'Warm holiday greetings layout.' },
                    { id: 'hiring', name: '💼 Hiring Recruitment', desc: 'Clean corporate recruitment layout.' }
                  ].map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => { renderPoster(TEMPLATE_PRESETS[tmpl.id]); setMobilePanelOpen(false); }}
                      className="w-full text-left p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#7C3AED]/35 active:bg-white/[0.04] transition-all"
                    >
                      <span className="block text-[11px] font-black uppercase tracking-wider text-white">{tmpl.name}</span>
                      <span className="block text-[9px] text-gray-500 mt-1 leading-normal">{tmpl.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Background Color</h4>
                  <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <input type="color" value={bgColor} onChange={(e) => changeBackgroundColor(e.target.value)} className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
                    <span className="text-xs font-mono uppercase font-bold text-white">{bgColor}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Edit */}
            {activeTab === 'ai_edit' && (
              <div className="space-y-4">
                <p className="text-[10px] text-gray-500 leading-relaxed">Describe an edit in plain English. AI will apply it to the canvas.</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Change title color to red', 'Make button larger', 'Change background to gold', 'Increase title size'].map((example) => (
                    <button key={example} onClick={() => setAiEditInput(example)} className="text-[9px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-gray-400 active:bg-white/[0.08] transition-all">{example}</button>
                  ))}
                </div>
                <textarea
                  value={aiEditInput}
                  onChange={e => setAiEditInput(e.target.value)}
                  placeholder="e.g. Change title color to gold..."
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-gray-200 placeholder-gray-600 resize-none outline-none focus:border-[#7C3AED]/50 transition-colors"
                />
                <button
                  onClick={() => { applyEditToPoster(); }}
                  disabled={aiEditLoading || !aiEditInput.trim()}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${aiEditLoading || !aiEditInput.trim() ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] text-white shadow-lg'}`}
                >
                  {aiEditLoading ? '⚙️ Applying...' : '✨ Apply AI Edit'}
                </button>
                {aiEditResult && (
                  <div className={`p-3 rounded-xl text-[10px] border ${aiEditResult.ok ? 'bg-green-950/30 border-green-500/20 text-green-400' : 'bg-red-950/30 border-red-500/20 text-red-400'}`}>
                    {aiEditResult.ok ? '✅' : '⚠️'} {aiEditResult.msg}
                  </div>
                )}
              </div>
            )}

            {/* Layers */}
            {activeTab === 'layers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Canvas Layers</h4>
                  {selectedObj && <button onClick={() => { deleteSelected(); }} className="text-[9px] font-black text-red-400 uppercase tracking-widest">Delete</button>}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {layers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-8">No layers yet.</p>
                  ) : layers.map((layer) => {
                    const isSelected = selectedObj === layer.ref;
                    return (
                      <button key={layer.id} onClick={() => { selectLayer(layer); setMobilePanelOpen(false); }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-[#7C3AED]/15 border-[#7C3AED]/40 text-white' : 'bg-white/[0.01] border-white/5 text-gray-400'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{layer.type === 'textbox' || layer.type === 'text' ? '🔤' : layer.type === 'image' ? '🖼️' : '📐'}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px]">{layer.name}</span>
                        </div>
                        <span className="text-[8px] opacity-40 font-mono">{layer.type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Text / Type */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Typography</h4>
                <button onClick={() => { addText('ADD HEADING TITLE'); setMobilePanelOpen(false); }} className="w-full py-2.5 bg-[#7C3AED] text-white font-black text-xs uppercase tracking-widest rounded-xl">Add Heading</button>
                <button onClick={() => { addText('Add subtitle description'); setMobilePanelOpen(false); }} className="w-full py-2.5 bg-white/[0.04] border border-white/5 text-white font-bold text-xs uppercase tracking-wider rounded-xl">Add Subtitle</button>
                {selectedObj && (selectedObj.type === 'textbox' || selectedObj.type === 'text') && (
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); updateProp('fontFamily', e.target.value); }} className="w-full bg-black/45 border border-white/10 rounded-xl p-2 text-xs text-white outline-none">
                      {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div>
                      <label className="text-[8px] text-[#64748B] font-bold uppercase block mb-1">Size: {fontSize}px</label>
                      <input type="range" min="12" max="120" value={fontSize} onChange={(e) => { const sz = parseInt(e.target.value, 10); setFontSize(sz); updateProp('fontSize', sz); }} className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <input type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); updateProp('fill', e.target.value); }} className="w-full h-8 cursor-pointer rounded-lg bg-transparent border-0" />
                  </div>
                )}
              </div>
            )}

            {/* Shapes */}
            {activeTab === 'shapes' && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Shapes</h4>
                <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <input type="color" value={shapeColor} onChange={(e) => { setShapeColor(e.target.value); updateProp('fill', e.target.value); }} className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" />
                  <span className="text-xs font-mono uppercase font-bold text-white">{shapeColor}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['rect', 'circle', 'line'].map((type) => (
                    <button key={type} onClick={() => { addShape(type); setMobilePanelOpen(false); }} className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 hover:border-[#06B6D4]/35 rounded-xl transition-all">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Uploads */}
            {activeTab === 'uploads' && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#06B6D4] uppercase tracking-wider">Upload Assets</h4>
                <label className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border-2 border-dashed border-white/10 hover:border-[#7C3AED]/40 rounded-2xl cursor-pointer transition-all">
                  <span className="text-3xl mb-2">📤</span>
                  <span className="text-[10px] font-black uppercase text-gray-300">Upload Image / Logo</span>
                  <span className="text-[8px] text-gray-500 mt-1">PNG, JPG formats supported</span>
                  <input type="file" accept="image/*" onChange={(e) => { handleImageUpload(e); setMobilePanelOpen(false); }} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
