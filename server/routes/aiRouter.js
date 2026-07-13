// server/routes/aiRouter.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const ExcelJS = require('exceljs');
require('dotenv').config();

// Import existing routes for reuse
const imageRouter = require('./image'); // expose image generation and edit

// Intent detection utility
const detectIntent = (text) => {
  const lower = text.toLowerCase();
  if (lower.includes('poster')) return 'poster';
  if (lower.includes('image') || lower.includes('picture') || lower.includes('photo')) return 'image';
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('ppt') || lower.includes('presentation')) return 'ppt';
  if (lower.includes('docx') || lower.includes('word')) return 'docx';
  if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('sheet')) return 'excel';
  return 'chat';
};

// Helper to forward request to existing internal routes (same server)
const forward = async (method, endpoint, data) => {
  const base = process.env.API_URL || 'http://localhost:5001'; // adjust if needed
  return axios({ method, url: `${base}${endpoint}`, data, timeout: 30000 });
};

router.post('/handle', async (req, res) => {
  const { prompt, content } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  const intent = detectIntent(prompt);
  console.log('[AI Router] Intent:', intent);
  try {
    switch (intent) {
      case 'image': {
        const gen = await forward('post', '/api/image/generate', { prompt });
        return res.json(gen.data);
      }
      case 'poster': {
        const extract = await forward('post', '/api/image/poster-extract', { prompt });
        const layout = extract.data?.data;
        const bgPrompt = `premium clean abstract background for ${layout?.posterType || 'poster'}, theme ${layout?.colorTheme || 'blue'}, high-res`;
        const bg = await forward('post', '/api/image/generate', { prompt: bgPrompt });
        return res.json({ success: true, layout, backgroundImage: bg.data?.imageUrl || bg.data?.backgroundImage });
      }
      case 'pdf': {
        const pdf = await forward('post', '/api/export/pdf', { content, title: prompt });
        return res.json({ success: true, fileUrl: `/generated/${path.basename(pdf.request.path)}` });
      }
      case 'ppt': {
        const ppt = await forward('post', '/api/export/ppt', { content, title: prompt });
        return res.json({ success: true, fileUrl: `/generated/${path.basename(ppt.request.path)}` });
      }
      case 'docx': {
        const docx = await forward('post', '/api/export/docx', { content, title: prompt });
        return res.json({ success: true, fileUrl: `/generated/${path.basename(docx.request.path)}` });
      }
      case 'excel': {
        const rows = content.split('\n').map(l => [l]);
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Export');
        ws.addRows(rows);
        const filename = `export-${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '..', 'generated', filename);
        await wb.xlsx.writeFile(filePath);
        return res.json({ success: true, fileUrl: `/generated/${filename}` });
      }
      default: {
        // Fallback chat
        const chat = await forward('post', '/api/chat', { message: prompt });
        return res.json(chat.data);
      }
    }
  } catch (e) {
    console.error('[AI Router] Error:', e.message);
    return res.status(500).json({ error: 'Failed to process request', details: e.message });
  }
});

module.exports = router;
