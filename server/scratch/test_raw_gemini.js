import 'dotenv/config';
import axios from 'axios';

async function testRawGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Using API Key:', apiKey);
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in server/.env');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [{
        text: 'Hello! Respond with exactly "API is working!"'
      }]
    }]
  };

  try {
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('\n--- SUCCESS ---');
    console.log('HTTP Status:', res.status);
    console.log('Response JSON:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('\n--- ERROR ---');
    if (err.response) {
      console.error('HTTP Status:', err.response.status);
      console.error('Error JSON:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error Message:', err.message);
    }
  }
}

testRawGemini();
