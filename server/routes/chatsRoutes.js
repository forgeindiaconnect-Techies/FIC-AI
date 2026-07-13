// chatsRoutes.js – reads real data from storage (MongoDB → JSON fallback)
import express from 'express';
import { getChatSessions, getChatMessages } from '../utils/storage.js';

const router = express.Router();

// GET /api/chats — return all chat sessions for the sidebar
router.get('/', async (_req, res) => {
  try {
    const sessions = await getChatSessions();
    res.json({ success: true, chats: Array.isArray(sessions) ? sessions : [] });
  } catch (err) {
    console.error('[Chats] Failed to fetch sessions:', err.message);
    res.json({ success: true, chats: [], error: err.message });
  }
});

// GET /api/chats/:chatId — return all messages for a specific chat
router.get('/:chatId', async (req, res) => {
  const { chatId } = req.params;
  try {
    if (!chatId) {
      return res.json({ success: true, chatId: '', messages: [] });
    }
    const messages = await getChatMessages(chatId);
    res.json({ success: true, chatId, messages: Array.isArray(messages) ? messages : [] });
  } catch (err) {
    console.error('[Chats] Failed to fetch messages for', chatId, ':', err.message);
    res.json({ success: true, chatId, messages: [], error: err.message });
  }
});

export default router;
