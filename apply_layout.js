// forge-ai/apply_layout.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, 'client/src/components/VideoGenerator.jsx');

try {
  let content = fs.readFileSync(filePath, 'utf8');

  // Normalize all CRLF to LF to prevent cross-platform template literal match failures
  content = content.replace(/\r\n/g, '\n');

  // Define the grid container style block
  const layoutHeader = `
      {/* ── BODY ── */}
      <div style={{ flex: 1, padding: '28px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <style>{\`
          .video-grid-container {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 32px;
            width: 100%;
            align-items: start;
          }
          @media (max-width: 1024px) {
            .video-grid-container {
              grid-template-columns: 1fr;
              gap: 24px;
            }
          }
        \`}</style>
        <div className="video-grid-container">
          
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
  `;

  // 1. Replace the body wrapper start (and bypass settings panel at the top)
  content = content.replace(
    /\{\/\* ── BODY ── \*\/\}\n\s*<div style=\{\{\s*flex:\s*1,\s*padding:\s*'28px',\s*maxWidth:\s*760,\s*width:\s*'100%',\s*margin:\s*'0\s+auto',\s*boxSizing:\s*'border-box'\s*\}\}>/g,
    layoutHeader.trim()
  );

  // 2. Find the D-ID/HeyGen configurations settings panel block
  const settingsPanelRegex = /\{\/\* API KEY SETTINGS PANEL \*\/\}\n\s*\{showSettings && \([\s\S]*?\}\n\s*\}\n\s*\)\}/;
  const matchSettings = content.match(settingsPanelRegex);
  let settingsPanelCode = '';
  if (matchSettings) {
    settingsPanelCode = matchSettings[0];
    // Remove the settings panel from the top of the body
    content = content.replace(settingsPanelRegex, '');
  } else {
    console.warn('[Warning] Could not locate settings panel via regex.');
  }

  // 3. Close the left column right after the Generate Button, and open the right column
  // Target anchor: the closing </button> of the generate video form
  const generateButtonAnchor = `        </button>\n\n        {/* Result: Unified Video Player */}`;

  const splitColumnReplacement = `        </button>
          </div> {/* End Left Column */}

          {/* RIGHT COLUMN: PREVIEW CANVAS & RESULTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            ${settingsPanelCode}

            {/* Empty Preview Placeholder */}
            {!videoUrl && !loading && (
              <div style={{
                border: '1.5px dashed var(--sidebar-border)',
                borderRadius: 16,
                padding: '60px 40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}>
                <span style={{ fontSize: 48 }}>🎬</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-color)' }}>
                  AI Video Preview Canvas
                </h4>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-color)', lineHeight: 1.6, maxWidth: 280 }}>
                  Configure your script and voice settings on the left, then click generate to compile your talking presenter!
                </p>
              </div>
            )}\n\n        {/* Result: Unified Video Player */}`;

  if (content.includes(generateButtonAnchor)) {
    content = content.replace(generateButtonAnchor, splitColumnReplacement);
  } else {
    // Fallback search with single line break
    const singleBreakAnchor = `        </button>\n        {/* Result: Unified Video Player */}`;
    if (content.includes(singleBreakAnchor)) {
      content = content.replace(singleBreakAnchor, splitColumnReplacement);
    } else {
      throw new Error('Could not find generate button anchor in file.');
    }
  }

  // 4. Close the right column and grid wrapper right before the History Panel
  // Target anchor: the closing tag of the body container before history starts
  const bodyCloseAnchor = `            </p>\n          </div>\n        )}\n      </div>\n\n      {/* ── 30-Day History Panel ── */}`;

  const bodyCloseReplacement = `            </p>\n          </div>\n        )}\n          </div> {/* End Right Column */}\n        </div> {/* End Split Grid */}\n      </div>\n\n      {/* ── 30-Day History Panel ── */}`;

  if (content.includes(bodyCloseAnchor)) {
    content = content.replace(bodyCloseAnchor, bodyCloseReplacement);
  } else {
    throw new Error('Could not find body close anchor before history panel.');
  }

  // Write back with normalized LF (Node/Git handles CRLF conversion dynamically on commit)
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Successfully applied responsive side-by-side layout using CSS media queries!');
} catch (err) {
  console.error('Failed to apply layout changes programmatically:', err.message);
}
