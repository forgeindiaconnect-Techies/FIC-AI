import express from 'express';
import { generateGeminiReply } from '../config/gemini.js';
import { getAllChats, getChat, saveMessage } from '../utils/storage.js';

const router = express.Router();

/** GET /api/chats – Return list of chats */
router.get('/chats', async (req, res) => {
  try {
    const chats = await getAllChats();
    const list = chats.map(c => ({ chatId: c.chatId, title: c.title, createdAt: c.createdAt }));
    res.json({ success: true, chats: list });
  } catch (err) {
    console.error('GET /api/chats error:', err);
    // Always return success with empty array to avoid 500s
    res.json({ success: true, chats: [] });
  }
});

/** GET /api/chats/:chatId – Return chat history; never 404 */
router.get('/chats/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const chat = await getChat(chatId);
    const messages = chat?.messages?.map(m => ({ role: m.role, content: m.content || m.text, timestamp: m.timestamp })) || [];
    res.json({ success: true, chatId, messages });
  } catch (err) {
    console.error('GET /api/chats/:chatId error:', err);
    const chatId = req.params.chatId;
    res.json({ success: true, chatId, messages: [] });
  }
});

/** POST /api/chat – Send user message and receive AI reply */
router.post('/chat', async (req, res) => {
  try {
    const { message, chatId } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });
    const uid = chatId || `chat_${Date.now()}`;
    let aiReply;
    try {
      aiReply = await generateGeminiReply(message);
    } catch (genErr) {
      console.error('Gemini generation error:', genErr);
      return res.status(500).json({ success: false, error: genErr.message });
    }
    await saveMessage(uid, 'user', message);
    await saveMessage(uid, 'assistant', aiReply);
    const chat = await getChat(uid);
    const messages = chat?.messages?.map(m => ({ role: m.role, content: m.content || m.text, timestamp: m.timestamp })) || [];
    res.json({ success: true, chatId: uid, reply: aiReply, messages });
  } catch (err) {
    console.error('POST /api/chat unexpected error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
