const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fetch = require('node-fetch');
const File = require('../models/File');

const router = express.Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({ storage });

// Helper: extract text based on mime
async function extractText(filePath, mime) {
  const data = await fs.promises.readFile(filePath);
  if (mime === 'application/pdf') {
    const parsed = await pdfParse(data);
    return parsed.text;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mime === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
  }
  // txt or unknown plain text
  return data.toString('utf8');
}

// Helper: call Ollama for summarization or QA
async function ollamaGenerate(prompt) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3:latest';
  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!res.ok) throw new Error('Ollama error');
  const json = await res.json();
  return json.response;
}

// POST /api/files/upload – handle multiple file uploads, extract, summarize, store metadata
router.post('/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  try {
    const savedFiles = [];
    for (const f of req.files) {
      const content = await extractText(f.path, f.mimetype);
      const summary = await ollamaGenerate(`Summarize the following text in a concise paragraph (max 3 sentences):\n\n${content}`);
      const fileDoc = new File({
        originalName: f.originalname,
        storedName: f.filename,
        mime: f.mimetype,
        size: f.size,
        content,
        summary
      });
      await fileDoc.save();
      savedFiles.push({ id: fileDoc._id, originalName: f.originalname, summary });
    }
    res.json({ message: 'Files processed', files: savedFiles });
  } catch (err) {
    console.error('File upload processing error:', err);
    res.status(500).json({ error: 'Failed to process files' });
  }
});

// POST /api/files/ask – answer a question based on a specific file's content
router.post('/ask', async (req, res) => {
  const { fileId, question } = req.body;
  if (!fileId || !question) {
    return res.status(400).json({ error: 'fileId and question are required' });
  }
  try {
    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    const prompt = `Answer the following question using ONLY the provided text. If the answer is not present, respond with "I don't know."\n\nText:\n${file.content}\n\nQuestion: ${question}`;
    const answer = await ollamaGenerate(prompt);
    res.json({ answer });
  } catch (err) {
    console.error('Ask error:', err);
    res.status(500).json({ error: 'Failed to get answer' });
  }
});

module.exports = router;
