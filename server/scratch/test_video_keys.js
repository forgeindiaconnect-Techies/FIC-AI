import 'dotenv/config';
import axios from 'axios';
import { getCandidateDIDAuthHeaders } from '../routes/documents.js';

async function testDID() {
  const didKey = process.env.DID_API_KEY;
  console.log('Testing D-ID Key:', didKey);
  if (!didKey) {
    console.warn('No DID_API_KEY found in server/.env');
    return;
  }

  const candidates = getCandidateDIDAuthHeaders(didKey);
  console.log(`Generated ${candidates.length} auth candidates for D-ID.`);
  
  for (const candidate of candidates) {
    try {
      const res = await axios.get('https://api.d-id.com/credits', {
        headers: { 
          Authorization: candidate, 
          Accept: 'application/json' 
        },
        timeout: 10000
      });
      console.log('D-ID SUCCESS: Auth verified!');
      console.log('D-ID Response JSON:', JSON.stringify(res.data, null, 2));
      return;
    } catch (err) {
      console.warn(`Candidate failed: ${err.message}`);
      if (err.response) {
        console.warn(`HTTP ${err.response.status} Response:`, JSON.stringify(err.response.data, null, 2));
      }
    }
  }
  console.error('D-ID ERROR: All auth candidates failed.');
}

async function testHeyGen() {
  const heygenKey = process.env.HEYGEN_API_KEY;
  console.log('\nTesting HeyGen Key:', heygenKey);
  if (!heygenKey) {
    console.warn('No HEYGEN_API_KEY found in server/.env');
    return;
  }

  try {
    const res = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: { 
        'X-Api-Key': heygenKey,
        Accept: 'application/json' 
      },
      timeout: 10000
    });
    console.log('HeyGen SUCCESS: Auth verified!');
    console.log('HeyGen Response JSON:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('HeyGen ERROR:', err.message);
    if (err.response) {
      console.error(`HTTP ${err.response.status} Response:`, JSON.stringify(err.response.data, null, 2));
    }
  }
}

async function run() {
  await testDID();
  await testHeyGen();
}

run();
