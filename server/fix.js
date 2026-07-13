import fs from 'fs';

const path = 'c:/Users/Forgeindiaconnect/OneDrive/Documents/My-Projects/AI/forge-ai/server/services/ollamaService.js';

try {
  let buf = fs.readFileSync(path);
  let content = buf.toString('latin1');
  
  // Find the exact commented export line
  const searchStr = "export async function getOllamaReply";
  const searchIdx = content.indexOf(searchStr);
  
  if (searchIdx !== -1) {
    // find the previous newline
    let prevNewline = content.lastIndexOf('\n', searchIdx);
    if (prevNewline === -1) prevNewline = 0;
    
    // Check if it's on a commented line
    const lineStart = content.indexOf('//', prevNewline);
    if (lineStart !== -1 && lineStart < searchIdx) {
      // It is commented out!
      // Insert a newline before 'export'
      const before = content.substring(0, searchIdx);
      const after = content.substring(searchIdx);
      
      // Clean up the weird char before 'export'
      let cleanBefore = before.replace(/[^\x20-\x7E\r\n]/g, ''); 
      
      let newContent = cleanBefore + '\n' + after;
      
      let contentUtf8 = buf.toString('utf8');
      const idxUtf8 = contentUtf8.indexOf(searchStr);
      if (idxUtf8 !== -1) {
        let beforeUtf8 = contentUtf8.substring(0, idxUtf8);
        let afterUtf8 = contentUtf8.substring(idxUtf8);
        beforeUtf8 = beforeUtf8.replace(/\uFFFD/g, '');
        newContent = beforeUtf8 + '\n' + afterUtf8;
        
        fs.writeFileSync(path, newContent, 'utf8');
        console.log("✅ Successfully fixed the file!");
      }
    } else {
      console.log("No commented export found. The file might already be fixed.");
    }
  } else {
    console.log("export async function not found.");
  }
} catch(e) {
  console.error("Error:", e);
}
