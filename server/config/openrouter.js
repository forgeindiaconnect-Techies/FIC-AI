import 'dotenv/config';
import axios from 'axios';

// ─── Constants ───────────────────────────────────────────────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/auto';

const SYSTEM_PROMPT =
  'You are FIC AI, a ChatGPT-like assistant. Give detailed, structured, ' +
  'beginner-friendly answers in clean Markdown formatting. Use headings, ' +
  'bullet points, examples, and tables where appropriate.';

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Send a message to OpenRouter (model: openrouter/auto) and return the reply.
 *
 * @param {string} userMessage
 * @returns {Promise<string>} AI reply text
 */
export async function generateOpenRouterReply(userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in .env');
  }

  const requestBody = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
  };

  console.log('[OpenRouter] Sending request → model:', MODEL);
  console.log('[OpenRouter] User message (preview):', userMessage.slice(0, 120));

  let response;
  try {
    response = await axios.post(OPENROUTER_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 s — auto model may route slowly
    });
  } catch (err) {
    // Axios throws on non-2xx; surface the exact OpenRouter error body
    const status  = err?.response?.status;
    const errBody = err?.response?.data;
    console.error('[OpenRouter] ❌ HTTP error', status, JSON.stringify(errBody, null, 2));
    throw new Error(
      `OpenRouter request failed (${status}): ${errBody?.error?.message || err.message}`
    );
  }

  console.log('[OpenRouter] OPENROUTER RESPONSE:', JSON.stringify(response.data, null, 2));

  const aiReply = response.data?.choices?.[0]?.message?.content?.trim();

  if (!aiReply) {
    console.error('[OpenRouter] ⚠️ aiReply is undefined. Full response:', JSON.stringify(response.data, null, 2));
    throw new Error('OpenRouter returned an empty reply. Check the full response log above.');
  }

  console.log('[OpenRouter] AI REPLY:', aiReply.slice(0, 200));
  return aiReply;
}
