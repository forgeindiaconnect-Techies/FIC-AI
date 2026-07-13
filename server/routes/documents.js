// routes/documents.js – ES module document generation (uses shared docGenerator helper)
import express from 'express';

let lastValidatedDIDKey = null;
let cachedDIDAuthHeader = null;

// Helper: Generates multiple auth header combinations to tolerate various client key formats and email typos
export function getCandidateDIDAuthHeaders(didKey) {
  if (!didKey) return [];
  const rawKey = didKey.trim();
  if (rawKey.startsWith('Basic ')) return [rawKey];

  let emailPart = '';
  let password = '';

  if (rawKey.includes(':')) {
    const parts = rawKey.split(':');
    emailPart = parts[0];
    password = parts[1];
  } else {
    try {
      const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
      if (decoded.includes(':')) {
        const parts = decoded.split(':');
        emailPart = parts[0];
        password = parts[1];
      }
    } catch (_) {}
  }

  if (emailPart && password) {
    let emailDecoded = emailPart;
    if (!emailPart.includes('@')) {
      try {
        const decoded = Buffer.from(emailPart, 'base64').toString('utf8');
        if (decoded.includes('@')) {
          emailDecoded = decoded;
        }
      } catch (_) {}
    }

    const candidates = [];
    // Candidate 1: decoded email + password
    candidates.push('Basic ' + Buffer.from(`${emailDecoded}:${password}`).toString('base64'));

    // Candidate 2: swap vaideeswari8 with vaideeswareswari8 (typo resilience)
    if (emailDecoded.includes('vaideeswari8')) {
      const swapped = emailDecoded.replace('vaideeswari8', 'vaideeswareswari8');
      candidates.push('Basic ' + Buffer.from(`${swapped}:${password}`).toString('base64'));
    }
    if (emailDecoded.includes('vaideeswareswari8')) {
      const swapped = emailDecoded.replace('vaideeswareswari8', 'vaideeswari8');
      candidates.push('Basic ' + Buffer.from(`${swapped}:${password}`).toString('base64'));
    }

    // Candidate 3: raw emailPart + password
    candidates.push('Basic ' + Buffer.from(`${emailPart}:${password}`).toString('base64'));

    // Candidate 4: rawKey as-is encoded in basic auth
    candidates.push('Basic ' + Buffer.from(`${rawKey}:`).toString('base64'));

    return [...new Set(candidates)];
  }

  return ['Basic ' + Buffer.from(`${rawKey}:`).toString('base64')];
}

// Robust async D-ID basic auth header builder that finds and caches the first working candidate
export async function getDIDAuthHeader(didKey) {
  if (!didKey) return '';
  const trimmed = didKey.trim();

  if (trimmed === lastValidatedDIDKey && cachedDIDAuthHeader) {
    return cachedDIDAuthHeader;
  }

  lastValidatedDIDKey = trimmed;
  cachedDIDAuthHeader = null;

  if (trimmed.startsWith('Basic ')) {
    cachedDIDAuthHeader = trimmed;
    return trimmed;
  }

  const candidates = getCandidateDIDAuthHeaders(trimmed);
  console.log(`[Docs/D-ID Auth] Verifying ${candidates.length} auth header candidates...`);

  for (const candidate of candidates) {
    try {
      // D-ID GET /credits is a fast, authenticated endpoint to check key health
      await axios.get('https://api.d-id.com/credits', {
        headers: { Authorization: candidate, Accept: 'application/json' },
        timeout: 8000,
      });
      console.log('[Docs/D-ID Auth] Found valid credentials candidate!');
      cachedDIDAuthHeader = candidate;
      return candidate;
    } catch (err) {
      console.warn(`[Docs/D-ID Auth] Candidate test failed: HTTP ${err.response?.status || err.message}`);
    }
  }

  // If no candidates succeed, fallback to the default candidate
  console.warn('[Docs/D-ID Auth] All candidates failed. Falling back to default candidate.');
  cachedDIDAuthHeader = candidates[0] || '';
  return cachedDIDAuthHeader;
}


import { createDocument } from '../utils/docGenerator.js';
import { generateTalkVideo } from '../utils/videoGeneration.js';
import { preprocessImage } from '../utils/imagePreprocess.js';
import { markdownToTtsScript } from '../utils/markdownToTts.js';
import { getVoiceIds } from '../utils/voiceMap.js';
import { getPopularTopicFallback } from '../utils/fallbackTemplates.js';
import { generateTTSAudioBuffer } from '../utils/ttsHelper.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);


const router = express.Router();

// Helper to auto-detect document format from natural language
function detectDocType(text) {
  const t = text.toLowerCase();
  if (t.includes('ppt') || t.includes('presentation') || t.includes('slide')) return 'pptx';
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('excel') || t.includes('sheet') || t.includes('spreadsheet') || t.includes('xlsx')) return 'xlsx';
  if (t.includes('word') || t.includes('docx') || t.includes('doc')) return 'docx';
  return 'pdf'; // default
}

export function sanitizeOopsPrompt(message) {
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
      return "Object-Oriented Programming (OOP)";
    }
  }
  return message;
}

function withTimeout(promise, ms, timeoutErrorMsg = 'Operation timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Topic expander: detects well-known topics and injects required subtopics
 * so the AI always covers ALL relevant sections automatically.
 */
function buildTopicRequirements(topic) {
  const t = topic.toLowerCase();

  // MERN Stack
  if (t.includes('mern')) {
    return `
## REQUIRED SECTIONS FOR THIS TOPIC — you MUST cover ALL of these in depth:
1. What is MERN Stack? (overview and definition)
2. Components: MongoDB, Express.js, React.js, Node.js (each with its own H2 section, detailed explanation, and use)
3. MERN Architecture Diagram (describe it textually with data flow)
4. How MERN Works Together (request/response lifecycle)
5. MERN Project Directory Structure (with a code block showing folder layout)
6. Setting Up MERN (step-by-step installation: Node.js, MongoDB, React app, Express server)
7. Building a REST API with Express + Node (code example)
8. Connecting MongoDB with Mongoose (code example)
9. React Frontend consuming the API (code example)
10. Advantages of MERN Stack
11. Disadvantages / Limitations
12. Real-World Use Cases (companies and applications built with MERN)
13. MERN vs MEAN vs LAMP comparison table
14. MERN Stack Career Opportunities
15. Top 20 MERN Stack Interview Questions and Answers
`;
  }

  // OOP / OOPs
  if (t.includes('oop') || t.includes('object orient')) {
    return `
## REQUIRED SECTIONS FOR THIS TOPIC — you MUST cover ALL of these in depth:
1. What is OOP? (definition, history, why it matters)
2. Class and Object (with real-world analogies and code examples)
3. Encapsulation (definition, getter/setter pattern, code example, advantages)
4. Abstraction (definition, abstract class vs interface, real-world example)
5. Inheritance (single, multilevel, hierarchical, multiple; code examples)
6. Polymorphism (compile-time/method overloading, runtime/method overriding; code examples)
7. Constructor (default, parameterized, copy constructor; code examples)
8. Destructor / Garbage Collection
9. Access Modifiers (public, private, protected)
10. Static Members and Methods
11. Interfaces vs Abstract Classes
12. Association, Aggregation, Composition
13. Real-World Analogies for all OOP concepts
14. OOP in Java vs Python vs JavaScript comparison
15. Advantages of OOP
16. Disadvantages of OOP
17. OOP Use Cases in Modern Software
18. Top 25 OOP Interview Questions and Answers
`;
  }

  // React
  if (t.includes('react')) {
    return `
## REQUIRED SECTIONS FOR THIS TOPIC — you MUST cover ALL of these in depth:
1. What is React? (library vs framework, history, Meta/Facebook origin)
2. Key Features of React (Virtual DOM, Component-based, JSX, Unidirectional data flow)
3. JSX Explained (with code examples)
4. Components: Functional vs Class (with examples)
5. Props and State (detailed with examples)
6. React Hooks (useState, useEffect, useContext, useRef, useMemo, useCallback — each explained)
7. React Lifecycle Methods
8. Context API and State Management
9. React Router (navigation setup with code)
10. Connecting React to a REST API (fetch/axios examples)
11. React Project Structure (folder layout code block)
12. Performance Optimization in React
13. React vs Angular vs Vue comparison
14. Real-World Applications built with React
15. Top 25 React Interview Questions and Answers
`;
  }

  // Node.js
  if (t.includes('node') && !t.includes('mern')) {
    return `
## REQUIRED SECTIONS — cover ALL:
1. What is Node.js? (event loop, non-blocking I/O)
2. Node.js Architecture
3. NPM and package management
4. Core Modules (fs, http, path, os, events)
5. Express.js framework overview
6. REST API development with Express
7. Middleware concept
8. Database connections (MongoDB, MySQL)
9. Authentication with JWT
10. Error handling in Node
11. Node.js vs Python/PHP for backends
12. Deployment (Heroku, AWS, Railway)
13. Top 20 Interview Questions
`;
  }

  // Python
  if (t.includes('python')) {
    return `
## REQUIRED SECTIONS — cover ALL:
1. What is Python? History and Philosophy
2. Python Syntax and Data Types
3. Control Flow (if/else, loops)
4. Functions and Lambda
5. OOP in Python
6. Modules and Packages
7. File I/O
8. Exception Handling
9. List Comprehensions
10. Python Libraries (NumPy, Pandas, Matplotlib, Requests)
11. Python for Data Science / ML
12. Python for Web (Django, Flask)
13. Python vs Other Languages
14. Top 25 Python Interview Questions
`;
  }

  // Data Structures
  if (t.includes('data structure') || t.includes('dsa')) {
    return `
## REQUIRED SECTIONS — cover ALL:
1. What are Data Structures?
2. Arrays (operations, complexity)
3. Linked Lists (singly, doubly, circular)
4. Stacks and Queues
5. Trees (Binary Tree, BST, AVL)
6. Graphs (BFS, DFS)
7. Hash Tables
8. Heaps
9. Sorting Algorithms (Bubble, Merge, Quick, Heap)
10. Searching Algorithms (Linear, Binary)
11. Big O Notation and Complexity Analysis
12. Real-World Applications
13. Top 25 DSA Interview Questions
`;
  }

  // Machine Learning / AI
  if (t.includes('machine learning') || t.includes('ml') || t.includes('artificial intelligence') || t.includes(' ai ')) {
    return `
## REQUIRED SECTIONS — cover ALL:
1. What is Machine Learning? (definition, types)
2. Supervised vs Unsupervised vs Reinforcement Learning
3. Key Algorithms (Linear Regression, Logistic Regression, Decision Trees, Random Forest, SVM, KNN, Neural Networks)
4. Deep Learning overview
5. Natural Language Processing
6. Computer Vision
7. ML Workflow (data collection, preprocessing, training, evaluation, deployment)
8. Python ML Libraries (scikit-learn, TensorFlow, PyTorch)
9. Real-world ML Applications
10. Ethics in AI
11. Top 20 ML Interview Questions
`;
  }

  // SQL / Database
  if (t.includes('sql') || t.includes('database') || t.includes('mongodb')) {
    return `
## REQUIRED SECTIONS — cover ALL:
1. What is a Database? RDBMS vs NoSQL
2. SQL Fundamentals (CREATE, SELECT, INSERT, UPDATE, DELETE)
3. Joins (INNER, LEFT, RIGHT, FULL)
4. Aggregate Functions
5. Indexes and Performance
6. Transactions and ACID
7. Stored Procedures and Views
8. MongoDB (document model, CRUD, aggregation)
9. SQL vs NoSQL comparison
10. Real-world Use Cases
11. Top 25 SQL Interview Questions
`;
  }

  // Generic — no specific topic matched, return empty (AI will decide on its own)
  return '';
}

/** Helper: Ask Ollama to generate structured content for a document */
async function generateContent(topic, format) {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';

  const prompts = {
    pdf: `Write a detailed, well-structured document about: "${topic}". Use clear sections with headings and explanatory paragraphs.`,
    docx: `Write a professional Word document about: "${topic}". Include an introduction, key points, and conclusion.`,
    pptx: `Create a presentation outline about: "${topic}". Format as: SLIDE 1: [Title] | CONTENT: [content] || SLIDE 2: [Title] | CONTENT: [content] ... (5-7 slides)`,
    xlsx: `Create a data table about: "${topic}". Format as CSV with a header row and 8-10 data rows. Only output the CSV, no explanations.`,
  };

  try {
    const promptText = prompts[format] || prompts.pdf;
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: `You are a professional document creator. ${promptText}`,
      stream: false,
    }, { timeout: 120000 });
    return res.data?.response?.trim() || topic;
  } catch (err) {
    console.warn('[Docs] Ollama connection failed, using topic as content fallback:', err.message);
    return topic;
  }
}

/** Helper: Generate comprehensive structured Markdown draft using multi-tier LLMs */
async function prepareContent(topic) {
  const topicRequirements = buildTopicRequirements(topic);

  const systemInstructions = `You are a world-class technical author, educator, and document architect.
Your task is to generate a COMPLETE, COMPREHENSIVE, and EXHAUSTIVE document about: "${topic}".

CRITICAL RULES:
- You MUST produce a VERY LONG, DETAILED document — minimum 1500 words.
- DO NOT produce a summary or overview. Cover every single subtopic thoroughly.
- Structure with clear H1 (document title), H2 (major sections), H3 (subsections).
- Include real-world examples, code snippets (in fenced code blocks), comparisons, and practical details.
- Include a section on Advantages and Disadvantages/Limitations.
- Include a section on Real-World Use Cases and Applications.
- Include at least 15 interview questions with detailed answers at the end.
- Use bullet points for lists, numbered steps for procedures, tables for comparisons.
- Do NOT include any meta-commentary like "Here is your document" or "I'll now write...".
- Output ONLY the document content itself in clean Markdown format.
${topicRequirements}`;

  // 1. Try Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your_') && geminiKey.trim() !== '') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        }
      });
      const geminiPromise = model.generateContent([systemInstructions]).then(async (result) => {
        const response = await result.response;
        return response.text().trim();
      });
      let text = await withTimeout(geminiPromise, 15000, 'Gemini request timed out');
      if (text && text.length > 200) {
        console.log('[Docs] Prepared content using Gemini. Length:', text.length);
        return text;
      }
    } catch (err) {
      console.error('[Docs] Gemini content preparation failed:', err.message);
    }
  }

  // 2. Try OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && !openRouterKey.includes('your_') && openRouterKey.trim() !== '') {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: systemInstructions }
        ],
        max_tokens: 8192,
      }, {
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      let text = res.data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 200) {
        console.log('[Docs] Prepared content using OpenRouter. Length:', text.length);
        return text;
      }
    } catch (err) {
      console.error('[Docs] OpenRouter content preparation failed:', err.message);
    }
  }

  // 3. Fallback to Ollama (Local)
  try {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';
    console.log('[Docs] Querying local Ollama model:', OLLAMA_MODEL);
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: systemInstructions,
      stream: false,
      options: {
        num_predict: 4096,
        temperature: 0.7,
      }
    }, { timeout: 25000 });
    const text = res.data?.response?.trim();
    if (text && text.length > 100) return text;
    throw new Error('Minimal content returned by Ollama');
  } catch (err) {
    console.warn('[Docs] Ollama failed or timed out, returning high-quality pre-written fallback template:', err.message);
    return getPopularTopicFallback(topic);
  }
}

/** Helper: Translate text to target language using multi-tier LLMs */
async function translateText(text, targetLanguage) {
  if (!targetLanguage || targetLanguage.toLowerCase() === 'english' || !text || !text.trim()) {
    return text;
  }

  const promptText = `You are a professional translator specializing in software development and technology.
Translate the following English technical script/text into fluent, natural-sounding, and grammatically correct ${targetLanguage}.

CRITICAL RULES:
1. DO NOT translate technical programming terms, framework names, or technologies literally. Keep them in English.
   For example, keep: "MERN Stack", "MongoDB", "Express", "React", "Node.js", "JavaScript", "Python", "SQL", "OOP", "database", "API", "HTML", "CSS", "code", "programming", "software".
   Do NOT translate "React" to "எதிர்வினை" (reaction). Keep it as "React".
   Do NOT translate "Node" to "முனை" or "கணு". Keep it as "Node" or "Node.js".
2. The surrounding grammar, explanations, and structure must be in fluent, natural ${targetLanguage} as spoken by a native speaker.
3. Output ONLY the translated text itself. Do NOT wrap it in quotes, and do NOT include any introductory or concluding remarks (such as "Here is the translation:").

Text to translate:
"${text}"`;

  // 1. Try Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.includes('your_') && geminiKey.trim() !== '') {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.3,
        }
      });
      const result = await model.generateContent([promptText]);
      const response = await result.response;
      const textResult = response.text().trim();
      if (textResult) {
        console.log(`[Translate] Successfully translated to ${targetLanguage} using Gemini.`);
        return textResult;
      }
    } catch (err) {
      console.error('[Translate] Gemini translation failed:', err.message);
    }
  }

  // 2. Try OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && !openRouterKey.includes('your_') && openRouterKey.trim() !== '') {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: promptText }
        ],
        max_tokens: 2048,
      }, {
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      const textResult = res.data?.choices?.[0]?.message?.content?.trim();
      if (textResult) {
        console.log(`[Translate] Successfully translated to ${targetLanguage} using OpenRouter.`);
        return textResult;
      }
    } catch (err) {
      console.error('[Translate] OpenRouter translation failed:', err.message);
    }
  }

  // 3. Fallback to Ollama
  try {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';
    const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: promptText,
      stream: false,
    }, { timeout: 60000 });
    const textResult = res.data?.response?.trim();
    if (textResult) {
      console.log(`[Translate] Successfully translated to ${targetLanguage} using Ollama.`);
      return textResult;
    }
  } catch (err) {
    console.warn('[Translate] Ollama translation failed:', err.message);
  }

  // 4. Try Google Translate Free API (robust no-key fallback)
  try {
    const tl = targetLanguage.toLowerCase() === 'tamil' ? 'ta' : 'en';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { timeout: 10000 });
    const sentences = res.data?.[0];
    if (sentences && sentences.length > 0) {
      const translated = sentences.map(s => s[0]).join('');
      if (translated && translated.trim()) {
        console.log(`[Translate] Successfully translated to ${targetLanguage} using Google Translate API (Fallback).`);
        return translated;
      }
    }
  } catch (err) {
    console.error('[Translate] Google Translate API fallback failed:', err.message);
  }

  return text; // fallback to original text if all failed
}


// POST /api/documents/prepare – prepare structured content draft

router.post('/prepare', async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required to prepare document content' });
    }
    
    const sanitized = sanitizeOopsPrompt(prompt);
    console.log('[Docs] Preparing comprehensive document draft for:', sanitized);
    const preparedContent = await prepareContent(sanitized);
    
    return res.json({
      success: true,
      content: preparedContent,
      title: sanitized
    });
  } catch (err) {
    console.error('[Docs] Prepare endpoint error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── D-ID Avatar configuration ───────────────────────────────────────────────
// Microsoft Azure TTS voices (natural sounding, available through D-ID)
const DID_VOICES = {
  female: 'en-US-JennyNeural',
  male:   'en-US-GuyNeural',
  tamil_female: 'ta-IN-PallaviNeural',
  tamil_male:   'ta-IN-ValluvarNeural',
};

// Pools of stable, high-quality public portrait images (Unsplash face assets)
const FALLBACK_FEMALE_FACES = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1024&h=1024&fit=crop'
];

const FALLBACK_MALE_FACES = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1024&h=1024&fit=crop',
  'https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=1024&h=1024&fit=crop'
];

const DID_FEMALE_IMAGE = FALLBACK_FEMALE_FACES[0];
const DID_MALE_IMAGE   = FALLBACK_MALE_FACES[0];

// Dynamically fetch the first female/male Clips presenter available for this account
async function fetchBestPresenter(authHeader, preferGender = 'female') {
  try {
    const res = await axios.get('https://api.d-id.com/clips/presenters?limit=20', {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      timeout: 10000,
    });
    const presenters = res.data?.presenters || res.data?.clips || [];
    if (presenters.length === 0) return null;

    const targetGender = ['male', 'boy', 'male_presenter'].includes((preferGender || '').toLowerCase()) ? 'male' : 'female';
    
    // Filter presenters matching targetGender
    const genderMatches = presenters.filter(p => (p.gender || '').toLowerCase() === targetGender);
    
    if (genderMatches.length > 0) {
      // 1. Try to find a premium/Full-HD presenter among gender matches
      const premiumMatch = genderMatches.find(p => 
        (p.type || '').toLowerCase() === 'premium' || 
        (p.id || '').toLowerCase().includes('premium') ||
        (p.presenter_id || '').toLowerCase().includes('premium')
      );
      if (premiumMatch) {
        console.log(`[Docs/D-ID] Selected premium presenter: ${premiumMatch.name} (${premiumMatch.presenter_id || premiumMatch.id})`);
        return premiumMatch.presenter_id || premiumMatch.id;
      }
      // 2. Fallback to first gender match
      return genderMatches[0].presenter_id || genderMatches[0].id;
    }
    
    // 3. Specific name matches based on gender from all available
    if (targetGender === 'male') {
      const maleName = presenters.find(p => p.presenter_id?.toLowerCase().includes('liam') || p.presenter_id?.toLowerCase().includes('guy') || p.id?.toLowerCase().includes('liam') || p.id?.toLowerCase().includes('guy'));
      if (maleName) return maleName.presenter_id || maleName.id;
    } else {
      const mia = presenters.find(p => p.presenter_id?.toLowerCase().includes('mia') || p.id?.toLowerCase().includes('mia'));
      if (mia) return mia.presenter_id || mia.id;
    }

    // 4. Fallback to first available presenter
    return presenters[0].presenter_id || presenters[0].id;
  } catch (e) {
    console.warn('[Docs/D-ID] Could not fetch presenters list:', e.message);
    return null;
  }
}

/**
 * Create a D-ID talking head video.
 * Priority: Clips API (Mia Elegant 3D avatar) → Talks API (2D realistic)
 * Handles 402/InsufficientCreditsError with clear user message.
 */
async function generateDIDVideo(script, gender, title, avatarUrl = null, language = 'english') {
  const didKey = process.env.DID_API_KEY;
  if (!didKey || didKey.includes('your_') || !didKey.trim()) {
    throw new Error('DID_API_KEY not configured');
  }

  const authHeader = await getDIDAuthHeader(didKey);

  const isMale = ['male', 'boy', 'male_presenter'].includes((gender || '').toLowerCase());

  // Pick voice ID based on language + gender
  const langLower = (language || 'english').toLowerCase();
  let voiceId;
  if (langLower === 'tamil') {
    voiceId = isMale ? DID_VOICES.tamil_male : DID_VOICES.tamil_female;
  } else {
    const { didVoiceId } = getVoiceIds(gender, language);
    voiceId = didVoiceId || (isMale ? DID_VOICES.male : DID_VOICES.female);
  }

  // Fast polling schedule: 2s × 14, then 3s × 8, then 4s × 3 ≈ 60s max
  const pollIntervals = [
    ...Array(14).fill(2000),
    ...Array(8).fill(3000),
    ...Array(3).fill(4000),
  ];

  // ─── Step 1: Clips API (expressive 3D avatar — best quality) ──────────────────
  // Fetch the actual presenter ID from the API (avoids hardcoded IDs that may differ by account)
  const presenterId = await fetchBestPresenter(authHeader, gender);
  if (presenterId) {
    console.log('[Docs/D-ID] Trying Clips API | presenter:', presenterId, '| voice:', voiceId);
    try {
      const clipsRes = await axios.post('https://api.d-id.com/clips', {
        presenter_id: presenterId,
        script: {
          type: 'text',
          input: script,
          provider: { type: 'microsoft', voice_id: voiceId },
          subtitles: 'false',
        },
        config: { result_format: 'mp4', stitch: true },
      }, {
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 20000,
      });

      const clipId = clipsRes.data?.id;
      if (clipId) {
        console.log('[Docs/D-ID] Clips job created:', clipId, '— polling...');
        for (let i = 0; i < pollIntervals.length; i++) {
          await new Promise(r => setTimeout(r, pollIntervals[i]));
          try {
            const pollRes = await axios.get(`https://api.d-id.com/clips/${clipId}`, {
              headers: { Authorization: authHeader, Accept: 'application/json' },
              timeout: 10000,
            });
            const clipStatus = pollRes.data?.status;
            const clipUrl = pollRes.data?.result_url;
            console.log(`[Docs/D-ID] Clips poll ${i + 1} — status: ${clipStatus}`);
            if (clipStatus === 'done' && clipUrl) {
              const elapsed = pollIntervals.slice(0, i + 1).reduce((a, b) => a + b, 0) / 1000;
              console.log(`[Docs/D-ID] Clips video ready in ~${elapsed.toFixed(0)}s:`, clipUrl);
              return { videoUrl: clipUrl, provider: 'd-id-clips', talkId: clipId };
            }
            if (clipStatus === 'error') {
              throw new Error(`Clips failed: ${pollRes.data?.error?.description || 'unknown'}`);
            }
          } catch (pollErr) {
            if (pollErr.message.startsWith('Clips failed')) throw pollErr;
            console.warn(`[Docs/D-ID] Clips poll ${i + 1} error:`, pollErr.message);
          }
        }
        throw new Error('Clips timed out after ~60s');
      }
    } catch (clipsErr) {
      const clipsStatus = clipsErr.response?.status;
      const clipsData = clipsErr.response?.data;
      const clipsDetail = clipsData?.description || clipsData?.message || clipsErr.message;
      console.warn(`[Docs/D-ID] Clips API failed (HTTP ${clipsStatus}): ${clipsDetail}`);

      // If it's a credit issue, throw immediately with a helpful message instead of trying Talks
      if (clipsStatus === 402 || clipsData?.kind === 'InsufficientCreditsError') {
        throw new Error('D-ID account has insufficient credits. Please top up at studio.d-id.com/account-settings');
      }
    }
  } else {
    console.log('[Docs/D-ID] No Clips presenter found. Using Talks API directly.');
  }

  // ─── Step 2: Talks API (2D realistic talking head) ───────────────────────────
  const facePool = isMale ? FALLBACK_MALE_FACES : FALLBACK_FEMALE_FACES;
  const randomFaceUrl = facePool[Math.floor(Math.random() * facePool.length)];
  const imgUrl = avatarUrl || randomFaceUrl;
  console.log('[Docs/D-ID] Using Talks API | image:', imgUrl);

  let createRes;
  try {
    createRes = await axios.post('https://api.d-id.com/talks', {
      source_url: imgUrl,
      script: {
        type: 'text',
        input: script,
        provider: { type: 'microsoft', voice_id: voiceId },
        subtitles: 'false',
      },
      config: { fluent: true, pad_audio: 0.0, stitch: true },
    }, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 20000,
    });
  } catch (talkErr) {
    const talkStatus = talkErr.response?.status;
    const talkData = talkErr.response?.data;
    const talkDetail = talkData?.description || talkData?.message || talkErr.message;
    console.error('[Docs/D-ID] Talks POST error:', talkStatus, talkDetail);

    if (talkStatus === 402 || talkData?.kind === 'InsufficientCreditsError') {
      throw new Error('D-ID account has 0 credits remaining. Please top up at studio.d-id.com/account-settings to generate videos.');
    }
    throw new Error(`D-ID Talks error (${talkStatus}): ${talkDetail}`);
  }

  const talkId = createRes.data?.id;
  if (!talkId) {
    throw new Error(`D-ID Talks: no talk ID in response — ${JSON.stringify(createRes.data)}`);
  }

  console.log('[Docs/D-ID] Talks job created:', talkId, '— polling...');
  for (let i = 0; i < pollIntervals.length; i++) {
    await new Promise(r => setTimeout(r, pollIntervals[i]));
    try {
      const pollRes = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeout: 10000,
      });
      const talkStatus = pollRes.data?.status;
      const videoUrl = pollRes.data?.result_url;
      console.log(`[Docs/D-ID] Talks poll ${i + 1} — status: ${talkStatus}`);
      if (talkStatus === 'done' && videoUrl) {
        const elapsed = pollIntervals.slice(0, i + 1).reduce((a, b) => a + b, 0) / 1000;
        console.log(`[Docs/D-ID] Talks video ready in ~${elapsed.toFixed(0)}s:`, videoUrl);
        return { videoUrl, provider: 'd-id', talkId };
      }
      if (talkStatus === 'error') {
        throw new Error(`D-ID talk failed: ${pollRes.data?.error?.description || 'unknown'}`);
      }
    } catch (pollErr) {
      if (pollErr.message.startsWith('D-ID talk failed')) throw pollErr;
      console.warn(`[Docs/D-ID] Talks poll ${i + 1} error:`, pollErr.message);
    }
  }
  throw new Error('D-ID talk timed out after ~60 seconds');
}

/**
 * Dynamically fetch the first available avatar from HeyGen that matches
 * the requested gender. Falls back to any avatar if no gender match found.
 * @returns {Promise<string>} avatar_id
 */
async function fetchHeyGenAvatarId(heyGenKey, gender) {
  try {
    const res = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': heyGenKey.trim() },
      timeout: 15000,
    });
    const avatars = res.data?.data?.avatars || [];
    if (!avatars.length) throw new Error('No avatars found in HeyGen account');

    // Try to find a gender-matched avatar
    const preferred = gender === 'male' ? 'male' : 'female';
    const match = avatars.find(a =>
      (a.gender || '').toLowerCase() === preferred ||
      (a.avatar_name || '').toLowerCase().includes(preferred)
    );
    const chosen = match || avatars[0];
    console.log(`[Docs/HeyGen] Selected avatar: "${chosen.avatar_name}" (${chosen.avatar_id})`);
    return chosen.avatar_id;
  } catch (e) {
    // Fallback to HeyGen's well-known free public avatars
    const fallbackIds = {
      female: 'Abigail_expressive_2024112501',  // HeyGen free tier female avatar
      male:   'Andrew_public_3_20240520',        // HeyGen free tier male avatar
    };
    console.warn('[Docs/HeyGen] Avatar fetch failed, using fallback:', e.message);
    return fallbackIds[gender] || fallbackIds['female'];
  }
}

/**
 * Dynamically fetch a real HeyGen voice ID for the given language/gender.
 * Falls back to the IDs in voiceMap.js if the API call fails.
 */
async function fetchHeyGenVoiceId(heyGenKey, gender, language) {
  try {
    const res = await axios.get('https://api.heygen.com/v2/voices', {
      headers: { 'X-Api-Key': heyGenKey.trim() },
      timeout: 15000,
    });
    const voices = res.data?.data?.voices || [];
    if (!voices.length) throw new Error('No voices found');

    const langLower = (language || 'english').toLowerCase();

    // Map our language name to BCP-47 locale substring for matching
    const localeMap = {
      english: 'en-',
      tamil:   'ta-',
    };
    const localePrefix = localeMap[langLower] || 'en-';

    // Filter by language, then prefer gender match
    const langFiltered = voices.filter(v =>
      (v.locale || v.language || '').toLowerCase().startsWith(localePrefix)
    );

    if (!langFiltered.length) {
      throw new Error(`No ${language} voices found`);
    }

    const preferred = gender === 'male' ? 'male' : 'female';
    const match = langFiltered.find(v =>
      (v.gender || '').toLowerCase() === preferred
    );
    const chosen = match || langFiltered[0];
    console.log(`[Docs/HeyGen] Selected voice: "${chosen.name}" (${chosen.voice_id}) for ${language}/${gender}`);
    return chosen.voice_id;
  } catch (e) {
    // Fall back to known voice IDs from voiceMap
    const { heyGenVoiceId } = getVoiceIds(gender, language);
    console.warn(`[Docs/HeyGen] Voice fetch failed (${e.message}), using voiceMap fallback: ${heyGenVoiceId}`);
    return heyGenVoiceId;
  }
}

/**
 * Create a HeyGen talking avatar video.
 * Requires HEYGEN_API_KEY in .env (get at https://app.heygen.com/settings?nav=API)
 */
async function generateHeyGenVideo(script, gender, language = 'english', motionPrompt = 'natural speaking with subtle hand gestures and facial expressions') {
  const heyGenKey = process.env.HEYGEN_API_KEY;
  if (!heyGenKey || heyGenKey.includes('your_') || !heyGenKey.trim()) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  const normalisedGender = ['male', 'boy', 'male_presenter'].includes((gender || '').toLowerCase()) ? 'male' : 'female';

  // ── Dynamically get avatar + voice from HeyGen API ──────────────────────
  const [avatarId, voiceId] = await Promise.all([
    fetchHeyGenAvatarId(heyGenKey, normalisedGender),
    fetchHeyGenVoiceId(heyGenKey, normalisedGender, language),
  ]);

  console.log(`[Docs/HeyGen] Creating video | avatar: ${avatarId} | voice: ${voiceId} | lang: ${language}`);

  const createRes = await axios.post('https://api.heygen.com/v2/video/generate', {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal',
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voiceId,
      },
      background: {
        type: 'color',
        value: '#1a1a2e',
      },
      motion_prompt: motionPrompt,
    }],
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: '16:9',
  }, {
    headers: {
      'X-Api-Key': heyGenKey.trim(),
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  const videoId = createRes.data?.data?.video_id;
  if (!videoId) throw new Error(`HeyGen did not return video_id. Response: ${JSON.stringify(createRes.data)}`);

  console.log('[Docs/HeyGen] Video job created:', videoId, '— polling...');

  // Fast progressive polling schedule
  const pollIntervals = [
    ...Array(10).fill(3000), // 0-30s: 3s intervals
    ...Array(10).fill(4000), // 30-70s: 4s intervals
    ...Array(38).fill(5000), // 70-260s: 5s intervals
  ];

  for (let i = 0; i < pollIntervals.length; i++) {
    await new Promise(r => setTimeout(r, pollIntervals[i]));
    try {
      const pollRes = await axios.get(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { 'X-Api-Key': heyGenKey.trim() },
        timeout: 15000,
      });
      const status   = pollRes.data?.data?.status;
      const videoUrl = pollRes.data?.data?.video_url;
      console.log(`[Docs/HeyGen] Poll ${i + 1}/${pollIntervals.length} (${pollIntervals[i]}ms) — status: ${status}`);

      if (status === 'completed' && videoUrl) {
        return { videoUrl, provider: 'heygen', videoId };
      }
      if (status === 'failed') {
        throw new Error(`HeyGen video failed: ${pollRes.data?.data?.error || 'unknown'}`);
      }
    } catch (pollErr) {
      if (pollErr.message.startsWith('HeyGen video failed')) throw pollErr;
      console.warn(`[Docs/HeyGen] Poll attempt ${i + 1} error:`, pollErr.message);
    }
  }
  throw new Error('HeyGen video timed out after 5 minutes');
}

/**
 * Download a video from a remote URL and save it locally.
 * Returns the local relative path e.g. /uploads/video/abc.mp4
 */
async function downloadAndSaveVideo(remoteUrl, prefix) {
  const videoDir = path.resolve(__dirname, '../uploads/video');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const filename = `${prefix}_${Date.now()}.mp4`;
  const localPath = path.join(videoDir, filename);

  console.log('[Docs/Video] Downloading video to local storage:', filename);
  const response = await axios.get(remoteUrl, {
    responseType: 'stream',
    timeout: 120000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FIC-AI/1.0)',
    },
  });

  const writer = fs.createWriteStream(localPath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return `/uploads/video/${filename}`;
}

// GET /api/documents/video/status – check D-ID and HeyGen API key health
router.get('/video/status', async (req, res) => {
  const didKey = process.env.DID_API_KEY;
  const heyGenKey = process.env.HEYGEN_API_KEY;
  const results = {};

  // Test D-ID
  if (!didKey || didKey.includes('your_')) {
    results.did = { configured: false, error: 'DID_API_KEY not set' };
  } else {
    try {
      const authHeader = await getDIDAuthHeader(didKey);
      const testRes = await axios.get('https://api.d-id.com/clips/presenters?limit=1', {
        headers: { Authorization: authHeader, Accept: 'application/json' },
        timeout: 10000,
      });
      results.did = { configured: true, status: testRes.status, clipsAccess: true };
    } catch (e) {
      const status = e.response?.status;
      const detail = e.response?.data?.description || e.response?.data?.message || e.message;
      results.did = { configured: true, status, clipsAccess: false, error: detail };
      // Test Talks API as fallback check
      try {
        const authHeader = await getDIDAuthHeader(didKey);
        const talksRes = await axios.get('https://api.d-id.com/talks?limit=1', {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          timeout: 10000,
        });
        results.did.talksAccess = true;
        results.did.talksStatus = talksRes.status;
      } catch (e2) {
        results.did.talksAccess = false;
        results.did.talksError = e2.response?.data?.description || e2.message;
      }
    }
  }

  // Test HeyGen
  if (!heyGenKey || heyGenKey.includes('your_')) {
    results.heygen = { configured: false, error: 'HEYGEN_API_KEY not set' };
  } else {
    try {
      const testRes = await axios.get('https://api.heygen.com/v2/avatars?limit=1', {
        headers: { 'X-Api-Key': heyGenKey.trim() },
        timeout: 10000,
      });
      results.heygen = { configured: true, status: testRes.status, access: true };
    } catch (e) {
      const status = e.response?.status;
      const detail = e.response?.data?.message || e.response?.data?.error || e.message;
      results.heygen = { configured: true, status, access: false, error: detail };
    }
  }

  res.json({ success: true, apiStatus: results });
});

// GET /api/documents/video/test-clips – quick test to diagnose D-ID Clips AND Talks creation
router.get('/test-clips', async (req, res) => {
  const didKey = process.env.DID_API_KEY;
  if (!didKey || didKey.includes('your_')) {
    return res.status(400).json({ error: 'DID_API_KEY not configured' });
  }
  const authHeader = await getDIDAuthHeader(didKey);
  const testScript = 'Hello, I am your AI presenter. This is a test video.';
  const results = {};


  // Test Clips API POST (create)
  console.log('[Test] Creating test D-ID Clips video...');
  try {
    const clipsRes = await axios.post('https://api.d-id.com/clips', {
      presenter_id: 'mia_elegant',
      script: {
        type: 'text',
        input: testScript,
        provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' },
        subtitles: 'false',
      },
      config: { result_format: 'mp4', stitch: true },
    }, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 20000,
    });
    results.clips = { success: true, id: clipsRes.data?.id, data: clipsRes.data };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    const detail = data?.description || data?.message || data?.error?.description || e.message;
    console.error('[Test] D-ID Clips creation failed:', status, detail);
    results.clips = { success: false, httpStatus: status, error: detail, rawData: data };
  }

  // Test Talks API POST (create)
  console.log('[Test] Creating test D-ID Talks video...');
  try {
    const talksRes = await axios.post('https://api.d-id.com/talks', {
      source_url: 'https://create-images-results.d-id.com/DefaultPresenters/Mia_f/image.jpeg',
      script: {
        type: 'text',
        input: testScript,
        provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' },
        subtitles: 'false',
      },
      config: { fluent: true, pad_audio: 0.0, stitch: true },
    }, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 20000,
    });
    results.talks = { success: true, id: talksRes.data?.id, data: talksRes.data };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    const detail = data?.description || data?.message || data?.error?.description || e.message;
    console.error('[Test] D-ID Talks creation failed:', status, detail);
    results.talks = { success: false, httpStatus: status, error: detail, rawData: data };
  }

  return res.json({ results, authHeaderPreview: authHeader.substring(0, 30) + '...' });
});

// GET /api/documents/test-heygen – test HeyGen API connection and validation
router.get('/test-heygen', async (req, res) => {
  const heyGenKey = process.env.HEYGEN_API_KEY;
  if (!heyGenKey || heyGenKey.includes('your_')) {
    return res.status(400).json({ error: 'HEYGEN_API_KEY not configured' });
  }
  
  const results = {};
  
  try {
    console.log('[Test HeyGen] Fetching avatars list...');
    const avatarsRes = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: { 'X-Api-Key': heyGenKey.trim() },
      timeout: 25000,
    });
    results.avatars = { success: true, status: avatarsRes.status, count: avatarsRes.data?.data?.avatars?.length, data: avatarsRes.data };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    results.avatars = { success: false, httpStatus: status, error: e.message, rawData: data };
  }

  try {
    console.log('[Test HeyGen] Fetching user me...');
    const meRes = await axios.get('https://api.heygen.com/v1/user/me', {
      headers: { 'X-Api-Key': heyGenKey.trim() },
      timeout: 25000,
    });
    results.me = { success: true, status: meRes.status, data: meRes.data };
  } catch (e) {
    const status = e.response?.status;
    const data = e.response?.data;
    results.me = { success: false, httpStatus: status, error: e.message, rawData: data };
  }

  return res.json({ success: true, results });
});

// GET /api/documents/test-local-wav2lip – test local python Wav2Lip checkpoints
router.get('/test-local-wav2lip', async (req, res) => {
  const liveportraitScript = path.resolve(__dirname, '../python/liveportrait_animate.py');
  
  let pythonCmd = 'python';
  const candidates = [
    path.resolve(__dirname, '../../../venv/Scripts/python.exe'),
    path.resolve(__dirname, '../../venv/Scripts/python.exe'),
    path.resolve(__dirname, '../../../../venv/Scripts/python.exe')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      pythonCmd = `"${p}"`;
      break;
    }
  }

  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffmpegExists = fs.existsSync(ffmpegPath);

  return res.json({
    success: true,
    message: "Wav2Lip & LivePortrait environment diagnostics.",
    pythonCommand: pythonCmd,
    ffmpegPath: ffmpegPath,
    ffmpegExists: ffmpegExists,
    gpuAcceleration: process.env.OLLAMA_MODEL ? "Available" : "Assuming CPU Mode"
  });
});





// Spoken explanation scripts for common topics as an offline/error fallback
const LOCAL_SPOKEN_FALLBACKS = {
  python: "Hello! Let's talk about Python. Python is a high-level, general-purpose programming language known for its simple readability and massive developer ecosystem. It was created to make code easy to write and understand, acting almost like plain English instructions. In the real world, Python is used for everything from web development and automated scripts, to advanced artificial intelligence and data science at companies like Netflix, Google, and NASA. In summary, Python is a versatile and powerful programming language that serves as the backbone of modern software automation and machine learning.",
  
  html: "Hello! Welcome to this tutorial. HTML, which stands for HyperText Markup Language, is the standard markup language used to create and structure pages on the World Wide Web. Its main purpose is to define the layout and organization of web content, such as headings, paragraphs, links, and images. In the real world, every single website you visit, from Google to social media platforms, uses HTML as its underlying skeleton. To sum it up, HTML is the essential building block of the web that brings structure to digital information.",
  
  css: "Hello! Welcome! CSS, or Cascading Style Sheets, is a design language used to style and format the presentation of web pages written in HTML. Its purpose is to separate content from design, allowing you to change colors, fonts, layouts, and animations across a website. In the real world, CSS is what makes websites look beautiful, responsive on mobile phones, and engaging to interact with. In short, CSS is the digital paintbrush of the internet that turns raw HTML structure into stunning, user-friendly visual experiences.",
  
  javascript: "Hello! Let's explore JavaScript. JavaScript is a dynamic programming language that adds interactive behavior and complex features to web pages. While HTML structures a page and CSS styles it, JavaScript brings it to life by handling button clicks, showing dynamic animations, and fetching data from servers. In the real world, it powers the interactive elements on websites like YouTube, Google Maps, and interactive games in your browser. To summarize, JavaScript is the engine of interactivity on the web, making static pages interactive and responsive.",
  
  ai: "Hello! Today we are discussing Artificial Intelligence, or AI. AI is the simulation of human intelligence processes by computer systems, enabling machines to learn, reason, solve problems, and make decisions. Its primary purpose is to automate tasks, analyze vast amounts of data, and assist humans in solving complex challenges. In the real world, AI powers virtual assistants like Siri, self-driving cars, translation apps, and recommendation systems on Spotify and Netflix. In conclusion, artificial intelligence is a transformative technology that reshapes how we live and work by bringing intelligent automation to everyday life."
};

function getSpokenExplanationFallback(topic) {
  const clean = topic.toLowerCase().trim().replace(/[?.]/g, '');
  
  if (clean.includes('python')) return LOCAL_SPOKEN_FALLBACKS.python;
  if (clean.includes('html')) return LOCAL_SPOKEN_FALLBACKS.html;
  if (clean.includes('css')) return LOCAL_SPOKEN_FALLBACKS.css;
  if (clean.includes('javascript') || clean.includes(' js')) return LOCAL_SPOKEN_FALLBACKS.javascript;
  if (clean.includes('artificial intelligence') || clean.includes(' ai ')) return LOCAL_SPOKEN_FALLBACKS.ai;
  
  // Generic fallback if Gemini fails and it's not a common topic
  const capitalizedTopic = topic.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
    
  return `Hello! Let's learn about ${capitalizedTopic}. This is an important topic in modern technology and software engineering. Its primary purpose is to help developers and users solve complex problems, optimize processes, and manage information more effectively. In the real world, this concept is applied across many different industries to build secure, scalable, and high-performance systems. In conclusion, understanding this concept is highly valuable for anyone looking to build a strong foundation in modern technology.`;
}

// POST /api/documents/video – generate AI presenter video from document content
router.post('/video', async (req, res) => {
  try {
    const { content, title, gender = 'female', language = 'english', avatarUrl, localAvatarUrl, provider } = req.body ?? {};
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required to generate video' });
    }

    const trimmed = content.trim();
    let translatedContent = trimmed;
    let translatedTitle = title;
    // ── Smart Intent Detection ─────────────────────────────────────────
    const words = trimmed.split(/\s+/);
    const hasQuestionMark = trimmed.endsWith('?');
    
    // Check for common question or topic/information starters
    const questionStarters = /\b(what|who|where|when|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|shall|have|has|had|define|explain|tell|describe|give|list|name|find|show|compare|difference|meaning|means|learn|know|teach|info|about)\b/i;
    const containsQuestionWord = questionStarters.test(trimmed);
    
    // If it's a short input (e.g. less than 25 words) or ends with '?' or contains query keywords, it's a topic query!
    const isExplanationRequest = words.length < 25 || hasQuestionMark || containsQuestionWord;
    console.log(`[Docs/Video] isExplanationRequest: ${isExplanationRequest} | wordCount: ${words.length} | hasQuestionMark: ${hasQuestionMark} | containsQuestionWord: ${containsQuestionWord}`);

    let alreadyTargetLanguage = false;

    if (isExplanationRequest) {
      const isTamil = language && language.toLowerCase() === 'tamil';
      const targetLangName = isTamil ? 'Tamil' : 'English';
      console.log(`[Docs/Video] Topic/Question detected. Generating structured classroom explanation script directly in ${targetLangName}...`);
      
      try {
        const { geminiClient } = await import('../config/gemini.js');
        if (geminiClient) {
          const voiceoverModel = geminiClient.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'text/plain' },
          });
          
          const voiceoverPrompt = `You are an expert AI video presenter and classroom teacher.
The user wants to learn about: "${trimmed}"

Write a complete, spoken classroom explanation script that answers/explains the topic. 

CRITICAL LANGUAGE REQUIREMENT:
You must write the entire script directly in fluent, natural-sounding, and grammatically correct ${targetLangName}.
${isTamil ? `Follow these rules for Tamil:
1. Keep all technical terms, names of technologies, and frameworks in English letters (e.g. HTML, CSS, JavaScript, React, Database, Software). Do not translate them to literal Tamil.
2. Write all the surrounding grammatical sentences, explanations, transitions, and definitions in fluent Tamil. Keep it natural, warm, and clear like a Tamil teacher speaking in a modern classroom.` : ''}

Structure the spoken script EXACTLY as follows:

PART 1 — INTRODUCTION & DEFINITION:
Open with a warm greeting. State the full proper name if the topic is an abbreviation or acronym (e.g. HTML = HyperText Markup Language, CSS = Cascading Style Sheets, AI = Artificial Intelligence). Give a clear, simple one-sentence definition that anyone can understand.

PART 2 — PURPOSE & WHY IT MATTERS:
Explain WHY this topic exists — what specific problem it was created to solve. Use a simple real-world comparison or analogy to make the concept click instantly.

PART 3 — HOW IT IS USED (Real-World Applications):
Give 2 to 3 concrete, everyday examples of how this is used in the real world. Connect it to things the student already knows and uses daily.

PART 4 — CLOSING SUMMARY:
Recap the single most important idea in one clear sentence. End with an encouraging classroom line.

ABSOLUTE RULES — violating these will make the script unusable:
- Write ONLY plain spoken sentences from start to finish. Zero bullet points, zero numbered lists, zero markdown, zero asterisks, zero code blocks, zero headings, zero special characters
- Every sentence must flow naturally and smoothly into the next — use transitions like "In other words...", "For example...", "Think of it this way...", "To put it simply...", "A perfect real-world example is...", "So essentially...", "And that is why..."
- Write between 350 and 500 words — detailing the concept comprehensively.
- Write EXACTLY the way an excellent teacher speaks naturally in class — warm, clear, confident, never boring
- Every single sentence must be simple enough for a 12-year-old to understand on the first listen
- The script must be completely self-contained and make full sense when read aloud`;
 
          const voiceResult = await voiceoverModel.generateContent(voiceoverPrompt);
          const voiceText = (await voiceResult.response.text()).trim();
          if (voiceText && voiceText.length > 50) {
            // Remove part headers so the speaker doesn't say "PART ONE..."
            const cleanVoiceText = voiceText
              .replace(/PART\s*1\s*[-—:]*\s*INTRODUCTION\s*&\s*DEFINITION\s*[-—:]*/gi, '')
              .replace(/PART\s*2\s*[-—:]*\s*PURPOSE\s*&\s*WHY\s*IT\s*MATTERS\s*[-—:]*/gi, '')
              .replace(/PART\s*3\s*[-—:]*\s*HOW\s*IT\s*IS\s*USED\s*(\(Real-World\s*Applications\))?\s*[-—:]*/gi, '')
              .replace(/PART\s*4\s*[-—:]*\s*CLOSING\s*SUMMARY\s*[-—:]*/gi, '')
              .replace(/PART\s*[1234]\s*[-—:]*/gi, '')
              .trim();
            translatedContent = cleanVoiceText;
            alreadyTargetLanguage = true;
            console.log('[Docs/Video] Structured script generated and cleaned successfully (' + cleanVoiceText.length + ' chars)');
          } else {
            console.warn('[Docs/Video] Gemini output was too short, falling back to local template script.');
            translatedContent = getSpokenExplanationFallback(trimmed);
          }
        } else {
          console.warn('[Docs/Video] Gemini Client not ready, using local spoken fallback.');
          translatedContent = getSpokenExplanationFallback(trimmed);
        }
      } catch (geminiErr) {
        console.warn('[Docs/Video] Script generation failed, falling back to local spoken fallback:', geminiErr.message);
        translatedContent = getSpokenExplanationFallback(trimmed);
      }
    } else {
      console.log('[Docs/Video] Direct script/prompt detected. Speaking it directly in the video.');
      translatedContent = trimmed;
    }
 
    if (language && language.toLowerCase() === 'tamil') {
      if (!alreadyTargetLanguage) {
        console.log('[Docs/Video] Translating raw script content fallback to Tamil...');
        translatedContent = await translateText(translatedContent, 'tamil');
      }
      if (title) {
        console.log('[Docs/Video] Translating title to Tamil...');
        translatedTitle = await translateText(title, 'tamil');
      }
    }

    // Convert to clean spoken script — 3500 char limit gives ~450 words for a deep explanation
    const ttsScript = markdownToTtsScript(translatedContent, 3500);
    
    // Deduplicate title prepending
    const cleanTts = ttsScript.trim();
    const cleanTitle = (translatedTitle || '').trim();
    let fullScript = cleanTts;
    if (cleanTitle && !cleanTts.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
      fullScript = `${cleanTitle}. ${cleanTts}`;
    }

    console.log('[Docs/Video] Generating AI presenter video. Gender:', gender, '| Language:', language, '| Script length:', fullScript.length, '| Preferred Provider:', provider);

    const errors = [];
    const errorDetails = []; // structured per-provider error details for frontend
    const providersToTry = (provider === 'heygen') ? ['heygen', 'd-id'] : ['d-id', 'heygen'];

    for (const p of providersToTry) {
      if (p === 'd-id') {
        try {
          const { videoUrl: remoteUrl, provider: resProvider, talkId } = await generateDIDVideo(fullScript, gender, translatedTitle || 'Presentation', avatarUrl, language);
          console.log('[Docs/Video] D-ID video ready, returning remote URL:', remoteUrl);
          return res.json({
            success: true,
            type: 'video',
            provider: 'd-id',
            realisticAvatar: true,
            gender,
            videoUrl: remoteUrl,
            remoteVideoUrl: remoteUrl,
            talkId,
            script: fullScript,
            message: 'Realistic AI human presenter video generated by D-ID.',
          });
        } catch (didErr) {
          const msg = didErr.message || 'Unknown D-ID error';
          console.warn('[Docs/Video] D-ID failed:', msg);
          errors.push(`D-ID: ${msg}`);

          // Classify the D-ID error for clear user messaging
          let didReason = msg;
          let didFix = 'Check your D-ID API key at studio.d-id.com/account-settings';
          if (msg.includes('insufficient credits') || msg.includes('0 credits') || msg.includes('InsufficientCredits')) {
            didReason = 'Your D-ID account has run out of credits (free plan: 20 credits ≈ 20 min video).';
            didFix = 'Top up credits at https://studio.d-id.com/account-settings or use HeyGen instead.';
          } else if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('authentication')) {
            didReason = 'D-ID API key is invalid or has expired.';
            didFix = 'Go to studio.d-id.com → Account Settings → regenerate your API key and update it in Settings.';
          } else if (msg.includes('timed out') || msg.includes('timeout')) {
            didReason = 'D-ID video generation timed out (D-ID servers may be slow right now).';
            didFix = 'Try again in a few minutes, or switch to HeyGen provider.';
          } else if (msg.includes('not configured') || msg.includes('DID_API_KEY')) {
            didReason = 'D-ID API key is not configured on this server.';
            didFix = 'Open Settings (⚙️) in the Video Generator and enter your D-ID API key.';
          }
          errorDetails.push({ provider: 'D-ID', reason: didReason, fix: didFix });
        }
      } else if (p === 'heygen') {
        try {
          const { videoUrl: remoteUrl, provider: resProvider, videoId } = await generateHeyGenVideo(fullScript, gender, language);
          console.log('[Docs/Video] HeyGen video ready, returning remote URL:', remoteUrl);
          return res.json({
            success: true,
            type: 'video',
            provider: 'heygen',
            realisticAvatar: true,
            gender,
            videoUrl: remoteUrl,
            remoteVideoUrl: remoteUrl,
            videoId,
            script: fullScript,
            message: 'Realistic AI presenter video generated by HeyGen.',
          });
        } catch (heyErr) {
          const msg = heyErr.message || 'Unknown HeyGen error';
          console.warn('[Docs/Video] HeyGen failed:', msg);
          errors.push(`HeyGen: ${msg}`);

          // Classify the HeyGen error
          let heyReason = msg;
          let heyFix = 'Check your HeyGen API key at app.heygen.com/settings?nav=API';
          if (msg.includes('credit') || msg.includes('quota') || msg.includes('limit')) {
            heyReason = 'Your HeyGen account has no remaining credits.';
            heyFix = 'Top up HeyGen credits at https://app.heygen.com or switch to D-ID.';
          } else if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid')) {
            heyReason = 'HeyGen API key is invalid or expired.';
            heyFix = 'Go to app.heygen.com → Settings → API and regenerate your key.';
          } else if (msg.includes('timed out') || msg.includes('timeout')) {
            heyReason = 'HeyGen video generation timed out (HeyGen servers may be busy).';
            heyFix = 'Try again later, or switch to D-ID provider.';
          } else if (msg.includes('not configured') || msg.includes('HEYGEN_API_KEY')) {
            heyReason = 'HeyGen API key is not configured on this server.';
            heyFix = 'Open Settings (⚙️) in the Video Generator and enter your HeyGen API key.';
          }
          errorDetails.push({ provider: 'HeyGen', reason: heyReason, fix: heyFix });
        }
      }
    }

    // Both D-ID and HeyGen failed. Try local offline Wav2Lip fallback (if not on Render/production).
    const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
    if (isRender) {
      console.warn('[Docs/Video] Running on Render/production. Falling back to Demo Mode (Static loop + TTS) to prevent Out-of-Memory crashes.');
      const isMale = gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'boy';
      const fallbackFilename = isMale ? 'boy_presenter.mp4' : 'girl_presenter.mp4';
      let relativeUrl = `/uploads/video/${fallbackFilename}`;
      
      // If the user uploaded a custom photo, use that image URL directly in demo mode!
      if (localAvatarUrl) {
        relativeUrl = localAvatarUrl;
      } else if (avatarUrl) {
        relativeUrl = avatarUrl;
      }

      return res.json({
        success: true,
        demo: true,
        type: 'video',
        provider: 'local-fallback', // use local-fallback so frontend enables TTS audio overlay
        realisticAvatar: true,
        gender,
        videoUrl: relativeUrl,
        remoteVideoUrl: relativeUrl,
        script: fullScript,
        message: `Fell back to AI image + TTS video generation. D-ID: ${errors.join(', ')}`,
      });
    }

    console.warn('[Docs/Video] D-ID and HeyGen failed. Running local offline Wav2Lip lip-sync generator...');
    try {
      const isMale = gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'boy';
      const fallbackFilename = isMale ? 'boy_presenter.mp4' : 'girl_presenter.mp4';
      const fallbackVideoPath = path.resolve(__dirname, `../uploads/video/${fallbackFilename}`);

      if (fs.existsSync(fallbackVideoPath)) {
        // Create request folder in uploads/talkify
        const requestId = `doc_${Date.now()}`;
        const outDir = path.join(process.cwd(), 'uploads', 'talkify', requestId);
        fs.mkdirSync(outDir, { recursive: true });

        // Step A: Select and use user's uploaded avatar OR download a random portrait face based on gender
        const imagePath = path.join(outDir, 'portrait.jpg');
        let usedCustomAvatar = false;
        
        if (localAvatarUrl) {
          const relativePath = localAvatarUrl.replace(/^\/uploads\//, '');
          const localPath = path.join(process.cwd(), 'uploads', relativePath);
          if (fs.existsSync(localPath)) {
            console.log('[Docs/Video] Using custom uploaded avatar for local fallback:', localPath);
            fs.copyFileSync(localPath, imagePath);
            usedCustomAvatar = true;
          } else {
            console.warn('[Docs/Video] Custom local avatar path not found:', localPath);
          }
        }

        if (!usedCustomAvatar) {
          const facePool = isMale ? FALLBACK_MALE_FACES : FALLBACK_FEMALE_FACES;
          const randomFaceUrl = facePool[Math.floor(Math.random() * facePool.length)];
          console.log('[Docs/Video] Downloading random portrait face for local fallback:', randomFaceUrl);
          const faceRes = await axios.get(randomFaceUrl, { responseType: 'arraybuffer', timeout: 15000 });
          fs.writeFileSync(imagePath, Buffer.from(faceRes.data));
        }

        // Step B: Generate custom TTS audio from prompt
        console.log('[Docs/Video] Synthesizing TTS audio buffer for prompt...');
        const audioBuffer = await generateTTSAudioBuffer(fullScript, language, gender);
        const audioPath = path.join(outDir, 'voice.mp3');
        fs.writeFileSync(audioPath, audioBuffer);

        // Step C: Run offline Wav2Lip generator (fast CPU mode with LivePortrait skipped)
        console.log('[Docs/Video] Running local talk video generation pipeline...');
        const finalVideoPath = await generateTalkVideo({ imagePath, audioPath, outDir, fallbackVideoPath });

        // Serve the final video using the static uploads server path
        const videoFilename = path.basename(finalVideoPath);
        const relativeUrl = `/uploads/talkify/${requestId}/${videoFilename}`;
        
        console.log('[Docs/Video] Local lip-sync video ready! URL:', relativeUrl);
        return res.json({
          success: true,
          type: 'video',
          provider: 'local-fallback',
          realisticAvatar: true,
          gender,
          videoUrl: relativeUrl,
          remoteVideoUrl: relativeUrl,
          script: fullScript,
          message: 'Local Synced Presenter: Generated custom offline lip-sync video (paid API credits exhausted/balance limit reached).',
        });
      } else {
        console.warn('[Docs/Video] Local fallback video file not found:', fallbackVideoPath);
        errorDetails.push({
          provider: 'Local Fallback',
          reason: `Local presenter video file not found (${fallbackFilename}).`,
          fix: 'Ensure the server has downloaded the default presenter videos on startup.',
        });
      }
    } catch (localErr) {
      const localMsg = localErr.message || 'Unknown local error';
      console.error('[Docs/Video] Local offline Wav2Lip generator failed:', localMsg);
      errors.push(`Local Lip-Sync Fallback: ${localMsg}`);
      errorDetails.push({
        provider: 'Local Fallback',
        reason: `Local lip-sync generator error: ${localMsg}`,
        fix: 'Check that Python and Wav2Lip are properly installed, or use an online provider (D-ID / HeyGen).',
      });
    }

    // All providers failed — return detailed structured error for clear frontend display
    return res.status(500).json({
      success: false,
      error: 'All video generation providers failed. See details below for how to fix each one.',
      details: errors,
      providerErrors: errorDetails,
      hint: 'Add valid API keys in the Settings panel (⚙️), or top up your D-ID / HeyGen account credits.',
    });


  } catch (err) {
    console.error('[Docs] Video endpoint error:', err.message);
    try {
      const diagPath = path.resolve(__dirname, '../diagnostics.txt');
      const logContent = `
========================================
[${new Date().toISOString()}] DOCS VIDEO ENDPOINT ERROR
Error: ${err.message}
Stack: ${err.stack}
Details: ${err.response?.data ? JSON.stringify(err.response.data) : 'N/A'}
========================================
`;
      fs.appendFileSync(diagPath, logContent, 'utf8');
    } catch (_) {}
    res.status(500).json({ success: false, error: err.response?.data?.message || err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/documents/generate
// Body option A (from standalone tab): { prompt }
// Body option B (from chat integration): { chatId, content, fileType, title }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { prompt, chatId, content, fileType, title } = req.body ?? {};

    // Option B: Direct generation from chat history / pre-provided content
    if (fileType && content) {
      console.log('[Docs] Direct document generation requested:', { fileType, title });
      const result = await createDocument({
        content,
        fileType,
        title: title || 'Generated Document',
        req
      });

      // Save messages in history if chatId is provided
      if (chatId) {
        try {
          const { saveMessage } = await import('../utils/storage.js');
          let msgText = `Your ${fileType.toUpperCase()} is ready.`;
          if (fileType.toLowerCase() === 'pdf') {
            msgText = 'Your PDF is ready.';
          } else if (fileType.toLowerCase() === 'docx' || fileType.toLowerCase() === 'doc') {
            msgText = 'Your Word document is ready.';
          }
          await saveMessage(chatId, 'user', `i need ${fileType.toLowerCase()}`);
          await saveMessage(chatId, 'assistant', `${msgText} [Download](${result.downloadUrl})`);
        } catch (saveErr) {
          console.error('[Docs] Failed to save messages to history:', saveErr.message);
        }
      }

      let msgText = `Your ${fileType.toUpperCase()} is ready.`;
      if (fileType.toLowerCase() === 'pdf') {
        msgText = 'Your PDF is ready.';
      } else if (fileType.toLowerCase() === 'docx' || fileType.toLowerCase() === 'doc') {
        msgText = 'Your Word document is ready.';
      }

      return res.json({
        success: true,
        type: 'document',
        fileType: fileType.toLowerCase(),
        fileName: result.filename,
        downloadUrl: `/downloads/${result.filename}`,
        message: msgText
      });
    }

    // Option A: Standalone page where prompt is given
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt or (content + fileType) is required' });
    }

    const sanitizedPrompt = sanitizeOopsPrompt(prompt);
    const detectedType = detectDocType(sanitizedPrompt);
    console.log('[Docs] Prompt-based generation:', { prompt: sanitizedPrompt, detectedType });

    const aiContent = await generateContent(sanitizedPrompt, detectedType);
    const result = await createDocument({
      content: aiContent,
      fileType: detectedType,
      title: sanitizedPrompt,
      req
    });

    return res.json({
      success: true,
      type: 'document',
      docType: detectedType,
      fileType: detectedType,
      downloadUrl: result.downloadUrl,
      fileUrl: result.fullUrl,
      filename: result.filename,
      message: `Your ${detectedType.toUpperCase()} document is ready.`
    });

  } catch (err) {
    console.error('[Docs] Generate endpoint error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Backward-compatible individual endpoints
router.post('/pdf', async (req, res) => {
  try {
    const topic = sanitizeOopsPrompt(req.body.prompt || req.body.topic || req.body.content || 'Document');
    const aiContent = await generateContent(topic, 'pdf');
    const result = await createDocument({ content: aiContent, fileType: 'pdf', title: topic, req });
    res.json({ success: true, docType: 'pdf', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/word', async (req, res) => {
  try {
    const topic = sanitizeOopsPrompt(req.body.prompt || req.body.topic || req.body.content || 'Document');
    const aiContent = await generateContent(topic, 'docx');
    const result = await createDocument({ content: aiContent, fileType: 'docx', title: topic, req });
    res.json({ success: true, docType: 'word', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ppt', async (req, res) => {
  try {
    const topic = sanitizeOopsPrompt(req.body.prompt || req.body.topic || req.body.content || 'Presentation');
    const aiContent = await generateContent(topic, 'pptx');
    const result = await createDocument({ content: aiContent, fileType: 'pptx', title: topic, req });
    res.json({ success: true, docType: 'ppt', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/excel', async (req, res) => {
  try {
    const topic = sanitizeOopsPrompt(req.body.prompt || req.body.topic || req.body.content || 'Data');
    const aiContent = await generateContent(topic, 'xlsx');
    const result = await createDocument({ content: aiContent, fileType: 'xlsx', title: topic, req });
    res.json({ success: true, docType: 'excel', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
