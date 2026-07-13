// server/utils/imagePreprocess.js
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhances an uploaded portrait image.
 *
 * Attempts to run a Python preprocessing script that applies face restoration
 * (e.g., GFPGAN) and up‑scaling (e.g., Real‑ESRGAN). If the script or required
 * models are missing, the original image is returned so the pipeline can
 * continue.
 *
 * @param {string} inputPath Absolute path to the raw uploaded image.
 * @returns {Promise<string>} Absolute path to the enhanced image (or the original
 *   image if enhancement failed).
 */
export async function preprocessImage(inputPath) {
  const outDir = path.dirname(inputPath);
  const outputPath = path.join(outDir, 'enhanced_' + path.basename(inputPath));

  const scriptPath = path.resolve(__dirname, '../python/image_preprocess.py');

  if (fs.existsSync(scriptPath)) {
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
    console.log('[Preprocess] Resolved python command:', pythonCmd);

    // Run the Python script; it should create the output file.
    await new Promise((resolve) => {
      const cmd = `${pythonCmd} "${scriptPath}" --input "${inputPath}" --output "${outputPath}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.warn('Image preprocessing failed, falling back to original image:', stderr);
          // Resolve without rejecting – we will fall back to original.
        } else {
          console.log('Image preprocessing succeeded:', stdout.trim());
        }
        resolve();
      });
    });
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  }
  // Fallback: return the original image path.
  return inputPath;
}
