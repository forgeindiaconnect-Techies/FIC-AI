import 'dotenv/config';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Config (read from .env) ──────────────────────────────────────────────────
const OLLAMA_URL   = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const GENERATE_URL = `${OLLAMA_URL}/api/generate`;

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

// ─── Main export ───────────────────────────────────────────────
async function getOllamaReplyRaw(message, history = [], officialUrl = null) {
  const SYSTEM_PROMPT = `You are FIC AI, an advanced, professional AI assistant similar to ChatGPT.
Your primary goal is to provide clear, structured, and highly readable answers using formatting.

Follow these strict formatting and style rules for every response:
1. USE MARKDOWN ACTIVELY: Always use Markdown headers (###, ##), bold text (**), bullet points (-), and numbered lists to structure your response. Never return plain text walls.
2. TECHNICAL & EDUCATIONAL FLOW: When asked about a technical topic (like React, Node, etc.), structure your answer exactly like this:
   - Brief Introduction / Definition
   - Why it is used (Key benefits)
   - Core Concepts
   - Code Example (Always provide a code block with language tags, e.g., \`\`\`javascript)
   - Real-World Uses (Which companies or projects use it)
   - Learning Roadmap for Beginners
   - Short Conclusion
3. GREETINGS: If the user just says hello, reply warmly and concisely without a full technical breakdown.
4. TONE: Be professional, encouraging, and highly informative, exactly like an expert tutor or senior developer.
5. NO REPETITION: Jump straight into the response, do not just echo the user's prompt.`;

  let finalSystemPrompt = SYSTEM_PROMPT;
  const isMsgGreeting = isGreeting(message);
  
  if (isMsgGreeting) {
    finalSystemPrompt += "\n\nCRITICAL: The user's input is a simple greeting. Reply with exactly one short, warm sentence (e.g., 'Hello! How can I help you today?') and absolutely nothing else. Do not output markdown.";
  } else {
    if (officialUrl) {
      finalSystemPrompt += `\n\nCRITICAL CONTEXT: The user is asking for a website link. The official website URL found is: "${officialUrl}". You must provide this link as a clickable Markdown link in your response (e.g., [Official Website](${officialUrl})). Do not guess or use any other link. If you explain other details, keep this link prominent. Do not mention any other external link.`;
    }
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
      console.log('[Ollama Service] Querying Groq API for chat reply...');
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
        console.log('[Ollama Service] Groq reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[Ollama Service] Groq API call failed, trying next provider:', err.message);
    }
  }

  // 2. Try Gemini (Native fast Google AI)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('[Ollama Service] Querying Gemini API for chat reply...');
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
        console.log('[Ollama Service] Gemini reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[Ollama Service] Gemini API call failed, trying next provider:', err.message);
    }
  }

  // 3. Try OpenRouter (Backup cloud provider)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('[Ollama Service] Querying OpenRouter API for chat reply...');
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
        console.log('[Ollama Service] OpenRouter reply successful.');
        return cleanReply(content, message);
      }
    } catch (err) {
      console.warn('[Ollama Service] OpenRouter API call failed, trying Pollinations AI fallback:', err.message);
    }
  }

  // 3.5. Try Pollinations AI (100% Free, no-key cloud fallback to prevent timeouts)
  try {
    console.log('[Ollama Service] Querying Pollinations AI for free cloud fallback chat reply...');
    const pollinationsResponse = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: finalSystemPrompt },
        ...chatMessages
      ],
      model: 'openai',
      jsonMode: false
    }, {
      timeout: 15000
    });
    
    if (pollinationsResponse.status === 200 && pollinationsResponse.data) {
      console.log('[Ollama Service] Pollinations AI reply successful.');
      return cleanReply(pollinationsResponse.data, message);
    }
  } catch (err) {
    console.warn('[Ollama Service] Pollinations AI free fallback failed, trying local Ollama:', err.message);
  }

  // 4. Fallback to Local Ollama
  console.log(`[Ollama Service] Falling back to Local Ollama query (${OLLAMA_MODEL} at ${GENERATE_URL})...`);
  
  const finalPrompt = finalSystemPrompt + '\n\n' + chatMessages.map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n') + '\nAssistant:';

  const requestBody = {
    model: OLLAMA_MODEL,
    prompt: finalPrompt,
    stream: false,
    options: {
      temperature: isMsgGreeting ? 0.6 : 0.7,
      top_p: 0.9,
      num_predict: isMsgGreeting ? 30 : 600
    }
  };

  let response;
  try {
    response = await axios.post(GENERATE_URL, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    console.log(`[Ollama Service] Provider: ollama | Base URL: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL} | Status: ${response.status}`);
    console.log(`[Ollama Service] Raw Response:`, response.data);
  } catch (err) {
    console.error(`[Ollama Service] Provider: ollama | Base URL: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL} | Local Ollama failed:`, err.message);
    throw new Error('All AI chat providers failed. Please check your internet connection or start Ollama locally.');
  }

  let rawReply = response.data.response || response.data.message?.content || '';
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
      prompt: `${SYSTEM_PROMPT}\nAnswer the question directly and concisely without repeating the prompt.\nUser: ${message}\nAssistant:`,
      stream: false,
      options: {
        temperature: 0.6,
        top_p: 0.9,
        num_predict: 250
      }
    };
    
    console.log('[Ollama Service] Reply contained only user question. Retrying...');
    try {
      response = await axios.post(GENERATE_URL, retryRequestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      console.log(`[Ollama Service] Retry Provider: ollama | Base URL: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL} | Status: ${response.status}`);
      rawReply = response.data.response || response.data.message?.content || '';
      cleanedReply = cleanReply(rawReply, message);
    } catch (err) {
      console.error('[Ollama Service] Retry attempt failed:', err.message);
    }
  }

  console.log("[Ollama Service] Local Ollama reply complete.");
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

export async function getOllamaReply(message, history = []) {
  // 1. Detect website/link requests and fetch official URL dynamically
  const lowerMsg = (message || '').toLowerCase();
  const isLinkRequest = /\b(website|link|url|site|page|homepage)\b/.test(lowerMsg);
  let officialUrl = null;

  if (isLinkRequest) {
    try {
      const { searchOfficialWebsite } = await import('../utils/webSearch.js');
      officialUrl = await searchOfficialWebsite(message);
    } catch (err) {
      console.error('[Ollama Service] Link search failed:', err.message);
    }
  }

  // 2. Get the raw reply from the AI
  let aiReply = await getOllamaReplyRaw(message, history, officialUrl);

  // 3. Post-process to ensure only the official link is present (no random/guessed links)
  if (officialUrl && aiReply) {
    // Regex to match markdown links: [Anchor Text](URL)
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
    
    if (mdLinkRegex.test(aiReply)) {
      // Force any generated markdown link to point to the official URL
      aiReply = aiReply.replace(mdLinkRegex, `[$1](${officialUrl})`);
    } else {
      // If the AI didn't include a markdown link, append it cleanly at the end
      aiReply += `\n\nHere is the official website: [Official Website](${officialUrl})`;
    }
    
    // Also remove any plain text URLs that AI might have hallucinated
    const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;
    aiReply = aiReply.split('\n').map(line => {
      // If the line has a markdown link, keep it as-is
      if (line.includes('[') && line.includes('](')) return line;
      // Otherwise, remove plain-text URLs that don't match our official URL
      return line.replace(urlRegex, (match) => {
        if (match.includes(officialUrl) || officialUrl.includes(match)) return match;
        return ''; // strip out guessed URLs
      });
    }).join('\n');
  }

  return aiReply;
}
