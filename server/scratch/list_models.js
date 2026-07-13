import 'dotenv/config';
import axios from 'axios';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Listing models for API Key:', apiKey);
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found in server/.env');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const res = await axios.get(url);
    console.log('\n--- AVAILABLE MODELS ---');
    if (res.data && res.data.models) {
      res.data.models.forEach(model => {
        console.log(`- ${model.name} (Methods: ${model.supportedGenerationMethods.join(', ')})`);
      });
    } else {
      console.log('No models returned. Response:', JSON.stringify(res.data, null, 2));
    }
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

listModels();
