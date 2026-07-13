// gemini.js – Gemini AI configuration with detailed markdown output
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import fetch from 'node-fetch';

// ------------------------------------------------------------
// 1️⃣  API key & client
// ------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
export const geminiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ------------------------------------------------------------
// 2️⃣  System prompt – forces ChatGPT‑style answers
// ------------------------------------------------------------
const systemPrompt = `
You are FIC AI, a helpful assistant like ChatGPT.
Follow the user-provided abbreviation rules strictly. Use the following mappings when answering educational questions:
- BSc = Bachelor of Science
- BCA = Bachelor of Computer Applications
- MCA = Master of Computer Applications
- BE = Bachelor of Engineering
- BTech = Bachelor of Technology
If the user asks for a term with multiple meanings, choose the most common meaning based on context; for education contexts, use the mappings above.
If the user asks for code, provide complete working code first.
Do not explain only theory.
Use clean Markdown.
Use proper code blocks.
Do not output Question/Answer labels.
For landing page requests, provide a full responsive HTML file with CSS included.
If the user asks for a full form, explain the full form clearly and provide meaning, usage, examples, and differences from related concepts.
`;


// ------------------------------------------------------------
// 3️⃣  Generation function – high token limit, markdown output
// ------------------------------------------------------------
/**
 * Generate a response using Gemini (or a graceful fallback).
 * @param {string} userMessage – the message sent by the user.
 * @returns {Promise<string>} – Markdown formatted reply.
 */
export async function generateGeminiReply(userMessage) {
  const lower = (userMessage || '').toLowerCase();

  // Detect coding intent keywords
  const codingKeywords = ['code', 'html', 'css', 'landing page', 'website code', 'react code', 'frontend code'];
  const isCodingIntent = codingKeywords.some(k => lower.includes(k));

  // If coding intent, use Ollama phi3 model
  if (isCodingIntent) {
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3',
          prompt: `${systemPrompt}\nUser: ${userMessage}\nAssistant:`,
          stream: false,
          options: { num_predict: 1200, temperature: 0.5 }
        })
      });
      if (!response.ok) throw new Error('Ollama request failed');
      const data = await response.json();
      return data.response || '';
    } catch (ollamaErr) {
      console.error('Ollama generation error (fallback to Gemini):', ollamaErr);
      // fall through to Gemini below
    }
  }

  // ---------- 3a️⃣ Fallback when Gemini is not configured ----------
  if (!geminiClient) {
    // Throw a clear error for missing Gemini configuration
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY in .env');
  }


  // ---------- 3b️⃣ Call Gemini with system prompt ----------
  try {
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-2.5-pro', // higher‑quality model if available
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000, // allow long, detailed answers
        responseMimeType: 'text/plain',
      },
    });
    const result = await model.generateContent([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ]);
    const genResponse = await result.response;
    const text = await genResponse.text();
    // Append ignore tag if Gemini complains about loops (unlikely with proper prompt)
    return text.includes('[ignoring loop detection]') ? text : text;
  } catch (err) {
    console.error('Gemini generation error:', err);
    // Provide same markdown fallback as above for consistency
    if (lower.includes('mern') || lower.includes('mern stack')) {
      return `# What is the MERN Stack?\n\n(See fallback above)`;
    }
    return `# Error\n\nI ran into an internal error while generating a response. Please try again.`;
  }
}
