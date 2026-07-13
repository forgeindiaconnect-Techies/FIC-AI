import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoUrl = 'https://expressive-avatars.d-id.com/PUBLIC_D-ID/amber_sport_elegant/avt_s8NZJC/avatar_assets/talking_preview.mp4';
const destDir = path.resolve(__dirname, 'server/uploads/video');
const destPath = path.join(destDir, 'amber_presenter.mp4');

async function download() {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  console.log(`Downloading Amber presenter from: ${videoUrl}`);
  console.log(`Saving to: ${destPath}`);

  try {
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000,
    });

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log('Download complete! File size:', fs.statSync(destPath).size);
  } catch (err) {
    console.error('Download failed:', err.message);
  }
}

download();
