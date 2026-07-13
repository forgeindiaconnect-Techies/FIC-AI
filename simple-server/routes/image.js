import express from 'express';
import axios from 'axios';

const router = express.Router();

// POST /api/image/generate
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    // Adjust URL/endpoint according to your ComfyUI setup.
    const comfyRes = await axios.post('http://127.0.0.1:8188/api/prompt', { prompt });
    // Expecting the ComfyUI API to return an image (base64 or URL).
    const imageData = comfyRes.data.image || comfyRes.data.image_base64;
    if (!imageData) throw new Error('No image data returned');
    res.json({ image: imageData });
  } catch (error) {
    console.error('ComfyUI error:', error.message);
    res.status(500).json({ error: 'Local image AI server is not running' });
  }
});

export default router;
