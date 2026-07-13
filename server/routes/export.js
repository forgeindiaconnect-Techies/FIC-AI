import express from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import PptxGenJS from 'pptxgenjs';

const router = express.Router();

// __dirname for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Ensure generated folder exists
const generatedDir = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

// ── POST /api/export/pdf ──────────────────────────────────────────────────────
router.post('/pdf', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const filename = `export-${Date.now()}.pdf`;
    const filePath = path.join(generatedDir, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.font('Helvetica-Bold').fontSize(20).text(title, { align: 'center' });
    doc.moveDown(1.5);

    // Body text
    doc.font('Helvetica').fontSize(12).text(content, { align: 'left', lineGap: 4 });
    doc.end();

    stream.on('finish', () => {
      res.download(filePath, filename, (err) => {
        if (err) console.error('Download error:', err);
        setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
      });
    });
    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      res.status(500).json({ error: 'PDF generation failed' });
    });
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ── POST /api/export/docx ─────────────────────────────────────────────────────
router.post('/docx', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const paragraphs = content.split('\n').filter(Boolean);

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
          ...paragraphs.map(line => new Paragraph({ children: [new TextRun({ text: line, size: 24 })], spacing: { after: 120 } }))
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `export-${Date.now()}.docx`;
    const filePath = path.join(generatedDir, filename);
    fs.writeFileSync(filePath, buffer);

    res.download(filePath, filename, (err) => {
      if (err) console.error('DOCX download error:', err);
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
    });
  } catch (err) {
    console.error('DOCX error:', err);
    res.status(500).json({ error: 'DOCX generation failed' });
  }
});

// ── POST /api/export/ppt ──────────────────────────────────────────────────────
router.post('/ppt', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    const SLIDE_LIMIT = 300;
    const chunks = [];
    const words = content.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).length > SLIDE_LIMIT) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) chunks.push(current.trim());

    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '0B1020' };
    titleSlide.addText(title, { x: 0.5, y: 2.5, w: '90%', h: 1.5, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center' });

    chunks.forEach((chunk, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: '0B1020' };
      slide.addText(`Slide ${idx + 1}`, { x: 0.5, y: 0.3, w: '90%', h: 0.6, fontSize: 16, bold: true, color: '7C3AED' });
      slide.addText(chunk, { x: 0.5, y: 1.1, w: '90%', h: 5, fontSize: 14, color: 'F8FAFC', wrap: true, valign: 'top' });
    });

    const filename = `export-${Date.now()}.pptx`;
    const filePath = path.join(generatedDir, filename);
    await pptx.writeFile({ fileName: filePath });

    res.download(filePath, filename, (err) => {
      if (err) console.error('PPT download error:', err);
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
    });
  } catch (err) {
    console.error('PPT error:', err);
    res.status(500).json({ error: 'PPT generation failed' });
  }
});

export default router;
const fs = require('fs');
const path = require('path');
const router = express.Router();

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const PptxGenJS = require('pptxgenjs');

// Ensure generated folder exists
const generatedDir = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

// ── POST /api/export/pdf ──────────────────────────────────────────────────────
router.post('/pdf', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const filename = `export-${Date.now()}.pdf`;
    const filePath = path.join(generatedDir, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.font('Helvetica-Bold').fontSize(20).text(title, { align: 'center' });
    doc.moveDown(1.5);

    // Body text — split by lines to handle paragraphs
    doc.font('Helvetica').fontSize(12).text(content, {
      align: 'left',
      lineGap: 4,
    });

    doc.end();

    stream.on('finish', () => {
      res.download(filePath, filename, (err) => {
        if (err) console.error('Download error:', err);
        // Clean up after 60 s
        setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
      });
    });
    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      res.status(500).json({ error: 'PDF generation failed' });
    });
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ── POST /api/export/docx ─────────────────────────────────────────────────────
router.post('/docx', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const paragraphs = content.split('\n').filter(Boolean);

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
          }),
          ...paragraphs.map(
            (line) =>
              new Paragraph({
                children: [new TextRun({ text: line, size: 24 })],
                spacing: { after: 120 },
              })
          ),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `export-${Date.now()}.docx`;
    const filePath = path.join(generatedDir, filename);
    fs.writeFileSync(filePath, buffer);

    res.download(filePath, filename, (err) => {
      if (err) console.error('DOCX download error:', err);
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
    });
  } catch (err) {
    console.error('DOCX error:', err);
    res.status(500).json({ error: 'DOCX generation failed' });
  }
});

// ── POST /api/export/ppt ──────────────────────────────────────────────────────
router.post('/ppt', async (req, res) => {
  try {
    const { content, title = 'FIC AI Export' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Split content into slides of ~300 chars each
    const SLIDE_LIMIT = 300;
    const chunks = [];
    const words = content.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).length > SLIDE_LIMIT) {
        if (current) chunks.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) chunks.push(current.trim());

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '0B1020' };
    titleSlide.addText(title, {
      x: 0.5, y: 2.5, w: '90%', h: 1.5,
      fontSize: 32, bold: true, color: 'FFFFFF', align: 'center',
    });

    // Content slides
    chunks.forEach((chunk, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: '0B1020' };
      slide.addText(`Slide ${idx + 1}`, {
        x: 0.5, y: 0.3, w: '90%', h: 0.6,
        fontSize: 16, bold: true, color: '7C3AED',
      });
      slide.addText(chunk, {
        x: 0.5, y: 1.1, w: '90%', h: 5,
        fontSize: 14, color: 'F8FAFC', wrap: true, valign: 'top',
      });
    });

    const filename = `export-${Date.now()}.pptx`;
    const filePath = path.join(generatedDir, filename);

    await pptx.writeFile({ fileName: filePath });

    res.download(filePath, filename, (err) => {
      if (err) console.error('PPT download error:', err);
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 60000);
    });
  } catch (err) {
    console.error('PPT error:', err);
    res.status(500).json({ error: 'PPT generation failed' });
  }
});

module.exports = router;
