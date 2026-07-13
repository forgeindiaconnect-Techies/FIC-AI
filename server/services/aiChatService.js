import 'dotenv/config';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';
const CHAT_URL     = `${OLLAMA_URL}/api/chat`;

// Helper to detect greetings
function isGreeting(message) {
  if (!message) return false;
  const clean = message.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const greetings = [
    'hi', 'hello', 'hey', 'hello there', 'hi there', 'hey there', 
    'good morning', 'good afternoon', 'good evening', 
    'yo', 'whats up', 'greetings', 'howdy'
  ];
  return greetings.includes(clean);
}

// Helper to clean response
function cleanReply(replyText, messageText) {
  let cleaned = replyText || '';
  
  // 1. Remove common model tags/tokens
  cleaned = cleaned.replace(/<\|system\|>|<\|user\|>|<\|assistant\|>|<\|end\|>|\[INST\]|\[\/INST\]/g, '');
  cleaned = cleaned.replace(/<\|end_of_text\|>|<\|endoftext\|>/g, '');
  
  // 2. Remove Prefix labels like "Assistant:", "User:", "FIC AI:", "AI:"
  cleaned = cleaned.replace(/^(assistant|user|fic ai|ai):\s*/i, '');
  cleaned = cleaned.replace(/\n(assistant|user|fic ai|ai):\s*/i, '\n');
  
  // 3. Remove repeated question
  if (messageText) {
    const cleanMsg = messageText.trim();
    const escapedMessage = cleanMsg.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`^${escapedMessage}\\s*`, 'i'), '');
    
    // Also check with/without trailing question mark
    if (cleanMsg.endsWith('?')) {
      const withoutQM = cleanMsg.slice(0, -1).trim();
      const escapedWithoutQM = withoutQM.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`^${escapedWithoutQM}\\s*`, 'i'), '');
    } else {
      const withQM = cleanMsg + '?';
      const escapedWithQM = withQM.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`^${escapedWithQM}\\s*`, 'i'), '');
    }
  }
  
  // Trim spaces
  cleaned = cleaned.trim();
  return cleaned;
}

export async function getOllamaReply(message, history = []) {
  const SYSTEM_PROMPT = `You are FIC AI, a friendly, conversational, and intelligent AI assistant. 
Your goal is to behave like a helpful human companion, similar to ChatGPT.

Follow these strict formatting and style rules:
1. GREETINGS: If the user says hello, hi, or greets you, reply with a warm, natural, and friendly greeting (e.g., "Hello! How can I help you today?"). Keep it very short.
2. NO MARKDOWN: Do NOT use markdown tags (like #, **, *, __, lists, bullet points, code blocks, or tables) unless the user explicitly asks for structured formatting, code, or a detailed breakdown.
3. CONVERSATIONAL TONE: Keep your replies natural, friendly, and human-like. Avoid robotic, repetitive, or overly structured template outputs.
4. PARAGRAPHS: Use standard paragraphs for explanations. Only use bullet lists or numbered lists when explaining complex steps, and only if requested or absolutely necessary.
5. NO REPETITION: Do not repeat the user's input or question. Jump straight into the response.`;

  let finalSystemPrompt = SYSTEM_PROMPT;
  const isMsgGreeting = isGreeting(message);
  
  if (isMsgGreeting) {
    finalSystemPrompt += "\n\nCRITICAL: The user's input is a simple greeting. Reply with exactly one short, warm sentence (e.g., 'Hello! How can I help you today?') and absolutely nothing else. Do not output markdown.";
  }

  // Build messages array
  let chatMessages = [];
  if (!isMsgGreeting && history && history.length > 0) {
    const recentHistory = history.slice(-12);
    chatMessages = recentHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text || msg.content || ''
    }));
  }
  
  // Ensure the latest message is included
  if (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].content !== message) {
    chatMessages.push({ role: 'user', content: message });
  }

  // 1. Try Groq (Ultra-fast Llama models)
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[AI Chat Service] Querying Groq API for chat reply...');
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...chatMessages
        ],
        temperature: isMsgGreeting ? 0.6 : 0.7,
        max_tokens: isMsgGreeting ? 40 : 800
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (content) {
        console.log('[AI Chat Service] Groq reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[AI Chat Service] Groq API call failed, trying next provider:', err.message);
    }
  }

  // 2. Try Gemini (Native fast Google AI)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('[AI Chat Service] Querying Gemini API for chat reply...');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      // Convert format for Gemini SDK
      const geminiContents = chatMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const result = await model.generateContent({
        contents: geminiContents,
        systemInstruction: finalSystemPrompt,
        generationConfig: {
          temperature: isMsgGreeting ? 0.6 : 0.7,
          maxOutputTokens: isMsgGreeting ? 40 : 800
        }
      });
      const response = await result.response;
      const content = response.text();
      if (content) {
        console.log('[AI Chat Service] Gemini reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[AI Chat Service] Gemini API call failed, trying next provider:', err.message);
    }
  }

  // 3. Try OpenRouter (Backup cloud provider)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('[AI Chat Service] Querying OpenRouter API for chat reply...');
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...chatMessages
        ],
        temperature: isMsgGreeting ? 0.6 : 0.7,
        max_tokens: isMsgGreeting ? 40 : 800
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (content) {
        console.log('[AI Chat Service] OpenRouter reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[AI Chat Service] OpenRouter API call failed, trying local fallback:', err.message);
    }
  }

  // 4. Fallback to Local Ollama
  console.log('[AI Chat Service] Falling back to Local Ollama query...');
  const requestMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...chatMessages
  ];

  const requestBody = {
    model: OLLAMA_MODEL,
    messages: requestMessages,
    stream: false,
    options: {
      temperature: isMsgGreeting ? 0.6 : 0.7,
      top_p: 0.9,
      num_predict: isMsgGreeting ? 30 : 600
    }
  };

  let response;
  try {
    response = await axios.post(CHAT_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  } catch (err) {
    console.error('[AI Chat Service] Local Ollama failed:', err.message);
    throw new Error('All AI chat providers failed. Please check your internet connection or start Ollama locally.');
  }

  let rawReply = response.data.message?.content || '';
  let cleanedReply = cleanReply(rawReply, message);

  // If reply contains only the user question, retry once
  const isOnlyQuestion = (raw, cleaned, msg) => {
    if (!cleaned || cleaned.trim() === '') {
      return true;
    }
    if (isGreeting(msg)) {
      return false;
    }
    const normalizedRaw = raw.replace(/User:|Assistant:/gi, '').replace(/[^\w]/g, '').toLowerCase().trim();
    const normalizedMsg = msg.replace(/[^\w]/g, '').toLowerCase().trim();
    return normalizedRaw === normalizedMsg;
  };

  if (isOnlyQuestion(rawReply, cleanedReply, message)) {
    const retryRequestBody = {
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\nAnswer the question directly and concisely without repeating the prompt.' },
        { role: 'user', content: message }
      ],
      stream: false,
      options: {
        temperature: 0.6,
        top_p: 0.9,
        num_predict: 250
      }
    };
    
    console.log('[AI Chat Service] Reply contained only user question. Retrying...');
    try {
      response = await axios.post(CHAT_URL, retryRequestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      rawReply = response.data.message?.content || '';
      cleanedReply = cleanReply(rawReply, message);
    } catch (err) {
      console.error('[AI Chat Service] Retry attempt failed:', err.message);
    }
  }

  console.log("[AI Chat Service] Local Ollama reply complete.");
  return cleanedReply;
}

// Automatically ensure the configured Ollama model exists/is pulled
async function ensureModelExists() {
  try {
    console.log(`[Ollama] Checking if model '${OLLAMA_MODEL}' exists...`);
    const tagsResponse = await axios.get(`${OLLAMA_URL}/api/tags`);
    const models = tagsResponse.data?.models || [];
    const exists = models.some(m => m.name?.startsWith(OLLAMA_MODEL) || m.name === OLLAMA_MODEL);

    if (!exists) {
      console.log(`[Ollama] Model '${OLLAMA_MODEL}' not found. Pulling it now (this may take a few minutes)...`);
      axios.post(`${OLLAMA_URL}/api/pull`, { name: OLLAMA_MODEL, stream: false })
        .then(() => console.log(`[Ollama] Successfully pulled model '${OLLAMA_MODEL}'`))
        .catch(err => console.error(`[Ollama] Failed to pull model '${OLLAMA_MODEL}':`, err.message));
    } else {
      console.log(`[Ollama] Model '${OLLAMA_MODEL}' is ready.`);
    }
  } catch (err) {
    console.warn(`[Ollama] Could not verify/pull model: ${err.message}`);
  }
}

ensureModelExists();
