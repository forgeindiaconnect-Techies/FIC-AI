// server/utils/posterEditPlanner.js – AI Poster Edit Planner
// Accepts a natural language edit request + current poster JSON, returns action plan.

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * planPosterEdit(currentPosterJSON, userEditRequest)
 *
 * Calls Gemini to parse a natural language edit request and return a structured
 * JSON action plan for the Fabric.js canvas.
 *
 * @param {object} currentPosterJSON  – The current Fabric.js canvas JSON (canvas.toJSON())
 * @param {string} userEditRequest    – e.g. "Change title color to red"
 * @returns {Promise<object>}         – Action plan JSON
 */
export async function planPosterEdit(currentPosterJSON, userEditRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[PosterEditPlanner] No GEMINI_API_KEY – using rule-based fallback.');
    return ruleFallback(userEditRequest);
  }

  const systemPrompt = `You are an AI poster editor assistant. The user wants to edit a Fabric.js poster canvas.
The canvas has named objects: title, subtitle, heroImage, ctaButton, footer, logo, background, description.

Your job is to convert the user's edit request into a structured JSON action plan.

Supported actions:
- "update": Change properties of an existing named object (e.g., fill color, fontSize, text content, opacity, fontFamily)
- "move": Change the position of a named object (set left / top)
- "resize": Change the size of a named object (set scaleX, scaleY or width, height)
- "delete": Remove a named object from the canvas
- "add": Add a new object (type: text or image)
- "replace": Replace the image source of a named image object

Response rules:
1. Return ONLY a valid JSON object — no explanations, no markdown, no code fences.
2. Infer the correct target object name from context.
3. For color changes use valid hex color strings.
4. For font changes use one of: Poppins, Playfair Display, Bebas Neue, Montserrat, Inter.
5. For fontSize specify number of pixels (e.g. 72).
6. For position use canvas coordinates (canvas is 800x1100 px).
7. For text content changes set "text" field in changes.

JSON Schema:
{
  "action": "update | move | resize | delete | add | replace",
  "target": "title | subtitle | heroImage | ctaButton | footer | logo | background | description",
  "changes": {
    "fill": "#hexcolor",
    "fontSize": 72,
    "fontFamily": "Poppins",
    "fontWeight": "bold",
    "text": "New text content",
    "opacity": 1,
    "left": 400,
    "top": 200,
    "scaleX": 1.5,
    "scaleY": 1.5,
    "width": 300,
    "height": 200,
    "src": "https://image-url.com"
  },
  "description": "Human readable description of what was changed"
}

Only include relevant fields in "changes" — omit fields that don't apply.
If you cannot determine the right action, return: { "action": "unknown", "target": "", "changes": {}, "description": "Could not understand the edit request" }`;

  const userPrompt = `Current poster has these named elements on canvas.
User's edit request: "${userEditRequest}"

Return the JSON action plan.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const text = result.response.text();

    // Parse the JSON response
    let parsed = JSON.parse(text);

    // Ensure all required fields are present
    if (!parsed.action) parsed.action = 'unknown';
    if (!parsed.target) parsed.target = '';
    if (!parsed.changes) parsed.changes = {};
    if (!parsed.description) parsed.description = userEditRequest;

    console.log('[PosterEditPlanner] Action plan:', JSON.stringify(parsed));
    return parsed;

  } catch (err) {
    console.error('[PosterEditPlanner] Gemini error:', err.message);
    // Attempt rule-based fallback
    return ruleFallback(userEditRequest);
  }
}

/**
 * Rule-based fallback parser for common edit commands.
 * Used when Gemini is unavailable.
 */
function ruleFallback(request) {
  const req = request.toLowerCase().trim();

  // Color change: "change title color to red" / "make title red"
  const colorMatch = req.match(/(?:change|make|set)\s+(title|subtitle|cta|footer|button|logo|description)\s+(?:color\s+)?(?:to\s+)?(#[0-9a-f]{3,6}|red|blue|green|gold|white|black|yellow|orange|purple|pink|cyan)/);
  if (colorMatch) {
    const target = normalizeTarget(colorMatch[1]);
    const colorName = colorMatch[2];
    const colorMap = {
      red: '#ef4444', blue: '#3b82f6', green: '#22c55e', gold: '#D4AF37',
      white: '#ffffff', black: '#000000', yellow: '#eab308', orange: '#f97316',
      purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4'
    };
    const fill = colorName.startsWith('#') ? colorName : (colorMap[colorName] || '#ffffff');
    return {
      action: 'update',
      target,
      changes: { fill },
      description: `Changed ${target} color to ${fill}`
    };
  }

  // Font size: "increase title size" / "make title larger" / "set title font size to 80"
  const sizeUpMatch = req.match(/(?:increase|make|enlarge)\s+(title|subtitle|cta|footer|description)\s+(?:size|font|larger|bigger)/);
  if (sizeUpMatch) {
    const target = normalizeTarget(sizeUpMatch[1]);
    return {
      action: 'update',
      target,
      changes: { fontSize: 90 },
      description: `Increased ${target} font size`
    };
  }

  const sizeDownMatch = req.match(/(?:decrease|reduce|make|shrink)\s+(title|subtitle|cta|footer|description)\s+(?:size|font|smaller)/);
  if (sizeDownMatch) {
    const target = normalizeTarget(sizeDownMatch[1]);
    return {
      action: 'update',
      target,
      changes: { fontSize: 48 },
      description: `Decreased ${target} font size`
    };
  }

  // Move: "move image to left/right/center"
  const moveMatch = req.match(/move\s+(image|hero|logo|title|subtitle|cta|button|footer)\s+(?:to\s+)?(left|right|center|top|bottom)/);
  if (moveMatch) {
    const target = normalizeTarget(moveMatch[1]);
    const posMap = { left: { left: 50 }, right: { left: 550 }, center: { left: 400 }, top: { top: 50 }, bottom: { top: 900 } };
    const changes = posMap[moveMatch[2]] || {};
    return {
      action: 'move',
      target,
      changes,
      description: `Moved ${target} to ${moveMatch[2]}`
    };
  }

  // Delete: "remove feature cards" / "delete footer"
  const deleteMatch = req.match(/(?:remove|delete|hide)\s+(cards?|features?|footer|logo|subtitle|description|image)/);
  if (deleteMatch) {
    const target = normalizeTarget(deleteMatch[1]);
    return {
      action: 'delete',
      target,
      changes: {},
      description: `Removed ${target} from poster`
    };
  }

  // Font family: "change title font to Poppins"
  const fontMatch = req.match(/(?:change|set)\s+(?:the\s+)?(title|subtitle|cta|footer|description)\s+font(?:\s+to)?\s+(poppins|playfair|bebas|montserrat|inter)/i);
  if (fontMatch) {
    const target = normalizeTarget(fontMatch[1]);
    const fontMap = {
      poppins: 'Poppins',
      playfair: 'Playfair Display',
      bebas: 'Bebas Neue',
      montserrat: 'Montserrat',
      inter: 'Inter'
    };
    const fontFamily = fontMap[fontMatch[2].toLowerCase()] || 'Poppins';
    return {
      action: 'update',
      target,
      changes: { fontFamily },
      description: `Changed ${target} font to ${fontFamily}`
    };
  }

  // Center align: "center align title"
  const alignMatch = req.match(/(?:center|left|right)\s+align\s+(title|subtitle|footer|description)/);
  if (alignMatch) {
    const target = normalizeTarget(alignMatch[1]);
    const textAlign = req.startsWith('center') ? 'center' : req.startsWith('left') ? 'left' : 'right';
    return {
      action: 'update',
      target,
      changes: { textAlign },
      description: `Aligned ${target} to ${textAlign}`
    };
  }

  // Background theme: "change background to gold theme"
  const bgMatch = req.match(/(?:change|set)\s+background\s+(?:to\s+)?(gold|dark|blue|green|red|luxury|corporate|festival)/);
  if (bgMatch) {
    const themeMap = {
      gold: '#D4AF37', dark: '#0a0a0a', blue: '#1e3a8a', green: '#14532d',
      red: '#7f1d1d', luxury: '#1a1200', corporate: '#0f172a', festival: '#4c1d95'
    };
    const fill = themeMap[bgMatch[1]] || '#0a0a0a';
    return {
      action: 'update',
      target: 'background',
      changes: { fill },
      description: `Changed background to ${bgMatch[1]} theme (${fill})`
    };
  }

  // Unknown
  return {
    action: 'unknown',
    target: '',
    changes: {},
    description: 'Could not parse edit request. Please try: "Change title color to red" or "Make button larger".'
  };
}

function normalizeTarget(raw) {
  const map = {
    image: 'heroImage', hero: 'heroImage',
    button: 'ctaButton', cta: 'ctaButton',
    cards: 'cards', card: 'cards', features: 'cards', feature: 'cards',
    logo: 'logo', title: 'title', subtitle: 'subtitle',
    footer: 'footer', description: 'description',
    background: 'background', bg: 'background'
  };
  return map[raw.toLowerCase()] || raw;
}
