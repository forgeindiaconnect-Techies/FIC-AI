const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const fetch = require('node-fetch');

// POST /api/generate – generate AI response using Ollama
router.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3:latest';
  console.log('Using Ollama model:', model);
  console.log('Ollama URL:', ollamaUrl);
  try {
    const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });
    if (!ollamaRes.ok) {
      const errBody = await ollamaRes.text();
      console.error('Ollama error:', errBody);
      return res.status(500).json({ error: 'Ollama returned an error', details: errBody });
    }
    const data = await ollamaRes.json();
    return res.json({ response: data.response });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: 'Failed to generate', details: error.message });
  }
});

module.exports = router;
