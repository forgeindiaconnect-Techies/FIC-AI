// chatRoutes.js – Ollama with Document generation integration
import express from 'express';
import dotenv from 'dotenv';
import { getOllamaReply } from '../services/ollamaService.js';
import { saveMessage, getChatMessages } from '../utils/storage.js';
import { createDocument } from '../utils/docGenerator.js';
import { generatePosterMetadata } from '../utils/posterGeneratorHelper.js';

dotenv.config();

const router = express.Router();

import { generateAIImage } from './image.js';

// Helper: Extracts download details from a message containing a Markdown download link
const getDocDetails = (content) => {
  if (!content) return null;
  const regex = /\[Download\]\((\/downloads\/[a-zA-Z0-9\-_.]+\.([a-z0-9]+))\)/i;
  const match = content.match(regex);
  if (match) {
    const url = match[1];
    const ext = match[2].toLowerCase();
    const cleanText = content.replace(regex, '').trim();
    return { url, ext, text: cleanText };
  }
  return null;
};

// Helper: Extracts poster details from message
const getPosterDetails = (content) => {
  if (!content) return null;
  const regex = /\[Poster Layout\]\(([\s\S]*)\)/i;
  const match = content.match(regex);
  if (match) {
    let jsonStr = match[1].trim();
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace !== -1) {
      jsonStr = jsonStr.substring(0, lastBrace + 1);
    }
    try {
      const posterData = JSON.parse(jsonStr);
      const cleanText = content.replace(regex, '').trim();
      return { poster: posterData, text: cleanText };
    } catch (e) {
      console.warn("Failed to parse poster layout JSON:", e.message);
    }
  }
  return null;
};

// Universal Prompt Intent Detector for FIC AI
export function universalIntentDetector(prompt) {
  const lower = prompt.toLowerCase().trim();

  // 1. Document / Export Intents (keywords: pdf, word, ppt, excel, document, download)
  const docKeywords = ['pdf', 'word', 'ppt', 'excel', 'document', 'download', 'docx', 'xlsx', 'pptx', 'spreadsheet', 'presentation'];
  const hasDocKeyword = docKeywords.some(k => lower.includes(k));
  const hasPosterKeyword = lower.includes('poster') || lower.includes('flyer') || lower.includes('banner');
  const hasImageKeyword = lower.includes('image') || lower.includes('photo') || lower.includes('picture') || lower.includes('draw') || lower.includes('painting') || lower.includes('artwork');

  if (hasDocKeyword && !hasPosterKeyword) {
    if (lower.includes('pdf')) return 'doc_pdf';
    if (lower.includes('word') || lower.includes('docx') || lower.includes('document')) return 'doc_docx';
    if (lower.includes('excel') || lower.includes('xlsx') || lower.includes('sheet') || lower.includes('spreadsheet')) return 'doc_xlsx';
    if (lower.includes('ppt') || lower.includes('pptx') || lower.includes('presentation')) return 'doc_pptx';
    return 'doc_pdf'; // Default fallback
  }

  // 2. Normal Image Intent (keywords: image, photo, picture, animal, nature, car, person, peacock, etc.)
  const normalImageKeywords = ['image', 'photo', 'picture', 'painting', 'draw', 'artwork', 'peacock', 'nature', 'car', 'animal', 'landscape', 'sunset', 'portrait', 'person'];
  const hasNormalImageKeyword = normalImageKeywords.some(k => lower.includes(k));
  if (hasNormalImageKeyword && !hasPosterKeyword) {
    return 'image';
  }

  // 3. Poster Intents (if prompt contains poster/flyer/banner OR contains specific category keywords)
  const hiringKeywords = ['hiring', 'job', 'vacancy', 'recruitment', 'developer', 'apply now', 'recruit'];
  const internshipKeywords = ['internship', 'intern', 'stipend', 'student'];
  const festivalKeywords = ['pongal', 'diwali', 'christmas', 'new year', 'festival', 'wishes', 'celebration', 'sankranti', 'harvest'];
  const birthdayKeywords = ['birthday', 'birth day', 'bday', 'happy birthday', 'anniversary', 'wedding', 'marriage', 'engagement', 'baby shower', 'graduation', 'farewell', 'retirement', 'congrats', 'congratulations'];
  const educationKeywords = ['course', 'training', 'workshop', 'class', 'webinar', 'learn', 'education', 'educational', 'academy'];
  const eventKeywords = ['event', 'summit', 'conference', 'seminar', 'meetup', 'conclave'];
  const businessKeywords = ['sale', 'offer', 'discount', 'business', 'launch', 'promotion', 'marketing', 'corporate', 'branding'];
  const infographicKeywords = ['infographic', 'metric', 'chart', 'stats', 'architecture', 'workflow', 'diagram'];

  const hasHiring = hiringKeywords.some(k => lower.includes(k));
  const hasInternship = internshipKeywords.some(k => lower.includes(k));
  const hasFestival = festivalKeywords.some(k => lower.includes(k));
  const hasBirthday = birthdayKeywords.some(k => lower.includes(k));
  const hasEducation = educationKeywords.some(k => lower.includes(k));
  const hasEvent = eventKeywords.some(k => lower.includes(k));
  const hasBusiness = businessKeywords.some(k => lower.includes(k));
  const hasInfographic = infographicKeywords.some(k => lower.includes(k));

  if (hasPosterKeyword || hasHiring || hasInternship || hasFestival || hasBirthday || hasEducation || hasEvent || hasBusiness || hasInfographic) {
    // Birthday/personal occasion takes priority before festival
    if (hasBirthday) {
      return 'poster_birthday';
    }
    if (hasFestival) {
      return 'poster_festival';
    }
    if (hasHiring) {
      return 'poster_hiring';
    }
    if (hasInternship) {
      return 'poster_internship';
    }
    if (hasEvent) {
      return 'poster_event';
    }
    if (hasEducation) {
      return 'poster_education';
    }
    if (hasBusiness) {
      return 'poster_business';
    }
    if (hasInfographic) {
      return 'poster_infographic';
    }
    return 'poster_general';
  }

  // 4. Fallback to general chat
  return 'chat';
}

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/test', (_req, res) => {
  res.json({
    success: true,
    message: 'Chat route working',
    provider: process.env.AI_PROVIDER || 'ollama',
    model: process.env.OLLAMA_MODEL || 'llama3',
    url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  });
});

// Helper for OOPS query sanitization
function sanitizeOopsPrompt(message) {
  if (!message) return message;
  const lower = message.toLowerCase().trim();
  if (
    lower.includes('oops') ||
    lower.includes('opps') ||
    lower.includes('oop') ||
    lower.includes('object orient')
  ) {
    const isQuestion = 
      lower.includes('what') || 
      lower.includes('mean') || 
      lower.includes('mena') || 
      lower.includes('define') || 
      lower.includes('explain') || 
      lower.includes('how') || 
      lower.includes('tell') ||
      lower.split(/\s+/).length <= 3;
      
    if (isQuestion) {
      return "What is Object-Oriented Programming (OOP)?";
    }
  }
  return message;
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  let { message, chatId } = req.body ?? {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a non-empty string.',
    });
  }

  // Sanitize OOPS questions
  message = sanitizeOopsPrompt(message);

  console.log('[Chat] POST /api/chat →', {
    message: String(message).slice(0, 100),
    chatId,
  });

  const uid = chatId || `chat_${Date.now()}`;

  const intent = universalIntentDetector(message);
  console.log("Detected intent:", intent);

  // 1. Image Generation Intent
  if (intent === 'image') {
    console.log(`[Chat] Image intent detected for: ${message}`);
    try {
      const prompt = message.trim();
      const generationResult = await generateAIImage(prompt, req);
      const imageUrl = typeof generationResult === 'object' ? generationResult.imageUrl : generationResult;
      const cleanPrompt = req.enhancedPrompt ? req.enhancedPrompt.split(',')[0].trim() : prompt;
      const reply = `I have generated the image for you:\n\n![${cleanPrompt}](${imageUrl})`;

      await saveMessage(uid, 'user', prompt);
      await saveMessage(uid, 'assistant', reply);

      return res.json({
        success: true,
        reply,
        chatId: uid
      });
    } catch (err) {
      console.error('[Chat] Image generation failed:', err.message);
      return res.json({
        success: false,
        error: `Image generation failed: ${err.message}`
      });
    }
  }

  // 2. Document Intent
  if (intent.startsWith('doc_')) {
    const docType = intent.split('_')[1]; // pdf, docx, xlsx, pptx
    console.log(`[Chat] Document intent detected: ${docType} for chatId: ${uid}`);
    try {
      // Find the last assistant message
      const history = await getChatMessages(uid);
      const assistantMessages = history.filter(m => m.role === 'assistant');
      const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];

      let previousText = lastAssistantMsg
        ? (lastAssistantMsg.text || lastAssistantMsg.content || lastAssistantMsg.message || lastAssistantMsg.reply || lastAssistantMsg.response)
        : null;

      if (previousText) {
        // Strip markdown downloads or poster info from text
        const docInfo = getDocDetails(previousText);
        if (docInfo) previousText = docInfo.text;
        const posterInfo = getPosterDetails(previousText);
        if (posterInfo) previousText = posterInfo.text;
      }

      if (!previousText) {
        return res.json({
          success: true,
          reply: `I couldn't find any previous content to export to ${docType.toUpperCase() === 'DOCX' ? 'Word' : docType.toUpperCase() === 'PPTX' ? 'PPT' : docType.toUpperCase() === 'XLSX' ? 'Excel' : 'PDF'}. Please ask me a question first, and then ask to download it!`
        });
      }

      const docResult = await createDocument({
        content: previousText,
        fileType: docType,
        title: 'Chat Document Export',
        req
      });

      const successMessage = `Done — I created the ${docType.toUpperCase() === 'DOCX' ? 'Word' : docType.toUpperCase() === 'PPTX' ? 'PPT' : docType.toUpperCase() === 'XLSX' ? 'Excel' : 'PDF'} document for you.`;

      await saveMessage(uid, 'user', message.trim());
      await saveMessage(uid, 'assistant', `${successMessage} [Download](${docResult.downloadUrl})`);

      return res.json({
        success: true,
        type: 'document',
        fileType: docType,
        downloadUrl: docResult.downloadUrl,
        message: successMessage,
        chatId: uid
      });
    } catch (err) {
      console.error('[Chat] Document creation error:', err.message);
      return res.json({
        success: false,
        error: `Failed to generate document: ${err.message}`
      });
    }
  }

  if (intent.startsWith('poster_')) {
    console.log(`[Chat] Poster intent detected (${intent}) for chatId: ${uid}`);
    try {
      const { generatePosterMetadataAndImage } = await import('./poster.js');
      const { poster, backgroundImageUrl, imageGenerationError } = await generatePosterMetadataAndImage(message.trim());
      
      // Allow poster generation to proceed even if Pexels image generation failed or skipped

      const successMessage = `Done — I designed the poster layout for you.`;

      await saveMessage(uid, 'user', message.trim());
      await saveMessage(uid, 'assistant', `${successMessage} [Poster Layout](${JSON.stringify(poster)})`);

      return res.json({
        success: true,
        type: "poster",
        imageUrl: backgroundImageUrl,
        url: backgroundImageUrl,
        poster,
        message: successMessage,
        chatId: uid
      });
    } catch (err) {
      console.error('[Chat] Poster generation error:', err.message);
      return res.json({
        success: false,
        error: `Failed to generate poster: ${err.message}`
      });
    }
  }

  // 4. Regular chat behavior (General Chat)
  try {
    // Save user message first so the chat session and title are generated
    try {
      await saveMessage(uid, 'user', message.trim());
    } catch (saveErr) {
      console.error('[Chat] ⚠️ User message storage save failed:', saveErr.message);
    }

    // Get conversation history to pass as context
    let history = [];
    try {
      history = await getChatMessages(uid);
    } catch (histErr) {
      console.error('[Chat] ⚠️ Failed to fetch chat history:', histErr.message);
    }

    // Get Ollama response
    let aiReply;
    try {
      aiReply = await getOllamaReply(message.trim(), history);
    } catch (ollamaErr) {
      console.error('[Chat] ❌ Ollama error:', ollamaErr.message);
      if (ollamaErr.message?.includes('taking longer')) {
        aiReply = 'Response is taking longer. Please try a shorter question.';
      }
      // If we don't have an aiReply yet, we will just let it fail below.
    }

    // Standardize success: true if aiReply was generated by ANY means
    if (aiReply) {
      // Save assistant reply
      try {
        await saveMessage(uid, 'assistant', aiReply);
      } catch (saveErr) {
        console.error('[Chat] ⚠️ Assistant message storage save failed:', saveErr.message);
      }

      console.log('[Chat] ✅ Reply sent — chatId:', uid);
      return res.json({
        success: true,
        response: aiReply,
        reply: aiReply,
        message: aiReply,
        chatId: uid
      });
    } else {
      throw new Error('All AI chat providers failed. Please check your internet connection or start Ollama locally.');
    }

  } catch (err) {
    console.error('[Chat] ❌ General chat route error:', err.message);
    return res.status(200).json({
      success: false,
      error: err.message || 'Ollama request failed.',
    });
  }
});

export default router;
