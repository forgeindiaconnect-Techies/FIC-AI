// server/index.js – Main entrypoint (reload trigger: 2026-07-01T11:52)
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import dotenv from "dotenv";

import fs from "fs";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Force Node.js to resolve DNS results with IPv4 first
dns.setDefaultResultOrder("ipv4first");
// Load environment variables from .env inside server folder
dotenv.config({ path: path.resolve(__dirname, ".env") });


// Verify required API keys are loaded (without printing the keys)
console.log("FAL exists:", !!process.env.FAL_KEY);
console.log("KLING exists:", !!process.env.KLING_API_KEY);

// Startup configuration




// Auto-copy the user's uploaded logo on startup/restart
try {
  const srcLogo = "C:/Users/Forgeindiaconnect/.gemini/antigravity-ide/brain/f758eab9-9ec7-4b1d-b700-185c53f0ac1c/media__1781671808731.png";
  const destLogo = path.resolve(__dirname, "../client/public/forge_india_logo.png");
  if (fs.existsSync(srcLogo)) {
    fs.copyFileSync(srcLogo, destLogo);
    console.log("✅ Successfully copied brand logo to client/public/forge_india_logo.png");
  }
} catch (e) {
  console.error("❌ Logo copy error:", e.message);
}

// Auto-download high-quality D-ID Mia Sport presenter on startup/restart
async function downloadDefaultPresenters() {
  const videoDir = path.resolve(__dirname, 'uploads/video');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const girlPath = path.join(videoDir, 'girl_presenter.mp4');
  const boyPath = path.join(videoDir, 'boy_presenter.mp4');

  // 1. Download girl presenter (Mia Sport)
  console.log('[Startup] Checking/downloading high-quality D-ID Mia Sport female presenter...');
  try {
    const response = await axios({
      method: 'get',
      url: 'https://expressive-avatars.d-id.com/PUBLIC_D-ID/mia_sport/avt_cQ7ccr/avatar_assets/talking_preview.mp4',
      responseType: 'stream',
      timeout: 30000,
    });
    const writer = fs.createWriteStream(girlPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log('✅ Successfully cached girl_presenter.mp4 (Mia Sport)');
  } catch (err) {
    console.error('❌ Failed to download D-ID Mia Sport presenter:', err.message);
  }

  // 2. Download boy presenter (Try candidates from D-ID public clips presenters database)
  let boySuccess = false;
  let forceDownloadBoy = true;
  
  if (fs.existsSync(boyPath) && fs.existsSync(girlPath)) {
    const boySize = fs.statSync(boyPath).size;
    const girlSize = fs.statSync(girlPath).size;
    // If they have different sizes and boy video is non-empty, we already have a real male presenter
    if (boySize !== girlSize && boySize > 10000) {
      forceDownloadBoy = false;
      boySuccess = true;
      console.log('✅ Local cached boy_presenter.mp4 is already a valid male video.');
    }
  }

  if (forceDownloadBoy) {
    console.log('[Startup] Overwriting/downloading high-quality D-ID male presenter (Adam)...');
    const boyUrls = [
      'https://clips-presenters.d-id.com/v2/Adam/0GLJgELXjc/j0HIbyxjap/talkingPreview.mp4',
      'https://clips-presenters.d-id.com/v2/Adam/36wCtvjdAi/C6evUUgPyQ/talkingPreview.mp4',
      'https://clips-presenters.d-id.com/v2/Adam/3nQpC4_Jzm/XVPmCvaw_C/talkingPreview.mp4'
    ];

    for (const url of boyUrls) {
      if (boySuccess) break;
      console.log(`[Startup] Downloading male presenter from: ${url}`);
      try {
        const response = await axios({
          method: 'get',
          url: url,
          responseType: 'stream',
          timeout: 20000,
        });
        const writer = fs.createWriteStream(boyPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        console.log('✅ Successfully cached boy_presenter.mp4 (Adam)');
        boySuccess = true;
      } catch (err) {
        console.warn(`[Startup] Failed downloading male presenter from candidate URL:`, err.message);
      }
    }
  }

  // If no male candidate works and we don't have a valid file, copy female presenter as a last resort
  if (!boySuccess && !fs.existsSync(boyPath)) {
    try {
      if (fs.existsSync(girlPath)) {
        fs.copyFileSync(girlPath, boyPath);
        console.log('ℹ️ No male candidate succeeded; copied girl_presenter.mp4 as boy_presenter.mp4 fallback');
      }
    } catch (e) {
      console.error('[Startup] Failed to create boy presenter fallback:', e.message);
    }
  }
}

// Trigger presenter download on startup asynchronously
downloadDefaultPresenters().catch(err => console.error('[Startup] Presenter download failed:', err.message));

console.log("POSTER_PROVIDER:", process.env.POSTER_PROVIDER);
console.log("IDEOGRAM KEY EXISTS:", !!process.env.IDEOGRAM_API_KEY);
console.log("IDEOGRAM KEY START:", process.env.IDEOGRAM_API_KEY?.slice(0, 4));

import express from "express";
import cors from 'cors';
import mongoose from 'mongoose';
import chatRoutes     from './routes/chatRoutes.js';
import chatsRoutes   from './routes/chatsRoutes.js';
import imageRoutes   from './routes/image.js';
import documentRoutes from './routes/documents.js';
import posterRoutes   from './routes/poster.js';
import * as storage  from './utils/storage.js';
import videoRoutes from './routes/video.js';
import talkifyRoutes from './routes/talkify.js';
import voiceRoutes from './routes/voice.js';
import resumeRoutes from './routes/resume.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';


const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5182',
  'https://fic-ai.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ── Serve generated files (PDF, DOCX, PPTX, XLSX downloads) with CORS headers ──
app.use('/generated', express.static(path.join(__dirname, 'generated'), {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));
app.use('/downloads', express.static(path.join(__dirname, 'uploads', 'documents'), {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads', 'images'), {
  setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*')
}));

// ── MongoDB connection ────────────────────────────────────────────────────────
const rawMongoUri = process.env.MONGODB_URI;
console.log("RAW MONGODB_URI:", rawMongoUri);
console.log("STARTS WITH:", rawMongoUri?.slice(0, 20));
const mongoUri = rawMongoUri?.trim();
import { setMongoStatus } from './utils/dbStatus.js';

if (!mongoUri || (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://"))) {
  console.warn("⚠️  MONGODB_URI not loaded correctly");
  setMongoStatus(false);
} else {
  try {
    mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 10000,
      family: 4 // Force IPv4
    })
      .then(() => {
        console.log("✅ MongoDB Connected");
        setMongoStatus(true);
      })
      .catch(err => {
        console.warn("⚠️  MongoDB connection failed:", err);
        setMongoStatus(false);
      });
  } catch (err) {
    console.error("❌ Mongoose connection synchronous error:", err.message);
    setMongoStatus(false);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/chat',      chatRoutes);
app.use('/api/chats',    chatsRoutes);
app.use('/api/image',    imageRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/poster',    posterRoutes);
app.use('/api/video',    videoRoutes);
app.use('/api/talkify', talkifyRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api', paymentRoutes);
app.use('/api', adminRoutes);

// ── Root & health ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('FIC AI Backend running'));
app.get('/api/health', (_req, res) =>
  res.json({
    success: true,
    message: `Backend on port ${process.env.PORT || 5001}`,
    model: process.env.OLLAMA_MODEL || 'phi3',
    pid: process.pid,
    uptime: process.uptime()
  })
);

// ── Delete a chat session ─────────────────────────────────────────────────────
app.delete('/api/chats/:id', async (req, res) => {
  try {
    await storage.deleteChatSession(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting chat:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Express error:', err);
  try {
    const diagPath = path.resolve(__dirname, 'diagnostics.txt');
    const logContent = `
========================================
[${new Date().toISOString()}] EXPRESS GLOBAL ERROR
Route: ${req.method} ${req.url}
Error: ${err.message}
Stack: ${err.stack}
========================================
`;
    fs.appendFileSync(diagPath, logContent, 'utf8');
  } catch (diagErr) {
    console.error('Failed to write global error to diagnostics:', diagErr);
  }
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

process.on('uncaughtException',   err => console.error('Uncaught Exception:',  err));
process.on('unhandledRejection',  err => console.error('Unhandled Rejection:', err));

let PORT = parseInt(process.env.PORT) || 5001;
const startServer = () => {
  const server = app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT} | Model: ${process.env.OLLAMA_MODEL || 'phi3'}`)
  );
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${PORT} already in use, trying ${PORT + 1}`);
      PORT += 1;
      startServer();
    } else {
      console.error('❌ Server error:', err);
    }
  });
};
startServer();
