import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// GET /api/ai/models – return list of installed Ollama models
router.get('/models', async (req, res) => {
  try {
    const resp = await fetch('http://127.0.0.1:11434/api/tags');
    if (!resp.ok) {
      return res.status(500).json({ error: 'Failed to query Ollama models' });
    }
    const data = await resp.json();
    const modelNames = (data.models || []).map(m => m.name);
    res.json({ models: modelNames });
  } catch (err) {
    console.error('Error fetching Ollama models:', err);
    res.status(500).json({ error: 'Unable to contact Ollama server' });
  }
});

export default router;
