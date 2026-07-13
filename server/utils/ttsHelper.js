// server/utils/ttsHelper.js
import axios from 'axios';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates TTS audio buffer using Microsoft Edge Neural TTS with a Google Translate TTS fallback.
 * 
 * @param {string} text The text script to speak
 * @param {string} lang The language ('english' or 'tamil')
 * @param {string} gender The voice gender ('male'/'boy' or 'female'/'girl')
 * @returns {Promise<Buffer>} The synthesized audio as a buffer
 */
export async function generateTTSAudioBuffer(text, lang = 'english', gender = 'female') {
  const isTamil = lang.toLowerCase() === 'tamil' || lang.toLowerCase() === 'ta';
  const isMale = ['male', 'boy', 'male_presenter'].includes((gender || '').toLowerCase());

  // Strip emojis and special symbols to prevent remote API errors
  let cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F0F5}\u{2600}-\u{26FF}]/gu, '')
    .trim();

  if (!isTamil) {
    cleanText = cleanText
      .replace(/[^\x00-\x7F]/g, '') // strip smart quotes/dashes/non-ASCII characters for English
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
  }
  const buffers = [];

  // 0. Try ElevenLabs TTS first if API Key is configured and we want a premium voice
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'your_elevenlabs_api_key') {
    try {
      console.log(`[TTS Helper] Attempting ElevenLabs TTS generation...`);
      // Use the user's specific requested male voice, otherwise use Rachel for female
      const voiceId = isMale ? 'NbkKnEAZ7Bqw4EAkVEaz' : '21m00Tcm4TlvDq8ikWAM';
      
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: cleanText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY.trim(),
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 20000,
        }
      );

      const buffer = Buffer.from(response.data);
      if (buffer.length > 500) {
        console.log(`[TTS Helper] ElevenLabs TTS generation successful (${buffer.length} bytes, voice="${voiceId}")`);
        return buffer;
      }
    } catch (err) {
      console.warn(`[TTS Helper] ElevenLabs TTS failed:`, err.message);
    }
  }

  // 0.1. Try OpenAI TTS first if API Key is configured
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key') {
    try {
      console.log(`[TTS Helper] Attempting OpenAI TTS generation...`);
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: isMale ? "onyx" : "nova",
        input: cleanText,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      if (buffer.length > 500) {
        console.log(`[TTS Helper] OpenAI TTS generation successful (${buffer.length} bytes)`);
        return buffer;
      }
    } catch (err) {
      console.warn(`[TTS Helper] OpenAI TTS failed:`, err.message);
    }
  }

  // Determine the best Microsoft Edge neural voice name
  let edgeVoice = 'en-US-JennyNeural';
  if (isTamil) {
    edgeVoice = isMale ? 'ta-IN-ValluvarNeural' : 'ta-IN-PallaviNeural';
  } else {
    edgeVoice = isMale ? 'en-US-GuyNeural' : 'en-US-JennyNeural';
  }

  console.log(`[TTS Helper] Edge-TTS requested: language="${lang}", gender="${gender}" -> voice="${edgeVoice}"`);

  // 1. Try Microsoft Edge TTS via generate_edge_tts.py
  try {
    let pythonCmd = 'python';
    const candidates = [
      path.resolve(__dirname, '../../../venv/Scripts/python.exe'),
      path.resolve(__dirname, '../../venv/Scripts/python.exe'),
      path.resolve(__dirname, '../../../../venv/Scripts/python.exe'),
      path.resolve(__dirname, '../../../venv/bin/python'),
      path.resolve(__dirname, '../../venv/bin/python'),
      path.resolve(__dirname, '../../../../venv/bin/python')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        pythonCmd = `"${p}"`;
        break;
      }
    }

    // Auto-install edge-tts if missing
    try {
      execSync(`${pythonCmd} -c "import edge_tts"`, { stdio: 'ignore' });
    } catch (_) {
      console.log('[TTS Helper] edge-tts python library is missing. Attempting auto-installation...');
      try {
        execSync(`${pythonCmd} -m pip install edge-tts`, { stdio: 'ignore' });
        console.log('[TTS Helper] edge-tts python library auto-installed successfully!');
      } catch (pipErr) {
        console.warn('[TTS Helper] Failed to auto-install edge-tts:', pipErr.message);
      }
    }

    const ttsScript = path.resolve(__dirname, '../python/generate_edge_tts.py');
    const outDir = path.resolve(__dirname, '../uploads/video');
    fs.mkdirSync(outDir, { recursive: true });

    const ts = Date.now();
    const tempTextPath = path.join(outDir, `temp_tts_script_${ts}.txt`);
    const tempOutPath  = path.join(outDir, `temp_tts_${ts}.mp3`);

    // Write text to a file to avoid shell cmd-line length/escaping issues
    fs.writeFileSync(tempTextPath, cleanText, 'utf8');

    const cmd = `${pythonCmd} "${ttsScript}" --text-file "${tempTextPath}" --voice "${edgeVoice}" --output "${tempOutPath}"`;
    console.log('[TTS Helper] Running Edge-TTS command (text-file mode, length:', cleanText.length, 'chars)');
    execSync(cmd, { timeout: 60000 });

    // Cleanup temp text file
    try { fs.unlinkSync(tempTextPath); } catch (e) {}

    if (fs.existsSync(tempOutPath)) {
      const buffer = fs.readFileSync(tempOutPath);
      try { fs.unlinkSync(tempOutPath); } catch (e) {}
      if (buffer.length > 500) {
        console.log(`[TTS Helper] Edge-TTS synthesis successful (${buffer.length} bytes, ${cleanText.length} chars spoken)`);
        return buffer;
      }
    }
    throw new Error('Edge-TTS output file missing or empty');
  } catch (seErr) {
    console.warn(`[TTS Helper] Edge-TTS failed (${seErr.message}). Trying StreamElements fallback...`);
    try {
      const diagPath = path.resolve(__dirname, '../diagnostics_tts.txt');
      fs.appendFileSync(diagPath, `\n[${new Date().toISOString()}] Edge-TTS error: ${seErr.message}\nStack: ${seErr.stack}\n`, 'utf8');
    } catch (_) {}
  }

  // 1.5. StreamElements TTS Fallback (Free cloud API, supports high-quality male/female Polly voices)
  try {
    console.log(`[TTS Helper] Attempting StreamElements TTS (gender="${gender}", language="${lang}")...`);
    let voiceName = isMale ? 'Brian' : 'Emma';
    if (isTamil) {
      voiceName = 'Aditi'; // Indian bilingual voice
    }

    // Chunk the text slightly (StreamElements has a ~450 char limit per request)
    const seChunks = [];
    let seRemaining = cleanText;
    while (seRemaining.length > 0) {
      if (seRemaining.length <= 400) {
        seChunks.push(seRemaining);
        break;
      }
      let splitIdx = seRemaining.lastIndexOf(' ', 400);
      if (splitIdx === -1) splitIdx = 400;
      seChunks.push(seRemaining.substring(0, splitIdx));
      seRemaining = seRemaining.substring(splitIdx).trim();
    }

    const seBuffers = [];
    for (const chunk of seChunks) {
      let chunkSuccess = false;
      
      // Attempt 1: StreamElements with cleared Authorization headers
      try {
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voiceName}&text=${encodeURIComponent(chunk)}`;
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Authorization': undefined,
            'xi-api-key': undefined
          },
          timeout: 10000
        });
        if (response.data && response.data.byteLength > 200) {
          seBuffers.push(Buffer.from(response.data));
          chunkSuccess = true;
        }
      } catch (seErr) {
        console.warn(`[TTS Helper] StreamElements chunk failed (${seErr.message}). Trying Streamlabs Polly...`);
      }

      // Attempt 2: Streamlabs Polly fallback
      if (!chunkSuccess) {
        try {
          const slRes = await axios.post('https://streamlabs.com/polly/speak', {
            text: chunk,
            voice: voiceName
          }, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Referer': 'https://streamlabs.com',
              'Authorization': undefined,
              'xi-api-key': undefined
            },
            timeout: 10000
          });
          if (slRes.data && slRes.data.success && slRes.data.speak_url) {
            const audioRes = await axios.get(slRes.data.speak_url, {
              responseType: 'arraybuffer',
              headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Authorization': undefined 
              },
              timeout: 10000
            });
            if (audioRes.data && audioRes.data.byteLength > 200) {
              seBuffers.push(Buffer.from(audioRes.data));
              chunkSuccess = true;
            }
          }
        } catch (slErr) {
          console.warn('[TTS Helper] Streamlabs chunk fallback failed:', slErr.message);
        }
      }

      if (!chunkSuccess) {
        throw new Error('All cloud fallback TTS providers failed for this chunk');
      }
    }

    if (seBuffers.length > 0) {
      const combined = Buffer.concat(seBuffers);
      console.log(`[TTS Helper] StreamElements cloud TTS successful (${combined.length} bytes, voice="${voiceName}")`);
      return combined;
    }
  } catch (seApiErr) {
    console.warn(`[TTS Helper] StreamElements TTS failed (${seApiErr.message}). Falling back to Google Translate TTS...`);
    try {
      const diagPath = path.resolve(__dirname, '../diagnostics_tts.txt');
      fs.appendFileSync(diagPath, `\n[${new Date().toISOString()}] StreamElements error: ${seApiErr.message}\nStack: ${seApiErr.stack}\n`, 'utf8');
    } catch (_) {}
  }

  // 2. Fallback: Google Translate TTS (splits text into 180-character chunks)
  const gtLang = isTamil ? 'ta' : 'en';
  const chunks = [];
  let remaining = cleanText;
  
  while (remaining.length > 0) {
    if (remaining.length <= 180) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf(' ', 180);
    if (splitIdx === -1) splitIdx = 180;
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trim();
  }

  console.log(`[TTS Helper] Google TTS Fallback: language="${gtLang}". Splitting script into ${chunks.length} chunks.`);

  try {
    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${gtLang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      buffers.push(Buffer.from(response.data));
    }
    
    const combinedBuffer = Buffer.concat(buffers);
    if (combinedBuffer.length > 100) {
      console.log(`[TTS Helper] Google TTS synthesis successful (${combinedBuffer.length} bytes)`);
      return combinedBuffer;
    }
    throw new Error('Google TTS returned empty audio buffer');
  } catch (gtErr) {
    console.error(`[TTS Helper] Google TTS Fallback failed:`, gtErr.message);
    throw new Error(`TTS synthesis failed for both StreamElements and Google Translate: ${gtErr.message}`);
  }
}
