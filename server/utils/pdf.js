// server/utils/pdf.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
async function ensureUploadsDir() {
  try {
    await fs.promises.mkdir(uploadsDir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

/**
 * Save uploaded file to disk and return its absolute path.
 */
async function saveUploadedFile(file) {
  await ensureUploadsDir();
  const dest = path.join(uploadsDir, file.originalname);
  await fs.promises.writeFile(dest, file.buffer);
  return dest;
}

/**
 * Extract plain text from a PDF file given its path.
 */
async function extractTextFromPdf(filePath) {
  const data = await fs.promises.readFile(filePath);
  const pdfData = await pdfParse(data);
  return pdfData.text;
}

module.exports = { saveUploadedFile, extractTextFromPdf };
