// server/utils/compositionEngine.js
// Visual Hierarchy & Composition Engine for Fabric.js Canvas Rendering

// Helper to fetch SVG icons from Iconify API dynamically based on category color
function getIconUrl(iconKey, colorHex) {
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
}

// Entry Point for Visual Layout Engine mapping
export function computeComposition(poster) {
  const canvasWidth = 1080;
  const canvasHeight = 1350;

  // Normalize fields to strings if they are objects for composition layout compatibility
  if (poster.title && typeof poster.title === 'object') {
    poster.title = poster.title.text || '';
  }
  if (poster.subtitle && typeof poster.subtitle === 'object') {
    poster.subtitle = poster.subtitle.text || '';
  }
  if (poster.cta && typeof poster.cta === 'object') {
    poster.cta = poster.cta.text || '';
  }

  // 1. Color Palette Setup: Premium modern grand opening palette
  // Navy background base, gold/orange highlights, blue accents
  let bgNavy = '#0A0F1D';
  let primaryColor = '#F59E0B';    // Gold/Orange highlight
  let accentColor = '#3B82F6';     // Blue accent
  let textColor = '#FFFFFF';       // White readable text
  let mutedTextColor = '#94A3B8';  // Light grey/muted text

  const colors = poster.colors || poster.colorPalette;
  if (Array.isArray(colors)) {
    bgNavy = colors[0] || bgNavy;
    primaryColor = colors[1] || primaryColor;
    accentColor = colors[2] || accentColor;
  } else if (colors && typeof colors === 'object') {
    bgNavy = colors.bg || colors.background || bgNavy;
    primaryColor = colors.primary || primaryColor;
    accentColor = colors.accent || accentColor;
    textColor = colors.text || textColor;
  }
  
  const fontPrimary = poster.fontPairing?.primary || 'Montserrat';
  const fontSecondary = poster.fontPairing?.secondary || 'Inter';

  const config = {
    canvasWidth,
    canvasHeight,
    fontPrimary,
    fontSecondary,
    primaryColor,
    accentColor,
    textColor,
    mutedTextColor,
    bgGradient1: bgNavy,
    bgGradient2: bgNavy === '#0A0F1D' ? '#040714' : bgNavy
  };

  const elements = [];

  // ==========================================
  // 2. BACKGROUND & OVERLAYS (No text overlays in image generator)
  // ==========================================
  // Gradient dark navy overlay for maximum contrast and readability
  elements.push({
    type: 'rect',
    left: 0,
    top: 0,
    width: canvasWidth,
    height: canvasHeight,
    fill: {
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: 0, y2: canvasHeight },
      colorStops: [
        { offset: 0, color: config.bgGradient1 + 'DD' },
        { offset: 0.5, color: config.bgGradient2 + 'F0' },
        { offset: 1, color: '#000000FA' }
      ]
    },
    selectable: false,
    evented: false,
    name: 'Navy Gradient Background Overlay'
  });

  // Background Ambient Glow Circle (Aesthetics)
  elements.push({
    type: 'circle',
    left: canvasWidth / 2 - 350,
    top: 150,
    radius: 400,
    fill: {
      type: 'radial',
      coords: { x1: 400, y1: 400, r1: 0, x2: 400, y2: 400, r2: 400 },
      colorStops: [
        { offset: 0, color: accentColor + '18' },
        { offset: 1, color: 'transparent' }
      ]
    },
    selectable: false,
    evented: false,
    name: 'Left Ambient Glow'
  });

  elements.push({
    type: 'circle',
    left: canvasWidth / 2 - 50,
    top: 600,
    radius: 350,
    fill: {
      type: 'radial',
      coords: { x1: 350, y1: 350, r1: 0, x2: 350, y2: 350, r2: 350 },
      colorStops: [
        { offset: 0, color: primaryColor + '10' },
        { offset: 1, color: 'transparent' }
      ]
    },
    selectable: false,
    evented: false,
    name: 'Right Ambient Glow'
  });

  // Crosshair design marks (symmetrical Canva touch)
  const crosshairs = [
    { x: 40, y: 40 },
    { x: canvasWidth - 40, y: 40 },
    { x: 40, y: canvasHeight - 40 },
    { x: canvasWidth - 40, y: canvasHeight - 40 }
  ];
  crosshairs.forEach((ch, idx) => {
    elements.push({
      type: 'line',
      left: ch.x - 10,
      top: ch.y,
      width: 20,
      height: 2,
      fill: primaryColor,
      opacity: 0.4,
      selectable: false,
      name: `Crosshair-H ${idx}`
    });
    elements.push({
      type: 'line',
      left: ch.x,
      top: ch.y - 10,
      width: 2,
      height: 20,
      fill: primaryColor,
      opacity: 0.4,
      selectable: false,
      name: `Crosshair-V ${idx}`
    });
  });

  // ==========================================
  // 3. DYNAMIC MATHEMATICAL LAYOUT ENGINE
  // ==========================================
  const canvasPadding = 40;
  const sectionGap = 24;
  const cardGap = 20;
  const usableWidth = canvasWidth - (canvasPadding * 2); // 1000px

  let currentY = canvasPadding;

  // A. Header Logo / Brand Text (Top)
  const brandName = 'FORGE INDIA CONNECT';
  elements.push({
    type: 'text',
    text: brandName,
    left: canvasWidth / 2,
    top: currentY,
    width: usableWidth,
    fontSize: 16,
    fontFamily: fontSecondary,
    fontWeight: 'bold',
    fill: accentColor,
    textAlign: 'center',
    originX: 'center',
    selectable: true,
    name: 'Brand Header'
  });
  currentY += 16 + 12; // Height + offset

  // B. Headline / Title
  // Rule: Title: large, top aligned, 48-64px
  const rawTitle = (poster.title || poster.heading || 'GRAND OPENING').toUpperCase();
  let titleSize = 64;
  if (rawTitle.length > 20) titleSize = 54;
  if (rawTitle.length > 35) titleSize = 48;

  elements.push({
    type: 'text',
    text: rawTitle,
    left: canvasWidth / 2,
    top: currentY,
    width: usableWidth,
    fontSize: titleSize,
    fontFamily: fontPrimary,
    fontWeight: '900',
    fill: textColor,
    textAlign: 'center',
    originX: 'center',
    selectable: true,
    name: 'Poster Title'
  });

  // Estimate Title Height to advance Y
  const titleLines = Math.ceil((rawTitle.length * (titleSize * 0.6)) / usableWidth);
  const titleHeight = titleLines * (titleSize * 1.25);
  currentY += titleHeight + sectionGap;

  // C. Subtitle
  // Rule: Subtitle: 20-26px
  const rawSubtitle = poster.subtitle || poster.subheading || 'Join us for our exclusive launch event';
  let subtitleSize = 24;
  if (rawSubtitle.length > 60) subtitleSize = 20;

  elements.push({
    type: 'text',
    text: rawSubtitle,
    left: canvasWidth / 2,
    top: currentY,
    width: usableWidth,
    fontSize: subtitleSize,
    fontFamily: fontSecondary,
    fontWeight: '600',
    fill: primaryColor, // gold accent
    textAlign: 'center',
    originX: 'center',
    selectable: true,
    name: 'Poster Subtitle'
  });

  // Estimate Subtitle Height to advance Y
  const subtitleLines = Math.ceil((rawSubtitle.length * (subtitleSize * 0.5)) / usableWidth);
  const subtitleHeight = subtitleLines * (subtitleSize * 1.35);
  currentY += subtitleHeight + sectionGap + 10;

  // D. Features Cards Grid
  // Rules:
  // - Cards: equal width, equal height, proper gap
  // - Card title max 2 lines, no overflow
  // - Body text inside card must wrap
  // - Text overflow protection: auto reduce font size, wrap text, never allow text overlap
  const features = (poster.features || []).slice(0, 3);
  if (features.length > 0) {
    const cols = features.length;
    const totalGaps = (cols - 1) * cardGap;
    const cardWidth = (usableWidth - totalGaps) / cols;

    // Estimate heights for each card to find the maximum height required
    const cardHeights = features.map(feat => {
      const cardUsableWidth = cardWidth - 40; // Subtract padding inside card (20px left + 20px right)
      
      // Icon: 44px
      // Space: 16px
      // Card Title: 18px font, 1.25 line height, max 2 lines
      const titleLinesCount = Math.min(2, Math.ceil(((feat.title || '').length * (18 * 0.55)) / cardUsableWidth));
      const cardTitleHeight = titleLinesCount * (18 * 1.25);

      // Space: 12px
      // Card Desc: 13px font, 1.4 line height, wrap
      const descLinesCount = Math.ceil(((feat.desc || '').length * (13 * 0.5)) / cardUsableWidth);
      const cardDescHeight = descLinesCount * (13 * 1.4);

      // Total inner height: Padding top(24) + Icon(44) + Gap(16) + Title + Gap(12) + Desc + Padding bottom(24)
      return 24 + 44 + 16 + cardTitleHeight + 12 + cardDescHeight + 24;
    });

    // Make all cards equal height
    const cardHeight = Math.max(280, ...cardHeights);

    // Render cards
    features.forEach((feat, index) => {
      const cardX = canvasPadding + index * (cardWidth + cardGap);
      const cardY = currentY;

      // Card Background (Frosted dark glass panel)
      elements.push({
        type: 'rect',
        left: cardX,
        top: cardY,
        width: cardWidth,
        height: cardHeight,
        rx: 16,
        ry: 16,
        fill: '#0C1222',
        opacity: 0.9,
        stroke: accentColor + '44', // Blue accent border
        strokeWidth: 1.5,
        selectable: true,
        name: `Card Panel ${index + 1}`
      });

      // Card Icon (Iconify URL)
      elements.push({
        type: 'image',
        src: getIconUrl(feat.icon || 'star', primaryColor),
        left: cardX + (cardWidth / 2) - 22,
        top: cardY + 24,
        width: 44,
        height: 44,
        selectable: false,
        name: `Card Icon ${index + 1}`
      });

      // Card Title (Max 2 lines, auto wrapping)
      elements.push({
        type: 'text',
        text: (feat.title || 'FEATURE').toUpperCase(),
        left: cardX + (cardWidth / 2),
        top: cardY + 24 + 44 + 16,
        width: cardWidth - 30,
        fontSize: 16,
        fontFamily: fontPrimary,
        fontWeight: 'bold',
        fill: primaryColor, // gold highlight
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        name: `Card Title ${index + 1}`
      });

      // Card Body text (wrapping, text-overflow protected)
      elements.push({
        type: 'text',
        text: feat.desc || 'Detailed feature description copy goes here.',
        left: cardX + (cardWidth / 2),
        top: cardY + 24 + 44 + 16 + 40,
        width: cardWidth - 30,
        fontSize: 13,
        fontFamily: fontSecondary,
        fontWeight: 'normal',
        fill: textColor,
        textAlign: 'center',
        originX: 'center',
        selectable: true,
        name: `Card Desc ${index + 1}`
      });
    });

    currentY += cardHeight + sectionGap;
  }

  // E. Full-width Call To Action Button
  // Rule: Button full width with padding (centered, width = 800px)
  const btnWidth = 800;
  const btnHeight = 70;
  const btnX = (canvasWidth - btnWidth) / 2;
  const btnY = currentY + 10;

  elements.push({
    type: 'rect',
    left: btnX,
    top: btnY,
    width: btnWidth,
    height: btnHeight,
    rx: 20,
    ry: 20,
    fill: {
      type: 'linear',
      coords: { x1: 0, y1: 0, x2: btnWidth, y2: 0 },
      colorStops: [
        { offset: 0, color: primaryColor }, // Gold
        { offset: 1, color: accentColor }   // Blue
      ]
    },
    selectable: true,
    name: 'CTA Button Background'
  });

  const ctaText = (poster.cta || poster.ctaButton || 'GET STARTED NOW').toUpperCase();
  elements.push({
    type: 'text',
    text: ctaText,
    left: canvasWidth / 2,
    top: btnY + (btnHeight - 24) / 2,
    width: btnWidth - 40,
    fontSize: 20,
    fontFamily: fontPrimary,
    fontWeight: 'bold',
    fill: textColor,
    textAlign: 'center',
    originX: 'center',
    selectable: true,
    name: 'CTA Button Text'
  });

  currentY += btnHeight + sectionGap + 20;

  // F. Centered Footer
  const footerText = poster.details || poster.contactInfo || 'Contact: info@forgeindia.com | www.forgeindia.com';
  elements.push({
    type: 'text',
    text: footerText,
    left: canvasWidth / 2,
    top: currentY,
    width: usableWidth,
    fontSize: 14,
    fontFamily: fontSecondary,
    fontWeight: 'bold',
    fill: mutedTextColor,
    textAlign: 'center',
    originX: 'center',
    selectable: true,
    name: 'Footer Text'
  });

  // Attach final resolved visual elements array
  poster.visualElements = elements;
  return elements;
}
