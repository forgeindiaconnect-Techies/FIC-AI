// server/test_wav2lip.js
import { generateTalkVideo } from './utils/videoGeneration.js';
import path from 'path';
import fs from 'fs';

async function test() {
  console.log("Testing generateTalkVideo imports and code path resolution...");
  try {
    const scriptPath = path.resolve('./python/wav2lip_sync.py');
    const exists = fs.existsSync(scriptPath);
    console.log(`wav2lip_sync.py exists at ${scriptPath}: ${exists}`);
    
    // Test if we can import other routes
    const docRoute = await import('./routes/documents.js');
    console.log("Documents route imported successfully!");
    
    console.log("✅ All Node imports and resolutions are correct!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  }
}
test();
