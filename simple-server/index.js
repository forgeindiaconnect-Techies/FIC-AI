// index.js
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  try {
    const ollamaRes = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: 'phi3',
      prompt: message,
      stream: false,
    });
    res.json({ reply: ollamaRes.data.response });
  } catch (error) {
    console.error('Ollama error:', error);
    res.status(500).json({ error: 'Failed to get response from Ollama' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
