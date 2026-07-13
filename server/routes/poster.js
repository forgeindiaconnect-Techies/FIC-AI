// server/routes/poster.js – Poster Generation, Export and Upload Endpoints
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { generatePosterMetadata, getFallbackPoster, sanitizePosterJSON } from '../utils/posterGeneratorHelper.js';
import { planPosterEdit } from '../utils/posterEditPlanner.js';
import { computeComposition } from '../utils/compositionEngine.js';
import { enhanceUserPrompt } from '../utils/promptEnhancementEngine.js';
import { detectCategoryAndTemplate, getHeuristicCategoryAndTemplate } from '../utils/categoryDetectionEngine.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAIImage } from './image.js';
import Replicate from 'replicate';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const documentsDir = path.join(__dirname, '..', 'uploads', 'documents');

// Ensure uploads/documents exists
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// ── Cloudinary & Multer Configurations ───────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhtv9cjnx',
  api_key: process.env.CLOUDINARY_API_KEY || '921537676448125',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'hxJ2-YG30MV2MN7Vu'
});

const uploadBufferToCloudinary = (buffer, folder = 'fic_posters_backgrounds') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ── POST /api/poster/upload-logo ─────────────────────────────────────────────
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No logo file provided' });
    }

    console.log('[Poster API] Uploading logo to Cloudinary...');
    const uploadStream = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'fic_posters_logos' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    };

    const result = await uploadStream();
    console.log('[Poster API] Logo uploaded successfully to Cloudinary:', result.secure_url);

    return res.json({
      success: true,
      url: result.secure_url
    });
  } catch (err) {
    console.error('[Poster API] Cloudinary upload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper to save image buffer to server's public generated folder and return local URL
function saveBufferToGenerated(buffer, extension = 'png') {
  const filename = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
  const dirPath = path.join(__dirname, '..', 'generated');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, buffer);
  
  return `/generated/${filename}`;
}

// ── Category-Aware Visual Checklists ─────────────────────────────────────────
const VISUAL_CHECKLISTS = {
  'pongal': ['pongal pot', 'sugarcane', 'temple', 'kolam', 'lamps', 'village', 'sunrise'],
  'diwali': ['diya', 'sparkles', 'rangoli', 'lamps', 'gold decoration'],
  'christmas': ['christmas tree', 'ornaments', 'snow', 'gifts', 'lights'],
  'new_year': ['fireworks', 'champagne', 'confetti', 'clock', 'lights'],
  'birthday': ['balloons', 'birthday cake', 'candles', 'confetti', 'sparkles', 'celebration'],
  'anniversary': ['roses', 'rings', 'champagne', 'romantic', 'bokeh', 'hearts'],
  'graduation': ['graduation cap', 'diploma', 'confetti', 'celebration', 'achievement'],
  'wedding': ['flowers', 'rings', 'bride', 'romantic', 'floral', 'celebration'],
  'grand_opening': ['building/store', 'ribbon', 'balloons', 'celebration', 'opening badge'],
  'hiring': ['team', 'office', 'laptop', 'skills', 'career growth'],
  'restaurant': ['food', 'menu', 'offer badge', 'chef'],
  'real_estate': ['luxury villa', 'property', 'landscape', 'premium branding'],
  'education': ['student', 'laptop', 'books', 'certificate', 'learning workspace'],
  'healthcare': ['clinic lobby', 'doctor/wellness', 'medical equipment', 'clean interior'],
  'sale_offer': ['discount badge', 'showcase', 'accent graphics', 'sale tag'],
  'event': ['tech stage', 'spotlight', 'audience seating', 'keynote hall'],
  'product_launch': ['podium stage', 'spotlight glow', 'tech backdrop', 'launching item'],
  'corporate': ['office meeting', 'business people', 'city skyline', 'boardroom'],
  'default': ['clean background', 'professional composition', 'high quality graphics']
};

function getVisualStorytellingPrompt(prompt, category) {
  const lower = prompt.toLowerCase();
  let selectedCategory = category.toLowerCase().replace(/[\s\/]/g, '_');
  
  if (lower.includes('pongal')) selectedCategory = 'pongal';
  else if (lower.includes('diwali')) selectedCategory = 'diwali';
  else if (lower.includes('christmas')) selectedCategory = 'christmas';
  else if (lower.includes('new year')) selectedCategory = 'new_year';
  else if (lower.includes('birthday') || lower.includes('bday')) selectedCategory = 'birthday';
  else if (lower.includes('anniversary')) selectedCategory = 'anniversary';
  else if (lower.includes('graduation')) selectedCategory = 'graduation';
  else if (lower.includes('wedding') || lower.includes('marriage')) selectedCategory = 'wedding';
  
  const STORYTELLING_MAP = {
    'pongal': "A traditional Tamil Pongal harvest festival celebration in a rustic village at sunrise. In the center, a clay Pongal pot sits on a wood-fire stove, with boiling milk and rice gently overflowing. Around the pot are decorated sugarcane stalks, a beautiful colorful kolam rangoli design on the floor, glowing brass oil lamps (diyas), with a traditional village temple silhouette visible against a bright sunrise sky.",
    'diwali': "A glowing Diwali night scene. Traditional clay diyas oil lamps are beautifully arranged, glowing with warm flames. Golden sparkles and fireworks light up the night sky, with a colorful rangoli pattern on the floor and lotus flowers in the background, warm amber festive lighting.",
    'christmas': "A cozy Christmas winter holiday scene. A beautifully decorated Christmas tree with glowing ornaments and fairy lights stands in a room with falling snow outside the window. Festive gift boxes wrapped in red ribbons sit under the tree, creating a warm, joyful atmosphere.",
    'new_year': "A spectacular New Year celebration night scene. Vibrant colorful fireworks fill the sky, with golden confetti rain and sparkler light trails. Elegant champagne glasses stand beside a clock countdown silhouette, glowing celebratory lights.",
    'birthday': "A magical birthday party celebration scene. Colorful balloons in pink, gold, and purple fill the background. A stunning layered birthday cake with glowing candles sits center stage, surrounded by golden confetti and sparkles. Rainbow streamers and festive string lights create a warm, joyful party atmosphere. Beautiful bokeh effect with vibrant pastel colors.",
    'anniversary': "A romantic anniversary celebration scene. Elegant red roses and champagne glasses with golden bokeh lights. Soft warm candlelight illuminates a beautifully set table with rose petals scattered around. Golden shimmer and sparkles create an intimate, luxurious atmosphere.",
    'graduation': "A triumphant graduation celebration scene. A graduation cap tossed in the air surrounded by colorful confetti streamers. Golden stars and sparkles fill the air against a deep navy blue sky. Diploma scroll and achievement ribbons celebrate academic success.",
    'wedding': "An elegant romantic wedding ceremony scene. Beautiful white and blush floral arrangements cascade around a golden arch. Soft bokeh rose petal backdrop with warm fairy lights creates a dreamy atmosphere. Rose petals scattered on the aisle, golden accents and candles.",
    'grand_opening': "A grand opening event scene of a modern retail building storefront. A colorful celebration balloon arch and gold ribbons span the entrance, with gold confetti sparkles and a premium opening badge displayed. Dramatic celebratory lights.",
    'hiring': "A professional corporate office workspace scene. A collaborative team of professionals are sitting around a table with a laptop. A whiteboard shows technical skills keywords, with business indicators representing career growth, warm modern office lighting.",
    'restaurant': "A gourmet culinary scene inside a restaurant kitchen. An expert chef is preparing food, with a beautifully plated dish on a wooden table. A menu card and a special offer badge are displayed beside the dish under warm hanging cafe lights.",
    'real_estate': "A luxury real estate modern residential villa exterior. The premium property facade is framed by a manicured garden landscape and a double gold border, with sunset lighting highlighting the premium branding aesthetic.",
    'education': "A modern education classroom study scene. A student is working at a clean desk with books and a laptop, displaying a graduation certificate on the wall. Subtle grid lines and knowledge icons represent a learning workspace.",
    'healthcare': "A clean modern wellness clinic reception lobby. A professional doctor in a white coat stands near medical equipment, representing healthcare services. Soft blue and teal light fills the clean professional interior.",
    'sale_offer': "An exciting flash sale retail showcase background. A bold discount badge is surrounded by bright accent graphics, floating sale tags, and dynamic burst patterns with confetti, creating a high-energy commercial shopping atmosphere.",
    'event': "An elegant tech conference conclave hall. A dramatic spotlight illuminates the main tech stage and presentation screen. Audience seating frames the keynote hall, creating an innovative event backdrop.",
    'product_launch': "A premium product launch presentation stage. A glowing neon spotlight illuminates a central podium stage. Futuristic tech backdrop elements and a launching item silhouette are shown in a 3D render aesthetic.",
    'corporate': "An executive boardroom office meeting. Business people are collaborating, with a clear view of glass architecture and a city skyline through the window, soft corporate lighting."
  };
  
  const defaultPrompt = `A premium, stunning visual graphic backdrop design themed around: "${prompt}". Clean, high-quality, professional, appropriate colors, minimalist aesthetic, no text inside the image.`;
  return STORYTELLING_MAP[selectedCategory] || defaultPrompt;
}

async function downloadImage(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(resp.data);
}

async function verifyVisualChecklist(imageBuffer, checklist) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Poster API] No GEMINI_API_KEY for checklist verification, skipping check.');
    return 1.0;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/png'
      }
    };
    
    const prompt = `Analyze this image and determine which of the following visual items from the checklist are present in the image scene.
Checklist items to search for: ${checklist.join(', ')}

Return ONLY a valid JSON object matching this schema:
{
  "presentItems": {
    "item_1": true,
    "item_2": false
  }
}`;
    
    const result = await model.generateContent([
      prompt,
      imagePart
    ]);
    
    const response = await result.response;
    const text = response.text().trim();
    console.log('[Poster API] Gemini Vision checklist raw response:', text);
    
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      const presentItems = parsed.presentItems || {};
      
      let presentCount = 0;
      checklist.forEach(item => {
        if (presentItems[item] === true || presentItems[item.toLowerCase()] === true) {
          presentCount++;
        }
      });
      
      const score = presentCount / checklist.length;
      console.log(`[Poster API] Checklist verification score: ${(score * 100).toFixed(1)}% (${presentCount}/${checklist.length} items present)`);
      return score;
    }
  } catch (err) {
    console.error('[Poster API] Gemini Vision checklist verification failed:', err.message);
  }
  return 1.0;
}

async function generateCategoryAwarePosterBackground(prompt, resolvedCategory) {
  const lower = prompt.toLowerCase();
  let checklistKey = resolvedCategory.toLowerCase().replace(/[\s\/]/g, '_');
  if (lower.includes('pongal')) checklistKey = 'pongal';
  else if (lower.includes('diwali')) checklistKey = 'diwali';
  else if (lower.includes('christmas')) checklistKey = 'christmas';
  else if (lower.includes('new year')) checklistKey = 'new_year';
  else if (lower.includes('birthday') || lower.includes('bday')) checklistKey = 'birthday';
  else if (lower.includes('anniversary')) checklistKey = 'anniversary';
  else if (lower.includes('graduation')) checklistKey = 'graduation';
  else if (lower.includes('wedding') || lower.includes('marriage')) checklistKey = 'wedding';
  
  const checklist = VISUAL_CHECKLISTS[checklistKey] || VISUAL_CHECKLISTS['default'];
  const storytellingPrompt = getVisualStorytellingPrompt(prompt, resolvedCategory);
  
  console.log(`[Poster API] Resolved Category: "${resolvedCategory}", Checklist Key: "${checklistKey}"`);
  console.log(`[Poster API] Checklist:`, checklist);
  console.log(`[Poster API] Visual Storytelling Prompt: "${storytellingPrompt}"`);
  
  let attempts = 0;
  let finalImageUrl = null;
  let finalQuery = storytellingPrompt;
  let relevanceScore = 100;
  
  while (attempts < 3) {
    attempts++;
    console.log(`[Poster API] Generating background image (attempt ${attempts}/3)...`);
    
    let currentQuery = storytellingPrompt;
    if (attempts > 1) {
      currentQuery = `${storytellingPrompt}, unique composition, variation ${attempts}, high details, extremely visible ${checklist.join(', ')}`;
    }
    
    const seed = Math.floor(Math.random() * 10000) + (attempts * 100);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(currentQuery)}?width=1080&height=1350&nologo=true&seed=${seed}`;
    console.log(`[Poster API] Pollinations URL: ${pollinationsUrl}`);
    
    try {
      const buffer = await downloadImage(pollinationsUrl);
      const score = await verifyVisualChecklist(buffer, checklist);
      
      if (score >= 0.7 || attempts === 3) {
        try {
          finalImageUrl = await uploadBufferToCloudinary(buffer, 'fic_posters_backgrounds');
          console.log(`[Poster API] Accepted background image uploaded to Cloudinary: ${finalImageUrl}`);
        } catch (cloudinaryErr) {
          console.warn('[Poster API] Background Cloudinary upload failed, using local save:', cloudinaryErr.message);
          finalImageUrl = saveBufferToGenerated(buffer, 'png');
          console.log(`[Poster API] Accepted background image. Local URL: ${finalImageUrl}`);
        }
        relevanceScore = Math.round(score * 100);
        finalQuery = currentQuery;
        break;
      } else {
        console.log(`[Poster API] Image rejected (checklist score ${(score * 100).toFixed(1)}% < 70%). Retrying...`);
      }
    } catch (err) {
      console.warn(`[Poster API] Image attempt ${attempts} failed:`, err.message);
      if (attempts === 3) {
        console.log(`[Poster API] Falling back to Pexels search...`);
        const pexelsResult = await fetchPexelsBackground(prompt, resolvedCategory);
        finalImageUrl = pexelsResult.url;
        relevanceScore = pexelsResult.relevanceScore || 50;
        finalQuery = pexelsResult.query || prompt;
        break;
      }
    }
  }
  
  return {
    url: finalImageUrl,
    relevanceScore,
    query: finalQuery
  };
}

// ── Helper to call Gemini model optionally ────────────────────────────────────
async function callGemini(prompt, detectedCategoryInfo = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Poster API] No GEMINI_API_KEY in environment.');
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    console.log(`[Poster API] Calling Gemini model ${modelName}...`);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
      },
    });

    const systemPrompt = `You are a professional graphic designer and Creative Director AI creating premium Canva Pro-quality marketing posters with rich, detailed copywriter-grade text content.
Design a highly polished visual poster based on the user's prompt. 
Follow these guidelines to provide rich, comprehensive text content (like a high-quality ChatGPT response):
1. "title": Generate a specific, premium business headline/title. NEVER use generic placeholder words like "POSTER", "FLYER", "ADVERTISING", or "AD". Make it a real catchy marketing headline.
2. "subtitle": A compelling supporting copy/subtitle. Must be a rich, descriptive tagline outlining the main value proposition in a highly informative way.
3. "theme": Detect the category of the poster. Set this field to EXACTLY one of: "hiring", "festival", "education", "business", "healthcare", "real_estate", "event", "product_launch".
4. "skills": Provide exactly 3 to 5 highly descriptive bullet points or highlights. Do NOT use short 1-word tags like "React". Instead, write detailed, informative marketing highlights (e.g., "Full-Stack Development with React & Node", "Advanced Database Integration via MongoDB", "Scalable Enterprise REST API Design").
5. "features": Provide exactly 3 to 6 distinct, highly descriptive feature cards. Do not use generic placeholders. Each feature object must have:
   - "title": A short feature header (2-4 words)
   - "desc": Premium detail copy explaining the feature. Must be a complete, high-quality, descriptive sentence that gives concrete details (ChatGPT-range depth).
   - "icon": A matching icon keyword from this set: code, briefcase, award, star, rocket, calendar, graduationcap, shield, users, trendingup, home, building, light, check, info, globe, target, chart, lock, wrench, gears, heart, sparkles, bell
6. Return ONLY a valid JSON object matching the schema. No explanations, no markdown formatting.

JSON Schema:
{
  "title": "Specific business headline / catchy title (uppercase, 2-5 words)",
  "subtitle": "Compelling, detailed subtitle describing value proposition",
  "cta": "Action text, e.g. Get Started, Apply Now, Register, Enroll, Celebrate",
  "theme": "hiring | festival | education | business | healthcare | real_estate | event | product_launch",
  "colorPalette": ["#primary_hex", "#accent_hex", "#bg_hex"],
  "fontPairing": {
    "primary": "Poppins | Playfair Display | Bebas Neue | Montserrat",
    "secondary": "Inter | Montserrat"
  },
  "skills": ["Detailed highlight bullet 1", "Detailed highlight bullet 2", "Detailed highlight bullet 3"],
  "features": [
    { "title": "Feature 1 Title", "desc": "Detailed sentence explaining feature 1 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 2 Title", "desc": "Detailed sentence explaining feature 2 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 3 Title", "desc": "Detailed sentence explaining feature 3 with ChatGPT-range depth.", "icon": "icon_keyword" }
  ],
  "backgroundQuery": "Descriptive keywords for a large background image search (text-free background, no overlay text/words)"
}`;

    let finalPrompt = systemPrompt + `\n\nPrompt: "${prompt}"`;
    if (detectedCategoryInfo) {
      finalPrompt += `\n\nCRITICAL CONTEXT:
1. The detected category is: "${detectedCategoryInfo.category}".
2. You MUST set the "theme" field in the output JSON to "${detectedCategoryInfo.template}".
3. NEVER use "hiring" theme/template under any circumstances for non-hiring requests. Specifically, if the category is Grand Opening, Sale / Offer, Corporate, Restaurant, etc., set the theme to "business".`;
    }

    const result = await model.generateContent([
      { text: finalPrompt }
    ]);
    const response = await result.response;
    const aiText = response.text();
    console.log('[Poster API] Gemini raw response:', aiText);
    const parsed = JSON.parse(aiText);
    if (parsed.title && parsed.subtitle) {
      if (detectedCategoryInfo) {
        if (detectedCategoryInfo.category === 'Grand Opening' && parsed.theme === 'hiring') {
          parsed.theme = 'business';
        }
      }
      return parsed;
    }
  } catch (err) {
    console.error('[Poster API] Gemini call failed:', err.message);
  }
  return null;
}

// ── Helper to call OpenRouter optionally ──────────────────────────────────────
async function callOpenRouter(prompt, detectedCategoryInfo = null) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('[Poster API] No OPENROUTER_API_KEY in environment.');
    return null;
  }
  try {
    console.log('[Poster API] Calling OpenRouter model google/gemini-2.5-flash...');
    const systemPrompt = `You are a professional graphic designer and Creative Director AI creating premium Canva Pro-quality marketing posters with rich, detailed copywriter-grade text content.
Design a highly polished visual poster based on the user's prompt. 
Follow these guidelines to provide rich, comprehensive text content (like a high-quality ChatGPT response):
1. "title": Generate a specific, premium business headline/title. NEVER use generic placeholder words like "POSTER", "FLYER", "ADVERTISING", or "AD". Make it a real catchy marketing headline.
2. "subtitle": A compelling supporting copy/subtitle. Must be a rich, descriptive tagline outlining the main value proposition in a highly informative way.
3. "theme": Detect the category of the poster. Set this field to EXACTLY one of: "hiring", "festival", "education", "business", "healthcare", "real_estate", "event", "product_launch".
4. "skills": Provide exactly 3 to 5 highly descriptive bullet points or highlights. Do NOT use short 1-word tags like "React". Instead, write detailed, informative marketing highlights (e.g., "Full-Stack Development with React & Node", "Advanced Database Integration via MongoDB", "Scalable Enterprise REST API Design").
5. "features": Provide exactly 3 to 6 distinct, highly descriptive feature cards. Do not use generic placeholders. Each feature object must have:
   - "title": A short feature header (2-4 words)
   - "desc": Premium detail copy explaining the feature. Must be a complete, high-quality, descriptive sentence that gives concrete details (ChatGPT-range depth).
   - "icon": A matching icon keyword from this set: code, briefcase, award, star, rocket, calendar, graduationcap, shield, users, trendingup, home, building, light, check, info, globe, target, chart, lock, wrench, gears, heart, sparkles, bell
6. Return ONLY a valid JSON object matching the schema. No explanations, no markdown formatting.

JSON Schema:
{
  "title": "Specific business headline / catchy title (uppercase, 2-5 words)",
  "subtitle": "Compelling, detailed subtitle describing value proposition",
  "cta": "Action text, e.g. Get Started, Apply Now, Register, Enroll, Celebrate",
  "theme": "hiring | festival | education | business | healthcare | real_estate | event | product_launch",
  "colorPalette": ["#primary_hex", "#accent_hex", "#bg_hex"],
  "fontPairing": {
    "primary": "Poppins | Playfair Display | Bebas Neue | Montserrat",
    "secondary": "Inter | Montserrat"
  },
  "skills": ["Detailed highlight bullet 1", "Detailed highlight bullet 2", "Detailed highlight bullet 3"],
  "features": [
    { "title": "Feature 1 Title", "desc": "Detailed sentence explaining feature 1 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 2 Title", "desc": "Detailed sentence explaining feature 2 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 3 Title", "desc": "Detailed sentence explaining feature 3 with ChatGPT-range depth.", "icon": "icon_keyword" }
  ],
  "backgroundQuery": "Descriptive keywords for a large background image search (text-free background, no overlay text/words)"
}`;

    let finalPrompt = systemPrompt + `\n\nPrompt: "${prompt}"`;
    if (detectedCategoryInfo) {
      finalPrompt += `\n\nCRITICAL CONTEXT:
1. The detected category is: "${detectedCategoryInfo.category}".
2. You MUST set the "theme" field in the output JSON to "${detectedCategoryInfo.template}".
3. NEVER use "hiring" theme/template under any circumstances for non-hiring requests. Specifically, if the category is Grand Opening, Sale / Offer, Corporate, Restaurant, etc., set the theme to "business".`;
    }

    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalPrompt }
      ],
      response_format: { type: 'json_object' }
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const content = res.data?.choices?.[0]?.message?.content;
    console.log('[Poster API] OpenRouter raw response:', content);
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.title && parsed.subtitle) {
        if (detectedCategoryInfo) {
          if (detectedCategoryInfo.category === 'Grand Opening' && parsed.theme === 'hiring') {
            parsed.theme = 'business';
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Poster API] OpenRouter call failed:', err.message);
  }
  return null;
}

// ── AI Coordinator ───────────────────────────────────────────────────────────
async function callAIForPoster(prompt, detectedCategoryInfo = null) {
  let result = await callGemini(prompt, detectedCategoryInfo);
  if (!result) {
    result = await callOpenRouter(prompt, detectedCategoryInfo);
  }
  return result;
}

// ── Poster Topic Extractor ───────────────────────────────────────────────────
function extractPosterTopic(prompt) {
  const clean = prompt.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Look for specific patterns
  const hiringMatch = clean.match(/(?:hiring|recruit|looking for|vacancy for)\s+([a-z0-9\s\-]+?)(?:\s+poster|\s+with|\s+to|\s+skills|\.|$)/i);
  if (hiringMatch && hiringMatch[1]) {
    return hiringMatch[1].trim();
  }
  
  const celebrationMatch = clean.match(/(?:celebration|festival|greetings|wishes|celebrate)\s+([a-z0-9\s\-]+?)(?:\s+poster|\s+card|\.|$)/i);
  if (celebrationMatch && celebrationMatch[1]) {
    return celebrationMatch[1].trim();
  }
  
  const diwaliMatch = clean.match(/(diwali|christmas|pongal|eid|halloween|thanksgiving)/i);
  if (diwaliMatch && diwaliMatch[1]) {
    return diwaliMatch[1].trim();
  }
  
  const courseMatch = clean.match(/(?:course|training|class|workshop|academy|bootcamp)\s+(?:on|for)?\s*([a-z0-9\s\-]+?)(?:\s+poster|\.|$)/i);
  if (courseMatch && courseMatch[1]) {
    return courseMatch[1].trim();
  }

  const estateMatch = clean.match(/(?:real estate|property|apartment|villa|house|building|home)\s+([a-z0-9\s\-]+?)(?:\s+poster|\.|$)/i);
  if (estateMatch && estateMatch[1]) {
    return estateMatch[1].trim();
  }

  // General fallback: remove common stop words and return the top 2-3 significant words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'of', 'to', 'with', 'for', 'is', 'at', 'on', 'are', 
    'this', 'your', 'our', 'my', 'we', 'you', 'looking', 'hiring', 'poster', 'design', 'flyer',
    'banner', 'create', 'make', 'generate', 'premium', 'modern', 'elegant', 'vibrant', 'creative'
  ]);
  
  const words = clean.split(' ').filter(w => !stopWords.has(w) && w.length > 2);
  if (words.length > 0) {
    return words.slice(0, 3).join(' ');
  }
  
  return 'business';
}

// ── Dynamic Keyword Generator (generates 5-10 terms) ─────────────────────────
function generateDynamicKeywords(topic, category) {
  const topicWords = topic.split(' ').filter(w => w.length > 2);
  const keywords = [];
  
  // 1. Add topic words directly
  topicWords.forEach(word => {
    keywords.push(word);
  });
  
  // 2. Add category specific combinations (ensuring 5-10 keywords)
  if (category === 'festival') {
    keywords.push('festival', 'lights', 'celebration', 'sparkles', 'glowing');
    topicWords.forEach(w => {
      keywords.push(`${w} celebration`, `${w} festival`, `${w} lights`);
    });
  } else if (category === 'hiring') {
    keywords.push('office', 'developer', 'team', 'coding', 'workspace', 'laptop');
    topicWords.forEach(w => {
      keywords.push(`${w} developer`, `${w} engineer`, `${w} office`);
    });
  } else if (category === 'realestate') {
    keywords.push('building', 'property', 'apartment', 'architecture', 'luxury', 'residential');
    topicWords.forEach(w => {
      keywords.push(`${w} house`, `${w} property`, `${w} building`);
    });
  } else if (category === 'education') {
    keywords.push('student', 'classroom', 'learning', 'education', 'books', 'classroom desk');
    topicWords.forEach(w => {
      keywords.push(`${w} study`, `${w} class`, `${w} course`);
    });
  } else {
    keywords.push('corporate', 'office', 'business', 'presentation', 'growth', 'finance');
    topicWords.forEach(w => {
      keywords.push(`${w} business`, `${w} corporate`);
    });
  }
  
  const uniqueKws = [...new Set(keywords)].map(k => k.toLowerCase()).filter(k => k.trim());
  return uniqueKws.slice(0, 10);
}

// ── Pexels Image Relevancy Ranker ──────────────────────────────────────────────
function rankPexelsImages(photos, prompt, category, dynamicKeywords) {
  const lowerPrompt = prompt.toLowerCase();
  
  const positiveKeywords = {
    hiring: ['office', 'developer', 'work', 'team', 'coding', 'programmer', 'workspace', 'computer', 'meeting', 'laptop', 'developer coding', 'collaborate', 'business meeting'],
    festival: ['diwali', 'festival', 'lights', 'celebration', 'diyas', 'glowing', 'christmas', 'holiday', 'pongal', 'harvest', 'traditional', 'sparkles', 'festive lights'],
    realestate: ['apartment', 'building', 'house', 'home', 'property', 'architecture', 'luxury', 'interior', 'exterior', 'estate', 'residential', 'luxury apartment'],
    education: ['student', 'classroom', 'study', 'learn', 'books', 'education', 'school', 'college', 'lecture', 'class', 'classroom workspace'],
    business: ['business', 'office', 'corporate', 'meeting', 'finance', 'analytics', 'growth', 'marketing', 'presentation']
  };

  const negativeKeywords = {
    hiring: ['cat', 'dog', 'animal', 'scenery', 'nature', 'forest', 'beach', 'mountain', 'food', 'flowers', 'wildlife', 'scenic view'],
    festival: ['office', 'computer', 'desk', 'workspace', 'laptop', 'corporate', 'business meeting', 'developer coding'],
    realestate: ['forest', 'ocean', 'animal', 'people', 'food', 'flowers', 'beach', 'nature'],
    education: ['party', 'construction', 'beach', 'industry', 'factory', 'travel'],
    business: ['scenery', 'animal', 'beach', 'nature', 'forest']
  };

  // Enforce categories contain category-specific terms
  const categoryMustMatch = {
    festival: ['festival', 'lights', 'celebration', 'diyas', 'glowing', 'christmas', 'holiday', 'pongal', 'harvest', 'traditional', 'sparkles', 'decorations', 'wishes', 'eid', 'sparkler', 'festive'],
    hiring: ['office', 'developer', 'work', 'team', 'coding', 'programmer', 'workspace', 'computer', 'meeting', 'laptop', 'collaborate', 'business', 'people', 'desk', 'professional'],
    realestate: ['apartment', 'building', 'house', 'home', 'property', 'architecture', 'luxury', 'interior', 'exterior', 'estate', 'residential', 'villa', 'structure', 'construction'],
    education: ['student', 'classroom', 'study', 'learn', 'books', 'education', 'school', 'college', 'lecture', 'class', 'library', 'studying', 'learning', 'university']
  };

  const posWords = positiveKeywords[category] || [];
  const negWords = negativeKeywords[category] || [];
  const mustMatchWords = categoryMustMatch[category] || [];

  let bestPhoto = null;
  let maxScore = -1;

  for (const photo of photos) {
    const alt = (photo.alt || '').toLowerCase();
    const tags = Array.isArray(photo.tags) ? photo.tags.map(t => t.toLowerCase()) : [];
    const textToAnalyze = `${alt} ${tags.join(' ')}`;

    let score = 60; // base score

    // Boost score for matching dynamic keywords
    dynamicKeywords.forEach(word => {
      if (textToAnalyze.includes(word)) {
        score += 10;
      }
    });

    // Boost score for matching positive keywords
    posWords.forEach(word => {
      if (textToAnalyze.includes(word)) {
        score += 8;
      }
      if (lowerPrompt.includes(word)) {
        score += 4;
      }
    });

    // Penalize score for matching negative keywords
    negWords.forEach(word => {
      if (textToAnalyze.includes(word)) {
        score -= 35;
      }
    });

    // CRITICAL: Reject if image lacks mandatory category keywords
    if (mustMatchWords.length > 0) {
      const matchesCategory = mustMatchWords.some(word => textToAnalyze.includes(word));
      if (!matchesCategory) {
        score -= 55; // Dock heavily to force rejection
      }
    }

    // Cap score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    if (score > maxScore) {
      maxScore = score;
      bestPhoto = photo;
    }
  }

  // Reject if score is too low
  if (maxScore < 50) {
    console.warn(`[Image Engine] Best image rejected due to low relevance score: ${maxScore}`);
    return { photo: null, score: maxScore };
  }

  return { photo: bestPhoto, score: maxScore };
}

// ── Fetch background image from Pexels API with topic checking and ranking ──────────────────
// Helper to generate background images based on IMAGE_PROVIDER (Pollinations, Hugging Face FLUX, or Pexels)
async function generateBackgroundImage(searchQuery, userPrompt = '') {
  // Force pollinations public endpoint as requested by user
  const provider = 'pollinations';
  console.log(`[Image Engine] Generating background using IMAGE_PROVIDER: ${provider} with query: "${searchQuery}"`);
  
  // Omit flat texture keywords for rich layouts (grand opening, festival, launch, showcase)
  const isRichLayout = searchQuery.includes('opening') || searchQuery.includes('luxury') || searchQuery.includes('festival') || searchQuery.includes('celebration') || searchQuery.includes('podium') || searchQuery.includes('stage');
  const flatKeywords = isRichLayout ? '' : 'texture background, empty background, copy space, ';
  
  const textlessQuery = `${searchQuery}, ${flatKeywords}premium poster background, beautiful composition, photorealistic, realistic photography, DSLR camera, natural lighting, ultra detailed, sharp focus, 4k quality, professional photo`;
  
  if (provider === 'pollinations') {
    try {
      // Use exact aspect ratio 1080x1350 matching our portrait poster canvas
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(textlessQuery)}?width=1080&height=1350&nologo=true`;
      console.log(`ORIGINAL PROMPT: ${userPrompt || searchQuery}`);
      console.log(`ENHANCED PROMPT: ${textlessQuery}`);
      console.log(`POLLINATIONS URL: ${url}`);
      
      const pollResponse = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000
      });
      if (pollResponse.status === 200 && pollResponse.data && pollResponse.data.length > 0) {
        console.log(`IMAGE LOADED: true`);
        const localUrl = saveBufferToGenerated(Buffer.from(pollResponse.data), 'png');
        return { url: localUrl, relevanceScore: 100, query: textlessQuery };
      } else {
        console.log(`IMAGE LOADED: false`);
      }
    } catch (err) {
      console.log(`IMAGE LOADED: false`);
      console.warn(`[Image Engine] Pollinations background generation failed:`, err.message);
    }
  } else if (provider === 'huggingface' || provider === 'flux') {
    if (process.env.HF_API_KEY) {
      try {
        console.log('IMAGE REQUEST START: HuggingFace FLUX background');
        const hfModel = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
        const response = await axios.post(
          `https://router.huggingface.co/hf-inference/models/${hfModel}`,
          { inputs: textlessQuery },
          {
            headers: {
              Authorization: `Bearer ${process.env.HF_API_KEY}`,
              Accept: 'image/png'
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );
        console.log('IMAGE REQUEST SUCCESS: HuggingFace FLUX background');
        const localUrl = saveBufferToGenerated(Buffer.from(response.data), 'png');
        return { url: localUrl, relevanceScore: 100, query: textlessQuery };
      } catch (hfError) {
        console.error('[Image Engine] Hugging Face FLUX failed:', hfError.message);
      }
    }
  }

  // Fallback to Pexels search
  console.log(`[Image Engine] Falling back to Pexels search for query: "${searchQuery}"`);
  const apiKey = process.env.PEXELS_API_KEY;
  if (apiKey) {
    try {
      const res = await axios.get('https://api.pexels.com/v1/search', {
        params: { query: searchQuery, per_page: 15 },
        headers: { Authorization: apiKey },
        timeout: 10000
      });
      const photos = res.data?.photos || [];
      if (photos.length > 0) {
        const selectedPhoto = photos[0];
        const imgUrl = selectedPhoto.src?.original || selectedPhoto.src?.large2x || selectedPhoto.src?.large;
        return { url: imgUrl, relevanceScore: 80, query: searchQuery };
      }
    } catch (pexError) {
      console.error('[Image Engine] Pexels fallback search failed:', pexError.message);
    }
  }

  return { url: null, relevanceScore: 0, query: searchQuery };
}

// ── Fetch background image from Pexels API with topic checking and ranking ──────────────────
// ── Fetch background image from Pexels API with topic checking and ranking ──────────────────
async function fetchPexelsBackground(prompt, category) {
  // 1. Extract poster topic dynamically
  const topic = extractPosterTopic(prompt);
  console.log(`[Image Engine] Extracted topic: "${topic}"`);

  // 2. Generate 5-10 keywords dynamically
  const dynamicKeywords = generateDynamicKeywords(topic, category);
  console.log(`[Image Engine] Generated keywords:`, dynamicKeywords);

  // 3. Construct a specific search query based on category and topic
  const lowerPrompt = prompt.toLowerCase();
  let searchQuery = topic;
  if (lowerPrompt.includes('grand opening') || lowerPrompt.includes('luxury') || category === 'luxury' || category === 'grand_opening') {
    searchQuery = `luxury grand opening event backdrop, elegant gold frame border, gold balloons, red ribbons, stage lights glow, gold confetti sparkles, soft warm glow background, premium festive styling`;
  } else if (category === 'festival') {
    searchQuery = `${topic} festive celebration background, glowing oil lamps, traditional decorative lights, golden sparkles, luxury holiday backdrop`;
  } else if (category === 'hiring') {
    searchQuery = `modern aesthetic creative office workspace background, warm soft lighting, computer setup, desk plants, copy space`;
  } else if (category === 'realestate' || category === 'real_estate') {
    searchQuery = `luxury modern residential building exterior, premium estate architectural design, beautiful garden lawn landscaping, warm sunset light`;
  } else if (category === 'education') {
    searchQuery = `creative studying classroom desk, modern education workspace, books, warm glowing ambient light`;
  } else if (category === 'healthcare') {
    searchQuery = `modern luxury medical clinic reception lobby, clean wellness center, soft warm lights, professional corporate wellness space`;
  } else if (category === 'product_launch') {
    searchQuery = `futuristic luxury product presentation podium stage, neon spotlight glow, premium launching backdrop, 3d render aesthetic`;
  } else if (category === 'event') {
    searchQuery = `elegant tech conference hall stage, presentation screen spotlight, audience seating backdrop, corporate event venue`;
  } else {
    searchQuery = `modern corporate office executive boardroom, clean glass architecture skyscrapers window view, soft business ambient light`;
  }

  // 4. Try AI/IMAGE_PROVIDER background generation
  const pexelsResult = await generateBackgroundImage(searchQuery, prompt);
  return pexelsResult;
}

// ── Rule-based Local Fallback Layout Generator ────────────────────────────────
function getLocalFallbackPoster(userPrompt) {
  const categoryInfo = getHeuristicCategoryAndTemplate(userPrompt);
  const lower = userPrompt.toLowerCase();
  
  // Use the detected template/theme as intent
  let intent = categoryInfo.template;
  let title = categoryInfo.title;
  let subtitle = categoryInfo.subtitle;

  // ── Birthday / Personal Occasion ──────────────────────────────────────────
  if (categoryInfo.category === 'Birthday') {
    const isBday = lower.includes('birthday') || lower.includes('bday');
    const isAnniv = lower.includes('anniversary');
    const isGrad = lower.includes('graduation');
    const isWedding = lower.includes('wedding') || lower.includes('marriage');
    const isFarewell = lower.includes('farewell') || lower.includes('retirement');

    if (isAnniv) {
      return {
        title: title || 'HAPPY ANNIVERSARY',
        subtitle: subtitle || 'Celebrating Love & Togetherness',
        cta: 'Celebrate With Us',
        theme: 'birthday',
        skills: ['Cherished Memories', 'Years of Love', 'Forever Together'],
        features: [
          { title: 'Years Together', desc: 'Celebrating this beautiful journey.', icon: 'heart' },
          { title: 'Love & Happiness', desc: 'May joy always be with you.', icon: 'sparkles' },
          { title: 'Memories Forever', desc: 'Moments that last a lifetime.', icon: 'star' }
        ],
        backgroundQuery: 'romantic anniversary roses champagne golden bokeh background'
      };
    }
    if (isGrad) {
      return {
        title: title || 'CONGRATULATIONS GRADUATE',
        subtitle: subtitle || 'Your Achievement Shines Bright',
        cta: 'Congratulations',
        theme: 'birthday',
        skills: ['Academic Excellence', 'New Beginnings', 'Bright Future Ahead'],
        features: [
          { title: 'Achievement', desc: 'A milestone worth celebrating.', icon: 'award' },
          { title: 'New Journey', desc: 'The world awaits your brilliance.', icon: 'rocket' },
          { title: 'Proud Moment', desc: 'Celebrate this incredible accomplishment.', icon: 'sparkles' }
        ],
        backgroundQuery: 'graduation cap diploma confetti gold sparkles celebration background'
      };
    }
    if (isWedding) {
      return {
        title: title || 'WEDDING CELEBRATION',
        subtitle: subtitle || 'Two Hearts, One Beautiful Journey',
        cta: 'Join the Celebration',
        theme: 'birthday',
        skills: ['Eternal Love', 'Beautiful Ceremony', 'Joyous Celebration'],
        features: [
          { title: 'Forever Together', desc: 'A love story beginning today.', icon: 'heart' },
          { title: 'Sacred Union', desc: 'Two souls becoming one.', icon: 'sparkles' },
          { title: 'Celebration', desc: 'Surrounded by family and love.', icon: 'users' }
        ],
        backgroundQuery: 'elegant wedding floral arch romantic bokeh pink gold background'
      };
    }
    if (isFarewell) {
      return {
        title: title || 'FAREWELL & BEST WISHES',
        subtitle: subtitle || 'Thank You for the Beautiful Journey',
        cta: 'Best Wishes',
        theme: 'birthday',
        skills: ['Cherished Memories', 'Great Achievements', 'New Adventures Ahead'],
        features: [
          { title: 'Thank You', desc: 'Gratitude for every moment shared.', icon: 'heart' },
          { title: 'Great Journey', desc: 'Achievements that inspire us all.', icon: 'award' },
          { title: 'New Chapter', desc: 'Exciting adventures lie ahead.', icon: 'rocket' }
        ],
        backgroundQuery: 'farewell golden confetti bokeh warm sunset appreciation background'
      };
    }
    // Default Birthday
    const nameMatch = userPrompt.match(/(?:birthday|bday)\s+(?:for|of|to)?\s*([a-zA-Z]+)/i);
    const name = nameMatch ? nameMatch[1] : null;
    return {
      title: name ? `HAPPY BIRTHDAY ${name.toUpperCase()}` : (title || 'HAPPY BIRTHDAY'),
      subtitle: subtitle || 'Wishing You a Day Full of Magic & Joy',
      cta: 'Make a Wish',
      theme: 'birthday',
      skills: ['Joyful Celebrations', 'Wonderful Surprises', 'Beautiful Memories'],
      features: [
        { title: 'Special Day', desc: 'Celebrating you with all our love.', icon: 'heart' },
        { title: 'Birthday Magic', desc: 'May all your wishes come true.', icon: 'sparkles' },
        { title: 'Joy & Happiness', desc: 'Here\'s to another amazing year.', icon: 'star' }
      ],
      backgroundQuery: 'birthday party colorful balloons cake candles confetti sparkles vibrant celebration background'
    };
  }

  if (categoryInfo.category === 'Grand Opening') {
    return {
      title,
      subtitle: subtitle || 'Join Us for the Celebration',
      cta: 'Join Us',
      theme: 'business',
      skills: ['Exclusive Launch Deals', 'Meet Our Team', 'Inaugural Celebrations'],
      features: [
        { title: 'Special Inauguration', desc: 'Celebrating our new location.', icon: 'sparkles' },
        { title: 'Welcome Gift', desc: 'Special treats for first-day visitors.', icon: 'award' },
        { title: 'Meet the Founders', desc: 'Get to know our vision and team.', icon: 'users' }
      ],
      backgroundQuery: 'grand opening ribbon cutting ceremony background'
    };
  }

  if (categoryInfo.category === 'Restaurant') {
    return {
      title,
      subtitle: subtitle || 'Experience Premium Fine Dining',
      cta: 'Book Table',
      theme: 'business',
      skills: ['Delicious Cuisine', 'Cozy Ambience', 'Expert Chefs'],
      features: [
        { title: 'Signature Dishes', desc: 'Curated by award-winning chefs.', icon: 'heart' },
        { title: 'Fresh Ingredients', desc: 'Sourced daily from local farms.', icon: 'star' },
        { title: 'Premium Dining', desc: 'Unforgettable culinary journey.', icon: 'award' }
      ],
      backgroundQuery: 'restaurant food chef fine dining background'
    };
  }

  if (categoryInfo.category === 'Corporate') {
    return {
      title,
      subtitle: subtitle || 'Driving Premium Business Value',
      cta: 'Get Started',
      theme: 'business',
      skills: ['Enterprise Scalability', 'Advanced AI Analytics', 'Strategic Consulting'],
      features: [
        { title: 'Strategic Roadmap', desc: 'Transforming legacy operations.', icon: 'briefcase' },
        { title: 'AI Automation', desc: 'Boosting process efficiency.', icon: 'gears' },
        { title: 'Expert Consultants', desc: 'Dedicated team of professionals.', icon: 'shield' }
      ],
      backgroundQuery: 'corporate clean office desk background'
    };
  }

  if (categoryInfo.category === 'Sale / Offer') {
    return {
      title,
      subtitle: subtitle || 'Limited Time Discount Deals',
      cta: 'Claim Offer',
      theme: 'business',
      skills: ['Up to 50% Off', 'Exclusive Discounts', 'Limited Stock'],
      features: [
        { title: 'Special Deals', desc: 'Unbeatable price reduction today.', icon: 'trendingup' },
        { title: 'Flash Discount', desc: 'Valid for the first 100 orders.', icon: 'rocket' },
        { title: 'Premium Quality', desc: 'Top tier items at lowest prices.', icon: 'award' }
      ],
      backgroundQuery: 'sales discount shopping tags background'
    };
  }

  if (intent === 'festival') {
    let query = 'festive lights celebration background';
    if (lower.includes('diwali')) {
      query = 'diwali diyas festival gold background';
    } else if (lower.includes('christmas')) {
      query = 'christmas tree snow festive background';
    } else if (lower.includes('pongal')) {
      query = 'pongal sugarcane harvest background';
    }

    return {
      title,
      subtitle: subtitle || 'Wishing you peace, prosperity, and joy',
      cta: 'Celebrate',
      theme: 'festival',
      skills: ['Light & Prosperity', 'Sweet Moments', 'Joyous Celebrations'],
      features: [
        { title: 'Light & Prosperity', desc: 'May success shine bright.', icon: 'star' },
        { title: 'Sweet Moments', desc: 'Joyous sharing with friends.', icon: 'award' },
        { title: 'New Beginnings', desc: 'Exciting journeys ahead.', icon: 'rocket' }
      ],
      backgroundQuery: query
    };
  }

  if (intent === 'education') {
    return {
      title,
      subtitle: subtitle || 'Upgrade your skills with our expert bootcamp',
      cta: 'Enroll Now',
      theme: 'education',
      skills: ['Hands-on Sandbox Labs', '1-on-1 Mentor Reviews', 'Certification on Completion'],
      features: [
        { title: 'Hands-on Labs', desc: 'Learn by coding real apps.', icon: 'code' },
        { title: '1-on-1 Mentorship', desc: 'Direct review from experts.', icon: 'briefcase' },
        { title: 'Certification', desc: 'Verifiable proof of skills.', icon: 'award' }
      ],
      backgroundQuery: 'classroom workspace books laptop background'
    };
  }

  if (intent === 'real_estate') {
    return {
      title,
      subtitle: subtitle || 'Find your dream luxury home today',
      cta: 'View Property',
      theme: 'real_estate',
      skills: ['Prime Location', 'Premium Amenities', 'Flexible Finance'],
      features: [
        { title: 'Prime Location', desc: 'Close to city center & parks.', icon: 'home' },
        { title: 'Premium Amenities', desc: 'Swimming pool, gym & 24/7 security.', icon: 'award' },
        { title: 'Flexible Finance', desc: 'Easy EMI options available.', icon: 'trendingup' }
      ],
      backgroundQuery: 'modern villa exterior green lawn copy space'
    };
  }

  if (intent === 'healthcare') {
    return {
      title,
      subtitle: subtitle || 'Your health and safety is our top priority',
      cta: 'Book Appointment',
      theme: 'healthcare',
      skills: ['24/7 Emergency Care', 'Certified Doctors', 'Modern Diagnostics'],
      features: [
        { title: 'Emergency Care', desc: 'Instant support when you need it.', icon: 'heart' },
        { title: 'Certified Doctors', desc: 'Expert medical consultation.', icon: 'shield' },
        { title: 'Modern Labs', desc: 'High precision diagnostics.', icon: 'gears' }
      ],
      backgroundQuery: 'clinic hospital lobby interior copy space'
    };
  }

  if (intent === 'product_launch') {
    return {
      title,
      subtitle: subtitle || 'Experience futuristic speed and elegance',
      cta: 'Pre-Order Now',
      theme: 'product_launch',
      skills: ['Quantum Processor', 'OLED Display', 'Supercharge Battery'],
      features: [
        { title: 'Quantum Speed', desc: 'Fastest chip in the market.', icon: 'rocket' },
        { title: 'OLED Display', desc: 'Vibrant colors and contrasts.', icon: 'sparkles' },
        { title: 'Supercharge', desc: 'Charge to 80% in 15 minutes.', icon: 'light' }
      ],
      backgroundQuery: 'futuristic product showcase neon dark background'
    };
  }

  if (intent === 'event') {
    return {
      title,
      subtitle: subtitle || 'Unlocking intelligent developer solutions',
      cta: 'Register Now',
      theme: 'event',
      skills: ['Keynote Sessions', 'Developer Workshops', 'Networking Lounge'],
      features: [
        { title: 'Keynote Panel', desc: 'Hear from industry leaders.', icon: 'users' },
        { title: 'Live Workshops', desc: 'Guided interactive builds.', icon: 'graduationcap' },
        { title: 'Networking Lounge', desc: 'Connect with developers.', icon: 'briefcase' }
      ],
      backgroundQuery: 'modern tech conference stage lights background'
    };
  }

  if (intent === 'business') {
    return {
      title,
      subtitle: subtitle || 'Premium services at unbeatable value',
      cta: 'Claim Offer',
      theme: 'business',
      skills: ['Up to 50% discount', 'Dedicated agent support', 'Full API integrations'],
      features: [
        { title: '50% Launch Discount', desc: 'Limited early access offer.', icon: 'trendingup' },
        { title: 'Dedicated Support', desc: '24/7 agentic coding help.', icon: 'shield' },
        { title: 'Full API Access', desc: 'Seamless system integration.', icon: 'code' }
      ],
      backgroundQuery: 'corporate clean office desk background'
    };
  }

  // Default to hiring
  let skills = ['React', 'Node.js', 'Express', 'MongoDB'];
  const devMatch = userPrompt.match(/(?:hiring|looking for)\s+([a-zA-Z0-9\s\-]+?)(?:\s+poster|\s+with|\s+to|\s+skills|\.|$)/i);
  if (devMatch && devMatch[1]) {
    title = devMatch[1].trim().toUpperCase();
  }

  return {
    title: title || 'MERN STACK DEVELOPER',
    subtitle: subtitle || 'We are hiring talented professionals',
    cta: 'Apply Now',
    theme: 'hiring',
    skills,
    features: [
      { title: 'Modern Stack', desc: 'Work with React, Node & Fabric.', icon: 'code' },
      { title: 'Paid Perks', desc: 'Competitive stipend & insurance.', icon: 'briefcase' },
      { title: 'Great Culture', desc: 'A creative collaborative hub.', icon: 'users' }
    ],
    backgroundQuery: 'modern office developer coding'
  };
}

// Helper to generate both poster metadata and the background image (for backwards compatibility/chat)
export async function generatePosterMetadataAndImage(userPrompt, model = 'openai', resolution = '4k') {
  let posterDataObj = null;
  try {
    posterDataObj = await generatePosterMetadata(userPrompt);
  } catch (err) {
    console.warn('[Poster API] AI Generation failed in generatePosterMetadataAndImage, using fallback:', err.message);
    posterDataObj = getFallbackPoster(userPrompt);
  }


  // Fetch background image from Pexels API
  let backgroundImageUrl = null;
  let backgroundType = 'image';

  const resolveCategory = (themeName, prompt = '') => {
    const t = (themeName || 'hiring').toLowerCase();
    const p = prompt.toLowerCase();
    // Birthday takes highest priority - check prompt directly
    if (p.includes('birthday') || p.includes('bday') || p.includes('anniversary') || p.includes('graduation') || p.includes('wedding') || p.includes('marriage') || p.includes('farewell') || p.includes('retirement') || t.includes('birthday')) return 'birthday';
    if (t.includes('festival') || t.includes('diwali') || t.includes('celebration') || t.includes('christmas') || t.includes('pongal') || t.includes('wishes')) return 'festival';
    if (t.includes('course') || t.includes('education') || t.includes('academy') || t.includes('learn') || t.includes('study')) return 'education';
    if (t.includes('realestate') || t.includes('real_estate') || t.includes('building') || t.includes('home') || t.includes('property') || t.includes('estate')) return 'real_estate';
    if (t.includes('healthcare') || t.includes('medical') || t.includes('health') || t.includes('clinic') || t.includes('doctor') || t.includes('hospital')) return 'healthcare';
    if (t.includes('product_launch') || t.includes('product launch') || t.includes('launch') || t.includes('new product') || t.includes('showcase')) return 'product_launch';
    if (t.includes('event') || t.includes('summit') || t.includes('conference') || t.includes('seminar') || t.includes('meetup') || t.includes('webinar')) return 'event';
    if (t.includes('grand') || t.includes('opening') || t.includes('luxury')) return 'luxury';
    if (t.includes('business') || t.includes('corporate') || t.includes('sale') || t.includes('offer')) return 'business';
    return 'hiring';
  };

  const category = resolveCategory(posterDataObj.theme, userPrompt);
  const pexelsResult = await generateCategoryAwarePosterBackground(userPrompt, category);
  backgroundImageUrl = pexelsResult.url;

  if (!backgroundImageUrl) {
    backgroundType = 'gradient';
  }

  posterDataObj.backgroundImageUrl = backgroundImageUrl;
  posterDataObj.backgroundType = backgroundType;

  // Run Visual Spacing and Layout Engine
  computeComposition(posterDataObj);

  // Old code expects: poster.heading, poster.subheading, poster.bullets, etc.
  // We populate both old and new layout formats for complete interoperability
  const mappedPoster = {
    ...posterDataObj,
    heading: posterDataObj.title,
    subheading: posterDataObj.subtitle,
    bullets: posterDataObj.skills,
    cta: posterDataObj.cta,
    colors: posterDataObj.theme === 'festival' ? ['#1F0C2C', '#FFD700', '#F97316'] :
            posterDataObj.theme === 'education' || posterDataObj.theme === 'course' ? ['#060B18', '#3B82F6', '#10B981'] :
            posterDataObj.theme === 'real_estate' || posterDataObj.theme === 'realestate' ? ['#0F1A1C', '#10B981', '#F59E0B'] :
            posterDataObj.theme === 'healthcare' ? ['#081C1B', '#0EA5E9', '#14B8A6'] :
            posterDataObj.theme === 'product_launch' ? ['#0A0B10', '#F43F5E', '#3B82F6'] :
            posterDataObj.theme === 'event' ? ['#0F0922', '#EC4899', '#8B5CF6'] :
            posterDataObj.theme === 'business' ? ['#080C14', '#D97706', '#3B82F6'] :
            ['#090D1A', '#06B6D4', '#7C3AED'],
    typography: { primary: 'Montserrat', secondary: 'Inter' }
  };

  return { 
    poster: mappedPoster, 
    backgroundImageUrl, 
    finalOpenAIPrompt: pexelsResult.query,
    imageQuery: pexelsResult.query,
    imageCategory: category,
    relevanceScore: pexelsResult.relevanceScore,
    imageGenerationError: null 
  };
}

// ── GET /api/poster/test-category-engine ──────────────────────────────────────
let testRunning = false;
router.get('/test-category-engine', async (req, res) => {
  if (testRunning) {
    return res.json({ success: true, status: 'already_running', message: 'Tests are already in progress. Check /api/poster/test-category-results' });
  }

  testRunning = true;
  const testPrompts = [
    {
      prompt: "Grand Opening of Forge India Connect",
      expectedCategory: "Grand Opening",
      shouldNotBeHiring: true
    },
    {
      prompt: "We are hiring MERN Stack Developers",
      expectedCategory: "Hiring",
      shouldNotBeHiring: false
    },
    {
      prompt: "Happy Diwali",
      expectedCategory: "Festival",
      shouldNotBeHiring: true
    },
    {
      prompt: "50% discount on all courses today",
      expectedCategory: "Sale / Offer",
      shouldNotBeHiring: true
    },
    {
      prompt: "Exclusive Restaurant grand opening",
      expectedCategory: "Restaurant",
      shouldNotBeHiring: true
    }
  ];

  // Run tests in the background
  (async () => {
    console.log('[Test Runner] Starting background test execution...');
    const results = [];
    let successCount = 0;

    for (const item of testPrompts) {
      console.log(`[Test Runner] Testing prompt: "${item.prompt}"`);
      try {
        const detection = await detectCategoryAndTemplate(item.prompt);
        const metadata = await generatePosterMetadata(item.prompt);

        let pass = true;
        let reason = 'OK';

        if (item.shouldNotBeHiring && detection.template === 'hiring') {
          pass = false;
          reason = `Hiring template used for non-hiring prompt`;
        } else if (item.shouldNotBeHiring && detection.category === 'Hiring') {
          pass = false;
          reason = `Hiring category used for non-hiring prompt`;
        } else if (item.shouldNotBeHiring && (metadata.layoutType === 'hiring-poster' || metadata.layoutType === 'split-hero')) {
          pass = false;
          reason = `Hiring layoutType (${metadata.layoutType}) used for non-hiring prompt`;
        }

        if (pass) {
          successCount++;
        }

        results.push({
          prompt: item.prompt,
          detection,
          layoutType: metadata.layoutType,
          pass,
          reason
        });
      } catch (err) {
        console.error(`[Test Runner] Error testing prompt "${item.prompt}":`, err.message);
        results.push({
          prompt: item.prompt,
          error: err.message,
          pass: false,
          reason: 'Execution error'
        });
      }
    }

    const output = {
      success: true,
      timestamp: new Date().toISOString(),
      total: testPrompts.length,
      passed: successCount,
      results
    };

    const outputPath = path.join(__dirname, '..', 'test_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('[Test Runner] Tests complete. Written results to:', outputPath);
    testRunning = false;
  })().catch(err => {
    console.error('[Test Runner] Uncaught error in tests:', err);
    testRunning = false;
  });

  return res.json({
    success: true,
    status: 'started',
    message: 'Tests started in the background. Please poll /api/poster/test-category-results or view test_results.json'
  });
});

// ── GET /api/poster/test-heuristics ─────────────────────────────────────────
router.get('/test-heuristics', (req, res) => {
  const testPrompts = [
    {
      prompt: "Grand Opening of Forge India Connect",
      expectedCategory: "Grand Opening",
      shouldNotBeHiring: true
    },
    {
      prompt: "We are hiring MERN Stack Developers",
      expectedCategory: "Hiring",
      shouldNotBeHiring: false
    },
    {
      prompt: "Happy Diwali",
      expectedCategory: "Festival",
      shouldNotBeHiring: true
    },
    {
      prompt: "50% discount on all courses today",
      expectedCategory: "Sale / Offer",
      shouldNotBeHiring: true
    },
    {
      prompt: "Exclusive Restaurant grand opening",
      expectedCategory: "Restaurant",
      shouldNotBeHiring: true
    }
  ];

  const results = [];
  let successCount = 0;

  for (const item of testPrompts) {
    try {
      const detection = getHeuristicCategoryAndTemplate(item.prompt);
      const fallbackObj = getFallbackPoster(item.prompt, detection);
      const sanitized = sanitizePosterJSON(fallbackObj, item.prompt);

      let pass = true;
      let reason = 'OK';

      if (item.shouldNotBeHiring && detection.template === 'hiring') {
        pass = false;
        reason = `Hiring template used for non-hiring prompt`;
      } else if (item.shouldNotBeHiring && detection.category === 'Hiring') {
        pass = false;
        reason = `Hiring category used for non-hiring prompt`;
      } else if (item.shouldNotBeHiring && (sanitized.layoutType === 'hiring-poster' || sanitized.layoutType === 'split-hero')) {
        pass = false;
        reason = `Hiring layoutType (${sanitized.layoutType}) used for non-hiring prompt`;
      }

      if (pass) {
        successCount++;
      }

      results.push({
        prompt: item.prompt,
        expectedCategory: item.expectedCategory,
        detectedCategory: detection.category,
        detectedTemplate: detection.template,
        resolvedLayoutType: sanitized.layoutType,
        pass,
        reason
      });
    } catch (err) {
      results.push({
        prompt: item.prompt,
        error: err.message,
        stack: err.stack,
        pass: false,
        reason: 'Execution error'
      });
    }
  }

  return res.json({
    success: true,
    total: testPrompts.length,
    passed: successCount,
    results
  });
});



// ── GET /api/poster/test-category-results ────────────────────────────────────
router.get('/test-category-results', (req, res) => {
  const outputPath = path.join(__dirname, '..', 'test_results.json');
  if (!fs.existsSync(outputPath)) {
    return res.json({ success: false, status: 'not_found', message: 'No test results found yet. Make sure tests have run and completed.' });
  }

  try {
    const data = fs.readFileSync(outputPath, 'utf8');
    return res.json(JSON.parse(data));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/poster/enhance-prompt ─────────────────────────────────────────
// Returns the full AI prompt enhancement brief without generating a poster.
router.post('/enhance-prompt', async (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }
  try {
    const enhancement = await enhanceUserPrompt(prompt.trim());
    return res.json({ success: true, enhancement });
  } catch (err) {
    console.error('[Poster API] Prompt enhancement error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/poster/detect-category ─────────────────────────────────────────
router.post('/detect-category', async (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  console.log('[Poster API] Detecting category for prompt:', prompt);
  try {
    const result = await detectCategoryAndTemplate(prompt);
    return res.json({
      success: true,
      category: result.category,
      template: result.template,
      title: result.title,
      subtitle: result.subtitle
    });
  } catch (err) {
    console.error('[Poster API] Category detection error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/poster/generate ───────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const { prompt, style } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  console.log('[Poster API] Received poster request:', prompt, { style });

  if (style === 'full_image') {
    console.log('[Poster API] Full-Image AI Poster mode active. Generating complete graphic design...');
    const seed = Math.floor(Math.random() * 10000);
    const lowerPrompt = prompt.toLowerCase();

    // Detect category from prompt keywords
    let detectedCategory = 'default';
    if (lowerPrompt.includes('grand opening') || lowerPrompt.includes('inauguration') || lowerPrompt.includes('launch event')) detectedCategory = 'grand_opening';
    else if (lowerPrompt.includes('hiring') || lowerPrompt.includes('we are hiring') || lowerPrompt.includes('job opening') || lowerPrompt.includes('vacancy') || lowerPrompt.includes('recruitment')) detectedCategory = 'hiring';
    else if (lowerPrompt.includes('restaurant') || lowerPrompt.includes('food') || lowerPrompt.includes('menu') || lowerPrompt.includes('cafe') || lowerPrompt.includes('bistro') || lowerPrompt.includes('chef')) detectedCategory = 'restaurant';
    else if (lowerPrompt.includes('real estate') || lowerPrompt.includes('property') || lowerPrompt.includes('villa') || lowerPrompt.includes('apartment') || lowerPrompt.includes('house for sale') || lowerPrompt.includes('realty')) detectedCategory = 'real_estate';
    else if (lowerPrompt.includes('diwali') || lowerPrompt.includes('pongal') || lowerPrompt.includes('holi') || lowerPrompt.includes('navratri') || lowerPrompt.includes('eid') || lowerPrompt.includes('christmas') || lowerPrompt.includes('festival') || lowerPrompt.includes('celebration')) detectedCategory = 'festival';
    else if (lowerPrompt.includes('sale') || lowerPrompt.includes('discount') || lowerPrompt.includes('offer') || lowerPrompt.includes('% off') || lowerPrompt.includes('clearance') || lowerPrompt.includes('deals')) detectedCategory = 'sale_offer';
    else if (lowerPrompt.includes('education') || lowerPrompt.includes('school') || lowerPrompt.includes('college') || lowerPrompt.includes('university') || lowerPrompt.includes('course') || lowerPrompt.includes('admission') || lowerPrompt.includes('training')) detectedCategory = 'education';
    else if (lowerPrompt.includes('healthcare') || lowerPrompt.includes('hospital') || lowerPrompt.includes('clinic') || lowerPrompt.includes('doctor') || lowerPrompt.includes('medical') || lowerPrompt.includes('health') || lowerPrompt.includes('wellness')) detectedCategory = 'healthcare';
    else if (lowerPrompt.includes('conference') || lowerPrompt.includes('summit') || lowerPrompt.includes('event') || lowerPrompt.includes('seminar') || lowerPrompt.includes('webinar') || lowerPrompt.includes('expo') || lowerPrompt.includes('concert')) detectedCategory = 'event';
    else if (lowerPrompt.includes('corporate') || lowerPrompt.includes('business') || lowerPrompt.includes('company') || lowerPrompt.includes('enterprise') || lowerPrompt.includes('services') || lowerPrompt.includes('solutions')) detectedCategory = 'corporate';
    else if (lowerPrompt.includes('product launch') || lowerPrompt.includes('new product') || lowerPrompt.includes('introducing') || lowerPrompt.includes('unveiling') || lowerPrompt.includes('reveal')) detectedCategory = 'product_launch';
    else if (lowerPrompt.includes('wedding') || lowerPrompt.includes('marriage') || lowerPrompt.includes('bridal') || lowerPrompt.includes('engagement')) detectedCategory = 'wedding';
    else if (lowerPrompt.includes('birthday') || lowerPrompt.includes('bday') || lowerPrompt.includes('happy birthday') || lowerPrompt.includes('anniversary')) detectedCategory = 'birthday';

    // Sector-specific AI art direction prompts
    const FULL_IMAGE_PROMPT_MAP = {
      grand_opening: `A stunning grand opening ceremony flyer. Dramatic red ribbon cutting at a modern storefront entrance, gold confetti explosion filling the air, luxurious gold and red balloons arch, champagne sparkles, dramatic stage lighting beams, deep black background with gold shimmer overlay, elegant typography space, premium professional photograph, full bleed 4k no borders`,
      hiring: `A sleek modern tech hiring recruitment poster. Open-plan coding office with glowing monitors showing colorful code, diverse team of professionals collaborating, blue and violet circuit-board light trails in background, holographic career growth chart, clean white and deep navy blue corporate design, glassmorphism panels, sharp typography space, full bleed professional corporate photography, no borders`,
      restaurant: `A premium gourmet restaurant promotional poster. Moody atmospheric dark restaurant interior, beautifully plated gourmet dish on rustic wood table, warm amber hanging cafe Edison lights, bokeh smoke and steam, deep charcoal background with golden warm highlights, menu card visible, chef silhouette, elegant culinary art, full bleed atmospheric photography, no borders`,
      real_estate: `A luxury real estate property marketing flyer. Stunning modern villa exterior at golden hour sunset, marble entrance foyer with chandelier, manicured garden and pool, dual gold ornate border frame, premium cream and ivory palette, architectural photography with wide lens, dramatic sky reflection, full bleed luxury real estate photography, no borders`,
      festival: `A vibrant colorful Indian festival celebration poster. ${lowerPrompt.includes('diwali') ? 'Glowing clay diyas and golden sparkles, elaborate rangoli patterns, warm amber firelight, jewel-toned lehenga, temple silhouette' : lowerPrompt.includes('pongal') ? 'Traditional clay Pongal pot boiling over with milk, sugarcane stalks, kolam rangoli, village sunrise, earthy terracotta tones' : lowerPrompt.includes('christmas') ? 'Snow-covered Christmas tree with golden ornaments, fairy lights, gift boxes with red ribbons, cozy warm fireplace glow' : 'Festival celebration with colorful lights, balloons, fireworks, confetti explosion, vibrant jewel tones'}, full bleed immersive photography, no borders`,
      sale_offer: `A bold aggressive flash sale promotion poster. Electric neon explosion on deep black background, bright red and yellow sale tags bursting outward, dynamic lightning bolt graphic elements, shopping bags and price drop badges, high-energy kinetic typography space, confetti and sparkle burst effects, retail commercial energy, full bleed graphic design, no borders`,
      education: `A professional academic education institution poster. Modern university campus building exterior, students studying with laptops and books, STEM laboratory with glowing equipment, clean sky-blue and white gradient design, graduation cap and diploma motifs, knowledge and growth metaphors, bright optimistic colors, full bleed academic photography, no borders`,
      healthcare: `A clean professional medical healthcare clinic poster. Pristine modern hospital lobby reception, friendly doctor in white coat, state-of-the-art medical equipment, soft teal and white color palette, healing light blue gradients, cross and heartbeat icons, wellness and trust imagery, calming professional atmosphere, full bleed medical photography, no borders`,
      event: `A dramatic large-scale tech conference summit event poster. Stage with dramatic LED spotlight beams, massive crowd silhouette in darkness, neon purple and blue LED panel displays showing data visualizations, keynote speaker silhouette center stage, futuristic audio-visual production, deep black with electric purple and cyan, full bleed concert photography, no borders`,
      corporate: `A premium executive corporate business services poster. Glass skyscraper boardroom with city skyline panorama view, confident business team around oval conference table, professional handshake close-up, clean navy and steel blue corporate palette, financial growth chart overlays, world map connectivity, sophisticated executive atmosphere, full bleed corporate photography, no borders`,
      product_launch: `A cinematic product launch reveal poster. Single product on dramatic dark podium under intense spotlight beam, floating neon geometric light rings, smoke and mist effects on stage, deep black background with electric mint and gold glow, tech futuristic aesthetic, lens flare and bokeh particles, luxury reveal ceremony atmosphere, full bleed product photography, no borders`,
      wedding: `An elegant romantic wedding event poster. Dreamy outdoor ceremony under a floral golden arch, white and blush rose cascades, string lights bokeh, golden hour sunlight through the arch, soft cream and gold palette, rose petals scattered on aisle, champagne and rings detail, romantic cinematic photography, full bleed wedding photography, no borders`,
      birthday: `A joyful magical birthday celebration party poster. Colorful balloons in pink gold and purple filling the frame, layered birthday cake with glowing candles center stage, golden confetti rain, rainbow streamers and party poppers, festive bokeh sparkle lights, warm pastel color palette, cheerful joyful energy, full bleed celebration photography, no borders`,
      default: `A premium professional marketing graphic poster design for: "${prompt}". Fill the entire image frame, full bleed design, borderless, no mockups, no table background, bold sharp typography space, highly detailed graphics, extremely cohesive composition, photorealistic, 4k quality, sharp focus, professional photo`
    };

    const fullPosterPrompt = FULL_IMAGE_PROMPT_MAP[detectedCategory] || FULL_IMAGE_PROMPT_MAP['default'];
    console.log(`[Poster API] Full-image category detected: "${detectedCategory}"`);
    console.log(`[Poster API] Full-image prompt: "${fullPosterPrompt.substring(0, 120)}..."`);

    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPosterPrompt)}?width=1080&height=1350&nologo=true&seed=${seed}`;
    console.log(`[Poster API] Pollinations URL: ${pollinationsUrl}`);
    
    try {
      const buffer = await downloadImage(pollinationsUrl);
      let localUrl;
      try {
        localUrl = await uploadBufferToCloudinary(buffer, 'fic_posters_backgrounds');
        console.log(`[Poster API] Full-image AI poster uploaded to Cloudinary: ${localUrl}`);
      } catch (cloudinaryErr) {
        console.warn('[Poster API] Full-image AI poster Cloudinary upload failed, using local save:', cloudinaryErr.message);
        localUrl = saveBufferToGenerated(buffer, 'png');
      }

      // Call the AI metadata generator to get high-quality, custom copywriting text (headlines, sentences)
      let aiMetadata = null;
      try {
        aiMetadata = await generatePosterMetadata(prompt);
        console.log('[Poster API] Successfully generated AI metadata for full-image poster:', aiMetadata);
      } catch (metadataErr) {
        console.warn('[Poster API] AI metadata generation failed for full-image poster, using fallback maps:', metadataErr.message);
      }

      // ── Smart text content per category ──────────────────────────────────
      const categoryTextMap = {
        grand_opening: { subtitle: 'We are thrilled to announce the grand opening of our new space. Come celebrate with us and enjoy exclusive launch day offers.', features: ['Exclusive launch day discounts', 'Complimentary gifts for early visitors', 'Live entertainment & refreshments'], cta: 'Join Us Today', footer: 'Open to all — bring your family and friends!' },
        hiring:        { subtitle: 'We are looking for talented and passionate individuals to join our growing team. Apply now and build your career with us.', features: ['Competitive salary & benefits', 'Flexible working environment', 'Growth and learning opportunities'], cta: 'Apply Now', footer: 'Send your resume to careers@company.com' },
        restaurant:    { subtitle: 'Indulge in an exceptional dining experience crafted with the finest ingredients and passion for great food.', features: ['Chef-crafted seasonal menu', 'Cozy ambiance & private dining', 'Reservations available online'], cta: 'Reserve a Table', footer: 'Open daily 12 PM – 11 PM  |  Call us to book' },
        real_estate:   { subtitle: 'Discover your dream home in one of our most exclusive properties. Luxury living, prime location, and world-class amenities await.', features: ['Premium location & scenic views', 'Modern architecture & interiors', 'Ready to move — limited units'], cta: 'Book a Site Visit', footer: 'Contact our property consultants today' },
        festival:      { subtitle: 'Wishing you and your family joy, love, and prosperity this festive season. May this celebration bring warmth and happiness to all.', features: ['Special festive offers inside', 'Gifts & surprises for all customers', 'Celebrate with your loved ones'], cta: 'Celebrate With Us', footer: 'From our family to yours — Happy Celebrations!' },
        sale_offer:    { subtitle: "Don't miss our biggest sale of the season! Massive discounts across all categories for a limited time only.", features: ['Up to 70% off on selected items', 'Free delivery on all orders', 'Offer valid while stocks last'], cta: 'Shop Now', footer: 'Sale ends soon — grab your deals today!' },
        education:     { subtitle: 'Unlock your potential with our expert-led courses and programs. Learn from the best and build skills that matter.', features: ['Industry-certified curriculum', 'Expert mentors & live sessions', 'Flexible online & offline batches'], cta: 'Enroll Today', footer: 'Admissions open — limited seats available' },
        healthcare:    { subtitle: 'Your health is our priority. We provide world-class medical care with compassion, expertise, and cutting-edge technology.', features: ['Experienced doctors & specialists', 'State-of-the-art equipment', '24/7 emergency & patient care'], cta: 'Book an Appointment', footer: 'Your wellness journey starts here' },
        event:         { subtitle: 'Join us for an unforgettable event packed with insights, networking opportunities, and inspiring keynote sessions.', features: ['Keynote speakers & panel discussions', 'Networking sessions & workshops', 'Exciting prizes & giveaways'], cta: 'Register Now', footer: 'Seats are filling fast — register today!' },
        corporate:     { subtitle: 'Empowering businesses with innovative solutions, strategic expertise, and a commitment to excellence and growth.', features: ['End-to-end business solutions', 'Dedicated client success team', 'Proven results across industries'], cta: 'Get in Touch', footer: 'Visit our website for a free consultation' },
        product_launch:{ subtitle: 'Introducing our latest innovation — designed to redefine the way you experience quality, performance, and style.', features: ['Next-generation technology inside', 'Sleek design & premium build quality', 'Pre-order now at launch pricing'], cta: 'Pre-Order Now', footer: 'Available from launch day — limited stock' },
        wedding:       { subtitle: 'Two hearts, one beautiful journey begins. We joyfully invite you to be part of our most special and memorable day.', features: ['Elegant venue & floral decor', 'Gourmet dinner & live music', 'RSVP required by the date below'], cta: 'RSVP Now', footer: 'Your presence is the greatest gift we could ask for' },
        birthday:      { subtitle: "Let's paint the town with laughter, cake, and good vibes! You are invited to celebrate this very special milestone.", features: ['Cake, music & amazing surprises', 'Fun games & activities for all ages', 'Join us for an evening to remember'], cta: 'Join the Party', footer: 'Dress code: Colorful & Festive  |  RSVP by date above' },
        default:       { subtitle: 'We bring you the best experience, crafted with care and designed to exceed your expectations at every step of the way.', features: ['Premium quality guaranteed', 'Trusted by thousands of customers', 'Contact us to learn more today'], cta: 'Learn More', footer: 'Visit our website or call for more information' }
      };
      const textContent = categoryTextMap[detectedCategory] || categoryTextMap['default'];
      // Check if user entered a short generic query (e.g., "Restaurant Poster") instead of a custom headline
      const cleanPromptForCheck = prompt.toLowerCase().trim();
      const genericWords = ['poster', 'flyer', 'banner', 'ad', 'advertisement', 'graphic', 'design', 'image', 'background', 'template'];
      const wordsInPrompt = cleanPromptForCheck.split(/\s+/);
      
      const categoryKeywords = [
        'restaurant', 'food', 'menu', 'cafe', 'bistro', 'chef',
        'hiring', 'job', 'careers', 'vacancy', 'recruitment',
        'birthday', 'bday', 'anniversary', 'wedding', 'marriage',
        'festival', 'diwali', 'christmas', 'pongal', 'celebration',
        'sale', 'offer', 'discount', 'clearance',
        'real estate', 'property', 'education', 'school', 'course',
        'healthcare', 'medical', 'clinic', 'event', 'summit', 'conference',
        'corporate', 'business', 'company', 'product launch', 'launch'
      ];
      
      const isGeneric = wordsInPrompt.length <= 3 && wordsInPrompt.every(w => 
        categoryKeywords.includes(w) || genericWords.includes(w) || w.length <= 2
      );

      const categoryTitleMap = {
        grand_opening: 'Grand Opening',
        hiring:        'We Are Hiring',
        restaurant:    'Delicious Dining',
        real_estate:   'Luxury Real Estate',
        festival:      'Happy Celebrations',
        sale_offer:    'Mega Flash Sale',
        education:     'Advanced Training',
        healthcare:    'Premium Healthcare',
        event:         'FIC Tech Summit',
        corporate:     'Corporate Solutions',
        product_launch:'New Product Reveal',
        wedding:       'Wedding Celebration',
        birthday:      'Happy Birthday'
      };

      const fallbackHeadline = categoryTitleMap[detectedCategory] || 'Exclusive Showcase';
      
      // If the prompt contains quotes, extract the text inside quotes as the custom title
      const quoteMatch = prompt.match(/"([^"]+)"/);
      const customTitle = quoteMatch ? quoteMatch[1].replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : null;

      const smartTitle = customTitle || (isGeneric ? fallbackHeadline : prompt.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
      const smartCategory = detectedCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      // Smartly format features from AI if returned as objects
      let smartFeatures = textContent.features;
      if (aiMetadata?.features && Array.isArray(aiMetadata.features)) {
        smartFeatures = aiMetadata.features.map(f => typeof f === 'string' ? f : (f.title || f.desc || ''));
      } else if (aiMetadata?.skills && Array.isArray(aiMetadata.skills)) {
        smartFeatures = aiMetadata.skills;
      }

      const mappedPoster = {
        title: aiMetadata?.title || smartTitle || smartCategory,
        subtitle: aiMetadata?.subtitle || textContent.subtitle,
        cta: aiMetadata?.cta || textContent.cta,
        features: smartFeatures,
        footer: aiMetadata?.footer || aiMetadata?.date || textContent.footer,
        details: aiMetadata?.footer || aiMetadata?.date || textContent.footer,
        theme: aiMetadata?.theme || 'business',
        category: aiMetadata?.category || smartCategory,
        colors: aiMetadata?.colors ? [aiMetadata.colors.bg, aiMetadata.colors.primary, aiMetadata.colors.accent] : ['#0A0907', '#D4AF37', '#8A6E17'],
        fullImageMode: true,
        layoutType: 'full_image',
        backgroundImageUrl: localUrl
      };
      
      return res.json({
        success: true,
        type: 'poster',
        message: 'Full-image AI poster generated successfully',
        imageUrl: localUrl,
        url: localUrl,
        poster: mappedPoster
      });
    } catch (err) {
      console.error('[Poster API] Full-image generation failed, falling back to layout mode:', err.message);
    }
  }

  // ── STEP 1: AI PROMPT ENHANCEMENT ────────────────────────────────────────
  let enhancement = null;
  let workingPrompt = prompt.trim();
  let bgPromptOverride = null;

  try {
    enhancement = await enhanceUserPrompt(workingPrompt);
    workingPrompt = enhancement.enhancedPrompt;
    bgPromptOverride = enhancement.finalBackgroundPrompt;
    console.log(`[Poster API] Prompt enhanced. Category: ${enhancement.detectedCategory}, Score: ${enhancement.qualityScore}`);
  } catch (err) {
    console.warn('[Poster API] Prompt enhancement failed, using raw prompt:', err.message);
  }

  let posterDataObj = null;
  let message = 'Poster generated using AI layout';

  try {
    posterDataObj = await generatePosterMetadata(workingPrompt);
  } catch (err) {
    console.warn('[Poster API] AI Generation failed, using fallback:', err.message);
    posterDataObj = getFallbackPoster(workingPrompt);
  }

  // Apply enhancement overrides to poster metadata
  if (enhancement) {
    if (enhancement.suggestedTitle && !posterDataObj.title) {
      posterDataObj.title = enhancement.suggestedTitle;
    }
    if (enhancement.suggestedSubtitle && !posterDataObj.subtitle) {
      posterDataObj.subtitle = enhancement.suggestedSubtitle;
    }
    if (enhancement.suggestedCta && !posterDataObj.cta) {
      posterDataObj.cta = enhancement.suggestedCta;
    }
    // Apply detected color palette if AI didn't override colors
    if (enhancement.colorPalette && enhancement.colorPalette.length >= 3) {
      if (!posterDataObj.colorPalette || posterDataObj.colorPalette.length === 0) {
        posterDataObj.colorPalette = enhancement.colorPalette;
      }
    }
  }


  // Fetch background image — use enhanced background prompt if available
  let backgroundImageUrl = null;
  let backgroundType = 'image';

  const resolveCategory = (themeName) => {
    const t = (themeName || 'hiring').toLowerCase();
    if (t.includes('festival') || t.includes('diwali') || t.includes('celebration') || t.includes('christmas') || t.includes('pongal') || t.includes('wishes')) return 'festival';
    if (t.includes('course') || t.includes('education') || t.includes('academy') || t.includes('learn') || t.includes('study')) return 'education';
    if (t.includes('realestate') || t.includes('real_estate') || t.includes('building') || t.includes('home') || t.includes('property') || t.includes('estate')) return 'real_estate';
    if (t.includes('healthcare') || t.includes('medical') || t.includes('health') || t.includes('clinic') || t.includes('doctor') || t.includes('hospital')) return 'healthcare';
    if (t.includes('product_launch') || t.includes('product launch') || t.includes('launch') || t.includes('new product') || t.includes('showcase')) return 'product_launch';
    if (t.includes('event') || t.includes('summit') || t.includes('conference') || t.includes('seminar') || t.includes('meetup') || t.includes('webinar')) return 'event';
    if (t.includes('grand') || t.includes('opening') || t.includes('luxury')) return 'luxury';
    if (t.includes('business') || t.includes('corporate') || t.includes('sale') || t.includes('offer')) return 'business';
    return 'hiring';
  };

  // Use enhancement-detected category if available (more accurate)
  const enhancedCategory = enhancement?.detectedCategory;
  const resolvedCategory = enhancedCategory
    ? enhancedCategory.toLowerCase().replace(/[\s\/]/g, '_')
    : resolveCategory(posterDataObj.theme);

  // Use category-aware storytelling and visual checklist validation loop
  console.log('[Poster API] Calling category-aware background generation with checklist verification...');
  let pexelsResult = await generateCategoryAwarePosterBackground(prompt, resolvedCategory);

  backgroundImageUrl = pexelsResult.url;

  if (!backgroundImageUrl) {
    console.log('[Poster API] Background image failed or not found, using gradient');
    backgroundType = 'gradient';
  }

  // Attach background properties
  posterDataObj.backgroundImageUrl = backgroundImageUrl;
  posterDataObj.backgroundType = backgroundType;

  // Run Visual Spacing and Layout Engine
  computeComposition(posterDataObj);

  // Apply category-based color palette (use enhancement palette as priority)
  const enhancementColors = enhancement?.colorPalette;
  posterDataObj.heading = posterDataObj.title;
  posterDataObj.subheading = posterDataObj.subtitle;
  posterDataObj.bullets = posterDataObj.skills;
  posterDataObj.colors = enhancementColors?.length >= 3
    ? enhancementColors.slice(0, 3)
    : posterDataObj.theme === 'festival' ? ['#1F0C2C', '#FFD700', '#F97316'] :
      posterDataObj.theme === 'education' || posterDataObj.theme === 'course' ? ['#060B18', '#3B82F6', '#10B981'] :
      posterDataObj.theme === 'real_estate' || posterDataObj.theme === 'realestate' ? ['#0F1A1C', '#10B981', '#F59E0B'] :
      posterDataObj.theme === 'healthcare' ? ['#081C1B', '#0EA5E9', '#14B8A6'] :
      posterDataObj.theme === 'product_launch' ? ['#0A0B10', '#F43F5E', '#3B82F6'] :
      posterDataObj.theme === 'event' ? ['#0F0922', '#EC4899', '#8B5CF6'] :
      posterDataObj.theme === 'business' ? ['#080C14', '#D97706', '#3B82F6'] :
      ['#090D1A', '#06B6D4', '#7C3AED'];
  posterDataObj.typography = { primary: 'Montserrat', secondary: 'Inter' };

  return res.json({
    success: true,
    type: 'poster',
    message,
    imageQuery: pexelsResult.query,
    imageCategory: resolvedCategory,
    relevanceScore: pexelsResult.relevanceScore,
    poster: posterDataObj,
    imageUrl: backgroundImageUrl,
    url: backgroundImageUrl,
    // Return enhancement data so client can display the AI understanding panel
    promptEnhancement: enhancement ? {
      originalPrompt: enhancement.originalPrompt,
      detectedCategory: enhancement.detectedCategory,
      detectedOccasion: enhancement.detectedOccasion,
      detectedIndustry: enhancement.detectedIndustry,
      detectedMood: enhancement.detectedMood,
      mainVisual: enhancement.mainVisual,
      colorPalette: enhancement.colorPalette,
      qualityScore: enhancement.qualityScore,
      missingDetails: enhancement.missingDetails,
    } : null
  });
});

// ── POST /api/poster/export ─────────────────────────────────────────────────
router.post('/export', async (req, res) => {
  try {
    const { dataUrl, fileType } = req.body ?? {};
    if (!dataUrl) {
      return res.status(400).json({ success: false, error: 'dataUrl is required' });
    }

    const ext = fileType === 'pdf' ? 'pdf' : 'png';
    const base64Data = dataUrl.replace(/^data:.*?;base64,/, "");
    const filename = `poster-${Date.now()}.${ext}`;
    const filePath = path.join(documentsDir, filename);

    fs.writeFileSync(filePath, base64Data, 'base64');
    console.log('[Poster API] Exported poster file:', filename);

    // Fallback port / host
    const port = process.env.PORT || 5001;
    const base = process.env.SERVER_URL || `http://localhost:${port}`;
    const downloadUrl = `/downloads/${filename}`;

    return res.json({
      success: true,
      downloadUrl,
      fullUrl: `${base}${downloadUrl}`,
      filename
    });
  } catch (err) {
    console.error('[Poster API] Export error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/poster/proxy-image ─────────────────────────────────────────────
router.get('/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('url parameter is required');
  }
  try {
    console.log('[Poster API] Proxying external image:', url);
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    // Set headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    response.data.pipe(res);
  } catch (err) {
    console.error('[Poster API] Proxy image failed:', err.message);
    res.status(500).send('Failed to proxy image: ' + err.message);
  }
});

// ── POST /api/poster/edit ─────────────────────────────────────────────────────
// Accepts { posterJSON, editRequest } and returns a structured Fabric.js action plan.
router.post('/edit', async (req, res) => {
  const { posterJSON, editRequest } = req.body;
  if (!editRequest || typeof editRequest !== 'string') {
    return res.status(400).json({ success: false, error: 'editRequest is required' });
  }
  try {
    console.log(`[Poster API] Processing edit request: "${editRequest}"`);
    const actionPlan = await planPosterEdit(posterJSON || {}, editRequest);
    return res.json({ success: true, actionPlan });
  } catch (err) {
    console.error('[Poster API] Edit planner error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
