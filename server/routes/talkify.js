// server/routes/talkify.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { generateTtsAudio } from '../utils/tts.js';
import { generateTalkVideo } from '../utils/videoGeneration.js';
import { preprocessImage } from '../utils/imagePreprocess.js';
const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'uploads', 'talkify') });

/**
 * POST /api/talkify
 * multipart/form-data:
 *   - image: PNG/JPEG portrait (required)
 *   - text: script to speak (optional, if no audio provided)
 *   - audio: pre‑recorded wav/mp3 (optional, overrides TTS)
 */
router.post('/', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), async (req, res) => {
  try {
    const imageFile = req.files?.image?.[0];
    if (!imageFile) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    // Determine audio source
    let audioPath;
    if (req.files?.audio?.[0]) {
      audioPath = req.files.audio[0].path;
    } else if (req.body.text) {
      const ttsResult = await generateTtsAudio(req.body.text);
      audioPath = ttsResult.filePath;
    } else {
      return res.status(400).json({ success: false, error: 'Either audio file or text is required' });
    }

    // Generate a unique folder for this request
    const requestId = uuidv4();
    const outDir = path.join(process.cwd(), 'uploads', 'talkify', requestId);
    fs.mkdirSync(outDir, { recursive: true });

    // Copy the input image to the working folder (Wav2Lip expects a file path)
    // Enhance the uploaded image (face restoration, up‑scaling, etc.)
    const rawImagePath = path.join(outDir, 'portrait' + path.extname(imageFile.originalname));
    fs.copyFileSync(imageFile.path, rawImagePath);
    const imagePath = await preprocessImage(rawImagePath);

    // Run the video generation pipeline (lip‑sync + optional motion)
    const videoPath = await generateTalkVideo({ imagePath, audioPath, outDir });

    // Serve the video from the static /uploads route (already exposed in server/index.js)
    const videoUrl = `/uploads/talkify/${requestId}/${path.basename(videoPath)}`;
    return res.json({ success: true, videoUrl });
  } catch (err) {
    console.error('Talkify error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
