const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// Simple health check for Ollama service
router.get('/health', async (req, res) => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) throw new Error('Non‑OK status');
    const data = await response.json();
    res.json({ status: 'ok', models: data.models?.map(m => m.name) || [] });
  } catch (err) {
    console.error('Ollama health check failed:', err);
    res.status(500).json({ status: 'error', message: 'Unable to reach Ollama at ' + ollamaUrl });
  }
});

module.exports = router;
