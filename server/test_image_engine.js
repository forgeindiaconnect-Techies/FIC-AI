import dotenv from 'dotenv';
dotenv.config();

import { generateAIImage } from './routes/image.js';

async function runTest() {
  const testPrompts = [
    "dog image",
    "boy and girl watching sunset"
  ];

  for (const prompt of testPrompts) {
    console.log(`\n========================================`);
    console.log(`Testing prompt: "${prompt}"`);
    try {
      const resultUrl = await generateAIImage(prompt);
      console.log(`SUCCESS! Result URL: ${resultUrl}`);
    } catch (err) {
      console.error(`FAILED! Error:`, err.message);
    }
  }
}

runTest();
