// server/routes/video.js
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import FormData from 'form-data';
import { generateTTSAudioBuffer } from '../utils/ttsHelper.js';
import { preprocessImage } from '../utils/imagePreprocess.js';

let lastValidatedDIDKey = null;
let cachedDIDAuthHeader = null;

// Helper: Generates multiple auth header combinations to tolerate various client key formats and email typos
export function getCandidateDIDAuthHeaders(didKey) {
  if (!didKey) return [];
  const rawKey = didKey.trim();
  if (rawKey.startsWith('Basic ')) return [rawKey];

  let emailPart = '';
  let password = '';

  if (rawKey.includes(':')) {
    const parts = rawKey.split(':');
    emailPart = parts[0];
    password = parts[1];
  } else {
    try {
      const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
      if (decoded.includes(':')) {
        const parts = decoded.split(':');
        emailPart = parts[0];
        password = parts[1];
      }
    } catch (_) {}
  }

  if (emailPart && password) {
    let emailDecoded = emailPart;
    if (!emailPart.includes('@')) {
      try {
        const decoded = Buffer.from(emailPart, 'base64').toString('utf8');
        if (decoded.includes('@')) {
          emailDecoded = decoded;
        }
      } catch (_) {}
    }

    const candidates = [];
    // Candidate 1: decoded email + password
    candidates.push('Basic ' + Buffer.from(`${emailDecoded}:${password}`).toString('base64'));

    // Candidate 2: swap vaideeswari8 with vaideeswareswari8 (typo resilience)
    if (emailDecoded.includes('vaideeswari8')) {
      const swapped = emailDecoded.replace('vaideeswari8', 'vaideeswareswari8');
      candidates.push('Basic ' + Buffer.from(`${swapped}:${password}`).toString('base64'));
    }
    if (emailDecoded.includes('vaideeswareswari8')) {
      const swapped = emailDecoded.replace('vaideeswareswari8', 'vaideeswari8');
      candidates.push('Basic ' + Buffer.from(`${swapped}:${password}`).toString('base64'));
    }

    // Candidate 3: raw emailPart + password
    candidates.push('Basic ' + Buffer.from(`${emailPart}:${password}`).toString('base64'));

    // Candidate 4: rawKey as-is encoded in basic auth
    candidates.push('Basic ' + Buffer.from(`${rawKey}:`).toString('base64'));

    return [...new Set(candidates)];
  }

  return ['Basic ' + Buffer.from(`${rawKey}:`).toString('base64')];
}

// Robust async D-ID basic auth header builder that finds and caches the first working candidate
export async function getDIDAuthHeader(didKey) {
  if (!didKey) return '';
  const trimmed = didKey.trim();

  if (trimmed === lastValidatedDIDKey && cachedDIDAuthHeader) {
    return cachedDIDAuthHeader;
  }

  lastValidatedDIDKey = trimmed;
  cachedDIDAuthHeader = null;

  if (trimmed.startsWith('Basic ')) {
    cachedDIDAuthHeader = trimmed;
    return trimmed;
  }

  const candidates = getCandidateDIDAuthHeaders(trimmed);
  console.log(`[Video/D-ID Auth] Verifying ${candidates.length} auth header candidates...`);

  for (const candidate of candidates) {
    try {
      await axios.get('https://api.d-id.com/credits', {
        headers: { Authorization: candidate, Accept: 'application/json' },
        timeout: 8000,
      });
      console.log('[Video/D-ID Auth] Found valid credentials candidate!');
      cachedDIDAuthHeader = candidate;
      return candidate;
    } catch (err) {
      console.warn(`[Video/D-ID Auth] Candidate test failed: HTTP ${err.response?.status || err.message}`);
    }
  }

  // If no candidates succeed, fallback to the default candidate
  console.warn('[Video/D-ID Auth] All candidates failed. Falling back to default candidate.');
  cachedDIDAuthHeader = candidates[0] || '';
  return cachedDIDAuthHeader;
}



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temporary folder for intermediate files (image + audio) used by demo video generation
const tempDir = path.resolve(__dirname, '../../tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Ensure uploads/video directory exists
const videoDir = path.resolve(__dirname, '../uploads/video');
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

// Download helper to serve presenters locally (bypasses browser CORS & hotlinking blocks)
async function cachePresenter(filename, url) {
  // Destination path for cached presenter video
  const destPath = path.join(videoDir, filename);

  // If file already exists and is non‑empty, reuse it
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 0) return `/uploads/video/${filename}`;
    fs.unlinkSync(destPath);
  }

  console.log(`[Video] Caching presenter: ${filename} from ${url}`);

  // Try streaming download first
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      console.log(`[Video] Cache complete (stream): ${filename}`);
      return `/uploads/video/${filename}`;
    }
  } catch (e) {
    console.warn(`[Video] Streaming cache failed for ${filename}, attempting buffer download:`, e.message);
  }

  // Fallback: download as buffer
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    fs.writeFileSync(destPath, Buffer.from(response.data));
    
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      console.log(`[Video] Cache complete (buffer): ${filename}`);
      return `/uploads/video/${filename}`;
    }
  } catch (err) {
    console.error(`[Video] Failed caching presenter ${filename}:`, err.message);
    throw err;
  }
  
  throw new Error(`Failed to save valid video file for ${filename}`);
}

// Automatically download and cache the Amber presenter video from D-ID
(async () => {
  try {
    const amberPath = path.join(videoDir, 'amber_presenter.mp4');
    if (!fs.existsSync(amberPath) || fs.statSync(amberPath).size === 0) {
      console.log('[Video] Amber presenter template missing. Downloading...');
      await cachePresenter('amber_presenter.mp4', 'https://expressive-avatars.d-id.com/PUBLIC_D-ID/amber_sport_elegant/avt_s8NZJC/avatar_assets/talking_preview.mp4');
      console.log('[Video] Amber presenter template downloaded successfully!');
    }
  } catch (err) {
    console.error('[Video] Failed to auto-download Amber presenter:', err.message);
  }
})();

const router = express.Router();

// ── Multer: memory storage for avatar image uploads ───────────────────────────
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are accepted'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/video/upload-avatar
// Receives a user's photo, uploads it to D-ID, returns the D-ID hosted URL.
// The returned URL is then passed as avatarUrl when generating a D-ID talk.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-avatar', avatarUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    }

    // Save the file locally first
    const ext = path.extname(req.file.originalname || '.jpg') || '.jpg';
    const localFilename = `custom_avatar_${Date.now()}${ext}`;
    const localPath = path.join(videoDir, localFilename);
    await fs.promises.writeFile(localPath, req.file.buffer);

    // Perform face restoration / image enhancement
    let finalPath = localPath;
    let finalFilename = localFilename;
    try {
      console.log('[Video/Avatar] Enhancing uploaded custom avatar face...');
      const enhancedPath = await preprocessImage(localPath);
      if (enhancedPath && enhancedPath !== localPath && fs.existsSync(enhancedPath)) {
        finalPath = enhancedPath;
        finalFilename = path.basename(enhancedPath);
        // Overwrite file buffer with enhanced image so D-ID gets the clear photo!
        req.file.buffer = await fs.promises.readFile(finalPath);
        console.log('[Video/Avatar] Custom avatar face successfully enhanced!');
      }
    } catch (preprocessErr) {
      console.error('[Video/Avatar] Face enhancement failed, using original:', preprocessErr.message);
    }

    const localAvatarUrl = `/uploads/video/${finalFilename}`;

    console.log('[Video/Avatar] Saved user photo locally at:', finalPath);

    // Try to upload to D-ID
    const didKey = process.env.DID_API_KEY;
    if (!didKey || didKey.includes('your_') || didKey.includes('your-key')) {
      console.log('[Video/Avatar] D-ID key not configured. Using local fallback.');
      return res.json({
        success: true,
        avatarUrl: null,
        localAvatarUrl,
        message: 'Photo uploaded successfully (local fallback, D-ID API key not configured).'
      });
    }

    // Build D‑ID auth header using robust helper
    const authHeader = await getDIDAuthHeader(didKey);


    console.log('[Video/Avatar] Uploading user photo to D-ID images API...');
    try {
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname || 'avatar.jpg',
        contentType: req.file.mimetype,
      });

      const uploadRes = await axios.post('https://api.d-id.com/images', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: authHeader,
          Accept: 'application/json',
        },
        timeout: 30000,
      });

      const imageUrl = uploadRes.data?.url;
      const imageId  = uploadRes.data?.id;

      if (imageUrl) {
        console.log('[Video/Avatar] D-ID image uploaded successfully:', imageUrl);
        return res.json({ success: true, avatarUrl: imageUrl, imageId, localAvatarUrl });
      } else {
        console.warn('[Video/Avatar] D-ID did not return an image URL. Using local fallback.');
        return res.json({
          success: true,
          avatarUrl: null,
          localAvatarUrl,
          message: 'Photo uploaded successfully (local fallback, D-ID did not return URL).'
        });
      }
    } catch (didErr) {
      console.warn('[Video/Avatar] D-ID API upload failed (using local fallback):', didErr.message);
      if (didErr.response) {
        console.warn('D-ID Response status:', didErr.response.status);
        console.warn('D-ID Response data:', didErr.response.data);
      }
      return res.json({
        success: true,
        avatarUrl: null,
        localAvatarUrl,
        message: `Photo uploaded locally. Note: D-ID API returned error: ${didErr.response?.data?.error || didErr.message}`
      });
    }

  } catch (err) {
    console.error('[Video/Avatar] Route failed:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process avatar image.',
      message: err.message
    });
  }
});

// Read env vars safely
const falKey          = process.env.FAL_KEY;
const klingAccessKey  = process.env.KLING_ACCESS_KEY;
const klingApiKey     = process.env.KLING_API_KEY;      // the one set in .env
const demoMode        = process.env.VIDEO_DEMO_MODE !== 'false';

// Log provider availability on startup
console.log('[Video] FAL_KEY set:', !!falKey);
console.log('[Video] KLING_API_KEY set:', !!klingApiKey);
console.log('[Video] KLING_ACCESS_KEY set:', !!klingAccessKey);
console.log('[Video] Demo mode:', demoMode);

// ---------- Helper: build a clean video prompt ----------
function buildPrompt({ prompt, language, gender }) {
  const parts = [prompt.trim()];
  if (language && language !== 'auto') {
    parts.push(`in ${language} language`);
  }
  if (gender && gender !== 'no character' && gender !== 'none') {
    parts.push(`featuring a ${gender} character`);
  }
  parts.push('cinematic', 'realistic', 'high resolution', 'no watermark');
  return parts.join(', ');
}


// ---------- Helper: try Kling v1 API using Axios ----------
async function tryKling({ finalPrompt, aspectRatio, duration }) {
  const key = klingApiKey || klingAccessKey;
  if (!key) throw new Error('No Kling key available');

  console.log('[Video] Calling Kling API...');
  const response = await axios.post('https://api.klingai.com/v1/videos/text2video', {
    prompt: finalPrompt,
    aspect_ratio: aspectRatio,
    duration: String(duration),
    mode: 'pro',
  }, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  const data = response.data;
  const taskId = data?.data?.task_id;
  if (!taskId) {
    throw new Error(`Kling did not return a task_id. Response: ${JSON.stringify(data)}`);
  }

  console.log(`[Video] Kling task created: ${taskId}. Polling for result...`);

  // Poll up to 90s (18 × 5s)
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const pollResponse = await axios.get(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10000,
      });
      const pollData = pollResponse.data;
      const status = pollData?.data?.task_status;
      console.log(`[Video] Kling poll ${i + 1}/18 status: ${status}`);

      if (status === 'succeed') {
        const videoUrl = pollData?.data?.task_result?.videos?.[0]?.url;
        if (videoUrl) return videoUrl;
        throw new Error('Kling task succeeded but no video URL was returned');
      }
      if (status === 'failed') {
        throw new Error(`Kling task failed: ${pollData?.data?.task_status_msg}`);
      }
    } catch (pollErr) {
      console.warn(`[Video] Kling poll attempt ${i + 1} failed:`, pollErr.message);
    }
  }
  throw new Error('Kling task timed out after 90s');
}

// ---------- Helper: try Fal AI using Axios ----------
async function tryFal({ finalPrompt, aspectRatio, duration }) {
  if (!falKey) throw new Error('FAL_KEY not set');

  console.log('[Video] Calling Fal API...');
  const submitRes = await axios.post('https://queue.fal.run/fal-ai/kling-video/v2.1-pro/text-to-video', {
    prompt: finalPrompt,
    duration: String(duration),
    aspect_ratio: aspectRatio,
  }, {
    headers: {
      Authorization: `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  const submitData = submitRes.data;
  const requestId = submitData?.request_id;
  if (!requestId) {
    throw new Error(`Fal did not return a request_id. Response: ${JSON.stringify(submitData)}`);
  }

  console.log(`[Video] Fal request created: ${requestId}. Polling for result...`);

  // Poll result up to 120s (24 × 5s)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const pollRes = await axios.get(`https://queue.fal.run/fal-ai/kling-video/v2.1-pro/text-to-video/requests/${requestId}`, {
        headers: { Authorization: `Key ${falKey}` },
        timeout: 10000,
      });
      const pollData = pollRes.data;
      console.log(`[Video] Fal poll ${i + 1}/24 status: ${pollData?.status}`);

      if (pollData?.status === 'COMPLETED' || pollData?.video?.url) {
        const videoUrl = pollData?.video?.url || pollData?.data?.video?.url;
        if (videoUrl) return videoUrl;
      }
      if (pollData?.status === 'FAILED') {
        throw new Error(`Fal request failed: ${pollData?.error}`);
      }
    } catch (pollErr) {
      console.warn(`[Video] Fal poll attempt ${i + 1} failed:`, pollErr.message);
    }
  }
  throw new Error('Fal request timed out after 120s');
}

// ═══════════════════════════════════════════════════════════
// POST /api/video/text-to-video
// ═══════════════════════════════════════════════════════════
router.post('/text-to-video', async (req, res) => {
  const {
    prompt,
    script,
    language = 'english',
    gender   = 'none',
    aspectRatio = '16:9',
    duration = 10,
    localAvatarUrl,
  } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, message: 'Prompt is required.' });
  }

  const finalPrompt = buildPrompt({ prompt, language, gender });
  console.log('[Video] Request received — language:', language, '| gender:', gender, '| duration:', duration);
  console.log('[Video] Formatted Prompt:', finalPrompt);

  const errors = [];

  // ── 1. Try Kling ────────────────────────────────────────
  if (klingApiKey || klingAccessKey) {
    try {
      const videoUrl = await tryKling({ finalPrompt, aspectRatio, duration });
      return res.json({ success: true, provider: 'kling', videoUrl });
    } catch (err) {
      console.warn('[Video] Kling execution failed:', err.message);
      errors.push(`Kling: ${err.message}`);
    }
  } else {
    errors.push('Kling: API keys not configured in .env');
  }

  // ── 2. Try Fal AI ───────────────────────────────────────
  if (falKey) {
    try {
      const videoUrl = await tryFal({ finalPrompt, aspectRatio, duration });
      return res.json({ success: true, provider: 'fal', videoUrl });
    } catch (err) {
      console.warn('[Video] Fal execution failed:', err.message);
      errors.push(`Fal: ${err.message}`);
    }
  } else {
    errors.push('Fal: FAL_KEY not configured in .env');
  }

  // ── 3. Demo Mode Fallback — AI Image + Ken Burns animation ──
  // Uses Pollinations.ai (FREE, no API key) to generate an AI image
  // ── 3. Demo Mode – generate AI speaking video using Pollinations image + TTS audio ──
  if (demoMode) {
    try {
      console.log('[Video] Demo mode: generating AI speaking video using looped presenter video + TTS audio');

      // 1. Determine which presenter video/image to use
      let useLocalUploadedImage = false;
      let useVideoPresenter = false;
      let presenterPath = null;

      const amberPath = path.join(videoDir, 'amber_presenter.mp4');
      if (fs.existsSync(amberPath) && fs.statSync(amberPath).size > 0) {
        useVideoPresenter = true;
        presenterPath = amberPath;
        console.log('[Video] Using Amber presenter video template:', presenterPath);
      } else {
        // Fallback to local looped presenter videos if not cached yet
        const presenterFilename = (gender === 'male' || gender === 'boy') ? 'boy_presenter.mp4' : 'girl_presenter.mp4';
        const pPath = path.join(videoDir, presenterFilename);
        if (fs.existsSync(pPath) && fs.statSync(pPath).size > 0) {
          useVideoPresenter = true;
          presenterPath = pPath;
        }
      }

      // 2. Generate TTS audio buffer in-memory directly (avoids localhost port loopback errors)
      const narrationText = script || prompt;
      let audioData;
      try {
        audioData = await generateTTSAudioBuffer(narrationText, language, gender);
        if (!audioData || audioData.length < 100) {
          throw new Error('TTS returned empty or too-small audio data');
        }
      } catch (ttsErr) {
        console.error('[Video] Local TTS buffer generation failed:', ttsErr.message);
        throw new Error(`TTS audio generation failed: ${ttsErr.message}`);
      }
      const audioPath = path.join(__dirname, '../../tmp', `tts_${Date.now()}.mp3`);
      await fs.promises.writeFile(audioPath, audioData);

      const outputPath = path.join(videoDir, `ai_speaking_${Date.now()}.mp4`);
      let ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      if (process.env.FFMPEG_PATH && !fs.existsSync(process.env.FFMPEG_PATH)) {
        console.warn(`[Video] Configured FFMPEG_PATH (${process.env.FFMPEG_PATH}) does not exist. Falling back to global 'ffmpeg' command.`);
        ffmpegPath = 'ffmpeg';
      }
      if (!fs.existsSync(ffmpegPath) && ffmpegPath !== 'ffmpeg') {
        console.error('[Video] ffmpeg binary not found at path:', ffmpegPath);
        throw new Error('ffmpeg executable not found');
      }

      // Target resolution based on aspect ratio
      const targetWidth = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 1024 : 1280;
      const targetHeight = aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 1024 : 720;
      const scaleWidth = targetWidth * 2;
      const scaleHeight = targetHeight * 2;

      if (useLocalUploadedImage) {
        console.log('[Video] Merging user custom face image with TTS audio using dynamic camera movement...');
        // Loop the still user face image with Ken Burns slow zoom-in/pan camera motion, then merge with TTS audio
        const ffmpegCmd = `"${ffmpegPath}" -y -loop 1 -r 10 -i "${presenterPath}" -i "${audioPath}" -vf "scale=${scaleWidth}:${scaleHeight},zoompan=z='min(zoom+0.0005,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=10000:s=${targetWidth}x${targetHeight}:fps=10" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`;
        await new Promise((resolve, reject) => {
          exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
              console.error('[Video] ffmpeg static user face error:', error, stderr);
              return reject(error);
            }
            console.log('[Video] ffmpeg static user face merged successfully');
            resolve();
          });
        });
      } else if (useVideoPresenter) {
        console.log(`[Video] Found presenter video at: ${presenterPath}. Merging with audio...`);
        // Verify presenter video exists and is non-empty
        if (!fs.existsSync(presenterPath) || fs.statSync(presenterPath).size === 0) {
          throw new Error('Presenter video file is missing or empty');
        }
        // Loop the presenter video infinitely, map the TTS audio, and stop when audio ends
        const ffmpegCmd = `"${ffmpegPath}" -y -stream_loop -1 -r 10 -i "${presenterPath}" -i "${audioPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`;
        await new Promise((resolve, reject) => {
          exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
              console.error('[Video] ffmpeg merging error:', error, stderr);
              return reject(error);
            }
            console.log('[Video] ffmpeg merging completed');
            resolve();
          });
        });
      } else {
        // Fallback to static image if no video presenter templates are found
        console.log('[Video] Presenter template not found, falling back to static Pollinations image with dynamic camera movement');
        const imagePrompt = encodeURIComponent(finalPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=${targetWidth}&height=${targetHeight}&nologo=true`;
        
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imgPath = path.join(__dirname, '../../tmp', `prompt_${Date.now()}.jpg`);
        await fs.promises.writeFile(imgPath, imgRes.data);

        const ffmpegCmd = `"${ffmpegPath}" -y -loop 1 -r 10 -i "${imgPath}" -i "${audioPath}" -vf "scale=${scaleWidth}:${scaleHeight},zoompan=z='min(zoom+0.0005,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=10000:s=${targetWidth}x${targetHeight}:fps=10" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`;
        await new Promise((resolve, reject) => {
          exec(ffmpegCmd, (error, stdout, stderr) => {
            if (error) {
              console.error('[Video] ffmpeg static error:', error, stderr);
              return reject(error);
            }
            resolve();
          });
        });
      }

      // Return relative video URL
      const videoRel = `/uploads/video/${path.basename(outputPath)}`;
      return res.json({
        success: true,
        provider: useLocalUploadedImage ? 'custom-face-tts' : useVideoPresenter ? 'presenter-video-tts' : 'pollinations-tts-video',
        demo: true,
        videoUrl: videoRel,
        ttsText: prompt.trim(),
        ttsLanguage: language,
        ttsGender: gender,
        duration: duration,
        message: useVideoPresenter 
          ? 'AI presenter video generated using local avatar template.' 
          : 'AI speaking video generated from your prompt (static image fallback).',
      });
    } catch (err) {
      console.error('[Video] Demo mode failed:', err.message);
      errors.push(`Demo: ${err.message}`);
    }
  }

  // ── 4. If all else fails and demoMode is false ─────────
  return res.status(500).json({
    success: false,
    message: 'Video generation failed. Details: ' + errors.join(' | '),
    errors,
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/video/ask
// Smart mode: Detect question vs topic, generate Gemini AI answer,
// speak it as TTS audio. Returns { answer, audioUrl, isQuestion }
// ═══════════════════════════════════════════════════════════
router.post('/ask', async (req, res) => {
  const { content, language = 'english', gender = 'female' } = req.body ?? {};
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content is required' });
  }

  const trimmed = content.trim();

  // ── Detect if the input is a question ──────────────────────────────────────
  const questionStarters = /^(what|who|where|when|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|shall|have|has|had|define|explain|tell me|describe|give me|list|name|find|show|compare|difference|meaning|means|what's|who's|where's|when's|why's|how's)\b/i;
  const isQuestion = trimmed.endsWith('?') || questionStarters.test(trimmed);

  console.log(`[Video/Ask] Input: "${trimmed.substring(0, 60)}" | isQuestion: ${isQuestion}`);

  try {
    // ── Step 1: Generate spoken AI answer with Gemini ──────────────────────
    let spokenAnswer = trimmed;

    try {
      const { geminiClient } = await import('../config/gemini.js');
      if (geminiClient) {
        const model = geminiClient.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.7, maxOutputTokens: 900, responseMimeType: 'text/plain' },
        });

        const isTamil = language && language.toLowerCase() === 'tamil';
        const targetLangName = isTamil ? 'Tamil' : 'English';

        const systemPrompt = isQuestion
          ? `You are an expert teacher and AI tutor. A student asked you: "${trimmed}"

Your job is to give a complete, clear, spoken classroom explanation. 

CRITICAL LANGUAGE REQUIREMENT:
You must write the entire explanation directly in fluent, natural-sounding, and grammatically correct ${targetLangName}.
${isTamil ? `Follow these rules for Tamil:
1. Keep all technical terms, names of technologies, and frameworks in English letters (e.g. HTML, CSS, JavaScript, React, Database, Software). Do not translate them to literal Tamil.
2. Write all the surrounding grammatical sentences, explanations, transitions, and definitions in fluent Tamil. Keep it natural, warm, and clear like a Tamil teacher speaking in a modern classroom.` : ''}

Structure your answer EXACTLY like this:

PART 1 — INTRODUCTION & DEFINITION (2-3 sentences):
Start with the full proper name if it is an acronym or abbreviation. Define what it is in the simplest possible words. For example, if asked "What is HTML", say: "HTML stands for HyperText Markup Language. It is the standard language used to create and structure content on the web."

PART 2 — PURPOSE & WHY IT MATTERS (2-3 sentences):
Explain WHY it was created and what problem it solves. Use a relatable comparison or analogy to make it clear.

PART 3 — HOW IT IS USED / REAL-WORLD APPLICATIONS (2-3 sentences):
Give concrete, everyday examples of where or how it is used. Make it feel real and relevant to the student's life.

PART 4 — CLOSING SUMMARY (1-2 sentences):
Briefly recap the key idea. End with an encouraging or curiosity-building statement.

STRICT RULES — follow these exactly:
- Write ONLY plain spoken sentences. Zero bullet points, zero numbered lists, zero markdown, zero asterisks, zero code blocks, zero headings, zero symbols
- Use smooth classroom transitions: "In other words...", "For example...", "Think of it this way...", "So essentially...", "To put it simply...", "A great real-world example is..."
- Write between 180 and 260 words — detailed enough to be truly educational, short enough to hold attention
- Write the way a great teacher talks naturally in class, not the way a textbook reads
- Every sentence must be clear enough for a 12-year-old to understand
- The answer must be 100% self-contained and make complete sense when spoken aloud`
          : `You are an expert AI presenter introducing a topic to students in a classroom.
Topic: "${trimmed}"

Write a spoken video introduction that covers these four parts:

CRITICAL LANGUAGE REQUIREMENT:
You must write the entire introduction directly in fluent, natural-sounding, and grammatically correct ${targetLangName}.
${isTamil ? `Follow these rules for Tamil:
1. Keep all technical terms, names of technologies, and frameworks in English letters (e.g. HTML, CSS, JavaScript, React, Database, Software). Do not translate them to literal Tamil.
2. Write all the surrounding grammatical sentences, explanations, transitions, and definitions in fluent Tamil. Keep it natural, warm, and clear like a Tamil teacher speaking in a modern classroom.` : ''}

PART 1 — WHAT IS IT (full name if abbreviated, clear one-line definition)
PART 2 — PURPOSE (why it exists, what problem it solves)
PART 3 — HOW IT IS USED (2 real-world examples, concrete and relatable)
PART 4 — CLOSING (key takeaway + invite the viewer to learn more)

STRICT RULES:
- Write ONLY plain spoken sentences. No bullet points, no markdown, no asterisks, no code, no headings
- Use transitions: "In other words...", "For example...", "To put it simply...", "And that's why..."
- 150 to 220 words total — rich enough to be informative, concise enough for a video intro
- Sound warm, clear and engaging — like a great teacher on the first day of class`;


        const result = await model.generateContent(systemPrompt);
        const text = (await result.response.text()).trim();
        if (text && text.length > 30) {
          spokenAnswer = text;
          console.log(`[Video/Ask] Gemini answer generated (${text.length} chars)`);
        }
      }
    } catch (geminiErr) {
      console.warn('[Video/Ask] Gemini failed, using raw input as answer:', geminiErr.message);
    }

    // Clean up headers from the spoken audio script so they aren't read by the voice
    const cleanSpokenAnswer = spokenAnswer
      .replace(/PART\s*1\s*[-—:]*\s*INTRODUCTION\s*&\s*DEFINITION\s*(\(2-3\s*sentences\))?\s*[-—:]*/gi, '')
      .replace(/PART\s*2\s*[-—:]*\s*PURPOSE\s*&\s*WHY\s*IT\s*MATTERS\s*(\(2-3\s*sentences\))?\s*[-—:]*/gi, '')
      .replace(/PART\s*3\s*[-—:]*\s*HOW\s*IT\s*IS\s*USED\s*(\/\s*REAL-WORLD\s*APPLICATIONS)?\s*(\(2-3\s*sentences\))?\s*[-—:]*/gi, '')
      .replace(/PART\s*4\s*[-—:]*\s*CLOSING\s*SUMMARY\s*(\(1-2\s*sentences\))?\s*[-—:]*/gi, '')
      .replace(/PART\s*4\s*[-—:]*\s*CLOSING\s*(\(key\s*takeaway\s*\+\s*invite\s*the\s*viewer\s*to\s*learn\s*more\))?\s*[-—:]*/gi, '')
      .replace(/PART\s*[1234]\s*[-—:]*/gi, '')
      .trim();

    // ── Step 2: Generate TTS audio ─────────────────────────────────────────
    const audioBuffer = await generateTTSAudioBuffer(cleanSpokenAnswer, language, gender);

    // Save audio to a temp file so the browser can stream it
    const requestId = `ask_${Date.now()}`;
    const audioDir = path.resolve(__dirname, '../uploads/talkify');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    const audioPath = path.join(audioDir, `${requestId}.mp3`);
    fs.writeFileSync(audioPath, audioBuffer);

    const audioUrl = `/uploads/talkify/${requestId}.mp3`;

    console.log(`[Video/Ask] TTS audio saved: ${audioUrl} (${audioBuffer.length} bytes)`);

    return res.json({
      success: true,
      isQuestion,
      answer: cleanSpokenAnswer,
      audioUrl,
      language,
      gender,
    });

  } catch (err) {
    console.error('[Video/Ask] Failed:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Failed to generate spoken answer.' });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/video/tts
// ═══════════════════════════════════════════════════════════

router.get('/tts', async (req, res) => {
  const { text, lang = 'english', gender = 'female' } = req.query;
  if (!text || !text.trim()) {
    return res.status(400).send('Text query parameter is required.');
  }

  try {
    const audioBuffer = await generateTTSAudioBuffer(text, lang, gender);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[Video TTS] Failed to generate TTS:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Failed to synthesize speech.');
    }
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/video/config
// Checks status, validity, and remaining credits for D-ID and HeyGen keys
// ═══════════════════════════════════════════════════════════
router.get('/config', async (req, res) => {
  const didKey = process.env.DID_API_KEY || '';
  const heyGenKey = process.env.HEYGEN_API_KEY || '';

  const status = {
    did: {
      configured: !!didKey && !didKey.includes('your_') && !didKey.includes('your-key'),
      valid: false,
      credits: 0,
      details: 'Not configured or empty',
    },
    heyGen: {
      configured: !!heyGenKey && !heyGenKey.includes('your_') && !heyGenKey.includes('your-key'),
      valid: false,
      balance: 0,
      details: 'Not configured or empty',
    }
  };

  // Test D-ID key
  if (status.did.configured) {
    try {
      const authHeader = await getDIDAuthHeader(didKey);
      const response = await axios.get('https://api.d-id.com/credits', {
        headers: { Authorization: authHeader },
        timeout: 10000,
      });
      status.did.valid = true;
      // D-ID returns credits response like: { "remaining": 0, "total": 12 } or similar
      status.did.credits = response.data?.remaining ?? response.data?.credits?.[0]?.remaining ?? 0;
      status.did.details = `Success. Remaining credits: ${status.did.credits}`;
    } catch (err) {
      status.did.valid = false;
      if (err.response?.status === 401) {
        status.did.details = 'Invalid API key credentials';
      } else if (err.response?.data?.kind === 'InsufficientCreditsError' || err.response?.status === 402) {
        status.did.details = 'Insufficient credits (0 remaining)';
      } else {
        status.did.details = err.response?.data?.description || err.response?.data?.error?.message || err.message;
      }
    }
  }

  // Test HeyGen key
  if (status.heyGen.configured) {
    try {
      const response = await axios.get('https://api.heygen.com/v1/user/me', {
        headers: { 'X-Api-Key': heyGenKey.trim() },
        timeout: 10000,
      });
      status.heyGen.valid = true;
      // HeyGen returns response like: { code: 100, data: { wallet: { remaining_balance: 0 } } }
      const wallet = response.data?.data?.wallet;
      status.heyGen.balance = wallet?.remaining_balance ?? 0;
      status.heyGen.details = `Success. Remaining balance: $${status.heyGen.balance}`;
    } catch (err) {
      status.heyGen.valid = false;
      if (err.response?.status === 401) {
        status.heyGen.details = 'Invalid API key credentials';
      } else {
        status.heyGen.details = err.response?.data?.error?.message || err.response?.data?.msg || err.message;
      }
    }
  }

  return res.json({ success: true, status });
});

// ═══════════════════════════════════════════════════════════
// POST /api/video/config
// Saves D-ID and HeyGen keys into server/.env file and updates process.env in memory
// ═══════════════════════════════════════════════════════════
router.post('/config', async (req, res) => {
  const { didApiKey, heyGenApiKey } = req.body;

  try {
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Function to replace or append a key-value pair in .env content
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
      const newValueLine = `${key}=${value.trim()}`;
      if (regex.test(content)) {
        return content.replace(regex, newValueLine);
      } else {
        // Ensure there's a trailing newline if adding to end
        return content.trim() + `\n${newValueLine}\n`;
      }
    };

    let updatedContent = envContent;
    if (typeof didApiKey === 'string') {
      updatedContent = updateEnvVar(updatedContent, 'DID_API_KEY', didApiKey);
      process.env.DID_API_KEY = didApiKey.trim();
    }
    if (typeof heyGenApiKey === 'string') {
      updatedContent = updateEnvVar(updatedContent, 'HEYGEN_API_KEY', heyGenApiKey);
      process.env.HEYGEN_API_KEY = heyGenApiKey.trim();
    }

    fs.writeFileSync(envPath, updatedContent, 'utf8');
    console.log('[Video Config] Successfully updated server/.env file keys');

    return res.json({ success: true, message: 'API keys updated successfully.' });
  } catch (err) {
    console.error('[Video Config] Error saving API keys:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to save API keys to server/.env' });
  }
});

export default router;
export { router as videoRoutes };

