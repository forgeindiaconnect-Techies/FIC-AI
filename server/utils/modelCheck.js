const fetch = require('node-fetch');
let fetchFn;
if (typeof fetch === 'function') {
  fetchFn = fetch;
} else {
  // fallback for older Node versions (should not happen here)
  const nodeFetch = require('node-fetch');
  fetchFn = nodeFetch;
}

let cache = {
  available: null,
  timestamp: 0 // milliseconds
};

/**
 * Checks if the configured Ollama model is available.
 * Uses the OLLAMA_MODEL environment variable (default "llama3:latest").
 */
async function isModelAvailable() {
  const now = Date.now();
  if (cache.available !== null && now - cache.timestamp < 60_000) {
    return cache.available;
  }

  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const modelName = process.env.OLLAMA_MODEL || 'llama3:latest';
    console.log('Using Ollama model:', modelName);
    console.log('Ollama URL:', ollamaUrl);
    const res = await fetchFn(`${ollamaUrl}/api/tags`);
    if (!res.ok) {
      cache.available = false;
    } else {
      const data = await res.json();
      // Check for exact model name match
      cache.available = Array.isArray(data.models) && data.models.some(m => m.name === modelName);
    }
    cache.timestamp = Date.now();
    return cache.available;
  } catch (e) {
    console.error('Model check error:', e);
    cache.available = false;
    cache.timestamp = Date.now();
    return false;
  }
}

module.exports = { isModelAvailable };
