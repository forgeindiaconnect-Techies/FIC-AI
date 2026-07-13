import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import fs from 'fs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const logFile = path.resolve(__dirname, 'test_providers.log');
fs.writeFileSync(logFile, `=== Provider Test Started at ${new Date().toISOString()} ===\n`);

function log(msg, ...args) {
  const line = `${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  console.log(msg, ...args);
  fs.appendFileSync(logFile, line);
}

async function testFFmpeg() {
  log('--- TESTING FFMEG H.264 ENCODING ---');
  let ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  log('FFmpeg path:', ffmpegPath);

  const testOutput = path.resolve(__dirname, 'test_h264.mp4');
  if (fs.existsSync(testOutput)) {
    try { fs.unlinkSync(testOutput); } catch (_) {}
  }

  // Generate a 1-second blank video using libx264
  const cmd = `"${ffmpegPath}" -y -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 -pix_fmt yuv420p "${testOutput}"`;
  log('Running command:', cmd);

  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        log('❌ FFmpeg encoding FAILED:', err.message);
        log('stderr:', stderr);
      } else {
        log('✅ FFmpeg encoding SUCCESSFUL! Output exists:', fs.existsSync(testOutput));
      }
      resolve();
    });
  });
}

async function testDID() {
  const didKey = process.env.DID_API_KEY;
  log('--- TESTING D-ID ---');
  log('DID_API_KEY from .env:', didKey ? `${didKey.slice(0, 4)}...${didKey.slice(-4)}` : 'empty');
  if (!didKey) {
    log('D-ID key is empty.');
    return;
  }

  const authHeader1 = 'Basic ' + Buffer.from(`${didKey.trim()}:`).toString('base64');
  const authHeader2 = 'Basic ' + Buffer.from(didKey.trim()).toString('base64');
  const authHeader3 = didKey.trim().startsWith('Basic ') ? didKey.trim() : 'Basic ' + didKey.trim();

  // Also try formatting basic credentials if it is base64(email):password
  let authHeader4 = null;
  const rawKey = didKey.trim();
  if (rawKey.includes(':')) {
    const colonIdx = rawKey.indexOf(':');
    const leftPart = rawKey.substring(0, colonIdx);
    const rightPart = rawKey.substring(colonIdx + 1);
    let decodedLeft;
    try {
      decodedLeft = Buffer.from(leftPart, 'base64').toString('utf8');
    } catch(e) {
      decodedLeft = leftPart;
    }
    if (decodedLeft.includes('@')) {
      const credential = `${decodedLeft}:${rightPart}`;
      authHeader4 = 'Basic ' + Buffer.from(credential).toString('base64');
    }
  }

  const headersList = [
    { name: 'Basic key:', header: authHeader1 },
    { name: 'Basic key (no trailing colon):', header: authHeader2 },
    { name: 'Raw didKey:', header: authHeader3 }
  ];
  if (authHeader4) {
    headersList.push({ name: 'Base64 email:password decoded & re-encoded:', header: authHeader4 });
  }

  for (const item of headersList) {
    try {
      log(`Checking header format "${item.name}"...`);
      const res = await axios.get('https://api.d-id.com/credits', {
        headers: { Authorization: item.header }
      });
      log(`✅ SUCCESS with "${item.name}"! Response:`, res.data);
      return;
    } catch (err) {
      log(`❌ FAILED with "${item.name}": status ${err.response?.status}, error:`, err.response?.data || err.message);
    }
  }
}

async function testHeyGen() {
  const heyGenKey = process.env.HEYGEN_API_KEY;
  log('--- TESTING HEYGEN ---');
  log('HEYGEN_API_KEY from .env:', heyGenKey ? `${heyGenKey.slice(0, 4)}...${heyGenKey.slice(-4)}` : 'empty');
  if (!heyGenKey) {
    log('HeyGen key is empty.');
    return;
  }

  try {
    const res = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: {
        'X-Api-Key': heyGenKey.trim()
      }
    });
    log('✅ HeyGen V2 Success! Number of avatars:', res.data?.data?.avatars?.length);
  } catch (err) {
    log('❌ HeyGen V2 Failed: status:', err.response?.status, 'error:', err.response?.data || err.message);
  }
}

export async function run() {
  try {
    await testFFmpeg();
    log('\n');
    await testDID();
    log('\n');
    await testHeyGen();
  } catch (e) {
    log('Test runner error:', e.message);
  }
}
