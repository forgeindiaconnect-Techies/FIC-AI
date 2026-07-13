// server/utils/promptEnhancementEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// AI Prompt Enhancement System
//
// Intercepts raw user prompts BEFORE they reach Gemini/Pollinations.
// Analyzes → Expands → Adds professional design details → Generates
// a category-matched background prompt for Pollinations.
//
// Usage:
//   import { enhanceUserPrompt } from './promptEnhancementEngine.js';
//   const brief = await enhanceUserPrompt("birthday poster");
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Category keyword maps ─────────────────────────────────────────────────────
const CATEGORY_MAPS = {
  'Festival': {
    keywords: ['festival', 'diwali', 'pongal', 'christmas', 'new year', 'eid', 'holi', 'navratri',
                'onam', 'ugadi', 'sankranti', 'harvest', 'wishes', 'celebration', 'greetings',
                'raksha', 'independence day', 'republic day', 'janmashtami', 'ganesh'],
    occasions: {
      diwali: ['diwali', 'deepawali', 'deepavali'],
      pongal: ['pongal', 'sankranti', 'harvest'],
      christmas: ['christmas', 'xmas', 'x-mas'],
      newyear: ['new year', 'happy new year', 'nye'],
      eid: ['eid', 'ramadan', 'muharram'],
      holi: ['holi', 'rang', 'colors'],
      independence: ['independence day', '15 august', 'republic day', '26 january'],
      ganesh: ['ganesh', 'chaturthi', 'ganapati'],
      birthday: ['birthday', 'bday', 'born', 'happy birthday', 'birthday wishes'],
      anniversary: ['anniversary', 'wedding anniversary'],
      ugadi: ['ugadi', 'gudi padwa', 'telugu new year'],
    }
  },
  'Birthday': {
    keywords: ['birthday', 'bday', 'born', 'happy birthday', 'birthday wishes', 'birthday party',
                'cake', 'balloons', 'celebrate birthday'],
  },
  'Grand Opening': {
    keywords: ['grand opening', 'opening of', 'inauguration', 'launch of', 'grand launch',
                'new opening', 'store opening', 'shop opening', 'restaurant opening',
                'grand inauguration', 'soft launch', 'new store'],
  },
  'Hiring': {
    keywords: ['hiring', 'job', 'vacancy', 'recruitment', 'developer', 'apply now', 'recruit',
                'career', 'opportunity', 'position', 'join our team', 'we are looking',
                'fresher', 'engineer wanted', 'job opening', 'apply'],
  },
  'Restaurant': {
    keywords: ['restaurant', 'food', 'cafe', 'dining', 'bistro', 'eat', 'menu', 'delicious',
                'pizza', 'pasta', 'burger', 'cuisine', 'chef', 'kitchen', 'dish',
                'coffee', 'bakery', 'hotel food', 'canteen'],
  },
  'Real Estate': {
    keywords: ['real estate', 'property', 'apartment', 'villa', 'house', 'building', 'home',
                'realty', 'flat', 'plot', 'bhk', 'residential', 'pg', 'rent', 'lease',
                'commercial space', 'office space'],
  },
  'Education': {
    keywords: ['course', 'training', 'class', 'learn', 'education', 'educational', 'academy',
                'bootcamp', 'workshop', 'seminar', 'tuition', 'coaching', 'school', 'college',
                'university', 'institute', 'certification', 'degree', 'program'],
  },
  'Healthcare': {
    keywords: ['hospital', 'clinic', 'doctor', 'health', 'medical', 'dentist', 'pharmacy',
                'wellness', 'fitness', 'gym', 'yoga', 'therapy', 'dental', 'specialist',
                'diagnostic', 'lab', 'blood test', 'checkup'],
  },
  'Sale / Offer': {
    keywords: ['sale', 'offer', 'discount', 'promo', 'deal', '% off', 'off', 'buy', 'get',
                'flash sale', 'clearance', 'seasonal offer', 'special price', 'best deal',
                'limited offer', 'today only'],
  },
  'Event': {
    keywords: ['event', 'summit', 'conference', 'webinar', 'meetup', 'conclave', 'live event',
                'cultural program', 'function', 'show', 'concert', 'award', 'ceremony'],
  },
  'Product Launch': {
    keywords: ['product launch', 'launching', 'introducing', 'new product', 'release', 'unveil',
                'new app', 'app launch', 'software launch', 'brand new'],
  },
  'Corporate': {
    keywords: ['corporate', 'business', 'company', 'agency', 'consulting', 'branding', 'service',
                'solutions', 'enterprise', 'startup', 'firm', 'association'],
  },
};

// ── Per-category visual expansion data ────────────────────────────────────────
const CATEGORY_VISUALS = {
  'Birthday': {
    mainVisual: 'birthday cake with candles, colorful balloons, confetti, streamers, celebration party',
    colorPalette: ['#FF6B9D', '#FFD93D', '#6BCB77', '#4D96FF', '#FFFFFF'],
    mood: 'Joyful, Fun, Celebratory',
    typography: 'Poppins',
    backgroundStyle: 'colorful festive party background, birthday balloons, streamers, bokeh lights, confetti rain, cheerful vibrant atmosphere',
    cta: 'Celebrate!',
    requiredText: ['Happy Birthday', 'Name', 'Date'],
  },
  'Festival': {
    mainVisual: 'festive lights, traditional decorations, celebration elements, glowing lamps',
    colorPalette: ['#D4AF37', '#EF4444', '#F97316', '#1A0A00'],
    mood: 'Festive, Traditional, Joyful',
    typography: 'Playfair Display',
    backgroundStyle: 'glowing festive lights background, traditional celebration atmosphere, warm golden bokeh, cultural decorative elements',
    cta: 'Celebrate',
    requiredText: ['Festival Name', 'Wishes', 'Brand Name'],
  },
  'Festival_diwali': {
    mainVisual: 'glowing diyas oil lamps, fireworks sparkles, rangoli pattern, lotus flowers, diya flames',
    colorPalette: ['#1A0A00', '#D4AF37', '#EF4444', '#F97316'],
    mood: 'Traditional, Bright, Celebratory',
    typography: 'Playfair Display',
    backgroundStyle: 'Diwali night background, multiple glowing clay diyas arranged beautifully, colorful fireworks in the sky, golden rangoli pattern, lotus flowers, warm amber light glow, bokeh sparkles, no text, no words, traditional Indian festival scene',
    cta: 'Celebrate Diwali',
  },
  'Festival_pongal': {
    mainVisual: 'sugarcane stalks, clay pongal pot with boiling milk overflow, kolam rangoli, sun symbol, harvest crops',
    colorPalette: ['#FFFDE7', '#FF8C00', '#2E7D32', '#1B5E20'],
    mood: 'Traditional, Harvest, Warm',
    typography: 'Playfair Display',
    backgroundStyle: 'Pongal harvest festival background, sugarcane stalks, traditional clay pot boiling with milk overflow, beautiful kolam rangoli design on floor, warm sunny harvest field, marigold flowers, no text, no words',
    cta: 'Happy Pongal',
  },
  'Festival_christmas': {
    mainVisual: 'Christmas tree with ornaments, falling snow, Santa hat, gift boxes, glowing fairy lights',
    colorPalette: ['#1B5E20', '#EF4444', '#FFFFFF', '#D4AF37'],
    mood: 'Warm, Cozy, Joyful',
    typography: 'Montserrat',
    backgroundStyle: 'Christmas holiday background, beautifully decorated Christmas tree with glowing lights, falling snowflakes, cozy warm bokeh, red ornaments, gift boxes wrapped with ribbons, no text, no words, photorealistic',
    cta: 'Merry Christmas',
  },
  'Festival_newyear': {
    mainVisual: 'fireworks sky, champagne, clock countdown, confetti, sparkler lights',
    colorPalette: ['#0A0A1A', '#D4AF37', '#FFFFFF', '#4F46E5'],
    mood: 'Exciting, Celebratory, New Beginnings',
    typography: 'Bebas Neue',
    backgroundStyle: 'New Year celebration background, spectacular fireworks display in night sky, champagne glasses, golden confetti rain, countdown clock silhouette, sparkler light trails, no text, no words',
    cta: 'Happy New Year!',
  },
  'Grand Opening': {
    mainVisual: 'ribbon cutting ceremony, gold balloons, celebration arch, confetti, stage with spotlights',
    colorPalette: ['#0A0A0A', '#D4AF37', '#FFFFFF', '#8A0000'],
    mood: 'Celebratory, Luxury, Prestigious',
    typography: 'Playfair Display',
    backgroundStyle: 'grand opening event background, gold ribbon cutting, balloons arch, celebration confetti rain, stage spotlights, gold foil texture, elegant event backdrop, luxury party atmosphere, no text, no words',
    cta: 'Join Us',
    requiredText: ['Grand Opening', 'Business Name', 'Date & Venue'],
  },
  'Hiring': {
    mainVisual: 'modern office workspace, professional team collaborating, tech desk with laptop, diverse team',
    colorPalette: ['#0F172A', '#3B82F6', '#8B5CF6', '#FFFFFF'],
    mood: 'Professional, Dynamic, Innovative',
    typography: 'Montserrat',
    backgroundStyle: 'modern creative office workspace background, warm soft ambient lighting, computer monitors, sleek desk setup, plants, minimalist interior, professional atmosphere, blurred depth of field, no text, no words, no people faces clearly visible',
    cta: 'Apply Now',
    requiredText: ['We Are Hiring', 'Job Role', 'Skills', 'Contact'],
  },
  'Restaurant': {
    mainVisual: 'beautifully plated food dish, close-up of gourmet meal, steam rising, elegant table setting',
    colorPalette: ['#1A0A00', '#EF4444', '#F97316', '#FFF8F0'],
    mood: 'Appetizing, Warm, Inviting',
    typography: 'Playfair Display',
    backgroundStyle: 'premium food photography background, beautifully plated gourmet dish on elegant table, soft warm restaurant lighting, bokeh background, wooden table texture, steam rising from food, no text, no words, no watermark',
    cta: 'Order Now',
    requiredText: ['Restaurant Name', 'Special Dish / Offer', 'Contact'],
  },
  'Real Estate': {
    mainVisual: 'luxury villa exterior, modern apartment building, manicured garden, golden sunset light',
    colorPalette: ['#0A0A0A', '#D4AF37', '#FFFFFF', '#EAD8C0'],
    mood: 'Elegant, Premium, Aspirational',
    typography: 'Playfair Display',
    backgroundStyle: 'luxury real estate property background, modern villa exterior with manicured lawn, golden sunset warm lighting, architectural elegance, swimming pool, premium residential building, no text, no words, photorealistic DSLR quality',
    cta: 'Enquire Now',
    requiredText: ['Property Name', 'Price', 'Location', 'Contact'],
  },
  'Education': {
    mainVisual: 'student studying, laptop with books, graduation certificate, classroom environment',
    colorPalette: ['#0F172A', '#3B82F6', '#10B981', '#FFFFFF'],
    mood: 'Academic, Motivating, Professional',
    typography: 'Montserrat',
    backgroundStyle: 'modern education learning background, clean classroom workspace, books and laptop on desk, soft blue ambient light, knowledge icons, subtle grid lines, academic atmosphere, no text, no words',
    cta: 'Enroll Now',
    requiredText: ['Course Name', 'Skills Covered', 'Duration', 'Contact'],
  },
  'Healthcare': {
    mainVisual: 'clean clinic interior, doctor in white coat, medical equipment, wellness atmosphere',
    colorPalette: ['#082032', '#0EA5E9', '#14B8A6', '#FFFFFF'],
    mood: 'Trustworthy, Clean, Professional',
    typography: 'Montserrat',
    backgroundStyle: 'modern medical clinic reception lobby background, clean white interior, soft blue light, wellness center atmosphere, professional clinical environment, no text, no words, no people faces',
    cta: 'Book Appointment',
    requiredText: ['Clinic Name', 'Services', 'Contact'],
  },
  'Sale / Offer': {
    mainVisual: 'discount badge, product showcase, bright accent graphics, sale tag',
    colorPalette: ['#0B0F19', '#EF4444', '#F97316', '#FFFFFF'],
    mood: 'Exciting, Urgent, Vibrant',
    typography: 'Bebas Neue',
    backgroundStyle: 'vibrant shopping sale background, colorful product showcase, bold discount graphics, dynamic burst patterns, star shapes, confetti, high energy commercial atmosphere, no text, no words',
    cta: 'Shop Now',
    requiredText: ['Offer %', 'Product Name', 'Valid Until'],
  },
  'Event': {
    mainVisual: 'conference stage with spotlight, audience, presentation screen, keynote setup',
    colorPalette: ['#0F0922', '#EC4899', '#8B5CF6', '#FFFFFF'],
    mood: 'Innovative, Exciting, Professional',
    typography: 'Montserrat',
    backgroundStyle: 'elegant tech conference hall stage background, dramatic lighting setup, presentation screens, audience seating, corporate event venue, spotlight effect, no text, no words',
    cta: 'Register Now',
    requiredText: ['Event Name', 'Date & Venue', 'Speakers', 'Registration'],
  },
  'Product Launch': {
    mainVisual: 'product on premium podium, dramatic spotlight, futuristic backdrop, sleek product design',
    colorPalette: ['#0A0B10', '#7C3AED', '#3B82F6', '#FFFFFF'],
    mood: 'Innovative, Premium, Exciting',
    typography: 'Poppins',
    backgroundStyle: 'futuristic product launch presentation podium stage, neon spotlight glow, dark premium backdrop, 3D render aesthetic, holographic elements, no text, no words',
    cta: 'Pre-Order Now',
    requiredText: ['Product Name', 'Key Feature', 'Launch Date'],
  },
  'Corporate': {
    mainVisual: 'executive boardroom, glass office building, business professionals, city skyline',
    colorPalette: ['#0F172A', '#0EA5E9', '#FFFFFF', '#94A3B8'],
    mood: 'Professional, Trustworthy, Clean',
    typography: 'Montserrat',
    backgroundStyle: 'modern corporate office executive boardroom background, glass architecture, city skyline view, soft professional blue ambient lighting, clean minimalist design, no text, no words',
    cta: 'Get Started',
    requiredText: ['Company Name', 'Service', 'Contact'],
  },
};

// ── Natural fallback for unknown prompts ──────────────────────────────────────
function detectOccasionSubtype(lower) {
  const map = CATEGORY_MAPS['Festival'].occasions;
  for (const [occasion, keywords] of Object.entries(map)) {
    if (keywords.some(k => lower.includes(k))) return occasion;
  }
  return null;
}

// ── Heuristic category detector ───────────────────────────────────────────────
function detectCategoryFromPrompt(rawPrompt) {
  const lower = rawPrompt.toLowerCase().trim();

  // Birthday first (before Festival to avoid misclassification)
  if (CATEGORY_MAPS['Birthday'].keywords.some(k => lower.includes(k))) {
    return { category: 'Birthday', occasion: 'birthday' };
  }

  // Grand Opening before other checks
  if (CATEGORY_MAPS['Grand Opening'].keywords.some(k => lower.includes(k))) {
    return { category: 'Grand Opening', occasion: null };
  }

  // Festival (with occasion subtype)
  if (CATEGORY_MAPS['Festival'].keywords.some(k => lower.includes(k))) {
    const occasion = detectOccasionSubtype(lower);
    return { category: 'Festival', occasion };
  }

  // All other categories
  for (const [category, data] of Object.entries(CATEGORY_MAPS)) {
    if (category === 'Festival' || category === 'Birthday') continue;
    if (data.keywords.some(k => lower.includes(k))) {
      return { category, occasion: null };
    }
  }

  // Forest / Nature → Event / Corporate (generic fallback)
  const natureWords = ['forest', 'nature', 'garden', 'park', 'trees', 'outdoors', 'eco', 'green'];
  if (natureWords.some(k => lower.includes(k))) {
    return { category: 'Event', occasion: 'outdoor' };
  }

  return { category: 'Corporate', occasion: null };
}

// ── Get visual profile for category ───────────────────────────────────────────
function getVisualProfile(category, occasion) {
  // Try specific occasion first (e.g. Festival_diwali)
  if (occasion && CATEGORY_VISUALS[`${category}_${occasion}`]) {
    return CATEGORY_VISUALS[`${category}_${occasion}`];
  }
  return CATEGORY_VISUALS[category] || CATEGORY_VISUALS['Corporate'];
}

// ── Extract key entities from prompt ─────────────────────────────────────────
function extractEntities(rawPrompt) {
  const entities = {
    brandName: null,
    personName: null,
    date: null,
    location: null,
    product: null,
    discount: null,
    jobRole: null,
  };

  // Discount / percentage
  const discountMatch = rawPrompt.match(/(\d+)\s*%\s*off/i);
  if (discountMatch) entities.discount = discountMatch[1] + '% OFF';

  // Date patterns
  const dateMatch = rawPrompt.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*\d{4})?)\b/i);
  if (dateMatch) entities.date = dateMatch[1];

  // Job role (after hiring keywords)
  const jobMatch = rawPrompt.match(/(?:hiring|looking for|vacancy for|position of)\s+([a-z\s]+?)(?:\s+with|\s+skills?|\s+poster|,|$)/i);
  if (jobMatch) entities.jobRole = jobMatch[1].trim();

  // Quoted brand name
  const quoteMatch = rawPrompt.match(/"([^"]+)"/);
  if (quoteMatch) entities.brandName = quoteMatch[1];

  return entities;
}

// ── Build expanded prompt for AI poster planner ───────────────────────────────
function buildExpandedPrompt(rawPrompt, category, occasion, visual, entities) {
  const parts = [rawPrompt.trim()];

  // Add visual context
  parts.push(`Visual style: ${visual.mainVisual}`);
  parts.push(`Color palette: ${visual.colorPalette.join(', ')}`);
  parts.push(`Mood: ${visual.mood}`);
  parts.push(`Typography: ${visual.typography} font family`);
  parts.push(`Category: ${category}${occasion ? ' (' + occasion + ')' : ''}`);

  // Add entity hints
  if (entities.discount) parts.push(`Highlight: ${entities.discount}`);
  if (entities.jobRole) parts.push(`Job role: ${entities.jobRole}`);
  if (entities.date) parts.push(`Date: ${entities.date}`);

  // Add required text hints
  if (visual.requiredText) {
    parts.push(`Required text elements: ${visual.requiredText.join(', ')}`);
  }

  parts.push(`Design quality: Premium Canva Pro quality, professional poster design`);
  parts.push(`Layout: no dashboard card layout, category-specific visual hierarchy`);

  return parts.join('. ');
}

// ── Build Pollinations background prompt ──────────────────────────────────────
function buildBackgroundPrompt(visual, entities, category) {
  const baseStyle = visual.backgroundStyle ||
    `premium ${category} themed background, professional poster composition`;

  return `${baseStyle}, no text, no letters, no typography, no watermark, no words, no characters, empty space for text overlay, premium poster background, photorealistic, 4K quality, DSLR photography, sharp focus, professional composition, ultra detailed`;
}

// ── Quality scorer ─────────────────────────────────────────────────────────────
function scoreQuality(rawPrompt, category, occasion, visual) {
  let score = 50; // base

  const lower = rawPrompt.toLowerCase();

  // Boost: category keywords found
  const catMap = CATEGORY_MAPS[category];
  if (catMap) {
    const keywordsMatched = catMap.keywords.filter(k => lower.includes(k)).length;
    score += Math.min(keywordsMatched * 10, 30);
  }

  // Boost: has entity info (brand name, dates, etc.)
  if (lower.length > 20) score += 10;

  // Boost: occasion detected
  if (occasion) score += 10;

  // Penalize: very short prompts
  if (lower.split(' ').length < 3) score -= 10;

  return Math.min(100, Math.max(0, score));
}

// ── AI Expansion via Gemini (optional enrichment) ─────────────────────────────
async function expandWithGemini(rawPrompt, category, visual) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are a professional poster design brief writer.
The user has given a short prompt. Expand it into a full professional poster design brief.

Category: ${category}
Visual Style: ${visual.mainVisual}
Mood: ${visual.mood}
Color Palette: ${visual.colorPalette.join(', ')}

Rules:
- Return ONLY a JSON object.
- Keep all strings concise (under 10 words each).
- Generate creative, specific, premium content. Never use placeholder words.
- title: A catchy headline (2-5 words, UPPERCASE).
- subtitle: A compelling tagline.
- cta: Action button text.
- backgroundPrompt: A Pollinations image prompt describing ONLY the background image (no text, no people faces, just the visual scene).

JSON Schema:
{
  "title": "CATCHY HEADLINE",
  "subtitle": "Supporting tagline text",
  "cta": "Action Text",
  "backgroundPrompt": "Detailed visual background description, no text, no words"
}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(`${systemPrompt}\n\nUser prompt: "${rawPrompt}"`);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.warn('[PromptEnhancer] Gemini expansion failed:', err.message);
    return null;
  }
}

// ── MAIN EXPORT: enhanceUserPrompt ────────────────────────────────────────────
export async function enhanceUserPrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    rawPrompt = 'business poster';
  }

  const trimmed = rawPrompt.trim();
  console.log(`[PromptEnhancer] Enhancing prompt: "${trimmed}"`);

  // Step 1: Detect category + occasion
  const { category, occasion } = detectCategoryFromPrompt(trimmed);
  console.log(`[PromptEnhancer] Detected: category="${category}", occasion="${occasion}"`);

  // Step 2: Get visual profile
  const visual = getVisualProfile(category, occasion);

  // Step 3: Extract entities
  const entities = extractEntities(trimmed);

  // Step 4: Build expanded prompt for AI poster planner
  const enhancedPrompt = buildExpandedPrompt(trimmed, category, occasion, visual, entities);

  // Step 5: Build background-only Pollinations prompt
  const backgroundPrompt = buildBackgroundPrompt(visual, entities, category);

  // Step 6: Optional Gemini enrichment
  const geminiExtra = await expandWithGemini(trimmed, category, visual);

  // Step 7: Quality score
  const qualityScore = scoreQuality(trimmed, category, occasion, visual);

  // Step 8: Determine missing info
  const missingDetails = [];
  if (!entities.brandName && ['Grand Opening', 'Corporate', 'Restaurant'].includes(category)) {
    missingDetails.push('Brand/Business name not found');
  }
  if (!entities.date && ['Event', 'Grand Opening'].includes(category)) {
    missingDetails.push('Event date not specified');
  }

  const result = {
    originalPrompt: trimmed,
    detectedCategory: category,
    detectedOccasion: occasion,
    detectedIndustry: getIndustry(category),
    detectedMood: visual.mood,
    detectedAudience: getAudience(category),
    mainVisual: visual.mainVisual,
    colorPalette: visual.colorPalette,
    requiredText: visual.requiredText || [],
    missingDetails,
    enhancedPrompt,
    backgroundPrompt,
    qualityScore,
    // Gemini extras (if available)
    suggestedTitle: geminiExtra?.title || null,
    suggestedSubtitle: geminiExtra?.subtitle || null,
    suggestedCta: geminiExtra?.cta || visual.cta || 'Get Started',
    // Fine-grained background prompt (Gemini overrides base if available)
    finalBackgroundPrompt: geminiExtra?.backgroundPrompt
      ? `${geminiExtra.backgroundPrompt}, no text, no letters, no typography, no watermark, no words, premium poster background, photorealistic, 4K quality`
      : backgroundPrompt,
  };

  console.log(`[PromptEnhancer] Quality score: ${qualityScore}/100`);
  console.log(`[PromptEnhancer] Enhanced prompt preview: "${enhancedPrompt.substring(0, 120)}..."`);

  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getIndustry(category) {
  const map = {
    'Birthday': 'Celebrations',
    'Festival': 'Cultural Events',
    'Grand Opening': 'Retail / Hospitality',
    'Hiring': 'Technology / HR',
    'Restaurant': 'Food & Beverage',
    'Real Estate': 'Property',
    'Education': 'EdTech / Training',
    'Healthcare': 'Medical / Wellness',
    'Sale / Offer': 'Retail / eCommerce',
    'Event': 'Events / Entertainment',
    'Product Launch': 'Technology / Consumer',
    'Corporate': 'Business Services',
  };
  return map[category] || 'General Business';
}

function getAudience(category) {
  const map = {
    'Birthday': 'Friends & Family',
    'Festival': 'General Public',
    'Grand Opening': 'Local Community',
    'Hiring': 'Job Seekers / Developers',
    'Restaurant': 'Food Lovers / Diners',
    'Real Estate': 'Home Buyers / Investors',
    'Education': 'Students / Professionals',
    'Healthcare': 'Patients / Health-Conscious',
    'Sale / Offer': 'Shoppers / Customers',
    'Event': 'Professionals / Enthusiasts',
    'Product Launch': 'Early Adopters / Tech Users',
    'Corporate': 'Business Owners / Executives',
  };
  return map[category] || 'General Audience';
}
