import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Message from '../models/Message.js';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_DB_PATH = path.join(__dirname, '..', 'data', 'chats.json');

// Ensure the data directory exists
async function ensureDir() {
  const dir = path.dirname(JSON_DB_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Read chats from JSON file
async function readChatsFromFile() {
  await ensureDir();
  try {
    const data = await fs.readFile(JSON_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

// Write chats to JSON file
async function writeChatsToFile(chats) {
  await ensureDir();
  await fs.writeFile(JSON_DB_PATH, JSON.stringify(chats, null, 2), 'utf8');
}

import { isMongoAvailable } from './dbStatus.js';

// Helper to check if MongoDB is connected
function isMongoConnected() {
  // Use shared status flag instead of direct mongoose state
  return isMongoAvailable();
}

/**
 * Save a message to the active database (MongoDB or JSON fallback)
 */
async function saveMessage(chatId, role, text) {
  const timestamp = new Date();
  console.log(`[Storage] saveMessage called for chatId: ${chatId}, role: ${role}, text: "${text.slice(0, 20)}..."`);

  if (isMongoConnected()) {
    try {
      // In MongoDB, we store messages as individual documents
      // Since the original schema was userMessage and aiResponse, let's keep it compatible or extend it.
      // Actually, let's save each message under the same chatId.
      // To keep compatibility with the original schema, we can store them. 
      // But it's much better to use a schema that supports chatId, role, and text.
      // Let's check if we can save to MongoDB.
      // If we use the original schema, it doesn't support chatId. Let's update the MongoDB Message schema to be flexible.
      const newMessage = new Message({
        chatId,
        role,
        text,
        timestamp
      });
      await newMessage.save();
      console.log(`[Storage] Saved message to MongoDB successfully.`);
      return;
    } catch (err) {
      console.warn('[Storage] MongoDB save failed, falling back to file storage:', err.message);
    }
  }

  // Fallback to JSON file
  console.log(`[Storage] Using JSON file fallback to save message.`);
  const chats = await readChatsFromFile();
  if (!chats[chatId]) {
    chats[chatId] = {
      chatId,
      title: text.slice(0, 35),
      createdAt: timestamp,
      messages: []
    };
  }
  chats[chatId].messages.push({ role, text, timestamp });
  await writeChatsToFile(chats);
  console.log(`[Storage] Saved message to JSON file successfully.`);
}

/**
 * Get all chat sessions (for the sidebar list)
 */
async function getChatSessions() {
  console.log(`[Storage] getChatSessions called. MongoDB connected: ${isMongoConnected()}`);
  if (isMongoConnected()) {
    try {
       const MessageModel = mongoose.model('Message');
       // Aggregate to get unique chatIds with their first user message as title
       const sessions = await MessageModel.aggregate([
         // Consider only user messages for title extraction
         { $match: { role: 'user' } },
         { $sort: { timestamp: 1 } },
         {
           $group: {
             _id: '$chatId',
             title: { $first: '$text' },
             timestamp: { $first: '$timestamp' }
           }
         },
         { $sort: { timestamp: -1 } }
       ]);

       console.log(`[Storage] MongoDB sessions retrieved: ${sessions.length}`);
       return sessions
         .filter(s => s._id) // filter out null ids
         .map(s => ({
           chatId: s._id,
           title: s.title ? (s.title.slice(0, 30) + (s.title.length > 30 ? '...' : '')) : 'New Chat',
           timestamp: s.timestamp
         }));
    } catch (err) {
      console.warn('[Storage] MongoDB getChatSessions failed, falling back to file storage:', err.message);
    }
  }

  // Fallback to JSON file
  const chats = await readChatsFromFile();
  console.log(`[Storage] JSON fallback sessions retrieved: ${Object.keys(chats).length}`);
  return Object.values(chats)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(c => ({
      chatId: c.chatId,
      title: c.title || 'New Chat',
      timestamp: c.createdAt
    }));
}

/**
 * Get all messages for a specific chat session
 */
async function getChatMessages(chatId) {
  if (isMongoConnected()) {
    try {
      const MessageModel = mongoose.model('Message');
      const messages = await MessageModel.find({ chatId }).sort({ timestamp: 1 });
      return messages.map(m => ({
        role: m.role,
        text: m.text,
        timestamp: m.timestamp
      }));
    } catch (err) {
      console.warn('MongoDB getChatMessages failed, falling back to file storage:', err.message);
    }
  }

  // Fallback to JSON file
  const chats = await readChatsFromFile();
  return chats[chatId] ? chats[chatId].messages : [];
}

/**
 * Get full chat object (title, messages, createdAt) for a given chatId
 */
async function getChat(chatId) {
  if (isMongoConnected()) {
    try {
      const MessageModel = mongoose.model('Message');
      const messages = await MessageModel.find({ chatId }).sort({ timestamp: 1 });
      const firstUser = await MessageModel.findOne({ chatId, role: 'user' }).sort({ timestamp: 1 });
      const title = firstUser ? firstUser.text.slice(0, 35) : 'New Chat';
      return {
        chatId,
        title,
        messages: messages.map(m => ({ role: m.role, content: m.text, timestamp: m.timestamp })),
        createdAt: messages[0] ? messages[0].timestamp : new Date()
      };
    } catch (err) {
      console.warn('MongoDB getChat failed, falling back to file storage:', err.message);
    }
  }
  // JSON fallback
  const chats = await readChatsFromFile();
  const chat = chats[chatId];
  if (!chat) return null;
  return {
    chatId,
    title: chat.title,
    messages: chat.messages.map(m => ({ role: m.role, content: m.text, timestamp: m.timestamp })),
    createdAt: chat.createdAt
  };
}

/**
 * Delete a chat session
 */
async function deleteChatSession(chatId) {
  if (isMongoConnected()) {
    try {
      const MessageModel = mongoose.model('Message');
      await MessageModel.deleteMany({ chatId });
      return;
    } catch (err) {
      console.warn('MongoDB delete failed, falling back to file storage:', err.message);
    }
  }

  const chats = await readChatsFromFile();
  if (chats[chatId]) {
    delete chats[chatId];
    await writeChatsToFile(chats);
  }
}

/**
 * Get all chats with full message arrays (for sidebar and history)
 */
async function getAllChats() {
  if (isMongoConnected()) {
    try {
      const MessageModel = mongoose.model('Message');
      const chats = await MessageModel.aggregate([
        {
          $group: {
            _id: '$chatId',
            messages: { $push: { role: '$role', content: '$text', timestamp: '$timestamp' } },
            firstUser: { $first: { $cond: [{ $eq: ['$role', 'user'] }, '$text', null] } },
            createdAt: { $first: '$timestamp' }
          }
        },
        {
          $project: {
            chatId: '$_id',
            title: { $substr: ['$firstUser', 0, 35] },
            messages: 1,
            createdAt: 1
          }
        }
      ]);
      return chats.map(c => ({
        chatId: c.chatId,
        title: c.title || 'New Chat',
        messages: c.messages,
        createdAt: c.createdAt
      }));
    } catch (err) {
      console.warn('MongoDB getAllChats failed, falling back to file storage:', err.message);
    }
  }
  // JSON fallback – chats already contain messages
  const chats = await readChatsFromFile();
  return Object.values(chats);
}

export {
  saveMessage,
  getChatSessions,
  getChatMessages,
  getChat,
  deleteChatSession,
  getAllChats
};
