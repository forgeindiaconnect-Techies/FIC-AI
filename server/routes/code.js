import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * POST /api/code/generate
 * Body: { prompt: string, language?: string }
 * Returns generated code and optional preview URL.
 */
router.post('/generate', async (req, res) => {
  const { prompt, language } = req.body;
  if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });

  const sysPrompt = `You are FIC AI, a helpful assistant like ChatGPT. When the user asks for code, output ONLY the complete, runnable code inside proper markdown fences. Do NOT include any "Question:" or "Answer:" labels or extra explanations unless explicitly asked. Include a short intro sentence before the code block if helpful. Provide a preview URL for HTML/React when applicable.`;

  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3',
        prompt: `${sysPrompt}\nUser: ${prompt}\nAssistant:`,
        stream: false,
        options: { num_predict: 1200, temperature: 0.5 }
      })
    });
    if (!response.ok) throw new Error('Ollama request failed');
    const data = await response.json();
    const reply = data.response || '';
    // Try to extract a preview URL if the model includes one (e.g., data:image/base64) – optional.
    res.json({ success: true, reply, type: 'code' });
  } catch (err) {
    console.error('Code generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
