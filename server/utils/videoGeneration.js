import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Write diagnostic details to diagnostics.txt in project root for debugging.
 */
function logDiagnosticError(stepName, cmd, error, stdout, stderr) {
  const diagPath = path.resolve(__dirname, '../../diagnostics.txt');
  const logContent = `
========================================
[${new Date().toISOString()}] ERROR IN STEP: ${stepName}
Command run: ${cmd}
Error Message: ${error?.message || error}
--- STDOUT ---
${stdout || ''}
--- STDERR ---
${stderr || ''}
========================================
`;
  try {
    fs.appendFileSync(diagPath, logContent, 'utf8');
    console.log(`[Diagnostics] Error logged to ${diagPath}`);
  } catch (err) {
    console.error('Failed to write diagnostics.txt:', err);
  }
}

/**
 * Helper to get the duration of an audio file using ffprobe.
 */
function getAudioDuration(audioPath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const durationStr = execSync(cmd).toString().trim();
    const parsed = parseFloat(durationStr);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('[Video] Failed to get audio duration using ffprobe:', e.message);
  }
  return 10.0; // safe default if probe fails
}

/**
 * Orchestrates the video generation pipeline:
 *   1. Loop template video.
 *   2. Run LivePortrait to create a blinking/moving video.
 *   3. Run Wav2Lip on the blinking/moving video.
 *   4. Run GFPGAN and combine.
 *
 * @param {Object} params
 * @param {string} params.imagePath - Absolute path to the portrait image.
 * @param {string} params.audioPath - Absolute path to the audio (WAV/MP3).
 * @param {string} params.outDir    - Directory where intermediate and final files will be stored.
 * @param {string} [params.fallbackVideoPath] - Path to the driving video template.
 * @returns {Promise<string>} Absolute path to the final MP4 video.
 */
export async function generateTalkVideo({ imagePath, audioPath, outDir, fallbackVideoPath }) {
  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  const lipSyncPath = path.join(outDir, 'lipsync.mp4');
  const motionPath = path.join(outDir, 'motion.mp4');
  const finalVideoPath = path.join(outDir, 'final.mp4');

  const wav2lipScript = path.resolve(__dirname, '../python/wav2lip_sync.py');
  const liveportraitScript = path.resolve(__dirname, '../python/liveportrait_animate.py');

  let pythonCmd = 'python';
  const candidates = [
    path.resolve(__dirname, '../../../venv/Scripts/python.exe'),
    path.resolve(__dirname, '../../venv/Scripts/python.exe'),
    path.resolve(__dirname, '../../../../venv/Scripts/python.exe')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      pythonCmd = `"${p}"`;
      break;
    }
  }
  console.log('[Video] Resolved python command:', pythonCmd);

  // Setup environment variables so child processes can resolve ffmpeg
  const ffmpegDir = process.env.FFMPEG_PATH ? path.dirname(process.env.FFMPEG_PATH) : '';
  const env = { ...process.env };
  if (ffmpegDir) {
    const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
    env[pathKey] = `${ffmpegDir}${path.delimiter}${env[pathKey] || ''}`;
  }

  // Auto-resolve fallbackVideoPath if not provided
  let resolvedFallback = fallbackVideoPath;
  if (!resolvedFallback || !fs.existsSync(resolvedFallback)) {
    resolvedFallback = path.resolve(__dirname, '../uploads/video/girl_presenter.mp4');
  }
  console.log('[Video] Using fallback template for driving movements:', resolvedFallback);

  // Calculate audio duration & create looped driving video
  const audioDuration = getAudioDuration(audioPath);
  const loopedDrivingPath = path.join(outDir, 'looped_driving.mp4');
  console.log(`[Video] Audio duration: ${audioDuration}s. Looping driving presenter video...`);
  
  await new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -stream_loop -1 -i "${resolvedFallback}" -t ${audioDuration} -c:v libx264 -pix_fmt yuv420p "${loopedDrivingPath}"`;
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Video] FFmpeg driving video looping failed:', stderr || error.message);
        return reject(error);
      }
      resolve();
    });
  });

  // 1️⃣ LivePortrait – Animate the static face using the looped presenter video as the driver.
  await new Promise((resolve) => {
    const cmd = `${pythonCmd} "${liveportraitScript}" --image "${imagePath}" --driving-video "${loopedDrivingPath}" --output "${motionPath}"`;
    console.log('[Video] Running LivePortrait animation (adding eye blinks & nods):', cmd);
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.warn('LivePortrait failed, falling back to static image path for Wav2Lip:', stderr || error.message);
        fs.copyFileSync(imagePath, motionPath);
      } else {
        console.log('LivePortrait animation completed successfully.');
      }
      resolve();
    });
  });

  // 2️⃣ Wav2Lip – Sync the mouth/lips of the blinking/moving face video to the TTS audio.
  await new Promise((resolve, reject) => {
    const cmd = `${pythonCmd} "${wav2lipScript}" --image "${motionPath}" --audio "${audioPath}" --output "${lipSyncPath}"`;
    console.log('[Video] Running Wav2Lip command (lip-syncing voice):', cmd);
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('Wav2Lip error:', stderr || error.message);
        logDiagnosticError('Wav2Lip Inference', cmd, error, stdout, stderr);
        return reject(error);
      }
      console.log('Wav2Lip completed:', stdout);
      resolve();
    });
  });

  // 3️⃣ Run GFPGAN local face enhancement to remove mouth/face blur and sharpen features (eyes, lips)
  const gfpganScript = path.resolve(__dirname, '../python/enhance_video_faces.py');
  const enhancedPath = path.join(outDir, 'enhanced.mp4');
  await new Promise((resolve) => {
    const cmd = `${pythonCmd} "${gfpganScript}" --input "${lipSyncPath}" --output "${enhancedPath}"`;
    console.log('[Video] Running GFPGAN face restoration:', cmd);
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.warn('GFPGAN face enhancement failed, falling back to lip-sync video:', stderr || error.message);
        fs.copyFileSync(lipSyncPath, enhancedPath);
      } else {
        console.log('GFPGAN face enhancement completed successfully.');
      }
      resolve();
    });
  });

  // 4️⃣ Combine with FFmpeg
  await new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${enhancedPath}" -i "${audioPath}" -vf "scale=1080:-2:flags=lanczos,unsharp=7:7:1.2:7:7:0.0" -c:v libx264 -preset fast -crf 18 -c:a aac -shortest "${finalVideoPath}"`;
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg combine error:', stderr || error.message);
        logDiagnosticError('FFmpeg Combine', cmd, error, stdout, stderr);
        return reject(error);
      }
      console.log('FFmpeg combine completed:', stdout);
      resolve();
    });
  });

  // Cleanup temporary looped driving file to save disk space
  try {
    if (fs.existsSync(loopedDrivingPath)) fs.unlinkSync(loopedDrivingPath);
  } catch (err) {
    console.warn('[Video] Cleanup of looped driving failed:', err.message);
  }

  return finalVideoPath;
}
