// restore_file.js
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Restoring client/src/components/VideoGenerator.jsx to discard truncated changes...');
  execSync('git checkout -- client/src/components/VideoGenerator.jsx', { cwd: __dirname });
  console.log('✅ Successfully restored original VideoGenerator.jsx! Lint errors will clear now.');
} catch (err) {
  console.error('Failed to run git restore:', err.message);
  console.log('Please right-click VideoGenerator.jsx in VS Code and select Discard Changes.');
}
