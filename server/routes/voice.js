// server/routes/voice.js
import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const upload = multer({ dest: 'uploads/temp_audio/' });

// Create temp directory for uploads if not exists
const tempAudioDir = path.resolve(__dirname, '../uploads/temp_audio');
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}

// ElevenLabs base headers helper
function getElevenLabsHeaders() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('ElevenLabs API Key is not configured in .env');
  }
  return { 'xi-api-key': apiKey.trim() };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/clone
// Body: name (string), description (string)
// File: file (binary recording wav/mp3)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/clone', upload.single('file'), async (req, res) => {
  const file = req.file;
  const { name = 'Custom Voice', description = 'My Cloned Voice' } = req.body;

  if (!file) {
    return res.status(400).json({ success: false, error: 'Audio file is required for voice cloning.' });
  }

  try {
    const headers = getElevenLabsHeaders();
    const form = new FormData();
    form.append('name', name);
    form.append('description', description);
    form.append('files', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    console.log(`[Voice/Clone] Uploading audio to ElevenLabs to clone "${name}"...`);
    const response = await axios.post('https://api.elevenlabs.io/v1/voices/add', form, {
      headers: {
        ...headers,
        ...form.getHeaders(),
      },
      timeout: 45000,
    });

    // Cleanup local temp file
    try { fs.unlinkSync(file.path); } catch (_) {}

    const voiceId = response.data?.voice_id;
    console.log(`[Voice/Clone] Voice cloned successfully! VoiceID: ${voiceId}`);

    return res.json({
      success: true,
      voiceId,
      name,
      message: 'Voice cloned successfully into your ElevenLabs library!',
    });
  } catch (err) {
    // Cleanup local temp file
    try { if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}

    console.error('[Voice/Clone] Voice cloning failed:', err.message);
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    return res.status(500).json({
      success: false,
      error: 'Voice cloning failed. Make sure your ElevenLabs API Key is correct and has remaining credits.',
      detail,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/voice/list
// Returns all custom and default ElevenLabs voices
// ─────────────────────────────────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const headers = getElevenLabsHeaders();
    console.log('[Voice/List] Fetching voices from ElevenLabs...');
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', { headers, timeout: 15000 });
    
    const voices = (response.data?.voices || []).map(v => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      previewUrl: v.preview_url,
      description: v.description || '',
    }));

    return res.json({ success: true, voices });
  } catch (err) {
    console.warn('[Voice/List] ElevenLabs list failed, returning default fallbacks:', err.message);
    // Return standard default voice models if ElevenLabs is not set up
    return res.json({
      success: true,
      elevenLabsConfigured: false,
      voices: [
        { voiceId: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Female - Warm)', category: 'premade', description: 'Warm and professional female narrator' },
        { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Female - Excited)', category: 'premade', description: 'Energetic and enthusiastic female voice' },
        { voiceId: 'ErXwobaYiN019atkyzla', name: 'Antoni (Male - Clear)', category: 'premade', description: 'Clear and natural male speaker' },
        { voiceId: 'pNInz6obpmmqZgguiGC7', name: 'Giovanni (Male - Deep)', category: 'premade', description: 'Deep, engaging male baritone voice' },
      ],
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/generate
// Synthesizes custom speech with optional emotion controls (stability, similarity, style)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const {
    text,
    voiceId = 'ErXwobaYiN019atkyzla', // Antoni default
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true,
  } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Text content is required for speech synthesis.' });
  }

  try {
    const headers = getElevenLabsHeaders();
    console.log(`[Voice/Generate] Calling ElevenLabs text-to-speech for voice "${voiceId}"...`);

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text.trim(),
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: parseFloat(stability),
          similarity_boost: parseFloat(similarityBoost),
          style: parseFloat(style),
          use_speaker_boost: !!useSpeakerBoost,
        },
      },
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    // Save output in static uploads directory for direct download/playing
    const outDir = path.resolve(__dirname, '../uploads/voice_outputs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const filename = `eleven_${Date.now()}.mp3`;
    const filepath = path.join(outDir, filename);
    fs.writeFileSync(filepath, Buffer.from(response.data));

    const relativeUrl = `/uploads/voice_outputs/${filename}`;
    console.log('[Voice/Generate] Speech synthesized successfully. Saved to:', relativeUrl);

    return res.json({
      success: true,
      audioUrl: relativeUrl,
      filename,
    });
  } catch (err) {
    console.error('[Voice/Generate] ElevenLabs synthesis failed:', err.message);
    // If ElevenLabs fails, fallback to our Edge-TTS/StreamElements local endpoint helper
    try {
      console.log('[Voice/Generate] Falling back to standard ttsHelper synthesis...');
      const { generateTTSAudioBuffer } = await import('../utils/ttsHelper.js');
      const fallbackBuffer = await generateTTSAudioBuffer(text, 'english', 'male');
      
      const outDir = path.resolve(__dirname, '../uploads/voice_outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const filename = `fallback_${Date.now()}.mp3`;
      const filepath = path.join(outDir, filename);
      fs.writeFileSync(filepath, fallbackBuffer);

      const relativeUrl = `/uploads/voice_outputs/${filename}`;
      return res.json({
        success: true,
        audioUrl: relativeUrl,
        filename,
        message: 'Synthesized using free fallback TTS (ElevenLabs API Key not configured or limit reached).',
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        success: false,
        error: 'TTS synthesis failed.',
        detail: fallbackErr.message,
      });
    }
  }
});

export default router;
