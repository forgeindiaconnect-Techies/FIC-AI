import express from 'express';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Replicate from 'replicate';
import OpenAI from 'openai';
import sharp from 'sharp';
import { HfInference } from '@huggingface/inference';
import { v2 as cloudinary } from 'cloudinary';

// Resolve __filename and __dirname for ES Modules
const __fileURL = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileURL);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dhtv9cjnx',
  api_key: process.env.CLOUDINARY_API_KEY || '921537676448125',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'hxJ2-YG30MV2MN7Vu'
});

const uploadBufferToCloudinary = (buffer, folder = 'fic_generated_images') => {
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


// Directory for final uploaded images
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'images');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Save a buffer to the uploads/images folder and return a public URL.
 */
function saveBufferToUploads(buffer, req, extension = 'png') {
  const filename = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/images/${filename}`;
}

/** Download image from any URL and return a Buffer */
async function downloadImage(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return Buffer.from(resp.data);
}



/** Apply sharpness enhancement */
async function sharpenImage(buffer) {
  return await sharp(buffer).sharpen().png({ quality: 100 }).toBuffer();
}

// Log IMAGE_PROVIDER on startup
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || 'pexels';
console.log('IMAGE_PROVIDER:', IMAGE_PROVIDER);



const router = express.Router();

// GET /config – check image editing capabilities based on API keys
router.get('/config', (req, res) => {
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const supportsEditing = hasReplicate || hasOpenAI;
  return res.json({
    success: true,
    supportsEditing,
    hasReplicate,
    hasOpenAI
  });
});

// In-memory storage for uploaded files
const upload = multer({ storage: multer.memoryStorage() });

// Helper to save image buffer to server's public generated folder and return local URL
function saveBufferToGenerated(buffer, req, extension = 'png') {
  const filename = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
  const dirPath = path.join(__dirname, '..', 'generated');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, filename);
  fs.writeFileSync(filePath, buffer);
  
  const protocol = req ? req.protocol : 'http';
  const host = req ? req.get('host') : `localhost:${process.env.PORT || 5001}`;
  return `${protocol}://${host}/generated/${filename}`;
}

// Helper to expand common Hindu and other religious/mythological figures into detailed prompts
function expandCommonSubjects(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  const lower = prompt.toLowerCase().trim();
  
  // Shiva / Sivan
  if (/\b(sivan|shiva|mahadhev|bholenath|rudra|maheshwar)\b/i.test(lower)) {
    return "Lord Shiva, Hindu deity Lord Shiva meditating on Mount Kailash, blue neck and skin, third eye on forehead, crescent moon in matted hair, holy river Ganga flowing from hair, snake around neck, holding trident (trishul) and damru, wearing tiger skin, sacred ash (vibhuti) on forehead, divine atmosphere";
  }
  // Krishna
  if (/\b(krishna|kisna|kanha|govinda|gopal|madhav)\b/i.test(lower)) {
    return "Lord Krishna, Hindu deity, playing flute, peacock feather in crown, blue skin, traditional yellow attire, serene smile, divine glowing halo, Vrindavan background";
  }
  // Ganesha
  if (/\b(ganesha?|ganpati|vinayaka|pillayar)\b/i.test(lower)) {
    return "Lord Ganesha, Hindu deity, elephant head, blessing posture, holding modak sweet, beautiful crown and jewelry, warm divine light, mouse companion";
  }
  // Hanuman
  if (/\b(hanuman|bajrangbali|maruti|anjaneya)\b/i.test(lower)) {
    return "Lord Hanuman, Hindu deity, powerful monkey god, holding mace (gada), carrying Dronagiri mountain, orange glowing aura, chest opened revealing Rama and Sita, epic devotional atmosphere";
  }
  // Ram / Rama
  if (/\b(rama?|sri ram|shree ram)\b/i.test(lower)) {
    return "Lord Rama, Hindu deity, holding bow and arrow, traditional clothing, royal crown, calm and serene expression, divine glowing aura";
  }
  // Murugan / Kartikeya
  if (/\b(murugan|kartikeya|subramanya)\b/i.test(lower)) {
    return "Lord Murugan, Hindu deity, holding divine spear (Vel), standing with a peacock, youthful warrior appearance, traditional gold ornaments, serene expression";
  }
  // Jesus
  if (/\b(jesus|christ)\b/i.test(lower)) {
    return "Jesus Christ, serene and peaceful expression, soft glowing halo, dressed in white and red robes, light rays shining from behind";
  }
  // Buddha
  if (/\b(buddha|siddhartha)\b/i.test(lower)) {
    return "Lord Buddha meditating in lotus position under the Bodhi tree, serene and peaceful expression, golden aura, peaceful nature background";
  }
  
  return prompt;
}

// Helper to strip conversational wrapper phrases from prompts (e.g. "i need cat drinking milk image i need" -> "cat drinking milk")
function stripConversationalWrappers(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  let cleaned = prompt.trim().toLowerCase();
  
  let prev;
  do {
    prev = cleaned;
    
    // Remove leading/trailing punctuation and extra whitespace
    cleaned = cleaned.replace(/^[.,!?\s"'`#*_\-\/]+|[.,!?\s"'`#*_\-\/]+$/g, '').trim();
    
    // 1. Remove complex prefix patterns
    cleaned = cleaned.replace(/^(please\s+)?(can\s+you\s+)?(generate|create|make|draw|illustrate|show|give|display|render)\s+(me\s+)?(a\s+|an\s+|the\s+)?(realistic\s+|hd\s+|beautiful\s+|epic\s+|high\s+quality\s+)?(image|photo|picture|drawing|painting|illustration|artwork|sketch)\s+(of|about|showcasing|depicting)\s+/gi, '');
    
    // 2. Remove simple prefix patterns
    cleaned = cleaned.replace(/^(i\s+need\s+(an?|the)?\s*|i\s+want\s+(an?|the)?\s*|generate\s+(an?|the)?\s*|create\s+(an?|the)?\s*|draw\s+(an?|the)?\s*|picture\s+of\s*|image\s+of\s*|photo\s+of\s*|illustration\s+of\s*|painting\s+of\s*|artwork\s+of\s*)/gi, '');
    
    // 3. Remove complex suffix patterns
    cleaned = cleaned.replace(/\s+(image|photo|picture|drawing|painting|illustration|artwork|sketch)(\s+i\s+need|\s+i\s+want|\s+please)?$/gi, '');
    
    // 4. Remove simple suffix patterns
    cleaned = cleaned.replace(/\s+(i\s+need|i\s+want|please|thanks|thank\s+you|for\s+me|now)$/gi, '');
    
  } while (cleaned !== prev);
  
  return cleaned.trim();
}

// Helper to clean/enhance prompt before generation
async function cleanPromptText(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  
  // Pre-clean conversational wrappers first
  const preCleaned = stripConversationalWrappers(prompt);
  
  // Expand common terms to rich descriptive inputs first
  const expandedPrompt = expandCommonSubjects(preCleaned);
  const cleaned = expandedPrompt.trim();
  
  const systemPrompt = `You are an expert prompt engineer for AI image generators.
Convert the user's raw image description request into a descriptive, high-quality, text-free image generation prompt.
Do not search for stock photos; write a description of the scene.
Ensure the output is clean, comma-separated keywords and descriptive phrases, optimizing for a beautiful rendering.
Do not include any introductory or concluding text, explanations, or quotes. Only output the final cleaned prompt.

CRITICAL INSTRUCTIONS:
Always append these exact keywords to the end of the prompt:
photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality

Avoid these styles completely (do not include them or explicitly say 'no cartoon, no anime, no illustration, no painting, no blurry, no low quality, no watermark'):
cartoon, anime, painting, illustration, blurry, low quality, watermark

Examples:
- "dog image" -> "cute dog, photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality"
- "boy and girl watching sunset" -> "boy and girl watching sunset, cinematic lighting, photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality"
- "i need a realistic photo of a cat" -> "realistic photo of a cat, detailed fur, photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality"

User raw input: "${cleaned}"
Cleaned prompt:`;

  // 1. Try Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your_')) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      });
      const result = await model.generateContent([systemPrompt]);
      const response = await result.response;
      let text = response.text().trim();
      text = text.replace(/^["'`\s]+|["'`\s]+$/g, '');
      if (text && text.length > 3) {
        console.log(`[Prompt Cleaner] Cleaned by Gemini: "${text}"`);
        return text;
      }
    } catch (err) {
      console.error('[Prompt Cleaner] Gemini cleaning failed:', err.message);
    }
  }

  // 2. Try OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && !openRouterKey.includes('your_')) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: systemPrompt }
        ],
        max_tokens: 100
      }, {
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      let text = res.data?.choices?.[0]?.message?.content?.trim();
      text = text.replace(/^["'`\s]+|["'`\s]+$/g, '');
      if (text && text.length > 3) {
        console.log(`[Prompt Cleaner] Cleaned by OpenRouter: "${text}"`);
        return text;
      }
    } catch (err) {
      console.error('[Prompt Cleaner] OpenRouter cleaning failed:', err.message);
    }
  }

  // 3. Try Ollama (Local)
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const response = await axios.post(`${ollamaUrl}/api/chat`, {
      model: ollamaModel,
      messages: [
        { role: 'user', content: systemPrompt }
      ],
      stream: false,
      options: {
        temperature: 0.6,
        num_predict: 100
      }
    }, {
      timeout: 10000
    });
    let text = response.data.message?.content?.trim();
    text = text.replace(/^["'`\s]+|["'`\s]+$/g, '');
    if (text && text.length > 3) {
      console.log(`[Prompt Cleaner] Cleaned by Ollama: "${text}"`);
      return text;
    }
  } catch (err) {
    console.error('[Prompt Cleaner] Ollama cleaning failed:', err.message);
  }

  // 4. Fallback
  const fallback = cleaned || 'beautiful scenery';
  const resultPrompt = `${fallback}, photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality`;
  console.log(`[Prompt Cleaner] Fallback rule-based: "${resultPrompt}"`);
  return resultPrompt;
}

// Modular AI image generator function
export async function generateAIImage(userPrompt, req = null) {
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    throw new Error('Prompt is required for image generation');
  }

  // 1. Log ORIGINAL PROMPT
  console.log(`ORIGINAL PROMPT: ${userPrompt}`);

  // 2. Gemini Prompt Enhancement
  let enhancedPrompt = '';
  try {
    enhancedPrompt = await cleanPromptText(userPrompt);
  } catch (err) {
    // Use fallback rule-based clean prompt text
    const preCleaned = stripConversationalWrappers(userPrompt);
    const expanded = expandCommonSubjects(preCleaned);
    const fallback = expanded || 'beautiful scenery';
    enhancedPrompt = `${fallback}, photorealistic, realistic photography, DSLR camera, sharp focus, natural lighting, ultra detailed, 4k quality`;
  }
  
  if (req) {
    req.enhancedPrompt = enhancedPrompt;
  }
  
  console.log(`ENHANCED PROMPT: ${enhancedPrompt}`);

  // 3. Construct direct URL for Pollinations AI with query parameters
  const enhancedPromptEncoded = encodeURIComponent(enhancedPrompt);
  const negativePrompt = 'cartoon, anime, painting, illustration, blurry, low quality, watermark';
  const negativePromptEncoded = encodeURIComponent(negativePrompt);
  const aiImageUrl = `https://image.pollinations.ai/prompt/${enhancedPromptEncoded}?width=1024&height=1024&nologo=true&negative=${negativePromptEncoded}&negative_prompt=${negativePromptEncoded}`;
  console.log(`POLLINATIONS URL: ${aiImageUrl}`);

  // 4. Try AI generation (Pollinations AI) first
  try {
    // Perform a GET request to verify the image loads successfully
    const pollResponse = await axios.get(aiImageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000 // 15s timeout
    });

    if (pollResponse.status === 200 && pollResponse.data && pollResponse.data.length > 0) {
      console.log(`IMAGE LOADED: true`);
      return { imageUrl: aiImageUrl, width: null, height: null };
    } else {
      throw new Error(`Pollinations returned status ${pollResponse.status}`);
    }
  } catch (pollError) {
    console.log(`IMAGE LOADED: false`);
    console.warn(`Pollinations AI generation failed, falling back to Pexels:`, pollError.message);

    // 5. Fallback to Pexels search
    if (process.env.PEXELS_API_KEY) {
      try {
        const pexelsKey = process.env.PEXELS_API_KEY;
        const query = encodeURIComponent(userPrompt.trim());
        console.log('IMAGE REQUEST START: Pexels direct query', query);
        const pexelsResponse = await axios.get('https://api.pexels.com/v1/search', {
          params: { query, per_page: 5 },
          headers: { Authorization: pexelsKey },
          timeout: 8000
        });
        if (pexelsResponse.data.photos && pexelsResponse.data.photos.length > 0) {
          console.log('IMAGE REQUEST SUCCESS: Pexels returned', pexelsResponse.data.photos.length, 'photos');
          const selectedPhoto = pexelsResponse.data.photos[0];
          const imgUrl = selectedPhoto.src.original || selectedPhoto.src.large2x || selectedPhoto.src.large;
          console.log('Pexels fallback image selected:', imgUrl);
          return { imageUrl: imgUrl, width: selectedPhoto.width, height: selectedPhoto.height };
        }
        console.warn('Pexels returned no photos for query:', userPrompt);
      } catch (pexError) {
        console.error('Pexels fallback failed:', pexError.message);
      }
    }

    // 6. Hugging Face fallback
    if (process.env.HF_API_KEY) {
      try {
        console.log('IMAGE REQUEST START: HuggingFace fallback');
        const enhancedHFPrompt = `${enhancedPrompt}, professional photo`;
        const response = await axios.post(
          'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
          { inputs: enhancedHFPrompt },
          {
            headers: {
              Authorization: `Bearer ${process.env.HF_API_KEY}`,
              Accept: 'image/png'
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );
        console.log('IMAGE REQUEST SUCCESS: HuggingFace fallback');
        const localUrl = saveBufferToGenerated(Buffer.from(response.data), req, 'png');
        return { imageUrl: localUrl, width: 1024, height: 1024 };
      } catch (hfError) {
        console.error('Hugging Face fallback failed:', hfError.message);
      }
    }

    throw new Error('Image generation failed: AI generation and fallbacks failed.');
  }
}

// POST /generate – generate an image
router.get('/test-pollinations', async (req, res) => {
  try {
    console.log('[Test Pollinations] Querying pollinations...');
    const response = await axios.get('https://image.pollinations.ai/prompt/cute%20dog%20cartoon', {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    console.log('[Test Pollinations] Succeeded. Size:', response.data.length);
    return res.json({ success: true, size: response.data.length });
  } catch (err) {
    console.error('[Test Pollinations] Failed:', err.message, err.response?.status);
    return res.json({ success: false, message: err.message, status: err.response?.status });
  }
});

router.post('/generate', async (req, res) => {
  const requestId = req.body.requestId;
  console.log('IMAGE REQUEST START (API call)', { requestId, prompt: req.body.prompt });try {
  const userPrompt = req.body.prompt || req.body.message || req.body.text || req.body.input || '';
  // Generate FLUX image (or fallback) – returns an object { imageUrl, width, height }
  const generationResult = await generateAIImage(userPrompt, req);
  const remoteUrl = typeof generationResult === 'object' ? generationResult.imageUrl : generationResult;
  console.log('GENERATED REMOTE URL:', remoteUrl);

  // 1. Download original image
  const originalBuffer = await downloadImage(remoteUrl);
  const origMeta = await sharp(originalBuffer).metadata();
  console.log('FLUX ORIGINAL SIZE:', origMeta.width, 'x', origMeta.height);

  // Apply local enhancement (sharpen). If it fails, use original image.
  let enhancedBuffer;
  let finalMeta;
  try {
    enhancedBuffer = await sharpenImage(originalBuffer);
    finalMeta = await sharp(enhancedBuffer).metadata();
    console.log('ENHANCED IMAGE SIZE (after sharpen):', finalMeta.width, 'x', finalMeta.height);
  } catch (e) {
    console.warn('Sharp enhancement failed, using original image:', e.message);
    enhancedBuffer = originalBuffer;
    finalMeta = await sharp(enhancedBuffer).metadata();
  }

  // Upload final image to Cloudinary (with local fallback to prevent 404s on ephemeral hosting like Render)
  let finalUrl;
  try {
    finalUrl = await uploadBufferToCloudinary(enhancedBuffer, 'fic_generated_images');
    console.log('SAVED TO CLOUDINARY:', finalUrl);
  } catch (cloudinaryErr) {
    console.warn('Cloudinary upload failed, falling back to local file:', cloudinaryErr.message);
    finalUrl = saveBufferToUploads(enhancedBuffer, req, 'png');
    console.log('SAVED FILE PATH:', path.join(UPLOADS_DIR, path.basename(finalUrl)));
  }
  console.log('FINAL FRONTEND URL:', finalUrl);

  return res.json({
    success: true,
    imageUrl: finalUrl,
    url: finalUrl,
    enhancedPrompt: req.enhancedPrompt || userPrompt,
    requestId,
    originalWidth: origMeta.width,
    originalHeight: origMeta.height,
    finalWidth: finalMeta.width,
    finalHeight: finalMeta.height
  });
} catch (error) {
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    console.error('IMAGE REQUEST TIMEOUT', { requestId, error: error.message });
  } else {
    console.error('IMAGE REQUEST FAILED', { requestId, error: error.message || error });
  }
  return res.json({
    success: false,
    message: 'Failed to generate image: ' + (error.message || 'Unknown error'),
    error: error.message || 'Unknown error',
    requestId
  });
}
});

// POST /edit – edit an uploaded image using image-to-image AI
router.post('/edit', upload.single('image'), async (req, res) => {
  try {
    console.log('IMAGE EDIT REQUEST START', { requestId: req.body.requestId, prompt: req.body.prompt });

    const denoise = req.body.denoise;
    const prompt = req.body.prompt;

    // 3. Validate inputs
    // 4. If image missing
    if (!req.file) {
      console.warn("Validation failed: No image uploaded");
      return res.status(400).json({
        success: false,
        message: "No image uploaded"
      });
    }
    // 5. If prompt missing
    if (!prompt || !prompt.trim()) {
      console.warn("Validation failed: No edit instruction provided");
      return res.status(400).json({
        success: false,
        message: "No edit instruction provided"
      });
    }
    if (denoise === undefined || denoise === null) {
      console.warn("Validation failed: No denoise / strength value provided");
      return res.status(400).json({
        success: false,
        message: "Denoise / edit strength is required."
      });
    }

    // 8. Determine provider and check capability
    const colorKeywords = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'gold', 'silver', 'brown', 'gray', 'grey'];
    const hasColor = colorKeywords.some(k => prompt.toLowerCase().includes(k));
    const hasComplexInstruction = /remove|add|replace|insert|change\s+to\s+a|make\s+it\s+a|cartoon|boy|girl/i.test(prompt);
    const isSimpleColorChange = hasColor && !hasComplexInstruction;

    let editProvider = isSimpleColorChange ? 'local' : process.env.IMAGE_EDIT_PROVIDER;
    if (!editProvider && !isSimpleColorChange) {
      if (process.env.REPLICATE_API_TOKEN) {
        editProvider = 'replicate';
      } else if (process.env.OPENAI_API_KEY) {
        editProvider = 'openai';
      } else if (process.env.HF_API_KEY) {
        editProvider = 'huggingface';
      }
    }

    if (!editProvider && !isSimpleColorChange) {
      console.log("[Image Editor] No paid edit provider found — using Pollinations AI with context-aware prompt as fallback");
      editProvider = 'pollinations';
    }

    const mimeExt = req.file.mimetype.split('/')[1] || 'png';
    const originalImageUrl = saveBufferToGenerated(req.file.buffer, req, mimeExt);

    let editedImageUrl;

    if (editProvider === 'replicate') {
      try {
        console.log('[Image Editor] Using Replicate (instruct-pix2pix) for image editing...');
        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN
        });
        
        const base64Input = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        
        // 6. Log exact Replicate payload before sending
        const replicatePayload = {
          model: "timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
          input: {
            image: base64Input.slice(0, 100) + "... [truncated]",
            prompt: prompt,
            guidance_scale: 7.5,
            image_guidance_scale: 1.5,
            num_inference_steps: 20
          }
        };
        console.log("SENDING TO REPLICATE PAYLOAD:", JSON.stringify(replicatePayload, null, 2));

        const output = await replicate.run(
          "timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
          {
            input: {
              image: base64Input,
              prompt: prompt,
              guidance_scale: 7.5,
              image_guidance_scale: 1.5,
              num_inference_steps: 20
            }
          }
        );
        
        console.log("Replicate output:", output);
        if (output && output[0]) {
          const imageRes = await axios.get(output[0], { responseType: 'arraybuffer' });
          editedImageUrl = saveBufferToGenerated(Buffer.from(imageRes.data), req, 'png');
        } else {
          throw new Error("Replicate did not return any image URL.");
        }
      } catch (replicateError) {
        // 7. Log exact provider error
        console.error("PROVIDER ERROR:", replicateError.response?.data || replicateError.message || replicateError);
        return res.status(400).json({
          success: false,
          message: replicateError.message || "Replicate image editing failed."
        });
      }
    }
    else if (editProvider === 'openai') {
      try {
        console.log('[Image Editor] Using OpenAI DALL-E 2 for image editing...');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        
        // Write the uploaded buffer to a temporary file locally so we can read it as a stream
        const tempFilename = `temp-edit-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
        const tempPath = path.join(__dirname, '..', 'generated', tempFilename);
        
        const dirPath = path.join(__dirname, '..', 'generated');
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(tempPath, req.file.buffer);
        
        // 6. Log exact OpenAI payload before sending
        const openAiPayload = {
          image: tempPath,
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        };
        console.log("SENDING TO OPENAI PAYLOAD:", JSON.stringify(openAiPayload, null, 2));

        try {
          const response = await openai.images.edit({
            image: fs.createReadStream(tempPath),
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
          });
          
          const base64 = response.data[0].b64_json;
          if (base64) {
            const buffer = Buffer.from(base64, 'base64');
            editedImageUrl = saveBufferToGenerated(buffer, req, 'png');
          } else {
            throw new Error("OpenAI did not return image data.");
          }
        } finally {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        }
      } catch (openAiError) {
        // 7. Log exact provider error
        console.error("PROVIDER ERROR:", openAiError.response?.data || openAiError.message || openAiError);
        return res.status(400).json({
          success: false,
          message: openAiError.message || "OpenAI image editing failed."
        });
      }
    }
    else if (editProvider === 'huggingface') {
      try {
        console.log('[Image Editor] Calling Hugging Face Stable Diffusion v1.5 img2img...');
        editedImageUrl = await runHuggingFaceImg2Img(req.file.buffer, req.file.mimetype, prompt, denoise, req);
      } catch (err) {
        console.error('[Image Editor] Hugging Face edit failed:', err.message);
      }
    }
    else if (editProvider === 'pollinations') {
      try {
        editedImageUrl = await runPollinationsAIEdit(req.file.buffer, req.file.mimetype, prompt, req);
      } catch (err) {
        console.error('[Image Editor] Pollinations edit failed:', err.message);
      }
    }

    // ── Fallback Chain if selected provider failed or was not set ──────────
    if (!editedImageUrl) {
      if (isSimpleColorChange) {
        try {
          console.log('[Image Editor] Running local Sharp image editor for color/style adjustments...');
          editedImageUrl = await runLocalSharpEditor(req.file.buffer, prompt, req);
        } catch (err) {
          console.error('[Image Editor] Local Sharp editor failed:', err.message);
        }
      } else {
        const hasRealGemini = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_') && process.env.GEMINI_API_KEY.trim() !== '';
        if (!hasRealGemini) {
          console.warn('[Image Editor] Hugging Face failed and no valid GEMINI_API_KEY was found in .env.');
          return res.status(400).json({
            success: false,
            message: "Hugging Face credits depleted (Error 402) or model not supported. To edit images for free, please obtain a free Gemini API key from Google AI Studio (https://aistudio.google.com/) and set it in your server/.env file under GEMINI_API_KEY."
          });
        }

        try {
          console.log('[Image Editor] Running Pollinations AI fallback with Gemini prompt rewriting...');
          editedImageUrl = await runPollinationsAIEdit(req.file.buffer, req.file.mimetype, prompt, req);
        } catch (err) {
          console.warn('[Image Editor] Pollinations AI fallback failed:', err.message);
          return res.status(400).json({
            success: false,
            message: "Failed to apply edit: " + err.message
          });
        }
      }
    }

    // 6. Return exact JSON format (including both keys for compatibility)
    return res.json({
      success: true,
      imageUrl: editedImageUrl,
      editedImageUrl: editedImageUrl,
      originalImageUrl: originalImageUrl,
      prompt,
      denoise,
    });
  } catch (err) {
    // 7. Log exact provider error
    console.error("PROVIDER ERROR:", err.response?.data || err.message || err);
    return res.status(400).json({
      success: false,
      message: err.message || "Image editing failed."
    });
  }
});

// Helper to perform local Sharp-based image edits
async function runLocalSharpEditor(imageBuffer, prompt, req) {
  const instruction = (prompt || '').toLowerCase().trim();
  let sharpPipeline = sharp(imageBuffer);

  const colorMap = {
    white:  { r: 240, g: 240, b: 240 },
    black:  { r: 20,  g: 20,  b: 20  },
    red:    { r: 220, g: 30,  b: 30  },
    blue:   { r: 30,  g: 80,  b: 220 },
    green:  { r: 30,  g: 180, b: 50  },
    yellow: { r: 240, g: 220, b: 30  },
    orange: { r: 240, g: 130, b: 20  },
    purple: { r: 140, g: 30,  b: 220 },
    pink:   { r: 240, g: 80,  b: 160 },
    cyan:   { r: 30,  g: 200, b: 220 },
    gold:   { r: 212, g: 175, b: 55  },
    silver: { r: 180, g: 180, b: 195 },
    brown:  { r: 140, g: 80,  b: 40  },
    gray:   { r: 128, g: 128, b: 128 },
    grey:   { r: 128, g: 128, b: 128 },
  };

  let appliedTint = null;
  for (const [colorName, rgb] of Object.entries(colorMap)) {
    if (instruction.includes(colorName)) {
      appliedTint = rgb;
      break;
    }
  }

  const wantsGrayscale = /grayscale|greyscale|black and white|b&w|monochrome|desaturate/.test(instruction);
  const wantsBlur = /blur|blurry|soft|dreamy|foggy/.test(instruction);
  const wantsSharpen = /sharp|sharpen|crisp|clearer|enhance/.test(instruction);
  const wantsBright = /bright|lighter|lighten|increase brightness/.test(instruction);
  const wantsDark = /dark|darker|darken|dim|shadow/.test(instruction);
  const wantsContrast = /contrast|vivid|vibrant|pop/.test(instruction);
  const wantsFlip = /flip|mirror|reverse/.test(instruction);
  const wantsVintage = /vintage|retro|old|aged|sepia/.test(instruction);

  if (wantsGrayscale || wantsVintage) {
    sharpPipeline = sharpPipeline.grayscale();
  }

  const wantsWhite = instruction.includes('white') || instruction.includes('light');
  const wantsBlack = instruction.includes('black') || (instruction.includes('dark') && !wantsDark);
  const wantsSilver = instruction.includes('silver');
  const wantsGray = instruction.includes('gray') || instruction.includes('grey');

  const isNeutralColor = wantsWhite || wantsBlack || wantsSilver || wantsGray;
  if (appliedTint && !wantsGrayscale && !isNeutralColor) {
    sharpPipeline = sharpPipeline.tint(appliedTint);
  }

  if (wantsFlip) {
    sharpPipeline = sharpPipeline.flop();
  }

  const modulateOptions = {};
  if (wantsBright) modulateOptions.brightness = 1.35;
  else if (wantsDark) modulateOptions.brightness = 0.65;
  if (wantsContrast) modulateOptions.saturation = 1.5;
  if (wantsVintage) { modulateOptions.saturation = 0.5; modulateOptions.brightness = 0.95; }

  if (wantsWhite) {
    modulateOptions.brightness = (modulateOptions.brightness || 1.0) * 1.50;
    modulateOptions.saturation = (modulateOptions.saturation || 1.0) * 0.15;
  } else if (wantsBlack) {
    modulateOptions.brightness = (modulateOptions.brightness || 1.0) * 0.35;
    modulateOptions.saturation = (modulateOptions.saturation || 1.0) * 0.30;
  } else if (wantsSilver) {
    modulateOptions.brightness = (modulateOptions.brightness || 1.0) * 1.25;
    modulateOptions.saturation = (modulateOptions.saturation || 1.0) * 0.10;
  } else if (wantsGray) {
    modulateOptions.brightness = (modulateOptions.brightness || 1.0) * 0.80;
    modulateOptions.saturation = (modulateOptions.saturation || 1.0) * 0.05;
  }

  if (Object.keys(modulateOptions).length > 0) {
    sharpPipeline = sharpPipeline.modulate(modulateOptions);
  }

  if (wantsBlur) {
    sharpPipeline = sharpPipeline.blur(4);
  } else if (wantsSharpen) {
    sharpPipeline = sharpPipeline.sharpen({ sigma: 3 });
  } else {
    sharpPipeline = sharpPipeline.sharpen();
  }

  const transformedBuffer = await sharpPipeline.png({ quality: 95 }).toBuffer();
  let finalBuffer = transformedBuffer;

  const isColorChange = appliedTint || wantsWhite || wantsBlack || wantsSilver || wantsGray;

  if (isColorChange) {
    const { data: hslData, info: hslInfo } = await sharp(imageBuffer)
      .toColorspace('hsl')
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const mask = Buffer.alloc(hslInfo.width * hslInfo.height);
    for (let i = 0; i < hslData.length / 3; i++) {
      const s = hslData[3 * i + 1];
      const l = hslData[3 * i + 2];
      if (s > 35 && l > 15 && l < 240) {
        mask[i] = 255;
      } else {
        mask[i] = 0;
      }
    }
    
    const maskBuffer = await sharp(mask, { 
      raw: { width: hslInfo.width, height: hslInfo.height, channels: 1 } 
    })
      .blur(4)
      .toBuffer();
      
    const colorShiftedWithAlpha = await sharp(transformedBuffer)
      .ensureAlpha()
      .joinChannel(maskBuffer, { 
        raw: { width: hslInfo.width, height: hslInfo.height, channels: 1 } 
      })
      .png()
      .toBuffer();
      
    finalBuffer = await sharp(imageBuffer)
      .composite([{ input: colorShiftedWithAlpha, blend: 'over' }])
      .png()
      .toBuffer();
  }

  return saveBufferToUploads(finalBuffer, req, 'png');
}

// Helper to perform Pollinations AI visual scene rewriting edit
async function runPollinationsAIEdit(imageBuffer, mimetype, prompt, req) {
  let targetPrompt = prompt;
  
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your_')) {
    try {
      console.log('[Image Editor] Generating context-aware edited prompt using Gemini...');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimetype
        }
      };
      
      const systemInstructions = `You are an expert prompt engineer for AI image generators.
Analyze the provided source image and the user's edit instruction: "${prompt}".
Create a detailed, high-quality, text-free image generation prompt describing the final desired image after applying the edit.
Ensure you keep the style, setting, colors, and layout of the original image as much as possible, only changing what the user requested.
Do not include any introductory or concluding text. Only output the final prompt.`;

      const result = await model.generateContent([imagePart, systemInstructions]);
      const response = await result.response;
      const enhanced = response.text().trim();
      if (enhanced && enhanced.length > 5) {
        targetPrompt = enhanced;
        console.log(`[Image Editor] Gemini generated edited scene prompt: "${targetPrompt}"`);
      }
    } catch (geminiErr) {
      console.warn('[Image Editor] Gemini prompt rewriting failed, using fallback:', geminiErr.message);
    }
  }
  
  const negativePrompt = 'blurry, low quality, watermark, text';
  const encodedPrompt = encodeURIComponent(targetPrompt);
  const encodedNegative = encodeURIComponent(negativePrompt);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&negative=${encodedNegative}`;
  
  console.log(`[Image Editor] Querying Pollinations AI: ${pollinationsUrl}`);
  
  const pollResponse = await axios.get(pollinationsUrl, {
    responseType: 'arraybuffer',
    timeout: 25000
  });
  
  if (pollResponse.status === 200 && pollResponse.data && pollResponse.data.length > 0) {
    return saveBufferToGenerated(Buffer.from(pollResponse.data), req, 'png');
  } else {
    throw new Error('Pollinations AI returned empty response.');
  }
}

// Helper to perform true pixel-based image-to-image editing using runwayml/stable-diffusion-v1-5 on Hugging Face
async function runHuggingFaceImg2Img(imageBuffer, mimetype, prompt, denoise, req) {
  if (!process.env.HF_API_KEY) return null;
  
  // 1. Get the detailed final scene description from Gemini based on original image context + edit prompt
  let sceneDescription = prompt;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your_')) {
    try {
      console.log('[Image Editor HF Fallback] Generating context-aware prompt using Gemini...');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
      
      const imagePart = {
        inlineData: { data: imageBuffer.toString('base64'), mimeType: mimetype }
      };
      
      const systemInstructions = `You are an expert prompt engineer for AI image generators.
Analyze the provided source image and the user's edit instruction: "${prompt}".
Create a detailed, high-quality, text-free image generation prompt describing the final desired image after applying the edit.
Ensure you keep the style, setting, colors, and layout of the original image as much as possible, only changing what the user requested.
Do not include any introductory or concluding text. Only output the final prompt.`;

      const result = await model.generateContent([imagePart, systemInstructions]);
      const response = await result.response;
      const enhanced = response.text().trim();
      if (enhanced && enhanced.length > 5) {
        sceneDescription = enhanced;
        console.log(`[Image Editor HF Fallback] Gemini prompt: "${sceneDescription}"`);
      }
    } catch (geminiErr) {
      console.warn('[Image Editor HF Fallback] Gemini prompt rewriting failed:', geminiErr.message);
    }
  }

  // 2. Call Stable Diffusion v1.5 img2img on Hugging Face
  const denoiseVal = parseFloat(denoise) || 0.65;
  // Strength controls how much of the original image is modified (0.0 to 1.0)
  // Higher denoiseVal means higher modification strength.
  const strength = denoiseVal;

  const base64Input = `data:${mimetype};base64,${imageBuffer.toString('base64')}`;

  const payload = {
    inputs: base64Input,
    parameters: {
      prompt: sceneDescription,
      negative_prompt: 'blurry, low quality, distorted face, extra limbs, watermark, text',
      strength: strength,
      guidance_scale: 7.5,
      num_inference_steps: 25
    }
  };

  console.log('[Image Editor HF Fallback] Calling runwayml/stable-diffusion-v1-5 img2img...');
  const response = await axios.post(
    'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
    payload,
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY.trim()}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true'
      },
      responseType: 'arraybuffer',
      timeout: 90000
    }
  );

  if (response.status === 200 && response.data && response.data.byteLength > 0) {
    console.log('[Image Editor HF Fallback] Img2Img edit succeeded!');
    return saveBufferToGenerated(Buffer.from(response.data), req, 'png');
  } else {
    throw new Error(`Hugging Face returned status ${response.status}`);
  }
}

export default router;
export { router as imageRoutes };
