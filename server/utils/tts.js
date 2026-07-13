// server/utils/tts.js
import path from 'path';
import fs from 'fs';
import { generateTTSAudioBuffer } from './ttsHelper.js';

/**
 * Generate a temporary WAV audio file from the provided text.
 * Returns an object with the absolute file path.
 */
export async function generateTtsAudio(text) {
  const tempDir = path.join(process.cwd(), 'uploads', 'talkify', 'temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const audioBuffer = await generateTTSAudioBuffer(text);
  const audioPath = path.join(tempDir, `tts_${Date.now()}.wav`);
  fs.writeFileSync(audioPath, audioBuffer);
  return { filePath: audioPath };
}
