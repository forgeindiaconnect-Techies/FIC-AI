// AI Design Brain for Poster Engine
// Provides rule‑based intelligence functions used by PosterGenerator.

/**
 * Helper to capitalize a string
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * 1. Prompt Understanding
 * Create: understandPosterPrompt(prompt)
 * It should extract:
 * - posterType
 * - occasion
 * - title
 * - subtitle
 * - message
 * - CTA
 * - targetAudience
 */
export function understandPosterPrompt(prompt) {
  const lower = prompt.toLowerCase();
  const result = {
    posterType: 'general',
    occasion: null,
    title: null,
    subtitle: null,
    message: null,
    cta: null,
    targetAudience: null,
  };

  // Poster type detection
  if (lower.includes('hiring') || lower.includes('job') || lower.includes('we are hiring')) {
    result.posterType = 'hiring';
  } else if (lower.includes('diwali') || lower.includes('festival') || lower.includes('christmas') || lower.includes('holiday')) {
    result.posterType = 'festival';
  } else if (lower.includes('birthday') || lower.includes('anniversary')) {
    result.posterType = 'birthday';
  } else if (lower.includes('sale') || lower.includes('offer') || lower.includes('discount') || lower.includes('promotion')) {
    result.posterType = 'offer';
  }

  // Occasion (capitalized as in the examples)
  const occasionMatch = lower.match(/(diwali|christmas|new year|birthday|anniversary)/i);
  if (occasionMatch) {
    result.occasion = capitalize(occasionMatch[1]);
  }

  // Title extraction
  const titleMatch = prompt.match(/"([^"]+)"|title[:\s]+([^,\.]+)/i);
  if (titleMatch) {
    result.title = titleMatch[1] || titleMatch[2].trim();
  } else {
    // Default title formatting based on type/occasion
    if (result.occasion) {
      result.title = `HAPPY ${result.occasion.toUpperCase()}`;
    } else if (result.posterType === 'hiring') {
      result.title = 'WE ARE HIRING';
    } else {
      result.title = 'PROFESSIONAL POSTER';
    }
  }

  // Subtitle / tagline
  const subMatch = prompt.match(/subtitle[:\s]+([^,\.]+)/i);
  if (subMatch) {
    result.subtitle = subMatch[1].trim();
  } else {
    if (result.posterType === 'hiring') {
      result.subtitle = 'Join Our Team';
    } else if (result.posterType === 'festival') {
      result.subtitle = 'Festival of Lights';
    } else {
      result.subtitle = 'Designed for your brand';
    }
  }

  // Message / body copy
  const msgMatch = prompt.match(/message[:\s]+([^,\.]+)/i);
  if (msgMatch) {
    result.message = msgMatch[1].trim();
  } else {
    if (result.posterType === 'hiring') {
      result.message = 'Build your future with us';
    } else if (result.posterType === 'festival') {
      result.message = 'Wishing you joy, prosperity and happiness';
    } else {
      result.message = 'Creative, clean and modern layout';
    }
  }

  // CTA
  const ctaMatch = prompt.match(/cta[:\s]+([^,\.]+)/i);
  if (ctaMatch) {
    result.cta = ctaMatch[1].trim();
  } else {
    if (result.posterType === 'hiring') {
      result.cta = 'Apply Now';
    } else if (result.posterType === 'festival') {
      result.cta = 'Celebrate with Light & Love';
    } else {
      result.cta = 'Get Started';
    }
  }

  // Target audience
  const audienceMatch = lower.match(/for\s+([a-z\s]+)/i);
  if (audienceMatch) {
    result.targetAudience = audienceMatch[1].trim();
  }

  return result;
}

/**
 * 2. Theme Detection
 * Create: detectTheme(posterData)
 */
export function detectTheme(posterData) {
  const occasion = (posterData.occasion || '').toLowerCase();
  const posterType = (posterData.posterType || '').toLowerCase();

  if (occasion.includes('diwali') || occasion.includes('festival') || posterType === 'festival') {
    return 'luxury festival';
  }
  if (posterType === 'hiring') {
    return 'corporate recruitment';
  }
  if (occasion.includes('birthday') || posterType === 'birthday') {
    return 'celebration';
  }
  if (posterType === 'offer') {
    return 'sales promotion';
  }
  return 'general';
}

/**
 * 3. Layout Intelligence
 * Create: selectLayout(posterData)
 */
export function selectLayout(posterData) {
  const theme = detectTheme(posterData);
  if (theme === 'luxury festival') {
    return 'centered title + decorations';
  }
  if (theme === 'corporate recruitment') {
    return 'bold title + role cards + CTA';
  }
  if (theme === 'sales promotion') {
    return 'product focus + discount badge';
  }
  return 'simple vertical stack';
}

/**
 * 4. Typography Intelligence
 * Create: selectTypography(theme)
 */
export function selectTypography(theme) {
  if (theme === 'luxury festival') {
    return 'elegant serif + gold';
  }
  if (theme === 'corporate recruitment') {
    return 'bold sans-serif';
  }
  if (theme.includes('tech') || theme.includes('futuristic')) {
    return 'futuristic mono font';
  }
  return 'clean sans-serif';
}

/**
 * 5. Color Intelligence
 * Create: selectColorPalette(theme)
 */
export function selectColorPalette(theme) {
  if (theme === 'luxury festival') {
    return ['dark purple', 'gold', 'orange'];
  }
  if (theme === 'corporate recruitment') {
    return ['navy', 'cyan', 'white'];
  }
  if (theme === 'celebration') {
    return ['pink', 'yellow', 'pastel'];
  }
  return ['gray', 'white'];
}

/**
 * Finally create: generatePosterDesign(prompt)
 * Returns full JSON:
 * {
 *   posterType,
 *   theme,
 *   layout,
 *   typography,
 *   colors,
 *   content,
 *   decorations
 * }
 */
export function generatePosterDesign(prompt) {
  const parsed = understandPosterPrompt(prompt);
  const theme = detectTheme(parsed);
  const layout = selectLayout(parsed);
  const typography = selectTypography(theme);
  const colors = selectColorPalette(theme);

  const content = {
    title: parsed.title,
    subtitle: parsed.subtitle,
    message: parsed.message,
    cta: parsed.cta,
    targetAudience: parsed.targetAudience
  };

  const decorations = [];

  return {
    posterType: parsed.posterType,
    theme,
    layout,
    typography,
    colors,
    content,
    decorations
  };
}
