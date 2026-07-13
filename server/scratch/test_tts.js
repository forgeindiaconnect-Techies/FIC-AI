import axios from 'axios';
import fs from 'fs';

async function testStreamElements() {
  console.log('Testing StreamElements TTS...');
  try {
    const text = 'Hello this is a test of the StreamElements TTS service. I am speaking in a male voice.';
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
    
    console.log('Requesting URL:', url);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    console.log('Response status:', response.status);
    console.log('Response length:', response.data.byteLength);
    if (response.data.byteLength > 100) {
      fs.writeFileSync('scratch/se_test.mp3', Buffer.from(response.data));
      console.log('SUCCESS: Written scratch/se_test.mp3');
    }
  } catch (err) {
    console.error('ERROR in StreamElements:', err.message);
    if (err.response) {
      console.error('HTTP Status:', err.response.status);
      console.error('Response data:', Buffer.from(err.response.data).toString('utf8').slice(0, 500));
    }
  }
}

testStreamElements();
