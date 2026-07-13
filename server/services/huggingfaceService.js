import 'dotenv/config';
import axios from 'axios';

// ─── Config (read from .env) ──────────────────────────────────────────────────
const HF_API_KEY = process.env.HF_API_KEY;
const HF_MODEL   = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
const HF_URL     = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const SYSTEM_PROMPT =
  'You are FIC AI, an advanced helpful AI assistant. ' +
  'Give detailed and structured answers.';

// ─── Prompt formatter (Mistral instruct format) ───────────────────────────────
// Mistral-7B-Instruct expects: <s>[INST] prompt [/INST]
function buildPrompt(userMessage) {
  return `<s>[INST] ${SYSTEM_PROMPT}\n\n${userMessage} [/INST]`;
}

// ─── Extract reply from any HF response shape ─────────────────────────────────
function extractReply(data, prompt) {
  // Shape 1: [{ generated_text: "..." }]
  if (Array.isArray(data) && data[0]?.generated_text) {
    let text = data[0].generated_text.trim();
    // Strip the echoed prompt if HF returns the full string
    if (text.startsWith(prompt)) {
      text = text.slice(prompt.length).trim();
    }
    return text || null;
  }
  // Shape 2: { generated_text: "..." }
  if (data?.generated_text) {
    let text = data.generated_text.trim();
    if (text.startsWith(prompt)) {
      text = text.slice(prompt.length).trim();
    }
    return text || null;
  }
  // Shape 3: { error: "..." } — model loading / cold start
  if (data?.error) {
    throw new Error(`Hugging Face model error: ${data.error}`);
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Send userMessage to Hugging Face Inference API and return the AI reply.
 *
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function getHuggingFaceReply(userMessage) {
  if (!HF_API_KEY) {
    throw new Error('HF_API_KEY is not set in .env');
  }

  const prompt = buildPrompt(userMessage);

  console.log('[HF] Sending to model:', HF_MODEL);
  console.log('[HF] Prompt preview:', prompt.slice(0, 150));

  let response;
  try {
    response = await axios.post(
      HF_URL,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false, // only return newly generated tokens
        },
        options: {
          wait_for_model: true, // wait if model is loading (cold start)
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 min — HF cold starts can be slow
      }
    );
  } catch (err) {
    const status  = err?.response?.status;
    const errData = err?.response?.data;
    console.error('[HF] ❌ HTTP error', status, JSON.stringify(errData, null, 2));
    throw new Error(
      `Hugging Face request failed (${status}): ${errData?.error || err.message}`
    );
  }

  console.log('[HF] Raw response:', JSON.stringify(response.data, null, 2));

  const reply = extractReply(response.data, prompt);

  if (!reply) {
    console.error('[HF] ⚠️  Could not extract reply. Full response:', JSON.stringify(response.data, null, 2));
    throw new Error('Hugging Face returned an empty or unrecognised response. Check the server log.');
  }

  console.log('[HF] ✅ AI REPLY:', reply.slice(0, 200));
  return reply;
}
