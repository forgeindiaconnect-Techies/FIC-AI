// server/routes/pexels.js
// Pexels Image Search Route
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * GET /api/pexels/search
 * Query Params:
 *   keywords - comma‑separated or space‑separated search terms
 * Returns the URL of the highest‑resolution image matching the query.
 */
router.get('/search', async (req, res) => {
  const { keywords } = req.query;
  if (!keywords) {
    return res.status(400).json({ error: 'keywords query param required' });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PEXELS_API_KEY not set in environment' });
  }

  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      headers: { Authorization: apiKey },
      params: { query: keywords, per_page: 5 },
      timeout: 15000,
    });

    const photos = response.data.photos;
    if (!photos || photos.length === 0) {
      return res.status(404).json({ error: 'No images found on Pexels' });
    }

    // Choose the image with the largest original width
    const best = photos.reduce((prev, curr) => {
      const prevWidth = prev.width || 0;
      const currWidth = curr.width || 0;
      return currWidth > prevWidth ? curr : prev;
    }, photos[0]);

    // Prefer the original size URL, fallback to largest available
    const imageUrl = best.src.original || best.src.large2x || best.src.large;

    console.log('PEXELS SEARCH:', keywords);
    console.log('PEXELS IMAGE FOUND:', imageUrl);
    return res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Pexels API error:', err.message);
    return res.status(500).json({ error: 'Failed to search Pexels', details: err.message });
  }
});

export default router;
