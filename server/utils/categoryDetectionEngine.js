// server/utils/categoryDetectionEngine.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

// Helper to capitalize helper strings
function cleanAndCapitalize(str) {
  if (!str) return '';
  return str.trim();
}

// Heuristic Category Classifier (Robust Fallback)
export function getHeuristicCategoryAndTemplate(prompt) {
  const lower = prompt.toLowerCase();
  
  let category = 'Corporate'; // default fallback
  let template = 'business';
  let title = 'EXCLUSIVE OFFER';
  let subtitle = 'Premium Business Solutions';
  // Additional design fields with null defaults
  let industry = null;
  let audience = null;
  let theme = null;
  let mood = null;
  let colorPalette = null;
  let layoutStyle = null;
  let fontPairing = null;
  let decorativeElements = [];

  if (lower.includes('birthday') || lower.includes('birth day') || lower.includes('bday') || lower.includes('happy birthday') || lower.includes('anniversary') || lower.includes('wedding') || lower.includes('marriage') || lower.includes('engagement') || lower.includes('baby shower') || lower.includes('graduation') || lower.includes('farewell') || lower.includes('retirement')) {
    category = 'Birthday';
    template = 'birthday';
    title = 'HAPPY BIRTHDAY';
    subtitle = 'Wishing You a Special Day Full of Joy';
    industry = 'Personal';
    audience = 'General Public';
    mood = 'Joyful';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['balloons', 'confetti', 'sparkles', 'cake'];
  } else if (lower.includes('diwali') || lower.includes('pongal') || lower.includes('christmas') || lower.includes('new year') || lower.includes('festival') || lower.includes('wishes') || lower.includes('celebration') || lower.includes('harvest') || lower.includes('sankranti')) {
    category = 'Festival';
    template = 'festival';
    title = 'HAPPY CELEBRATIONS';
    subtitle = 'Wishing You Joy and Prosperity';
    industry = 'Cultural';
    audience = 'General Public';
    mood = 'Festive';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['lights', 'confetti'];
  } else if (lower.includes('real estate') || lower.includes('property') || lower.includes('apartment') || lower.includes('villa') || lower.includes('house') || lower.includes('building') || lower.includes('home') || lower.includes('realty')) {
    category = 'Real Estate';
    template = 'real_estate';
    title = 'LUXURY REAL ESTATE';
    subtitle = 'Find Your Perfect Dream Home';
    industry = 'Real Estate';
    audience = 'Home Buyers';
    mood = 'Elegant';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['frame'];
  } else if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('dining') || lower.includes('bistro') || lower.includes('eat') || lower.includes('menu') || lower.includes('delicious') || lower.includes('pizza') || lower.includes('pasta')) {
    category = 'Restaurant';
    template = 'business';
    title = 'DELICIOUS DINING';
    subtitle = 'Experience Premium Fine Dining';
    industry = 'Food';
    audience = 'Gourmands';
    mood = 'Warm';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['warm_lights'];
  } else if (lower.includes('hiring') || lower.includes('job') || lower.includes('vacancy') || lower.includes('recruitment') || lower.includes('developer') || lower.includes('apply') || lower.includes('careers')) {
    category = 'Hiring';
    template = 'hiring';
    title = 'WE ARE HIRING';
    subtitle = 'Join Our Creative Tech Team';
    industry = 'Tech';
    audience = 'Developers';
    mood = 'Professional';
    layoutStyle = 'split-hero';
    fontPairing = { primary: 'Montserrat', secondary: 'Inter' };
    decorativeElements = ['tech_brackets'];
  } else if (lower.includes('grand opening') || lower.includes('grandopening') || lower.includes('opening of') || lower.includes('inauguration')) {
    category = 'Grand Opening';
    template = 'business'; 
    title = 'GRAND OPENING';
    subtitle = 'Welcome to Our New Location';
    industry = 'Retail';
    audience = 'Customers';
    mood = 'Celebration';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['balloons', 'confetti'];
  } else if (lower.includes('sale') || lower.includes('offer') || lower.includes('discount') || lower.includes('promo') || lower.includes('deal') || lower.includes('off')) {
    category = 'Sale / Offer';
    template = 'business';
    title = 'SPECIAL SALE OFFER';
    subtitle = 'Limited Time Discount Deals';
    industry = 'Retail';
    audience = 'Shoppers';
    mood = 'Exciting';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Montserrat', secondary: 'Inter' };
    decorativeElements = ['sparkles'];
  } else if (lower.includes('course') || lower.includes('training') || lower.includes('class') || lower.includes('learn') || lower.includes('education') || lower.includes('educational') || lower.includes('academy') || lower.includes('bootcamp')) {
    category = 'Education';
    template = 'education';
    title = 'ADVANCED TRAINING';
    subtitle = 'Master Premium Engineering Skills';
    industry = 'Education';
    audience = 'Students';
    mood = 'Academic';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Montserrat', secondary: 'Inter' };
    decorativeElements = ['grid_lines'];
  } else if (lower.includes('event') || lower.includes('summit') || lower.includes('conference') || lower.includes('seminar') || lower.includes('meetup') || lower.includes('conclave') || lower.includes('webinar')) {
    category = 'Event';
    template = 'event';
    title = 'FIC TECH SUMMIT';
    subtitle = 'Unlocking Intelligent Solutions';
    industry = 'Tech';
    audience = 'Professionals';
    mood = 'Innovative';
    layoutStyle = 'split-hero';
    fontPairing = { primary: 'Montserrat', secondary: 'Inter' };
    decorativeElements = ['tech_circles'];
  } else if (lower.includes('product launch') || lower.includes('launching') || lower.includes('introducing') || lower.includes('unveiling') || lower.includes('new product') || lower.includes('release')) {
    category = 'Product Launch';
    template = 'product_launch';
    title = 'PRODUCT LAUNCH';
    subtitle = 'Introducing the Next Generation';
    industry = 'Tech';
    audience = 'Customers';
    mood = 'Exciting';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['spotlights'];
  } else if (lower.includes('corporate') || lower.includes('business') || lower.includes('company') || lower.includes('agency') || lower.includes('consulting') || lower.includes('branding')) {
    category = 'Corporate';
    template = 'business'; 
    title = 'CORPORATE SOLUTIONS';
    subtitle = 'Driving Premium Business Value';
    industry = 'Corporate';
    audience = 'Businesses';
    mood = 'Professional';
    layoutStyle = 'centered-focus';
    fontPairing = { primary: 'Playfair Display', secondary: 'Montserrat' };
    decorativeElements = ['clean_borders'];
  }

  // Attempt to extract title/subtitle from prompt if possible
  const quoteMatch = prompt.match(/"([^"]+)"/);
  if (quoteMatch && quoteMatch[1]) {
    title = quoteMatch[1].toUpperCase();
  }

  return {
    category,
    template,
    title,
    subtitle,
    industry,
    audience,
    theme,
    mood,
    colorPalette,
    layoutStyle,
    fontPairing,
    decorativeElements
  };
}

// Main API wrapper for Category Detection
export async function detectCategoryAndTemplate(prompt) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return getHeuristicCategoryAndTemplate('');
  }

  const systemPrompt = `You are the AI Category Detection Engine for an AI poster generator.
Analyze the user's prompt and extract the category, template, title, subtitle, and design specifications.

You must categorize the prompt into EXACTLY one of these 11 categories:
- Hiring
- Grand Opening
- Sale / Offer
- Festival
- Real Estate
- Restaurant
- Education
- Event
- Product Launch
- Corporate
- Birthday

Birthday category covers: birthday, anniversary, wedding, engagement, baby shower, graduation, farewell, retirement, congratulations, personal celebration.

You must automatically choose the correct template string for the category. Allowed templates are:
- "hiring" (for Hiring category ONLY)
- "festival" (for Festival category)
- "birthday" (for Birthday category)
- "education" (for Education category)
- "event" (for Event category)
- "product_launch" (for Product Launch category)
- "real_estate" (for Real Estate category)
- "business" (for Grand Opening, Sale / Offer, Restaurant, Corporate)

CRITICAL RULES:
- NEVER use the "hiring" template for Grand Opening posters or any category other than Hiring.
- If the prompt mentions birthday, anniversary, graduation, wedding, or any personal celebration, classify as "Birthday" with template "birthday".

Output ONLY a valid JSON object matching the schema below. No markdown wrappers, no explanations.

Schema:
{
  "category": "One of the 10 allowed categories",
  "template": "One of the allowed template strings",
  "title": "A catchy premium headline for the poster (uppercase, 2-5 words, no generic placeholders like 'GRAND OPENING POSTER', generate a real title like 'GRAND OPENING OF FIC')",
  "subtitle": "A supporting tagline or value proposition",
  "industry": "Industry description (e.g. Tech, Food, Real Estate)",
  "audience": "Target audience (e.g. Professionals, Students)",
  "theme": "Design theme (e.g. Minimal, Vibrant)",
  "mood": "Emotional tone (e.g. Elegant, Exciting)",
  "colorPalette": "Suggested colors (e.g. #FF0000, #000000)",
  "layoutStyle": "Suggested layout (e.g. centered-focus, split-hero)",
  "fontPairing": { "primary": "font-name", "secondary": "font-name" },
  "decorativeElements": ["list of strings"]
}`;

  // 1. Try Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('[Category Engine] Querying Gemini for category...');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 250,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent([
        { text: systemPrompt + `\n\nPrompt: "${prompt}"` }
      ]);
      const response = await result.response;
      const aiText = response.text().trim();
      const parsed = JSON.parse(aiText);
      
      if (parsed && parsed.category && parsed.template) {
        console.log('[Category Engine] Gemini design brief detected:', parsed.category);
        // Safety guard: Never use hiring template for grand opening
        if (parsed.category === 'Grand Opening' && parsed.template === 'hiring') {
          parsed.template = 'business';
        }
        // Return full design brief, preserving any undefined fields as null
        return {
          category: cleanAndCapitalize(parsed.category),
          template: parsed.template,
          title: parsed.title ? parsed.title.toUpperCase() : null,
          subtitle: parsed.subtitle || null,
          industry: parsed.industry || null,
          audience: parsed.audience || null,
          theme: parsed.theme || null,
          mood: parsed.mood || null,
          colorPalette: parsed.colorPalette || null,
          layoutStyle: parsed.layoutStyle || null,
          fontPairing: parsed.fontPairing || null,
          decorativeElements: parsed.decorativeElements || []
        };
      }
    } catch (err) {
      console.error('[Category Engine] Gemini call failed:', err.message);
    }
  }

  // 2. Try OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('[Category Engine] Querying OpenRouter for category...');
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      const content = res.data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed && parsed.category && parsed.template) {
            console.log('[Category Engine] OpenRouter design brief detected:', parsed.category);
            if (parsed.category === 'Grand Opening' && parsed.template === 'hiring') {
              parsed.template = 'business';
            }
            return {
              category: cleanAndCapitalize(parsed.category),
              template: parsed.template,
              title: parsed.title ? parsed.title.toUpperCase() : null,
              subtitle: parsed.subtitle || null,
              industry: parsed.industry || null,
              audience: parsed.audience || null,
              theme: parsed.theme || null,
              mood: parsed.mood || null,
              colorPalette: parsed.colorPalette || null,
              layoutStyle: parsed.layoutStyle || null,
              fontPairing: parsed.fontPairing || null,
              decorativeElements: parsed.decorativeElements || []
            };
          }
        }
    } catch (err) {
      console.error('[Category Engine] OpenRouter call failed:', err.message);
    }
  }

  // 3. Try Ollama
  try {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';
    console.log(`[Category Engine] Querying Ollama (${OLLAMA_MODEL}) for category...`);

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: systemPrompt + `\n\nPrompt: "${prompt}"\n\nReturn JSON:`,
      stream: false,
    }, { timeout: 15000 });

    const aiText = response.data?.response?.trim() || '';
    const start = aiText.indexOf('{');
    const end = aiText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        const parsed = JSON.parse(aiText.slice(start, end + 1));
        if (parsed && parsed.category && parsed.template) {
          console.log('[Category Engine] Ollama design brief detected:', parsed.category);
          if (parsed.category === 'Grand Opening' && parsed.template === 'hiring') {
            parsed.template = 'business';
          }
          return {
            category: cleanAndCapitalize(parsed.category),
            template: parsed.template,
            title: parsed.title ? parsed.title.toUpperCase() : null,
            subtitle: parsed.subtitle || null,
            industry: parsed.industry || null,
            audience: parsed.audience || null,
            theme: parsed.theme || null,
            mood: parsed.mood || null,
            colorPalette: parsed.colorPalette || null,
            layoutStyle: parsed.layoutStyle || null,
            fontPairing: parsed.fontPairing || null,
            decorativeElements: parsed.decorativeElements || []
          };
        }
    }
  } catch (err) {
    console.warn('[Category Engine] Ollama call failed:', err.message);
  }

  // 4. Fallback to Heuristic Rules
  console.log('[Category Engine] All AI APIs failed, falling back to heuristics.');
  return getHeuristicCategoryAndTemplate(prompt);
}
