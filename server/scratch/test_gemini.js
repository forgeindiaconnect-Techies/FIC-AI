import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log('Gemini API Key:', geminiKey);
  if (!geminiKey) {
    console.log('No Gemini API key found.');
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(['Hello! Say "Gemini is working!" in 1 sentence.']);
    const response = await result.response;
    console.log('Response:', response.text());
  } catch (err) {
    console.error('Error during Gemini API call:', err);
  }
}

testGemini();
