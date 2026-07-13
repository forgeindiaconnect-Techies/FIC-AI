import { generatePosterMetadataAndImage } from './routes/poster.js';

const test = async () => {
  const prompt = 'Create a festive Diwali greeting poster with vibrant colors and elegant typography.';
  try {
    const result = await generatePosterMetadataAndImage(prompt);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
};

test();
