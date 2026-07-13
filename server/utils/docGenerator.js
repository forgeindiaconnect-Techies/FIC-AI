import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import PptxGenJS from 'pptxgenjs';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const documentsDir = path.join(__dirname, '..', 'uploads', 'documents');

// Ensure directory exists
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

/**
 * Generates a document of type pdf, docx, pptx, xlsx based on content and title.
 * Saves it to server/uploads/documents and returns { filename, downloadUrl }
 */
export async function createDocument({ content, fileType, title, req }) {
  const cleanTitle = title || 'Document';
  const fileExt = fileType.toLowerCase().replace(/^\./, '');
  const timestamp = Date.now();
  const filename = `doc-${timestamp}.${fileExt}`;
  const filePath = path.join(documentsDir, filename);

  // Fallback port / host
  const port = process.env.PORT || 5001;
  const base = process.env.SERVER_URL || `http://localhost:${port}`;
  const downloadUrl = `/downloads/${filename}`;

  switch (fileExt) {
    case 'pdf':
      await makePDF(filePath, content, cleanTitle);
      break;
    case 'docx':
    case 'doc':
      await makeWord(filePath, content, cleanTitle);
      break;
    case 'pptx':
    case 'ppt':
      await makePPT(filePath, content, cleanTitle);
      break;
    case 'xlsx':
    case 'xls':
    case 'excel':
      await makeExcel(filePath, content, cleanTitle);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  return {
    filename,
    downloadUrl,
    fullUrl: `${base}${downloadUrl}`
  };
}

// ── PDF Generator ────────────────────────────────────────────────────────────
async function makePDF(filePath, content, title) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  let page = pdfDoc.addPage([595, 842]); // A4 Size: 595 width, 842 height
  const { width, height } = page.getSize();
  const margin = 54; // 0.75 inch margins
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Draw Header Line & Title
  const drawPageHeader = (p, pageNum) => {
    // Top line
    p.drawLine({
      start: { x: margin, y: height - 40 },
      end: { x: width - margin, y: height - 40 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    // Header text
    p.drawText("FIC AI Document Studio", {
      x: margin,
      y: height - 34,
      size: 8,
      font: italicFont,
      color: rgb(0.5, 0.5, 0.5)
    });
    // Page number
    p.drawText(`Page ${pageNum}`, {
      x: width - margin - 30,
      y: height - 34,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
  };

  let pageCount = 1;
  drawPageHeader(page, pageCount);

  // Document Title (Large)
  page.drawText(title, {
    x: margin,
    y: y - 20,
    size: 22,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.4) // Dark slate blue
  });
  
  // Underline title
  page.drawLine({
    start: { x: margin, y: y - 26 },
    end: { x: margin + boldFont.widthOfTextAtSize(title, 22), y: y - 26 },
    thickness: 2,
    color: rgb(0.48, 0.22, 0.93) // Purple accent
  });
  y -= 70;

  // Split lines
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y -= 12; // Spacer for empty lines
      continue;
    }

    // Check for page overflow
    if (y < margin + 50) {
      page = pdfDoc.addPage([595, 842]);
      pageCount++;
      y = height - margin - 40;
      drawPageHeader(page, pageCount);
    }

    // Heading 1 (# title)
    if (trimmed.startsWith('# ')) {
      const hText = trimmed.replace('# ', '');
      y -= 15;
      page.drawText(hText, {
        x: margin,
        y,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.3)
      });
      y -= 24;
      continue;
    }

    // Heading 2 (## title)
    if (trimmed.startsWith('## ')) {
      const hText = trimmed.replace('## ', '');
      y -= 10;
      page.drawText(hText, {
        x: margin,
        y,
        size: 13,
        font: boldFont,
        color: rgb(0.02, 0.71, 0.83) // Cyan theme
      });
      y -= 20;
      continue;
    }

    // Heading 3 (### title)
    if (trimmed.startsWith('### ')) {
      const hText = trimmed.replace('### ', '');
      y -= 8;
      page.drawText(hText, {
        x: margin,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      });
      y -= 18;
      continue;
    }

    // Word wrapping and inline bold parsing for body lines
    const words = trimmed.split(' ');
    let currentLine = '';
    const wrappedLines = [];

    // Helper to measure token length (without markdown ** stars)
    const getCleanWidth = (text) => {
      const cleanText = text.replace(/\*\*/g, '');
      return font.widthOfTextAtSize(cleanText, 10);
    };

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (getCleanWidth(testLine) > contentWidth) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }

    for (const wLine of wrappedLines) {
      if (y < margin + 30) {
        page = pdfDoc.addPage([595, 842]);
        pageCount++;
        y = height - margin - 40;
        drawPageHeader(page, pageCount);
      }

      // Draw line with inline bold support (split by **)
      const tokens = wLine.split('**');
      let currentX = margin;
      
      tokens.forEach((token, index) => {
        const isBold = index % 2 === 1;
        const currentFont = isBold ? boldFont : font;
        page.drawText(token, {
          x: currentX,
          y,
          size: 10,
          font: currentFont,
          color: rgb(0.15, 0.15, 0.15)
        });
        currentX += currentFont.widthOfTextAtSize(token, 10);
      });

      y -= 15; // Line spacing
    }
    y -= 6; // Paragraph spacing
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
}

// ── Word Generator ───────────────────────────────────────────────────────────
async function makeWord(filePath, content, title) {
  const paragraphs = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 }
    }),
    ...content.split('\n').map(line =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24 })],
        spacing: { after: 120 }
      })
    )
  ];

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
}

// ── PPT Generator ────────────────────────────────────────────────────────────
async function makePPT(filePath, content, title) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  // Title Slide
  const titleSlide = pptx.addSlide();
  
  // Add a beautiful full-screen tech background image
  const bgPrompt = encodeURIComponent(`Futuristic premium abstract presentation background, clean corporate technology, dark blue and deep purple gradient lights`);
  const bgUrl = `https://image.pollinations.ai/prompt/${bgPrompt}?width=1280&height=720&nologo=true`;
  
  titleSlide.addImage({
    path: bgUrl,
    x: 0, y: 0, w: 13.33, h: 7.5
  });

  // Dark overlay card for readability
  titleSlide.addShape(pptx.shapes.RECTANGLE, {
    x: 1.0, y: 1.5, w: 11.33, h: 4.5,
    fill: { color: '000000', transparency: 60 },
    line: { color: '7C3AED', width: 2 }
  });

  titleSlide.addText(title, {
    x: 1.5, y: 2.2, w: 10.33, h: 1.5,
    fontSize: 40, bold: true, color: 'FFFFFF', align: 'center'
  });
  titleSlide.addText('FIC AI PRESENTATION STUDIO', {
    x: 1.5, y: 4.2, w: 10.33, h: 0.5,
    fontSize: 14, bold: true, color: '06B6D4', align: 'center'
  });

  // Try to split slides by common delimiters
  let slidesData = [];
  if (content.includes('SLIDE') || content.includes('Slide')) {
    const rawSlides = content.split(/(?=Slide \d+:|SLIDE \d+:)/i);
    rawSlides.forEach(block => {
      const parts = block.split('\n');
      const slideTitle = parts[0]?.replace(/(?:Slide \d+:|SLIDE \d+:)/i, '')?.trim() || 'Slide';
      const slideBody = parts.slice(1).join('\n').trim();
      if (slideBody) {
        slidesData.push({ title: slideTitle, body: slideBody });
      }
    });
  }

  // Fallback: split by double newline
  if (slidesData.length === 0) {
    const blocks = content.split('\n\n').filter(b => b.trim());
    blocks.forEach((block, idx) => {
      const lines = block.split('\n');
      const slideTitle = lines[0]?.slice(0, 50) || `Point ${idx + 1}`;
      const slideBody = lines.slice(1).join('\n') || lines[0];
      slidesData.push({ title: slideTitle, body: slideBody });
    });
  }

  // Generate slides
  slidesData.slice(0, 15).forEach(slideItem => {
    const slide = pptx.addSlide();
    slide.background = { color: '0A0E17' };

    // Text Content on the Left
    slide.addText(slideItem.title, {
      x: 0.8, y: 0.8, w: 6.0, h: 0.8,
      fontSize: 26, bold: true, color: '06B6D4'
    });
    
    // Format bullet points or lines in slide body
    const formattedBody = slideItem.body
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n\n'); // Add breathing room between lines

    slide.addText(formattedBody, {
      x: 0.8, y: 1.8, w: 6.0, h: 4.8,
      fontSize: 14, color: 'E2E8F0', wrap: true, valign: 'top'
    });

    // AI Generated Image on the Right
    const imgPrompt = encodeURIComponent(`Clean minimalist 3D icon design for ${slideItem.title}, cyber style, neon blue and violet details, dark premium background`);
    const imgUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=512&height=512&nologo=true`;
    
    // Add image placeholder frame
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 7.5, y: 1.2, w: 5.0, h: 5.0,
      fill: { color: '161B22' },
      line: { color: '7C3AED', width: 2 }
    });

    slide.addImage({
      path: imgUrl,
      x: 7.52,
      y: 1.22,
      w: 4.96,
      h: 4.96
    });
  });

  await pptx.writeFile({ fileName: filePath });
}

// ── Excel Generator ──────────────────────────────────────────────────────────
async function makeExcel(filePath, content, title) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FIC AI';
  const sheet = workbook.addWorksheet('Sheet1');

  // Check if content looks like CSV or tabular data
  const rows = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    let cells = [];
    if (line.includes(',')) {
      // Simple comma CSV parse (handles basic quotes)
      cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    } else if (line.includes('\t')) {
      cells = line.split('\t').map(c => c.trim());
    } else if (line.trim()) {
      cells = [line.trim()];
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length > 0) {
    // Style the header row
    sheet.addRow(rows[0]).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
      cell.alignment = { horizontal: 'center' };
    });
    // Add rest of rows
    rows.slice(1).forEach(row => sheet.addRow(row));
    // Auto column widths
    sheet.columns.forEach(col => { col.width = 24; });
  } else {
    sheet.addRow([title]);
    sheet.addRow([content]);
  }

  await workbook.xlsx.writeFile(filePath);
}
