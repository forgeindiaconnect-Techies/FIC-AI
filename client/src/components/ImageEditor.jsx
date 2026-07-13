import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { fabric } from 'fabric';
import { timeAgo } from '../hooks/useToolHistory';
import { API_BASE_URL as API_URL } from '../config/api';

// Client-side image compression utility
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1024;

      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Canvas compression failed'));
          }
        },
        'image/jpeg',
        0.75
      );
    };
    img.onerror = (err) => reject(err);
    img.src = URL.createObjectURL(file);
  });
};

export default function ImageEditor() {
  const [originalImage, setOriginalImage] = useState(null); // Preview dataURL
  const [imageFile, setImageFile] = useState(null); // Raw file for FormData
  const [editPrompt, setEditPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Progress states
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [denoise, setDenoise] = useState(0.65); // edit strength (0.65-0.75)
  const fileInputRef = useRef(null);
  const progressTimerRef = useRef(null);
  const [supportsEditing, setSupportsEditing] = useState(true);

  // Manual Canvas Studio States
  const canvasRef = useRef(null);
  const fabricCanvas = useRef(null);
  const fabricImageRef = useRef(null);
  const overlayRectRef = useRef(null);
  const cropRectRef = useRef(null);

  const [manualMode, setManualMode] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [overlayColor, setOverlayColor] = useState('#000000');
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [manualShapeColor, setManualShapeColor] = useState('#ff0000');
  const [isCropping, setIsCropping] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mobileScale = windowWidth < 768 ? (windowWidth - 48) / canvasWidth : 1;
  const displayScale = Math.min(mobileScale, 1);

  // Load history on mount
  // Add denoise slider UI after edit prompt textarea
  const denoiseSlider = (
    <div className="space-y-1 mt-2">
      <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Edit Strength (denoise)</label>
      <input
        type="range"
        min="0.65"
        max="0.75"
        step="0.01"
        value={denoise}
        onChange={(e) => setDenoise(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="text-xs text-[#94A3B8] text-center">{denoise.toFixed(2)}</div>
    </div>
  );

    

    const handleLoadEvent = (e) => {
  if (e.detail && e.detail.type === 'edit') {
    setError(null);
    setOriginalImage(e.detail.originalUrl || e.detail.url);
    setResultImage(e.detail.url);
    setEditPrompt(e.detail.prompt || '');
  }
};

  const handleSync = () => {
    const savedList = localStorage.getItem('fic_image_history');
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        // Prune items older than 30 days (those with timestamp field)
        const pruned = parsed.filter(item => !item.timestamp || (now - item.timestamp < THIRTY_DAYS));
        setHistory(pruned);
        if (pruned.length !== parsed.length) {
          localStorage.setItem('fic_image_history', JSON.stringify(pruned));
        }
      } catch (_) {}
    }
  };

  useEffect(() => {
    handleSync(); // Initial load of history on mount
    window.addEventListener('fic_load_image_history', handleLoadEvent);
    window.addEventListener('fic_image_history_updated', handleSync);

    // Check backend capability for image-to-image editing
    axios.get(`${API_URL}/api/image/config`)
      .then(res => {
        if (res.data && res.data.supportsEditing !== undefined) {
          setSupportsEditing(res.data.supportsEditing);
        }
      })
      .catch(err => {
        console.warn('Failed to load image editor config:', err);
      });

    return () => {
      window.removeEventListener('fic_load_image_history', handleLoadEvent);
      window.removeEventListener('fic_image_history_updated', handleSync);
    };
  }, []);

  // Clean up timer and canvas on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (fabricCanvas.current) {
        try {
          fabricCanvas.current.dispose();
        } catch (e) {
          console.warn(e);
        }
      }
    };
  }, []);

  // Initialize Fabric manual canvas when entering manual mode
  useEffect(() => {
    if (manualMode && originalImage) {
      const timer = setTimeout(() => {
        initManualCanvas(originalImage);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [manualMode, originalImage]);

  const handleExitManualMode = () => {
    setManualMode(false);
    if (fabricCanvas.current) {
      try {
        fabricCanvas.current.dispose();
      } catch (e) {
        console.warn(e);
      }
      fabricCanvas.current = null;
    }
  };

  const saveHistory = (items) => {
    setHistory(items);
    try {
      localStorage.setItem('fic_image_history', JSON.stringify(items));
      window.dispatchEvent(new Event('fic_image_history_updated'));
    } catch (err) {
      console.warn('LocalStorage quota exceeded, performing self-healing cleanup...', err);
      // Filter out huge base64 images, leaving only hosted/server URLs
      const cleanedItems = items.filter(item => {
        const urlStr = item.url || '';
        const origStr = item.originalUrl || '';
        return !urlStr.startsWith('data:image') && !origStr.startsWith('data:image');
      });
      // Limit to last 15 items to be extra safe
      const trimmedItems = cleanedItems.slice(0, 15);
      try {
        localStorage.setItem('fic_image_history', JSON.stringify(trimmedItems));
        setHistory(trimmedItems);
        window.dispatchEvent(new Event('fic_image_history_updated'));
      } catch (innerErr) {
        console.error('Failed to save history even after cleaning base64 data:', innerErr);
        // Clear all history as a last resort
        localStorage.removeItem('fic_image_history');
        setHistory([]);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setResultImage(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setOriginalImage(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startProgressSimulation = (isTextToImage = false) => {
    setProgressPercent(5);
    setProgressMsg(isTextToImage ? 'Initializing text generation pipeline...' : 'Compressing image dynamic assets...');
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 98) {
          clearInterval(progressTimerRef.current);
          return 98;
        }

        let nextMsg = isTextToImage ? 'Executing ComfyUI text-to-image pipeline...' : 'Executing ComfyUI image-to-image pipeline...';
        if (prev > 12 && prev < 40) {
          nextMsg = isTextToImage ? 'Analyzing design layout and prompts...' : 'Uploading source assets to ComfyUI input...';
        } else if (prev >= 40 && prev < 75) {
          nextMsg = 'KSampler processing neural latent spaces...';
        } else if (prev >= 75 && prev < 92) {
          nextMsg = 'VAE decoding latent space outputs...';
        } else if (prev >= 92) {
          nextMsg = 'Loading rendered asset files from ComfyUI/output...';
        }

        setProgressMsg(nextMsg);
        const increment = prev < 60 ? Math.floor(Math.random() * 12) + 8 : Math.floor(Math.random() * 3) + 1;
        return prev + increment;
      });
    }, 400);
  };

  const completeProgress = (isTextToImage = false) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setProgressPercent(100);
    setProgressMsg(isTextToImage ? 'AI image created successfully!' : 'AI Edit applied successfully!');
  };

  // Manual Canvas Studio helper methods
  const initManualCanvas = (imageUrl) => {
    if (!canvasRef.current) return;
    
    if (fabricCanvas.current) {
      try {
        fabricCanvas.current.dispose();
      } catch (e) {
        console.warn(e);
      }
      fabricCanvas.current = null;
    }

    const w = 600;
    const h = 600;
    setCanvasWidth(w);
    setCanvasHeight(h);

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      width: w,
      height: h,
      backgroundColor: '#0a0a0c',
      preserveObjectStacking: true
    });
    fabricCanvas.current = fCanvas;

    const setupOverlay = (cw, ch) => {
      const overlay = new fabric.Rect({
        left: 0,
        top: 0,
        width: cw,
        height: ch,
        fill: overlayColor,
        opacity: overlayOpacity,
        selectable: false,
        evented: false,
        name: 'ColorOverlay'
      });
      fCanvas.add(overlay);
      overlayRectRef.current = overlay;
      fCanvas.renderAll();
    };

    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let cw = img.width;
        let ch = img.height;
        const maxDim = 600;
        if (cw > maxDim || ch > maxDim) {
          if (cw > ch) {
            ch = Math.round((ch * maxDim) / cw);
            cw = maxDim;
          } else {
            cw = Math.round((cw * maxDim) / ch);
            ch = maxDim;
          }
        }
        setCanvasWidth(cw);
        setCanvasHeight(ch);
        fCanvas.setWidth(cw);
        fCanvas.setHeight(ch);

        fabric.Image.fromURL(imageUrl, (fImg) => {
          fImg.set({
            left: 0,
            top: 0,
            scaleX: cw / fImg.width,
            scaleY: ch / fImg.height,
            selectable: false,
            evented: false,
            name: 'BackgroundImage'
          });
          fCanvas.add(fImg);
          fCanvas.sendToBack(fImg);
          fabricImageRef.current = fImg;
          
          setupOverlay(cw, ch);
        }, { crossOrigin: 'anonymous' });
      };
      img.src = imageUrl;
    } else {
      // Create a default blank slate placeholder
      const placeholder = new fabric.Rect({
        left: 0,
        top: 0,
        width: w,
        height: h,
        fill: '#1e293b',
        selectable: false,
        evented: false,
        name: 'BackgroundImage'
      });
      fCanvas.add(placeholder);
      fCanvas.sendToBack(placeholder);
      fabricImageRef.current = placeholder;
      setupOverlay(w, h);
    }
  };

  const addManualText = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const textbox = new fabric.Textbox('Double click to edit text', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 28,
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
      width: 300,
      selectable: true
    });
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  };

  const addManualShape = (shapeType) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    const common = {
      left: canvas.width / 2,
      top: canvas.height / 2,
      fill: manualShapeColor,
      originX: 'center',
      originY: 'center',
      selectable: true
    };
    let shape;
    if (shapeType === 'rect') {
      shape = new fabric.Rect({ ...common, width: 100, height: 100 });
    } else if (shapeType === 'circle') {
      shape = new fabric.Circle({ ...common, radius: 50 });
    } else if (shapeType === 'line') {
      shape = new fabric.Rect({ ...common, width: 200, height: 6 });
    }
    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  const handleBrightnessChange = (val) => {
    setBrightness(val);
    const fImg = fabricImageRef.current;
    if (!fImg || !fabricCanvas.current) return;
    
    fImg.filters = fImg.filters.filter(f => !(f instanceof fabric.Image.filters.Brightness));
    
    if (val !== 0) {
      fImg.filters.push(new fabric.Image.filters.Brightness({ brightness: val }));
    }
    
    fImg.applyFilters();
    fabricCanvas.current.renderAll();
  };

  const handleOverlayColorChange = (color) => {
    setOverlayColor(color);
    const rect = overlayRectRef.current;
    if (rect && fabricCanvas.current) {
      rect.set('fill', color);
      fabricCanvas.current.renderAll();
    }
  };

  const handleOverlayOpacityChange = (opacity) => {
    setOverlayOpacity(opacity);
    const rect = overlayRectRef.current;
    if (rect && fabricCanvas.current) {
      rect.set('opacity', opacity);
      fabricCanvas.current.renderAll();
    }
  };

  const startCropMode = () => {
    const canvas = fabricCanvas.current;
    if (!canvas || isCropping) return;
    setIsCropping(true);

    const cropRect = new fabric.Rect({
      left: canvas.width / 4,
      top: canvas.height / 4,
      width: canvas.width / 2,
      height: canvas.height / 2,
      fill: 'transparent',
      stroke: '#06B6D4',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      cornerColor: '#06B6D4',
      cornerSize: 8,
      transparentCorners: false,
      selectable: true,
      hasRotatingPoint: false,
      name: 'CropSelectionRect'
    });

    canvas.add(cropRect);
    canvas.setActiveObject(cropRect);
    cropRectRef.current = cropRect;
    canvas.renderAll();
  };

  const confirmCrop = () => {
    const canvas = fabricCanvas.current;
    const cropRect = cropRectRef.current;
    const fImg = fabricImageRef.current;
    if (!canvas || !cropRect || !fImg) return;

    const cropLeft = cropRect.left;
    const cropTop = cropRect.top;
    const cropWidth = cropRect.width * cropRect.scaleX;
    const cropHeight = cropRect.height * cropRect.scaleY;

    canvas.remove(cropRect);
    cropRectRef.current = null;
    setIsCropping(false);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext('2d');

    canvas.discardActiveObject();
    canvas.renderAll();

    const fullDataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 1
    });

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const croppedDataUrl = croppedCanvas.toDataURL('image/png');
      initManualCanvas(croppedDataUrl);
    };
    img.src = fullDataUrl;
  };

  const cancelCrop = () => {
    const canvas = fabricCanvas.current;
    const cropRect = cropRectRef.current;
    if (canvas && cropRect) {
      canvas.remove(cropRect);
    }
    cropRectRef.current = null;
    setIsCropping(false);
    canvas.renderAll();
  };

  const handleResize = (newW, newH) => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    
    const w = parseInt(newW, 10);
    const h = parseInt(newH, 10);
    if (!isNaN(w) && !isNaN(h)) {
      setCanvasWidth(w);
      setCanvasHeight(h);
      canvas.setWidth(w);
      canvas.setHeight(h);
      
      const fImg = fabricImageRef.current;
      if (fImg) {
        fImg.set({
          scaleX: w / fImg.width,
          scaleY: h / fImg.height
        });
      }
      
      const overlay = overlayRectRef.current;
      if (overlay) {
        overlay.set({
          width: w,
          height: h
        });
      }
      
      canvas.renderAll();
    }
  };

  const handleDownloadManual = () => {
    const canvas = fabricCanvas.current;
    if (!canvas) return;
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: 2
    });
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `fic-manual-edit-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyEdit = async () => {
    if (!editPrompt.trim()) {
      setError('Please enter an instruction for what you want to change.');
      return;
    }

    setLoading(true);
    setError(null);
    setResultImage(null);
    startProgressSimulation(!imageFile && !originalImage);

    try {
      if (imageFile) {
        // ── Image uploaded: send to /api/image/edit ─────────────────────
        // Compress the image first to reduce payload
        const compressedFile = await compressImage(imageFile).catch(() => imageFile);
        const formData = new FormData();
        formData.append('image', compressedFile);
        formData.append('prompt', editPrompt.trim());
        formData.append('denoise', String(denoise));

        const res = await axios.post(`${API_URL}/api/image/edit`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000 // 5 minutes
        });

        if (res.data?.success && (res.data?.editedImageUrl || res.data?.imageUrl)) {
          const editedUrl = res.data.editedImageUrl || res.data.imageUrl;
          completeProgress(false);
          setResultImage(editedUrl);
          const newItem = {
            id: `edit-${Date.now()}`,
            url: editedUrl,
            originalUrl: originalImage,
            prompt: editPrompt.trim(),
            type: 'edit',
            timestamp: Date.now()
          };
          saveHistory([newItem, ...history]);
        } else {
          setError(res.data?.message || res.data?.error || 'Image edit failed. Please try again.');
        }
      } else {
        // ── No image: text-to-image generation ─────────────────────────
        const res = await axios.post(`${API_URL}/api/image/generate`, {
          prompt: editPrompt.trim()
        }, { timeout: 900000 });

        if (res.data?.success && (res.data?.imageUrl || res.data?.backgroundImage)) {
          const generatedUrl = res.data.imageUrl || res.data.backgroundImage;
          completeProgress(true);
          setResultImage(generatedUrl);
          setOriginalImage(generatedUrl);
          const newItem = {
            id: `gen-${Date.now()}`,
            url: generatedUrl,
            originalUrl: null,
            prompt: editPrompt.trim(),
            type: 'edit',
            timestamp: Date.now()
          };
          saveHistory([newItem, ...history]);
        } else {
          setError(res.data?.error || 'Image generation failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('[ImageEditor] Request failed:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Request failed.';
      setError(msg);
    } finally {
      setLoading(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  };


  const handleDownload = (url) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `fic-edited-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download image:', err);
      window.open(url, '_blank');
    }
  };

  const handleDeleteHistoryItem = (id, e) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);

    const deletedItem = history.find(item => item.id === id);
    if (deletedItem && resultImage === deletedItem.url) {
      setResultImage(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent select-none animate-fadeIn">
      {/* Premium Header bar */}
      <div className="h-16 border-b border-[rgba(255,255,255,0.08)] bg-[#0B1020]/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">FIC Vision Studio Editor</span>
        </div>
      </div>

      {manualMode ? (
        /* ── MANUAL DESIGN STUDIO WORKSPACE ── */
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-[#070A13]">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Canvas Area (Left) */}
            <div className="lg:col-span-8 flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 bg-black/35 relative min-h-[500px]">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-4 self-start">Studio Canvas Workspace</span>
              <div 
                className="relative flex items-center justify-center w-full" 
                style={{ 
                  height: `${canvasHeight * displayScale}px`, 
                  overflow: 'hidden' 
                }}
              >
                <div 
                  className="relative border border-white/10 rounded-lg shadow-2xl bg-[#0e0e12]" 
                  style={{ 
                    width: `${canvasWidth}px`, 
                    height: `${canvasHeight}px`,
                    transform: `scale(${displayScale})`,
                    transformOrigin: 'top center',
                    position: 'absolute',
                    top: 0
                  }}
                >
                  <canvas ref={canvasRef} />
                </div>
              </div>

              {/* Quick toolbar or crop status at bottom of canvas */}
              {isCropping && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0B1020]/90 border border-[#06B6D4]/30 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl backdrop-blur-md z-30">
                  <span className="text-xs font-black uppercase tracking-wider text-[#06B6D4] animate-pulse">Crop Mode Active</span>
                  <div className="h-4 w-px bg-white/10" />
                  <button
                    onClick={confirmCrop}
                    className="px-4 py-1.5 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Confirm Crop
                  </button>
                  <button
                    onClick={cancelCrop}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar Controls (Right) */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Studio Control Panel</span>

              <div className="glass-card rounded-2xl p-5 space-y-5">
                {/* Header Actions */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Studio Mode</span>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Manual Designer</h3>
                  </div>
                  <button
                    onClick={handleExitManualMode}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-wider rounded-xl text-gray-300 transition-all active:scale-95"
                  >
                    Back to AI
                  </button>
                </div>

                {/* Canvas Resize Control */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider block">Canvas Resize</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">Width (px)</label>
                      <input
                        type="number"
                        value={canvasWidth}
                        onChange={(e) => setCanvasWidth(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-black/20 border border-white/5 focus:border-[#06B6D4]/35 rounded-xl px-3 py-2 outline-none text-xs text-[#F8FAFC]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">Height (px)</label>
                      <input
                        type="number"
                        value={canvasHeight}
                        onChange={(e) => setCanvasHeight(parseInt(e.target.value, 10) || 0)}
                        className="w-full bg-black/20 border border-white/5 focus:border-[#06B6D4]/35 rounded-xl px-3 py-2 outline-none text-xs text-[#F8FAFC]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleResize(canvasWidth, canvasHeight)}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 border border-[#06B6D4]/20 text-[10px] font-black uppercase tracking-wider rounded-xl text-[#06B6D4] transition-all active:scale-95"
                  >
                    Apply Dimensions
                  </button>
                </div>

                {/* Layer Insertion */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider block">Insert Elements</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={addManualText}
                      className="py-2.5 bg-[#06B6D4]/10 hover:bg-[#06B6D4]/15 border border-[#06B6D4]/20 text-[#06B6D4] text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    >
                      📝 Text Box
                    </button>
                    <button
                      onClick={startCropMode}
                      disabled={isCropping}
                      className="py-2.5 bg-[#06B6D4]/10 hover:bg-[#06B6D4]/15 border border-[#06B6D4]/20 text-[#06B6D4] text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                    >
                      ✂️ Crop Image
                    </button>
                  </div>

                  {/* Shapes */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">Vector Shapes</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => addManualShape('rect')}
                        className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold uppercase tracking-wider rounded-lg text-white"
                      >
                        Rect
                      </button>
                      <button
                        onClick={() => addManualShape('circle')}
                        className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold uppercase tracking-wider rounded-lg text-white"
                      >
                        Circle
                      </button>
                      <button
                        onClick={() => addManualShape('line')}
                        className="py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[9px] font-bold uppercase tracking-wider rounded-lg text-white"
                      >
                        Line
                      </button>
                    </div>

                    {/* Shape Color Picker */}
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <span className="text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">Shape Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={manualShapeColor}
                          onChange={(e) => setManualShapeColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                        />
                        <span className="text-[10px] font-mono text-[#94A3B8] uppercase">{manualShapeColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adjustments: Brightness Filter */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider block">Image Adjustments</span>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">
                      <span>Brightness</span>
                      <span className="font-mono text-cyan-400">{brightness > 0 ? `+${(brightness * 100).toFixed(0)}%` : `${(brightness * 100).toFixed(0)}%`}</span>
                    </div>
                    <input
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.05"
                      value={brightness}
                      onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Translucent Solid Color Overlay */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <span className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider block">Color Overlay</span>
                  
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">Overlay Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={overlayColor}
                        onChange={(e) => handleOverlayColorChange(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                      />
                      <span className="text-[10px] font-mono text-[#94A3B8] uppercase">{overlayColor}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] text-[#94A3B8]/80 font-bold uppercase tracking-wider">
                      <span>Overlay Opacity</span>
                      <span className="font-mono text-cyan-400">{(overlayOpacity * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => handleOverlayOpacityChange(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Studio Actions */}
                <div className="pt-4 border-t border-white/5">
                  <button
                    onClick={handleDownloadManual}
                    className="w-full py-4 bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] hover:opacity-95 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                  >
                    📥 Download PNG
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── STANDARD AI VISUALIZER WORKSPACE ── */
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ── VISUALIZER FRAME (LEFT/TOP) ── */}
            <div className="lg:col-span-8 space-y-4">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Editing Visualizer Canvas</span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Asset */}
                <div className="relative aspect-square rounded-2xl border border-white/5 bg-black/35 flex flex-col items-center justify-center overflow-hidden group shadow-lg" style={{ minHeight: '340px' }}>
                  <input id="image-editor-file-input" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  {originalImage ? (
                    <label htmlFor="image-editor-file-input" className="w-full h-full cursor-pointer relative block">
                      <img src={originalImage} alt="Source asset" className="w-full h-full object-contain" />
                      {/* On mobile, standard group-hover doesn't trigger on tap without hover. We show a clear touch indicator overlay badge */}
                      <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/75 hover:bg-black/90 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5 transition-all shadow-md">
                        <span>🔄</span> Replace
                      </div>
                    </label>
                  ) : (
                    <label
                      htmlFor="image-editor-file-input"
                      className="flex flex-col items-center justify-center text-center p-6 cursor-pointer hover:bg-white/[0.02] w-full h-full transition-all"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-4 border border-white/10 group-hover:scale-105 transition-transform">
                        📤
                      </div>
                      <p className="text-xs font-black text-[#F8FAFC] tracking-wider uppercase mb-1">Load Asset Image</p>
                      <p className="text-[10px] text-[#94A3B8] max-w-[200px] leading-relaxed">
                        Drag and drop or click here to upload your source photo asset.
                      </p>
                    </label>
                  )}
                  <span className="absolute top-3 left-3 text-[8px] font-black uppercase bg-black/60 border border-white/10 text-gray-400 px-2 py-0.5 rounded-full shrink-0 tracking-wider">
                    Source Image
                  </span>
                </div>

                {/* Edited Masterpiece */}
                <div className="relative aspect-square rounded-2xl border border-white/5 bg-black/35 flex flex-col items-center justify-center overflow-hidden shadow-lg" style={{ minHeight: '340px' }}>
                  
                  {/* Simulated Neural Loader Overlay */}
                  {loading && (
                    <div className="absolute inset-0 z-30 bg-[#070A12]/95 flex flex-col items-center justify-center gap-4 text-center p-8 backdrop-blur-md">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-[#06B6D4]/10 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-[#06B6D4] border-r-[#7C3AED] rounded-full animate-spin" />
                        <span className="text-[11px] font-black text-[#F8FAFC]">{progressPercent}%</span>
                      </div>
                      <div className="space-y-1 mt-2">
                        <h4 className="text-[11px] font-black text-cyan-300 animate-pulse uppercase tracking-wider">{progressMsg}</h4>
                        <p className="text-[8px] text-[#94A3B8]/60 uppercase tracking-widest">Applying Neural Transformation</p>
                      </div>
                      <div className="w-full max-w-xs bg-white/5 h-1 rounded-full overflow-hidden border border-white/10 mt-1">
                        <div className="bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Error Banner */}
                  {error && (
                    <div className="absolute inset-0 z-20 bg-[#070A12]/95 flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-lg mb-2">
                        ⚠️
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Process Blocked</h4>
                      <p className="text-[10px] text-red-400 leading-relaxed mb-4">{error}</p>
                      <button
                        onClick={handleApplyEdit}
                        className="px-4 py-2 bg-[#06B6D4]/20 border border-[#06B6D4]/35 text-[#F8FAFC] hover:bg-[#06B6D4]/35 text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md"
                      >
                        Retry Edit
                      </button>
                    </div>
                  )}

                  {resultImage ? (
                    <div className="absolute inset-0 flex flex-col group animate-fadeIn">
                      <img src={resultImage} alt="AI output masterpiece" className="w-full h-full object-contain" />
                      {/* Hover controls inside visualizer */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between p-5">
                        <p className="text-[10px] text-gray-300 line-clamp-2 max-w-xs font-medium leading-relaxed pr-2">{editPrompt}</p>
                        <button
                          onClick={() => handleDownload(resultImage)}
                          className="shrink-0 px-4 py-2 bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] hover:opacity-95 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Asset
                        </button>
                      </div>
                    </div>
                  ) : (
                    !loading && !error && (
                      <div className="flex flex-col items-center justify-center text-center p-6 max-w-xs">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mb-4 border border-white/10">
                          ✨
                        </div>
                        <p className="text-xs font-black text-[#F8FAFC] tracking-wider uppercase mb-1">AI Edited Masterpiece</p>
                        <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                          Input source photo asset and type change instruction. Rendered edits appear here instantly.
                        </p>
                      </div>
                    )
                  )}

                  <span className="absolute top-3 left-3 text-[8px] font-black uppercase bg-black/60 border border-white/10 text-cyan-400 px-2 py-0.5 rounded-full shrink-0 tracking-wider">
                    Edited Result
                  </span>
                </div>
              </div>
            </div>

            {/* ── FORM PARAMETERS PANEL (RIGHT/BOTTOM) ── */}
            <div className="lg:col-span-4 space-y-4">
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">AI Customization Controls</span>

              <div className="glass-card rounded-2xl p-5 space-y-4">
                {/* File Info */}
                {originalImage && (
                  <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="text-lg">🖼️</span>
                      <div className="overflow-hidden">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active source file</p>
                        <p className="text-xs text-white truncate font-medium">{imageFile ? imageFile.name : 'fic_asset.png'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setOriginalImage(null);
                        setImageFile(null);
                        setResultImage(null);
                        setError(null);
                      }}
                      className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                      title="Remove asset"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Edit Instruction Box */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider">Visual Edit Instruction</label>
                  <textarea
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                    placeholder="e.g. Add red glowing glasses to the person, or change background to a beautiful futuristic beach sunset..."
                    rows={4}
                    className="w-full bg-black/25 border border-white/5 focus:border-[#06B6D4]/35 rounded-xl p-3 outline-none text-xs text-[#F8FAFC] placeholder-[#94A3B8]/30 resize-none transition-all leading-relaxed">
                  </textarea>
                  {/* Denoise Slider */}
                  {denoiseSlider}
                </div>

                {/* Warning banner removed - Pollinations fallback now handles editing */}

                {/* Trigger Button */}
                <button
                  onClick={handleApplyEdit}
                  disabled={loading || !editPrompt.trim()}
                  className="w-full py-4 bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] hover:opacity-95 disabled:opacity-20 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {imageFile ? 'Applying AI Edit...' : 'Generating AI Image...'}
                    </>
                  ) : (
                    <>
                      <span>{imageFile ? '🖌️' : '✨'}</span>
                      {imageFile ? 'Apply AI Edit' : 'Create AI Image'}
                    </>
                  )}
                </button>

                {originalImage && (
                  <button
                    onClick={() => setManualMode(true)}
                    className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
                  >
                    🎨 Edit Manually (Studio)
                  </button>
                )}

                {!originalImage && (
                  <button
                    onClick={() => setManualMode(true)}
                    className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
                  >
                    🎨 Open Studio (Blank Canvas)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── PERSISTED EDIT HISTORY GALLERY ── */}
          {history.filter(item => item.type === 'edit').length > 0 && (
            <div className="max-w-6xl mx-auto glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <button
                  onClick={() => setShowHistoryPanel(p => !p)}
                  className="flex items-center gap-2 bg-transparent border-none cursor-pointer"
                >
                  <span className="text-[#06B6D4] text-base">📚</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#F8FAFC]">🕐 AI Edit History — 30 Days</h3>
                  <span className="text-[#94A3B8] text-[10px]">{showHistoryPanel ? '▲' : '▼'}</span>
                </button>
                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] text-[#94A3B8] font-bold">
                  {history.filter(item => item.type === 'edit').length} Edits · auto-delete after 30 days
                </span>
              </div>

              {showHistoryPanel && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {history.filter(item => item.type === 'edit').map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setError(null);
                        setOriginalImage(item.originalUrl || item.url);
                        setResultImage(item.url);
                        setEditPrompt(item.prompt || '');
                      }}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border hover:border-[#06B6D4]/40 transition-all duration-300 group bg-black/40 ${
                        resultImage === item.url ? 'border-[#06B6D4] ring-2 ring-[#06B6D4]/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-white/5'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt="Gallery Edit Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      />
                      {item.timestamp && (
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/70 text-[8px] text-gray-300 text-center">
                          {timeAgo(item.timestamp)}
                        </div>
                      )}
                      {/* Hover controls inside history gallery thumbnail */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item.url); }}
                          className="p-1.5 bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] hover:opacity-90 text-white rounded-lg transition-transform active:scale-90"
                          title="Download"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          className="p-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 rounded-lg transition-transform active:scale-90"
                          title="Delete"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
