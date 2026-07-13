// server/engines/chatEngine.js
const axios = require('axios');
const storage = require('../utils/storage');
const API_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3';

module.exports = async function chatEngine(message, chatId) {
  // Call Ollama to get response text
  const ollamaRes = await axios.post(`${API_URL}/api/generate`, {
    model: MODEL,
    prompt: `You are FIC AI. Give clear and short answers.\nUser: ${message}`,
    stream: false,
  });
  const reply = ollamaRes.data.response;
  // Optionally store chat history
  const activeChatId = chatId || `chat_${Date.now()}`;
  try {
    await storage.saveMessage(activeChatId, 'user', message);
    await storage.saveMessage(activeChatId, 'ai', reply);
  } catch (e) {}
  return { type: 'text', reply, chatId: activeChatId };
};
