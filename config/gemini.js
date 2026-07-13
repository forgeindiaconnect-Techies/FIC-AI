// config/gemini.js
// This module provides a wrapper around the Google Gemini API to generate AI replies.
// It includes a system prompt that enforces correct handling of common educational abbreviations.

import fetch from 'node-fetch';

// Load API key from environment variables. Ensure you set GEMINI_API_KEY in your .env file.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set in environment. Gemini calls will fail.');
}

// System prompt to prepend to every user message.
const SYSTEM_PROMPT = `You are a helpful educational assistant.
When answering questions about academic qualifications, always expand the following abbreviations:
- BSc = Bachelor of Science
- BCA = Bachelor of Computer Applications
- MCA = Master of Computer Applications
- BE = Bachelor of Engineering
- BTech = Bachelor of Technology
If a question contains an abbreviation that could have multiple meanings, give the most common meaning in the given context and briefly note that other meanings exist.
Do not fabricate information. If you are unsure, respond with "I am not certain about that."
`;

/**
 * Generate a reply from Gemini for a given user message.
 * @param {string} userMessage - The message from the user.
 * @returns {Promise<string>} - The Gemini response text.
 */
export async function generateGeminiReply(userMessage) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  // Build the request payload according to Gemini API specification.
  const payload = {
    contents: [
      { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'user', parts: [{ text: userMessage }] },
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  // The response format includes candidates[0].content.parts[0].text
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== 'string') {
    throw new Error('Unexpected Gemini response format');
  }
  return reply.trim();
}

export default { generateGeminiReply };
