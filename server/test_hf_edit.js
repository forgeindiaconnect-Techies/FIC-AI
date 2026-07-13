import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function runTest() {
  const apiKey = process.env.HF_API_KEY;
  console.log('HF_API_KEY is present:', !!apiKey);
  if (!apiKey) {
    console.error('HF_API_KEY is missing from environment variables!');
    return;
  }

  // Look for any image in c:\Users\Forgeindiaconnect\OneDrive\Documents\My-Projects\AI\forge-ai\server\uploads\images
  const uploadsDir = path.resolve(__dirname, 'uploads', 'images');
  if (!fs.existsSync(uploadsDir)) {
    console.error('Uploads dir not found at:', uploadsDir);
    return;
  }
  
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.png') || f.endsWith('.jpeg') || f.endsWith('.jpg'));
  if (files.length === 0) {
    console.error('No images found in uploads directory to test with.');
    return;
  }

  // Use the most recent image
  files.sort((a, b) => {
    return fs.statSync(path.join(uploadsDir, b)).mtimeMs - fs.statSync(path.join(uploadsDir, a)).mtimeMs;
  });

  const targetFile = path.join(uploadsDir, files[0]);
  console.log('Using target file for edit test:', targetFile);

  const imageBuffer = fs.readFileSync(targetFile);
  const base64Input = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  
  const prompt = 'that girl place change into boy';
  console.log(`Prompt: "${prompt}"`);

  console.log('Sending request to Hugging Face api-inference...');
  try {
    const hfResponse = await axios.post(
      'https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix',
      {
        inputs: {
          image: base64Input,
          prompt: prompt
        },
        parameters: {
          image_guidance_scale: 1.5,
          guidance_scale: 7.5
        }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 60000
      }
    );

    console.log('Response status:', hfResponse.status);
    console.log('Response byte length:', hfResponse.data.byteLength);
    
    if (hfResponse.status === 200 && hfResponse.data.byteLength > 0) {
      const outputPath = path.resolve(__dirname, 'test_hf_output.png');
      fs.writeFileSync(outputPath, Buffer.from(hfResponse.data));
      console.log('Saved edited output to:', outputPath);
    }
  } catch (err) {
    const errDataStr = err.response?.data ? Buffer.from(err.response.data).toString() : '';
    console.error('Error occurred:', err.message);
    if (errDataStr) {
      console.error('Error response data:', errDataStr);
    }
  }
}

runTest();
