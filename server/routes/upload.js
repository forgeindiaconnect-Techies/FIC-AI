const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration – keep original filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // prepend timestamp to avoid collisions
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ storage });

// POST /api/upload   – accept multiple files (ppt, pdf, images)
router.post('/', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const fileInfos = req.files.map(f => ({
    originalName: f.originalname,
    storedName: f.filename,
    path: f.path,
    size: f.size,
    mimeType: f.mimetype
  }));
  res.json({ message: 'Files uploaded successfully', files: fileInfos });
});

// POST /api/voice   – accept a single audio recording (webm)
router.post('/voice', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  // Placeholder: In a real implementation you would send the audio to a speech‑to‑text service
  // and then forward the transcript to the AI model.
  res.json({ message: 'Voice audio received', file: req.file.filename });
});

module.exports = router;
