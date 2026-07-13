const axios = require('axios');

async function testOllama() {
  const url = 'http://127.0.0.1:11434/api/generate';
  console.log('Testing Ollama at:', url);
  try {
    const res = await axios.post(url, {
      model: 'llama3:latest',
      prompt: 'Hello, reply briefly.',
      stream: false
    }, { timeout: 40000 });
    console.log('Ollama Response SUCCESS:', res.data.response);
  } catch (err) {
    console.error('Ollama Response FAILED:', err.message);
    if (err.response) {
      console.error('Error Details:', err.response.data);
    }
  }
}

testOllama();
