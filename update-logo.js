const fs = require('fs');

const sourceFile = 'c:\\Users\\Forgeindiaconnect\\.gemini\\antigravity-ide\\brain\\f758eab9-9ec7-4b1d-b700-185c53f0ac1c\\media__1781612263525.png';
const destFile = 'c:\\Users\\Forgeindiaconnect\\OneDrive\\Documents\\My-Projects\\AI\\forge-ai\\client\\public\\forge_india_logo.png';

try {
  fs.copyFileSync(sourceFile, destFile);
  console.log('✅ Logo successfully updated! Please refresh your browser.');
} catch (err) {
  console.error('❌ Failed to update logo:', err.message);
}
