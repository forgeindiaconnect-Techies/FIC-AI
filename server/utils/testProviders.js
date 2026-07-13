// server/utils/testProviders.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function testProviders() {
  const logFile = path.resolve(__dirname, '../test_results.txt');
  let logContent = `--- TEST RUN AT ${new Date().toISOString()} ---\n`;

  const log = (msg) => {
    console.log(msg);
    logContent += msg + '\n';
  };

  const didKey = process.env.DID_API_KEY;
  const maskedDid = didKey ? `${didKey.slice(0, 4)}...${didKey.slice(-4)}` : 'empty';
  log(`DID_API_KEY value: "${maskedDid}"`);
  
  if (didKey) {
    // Method 1: The current implementation (Basic didKey:)
    const authHeader1 = 'Basic ' + Buffer.from(`${didKey.trim()}:`).toString('base64');
    // Method 2: Raw value directly base64 encoded
    const authHeader2 = 'Basic ' + Buffer.from(didKey.trim()).toString('base64');
    // Method 3: Basic token directly
    const authHeader3 = didKey.trim().startsWith('Basic ') ? didKey.trim() : 'Basic ' + didKey.trim();

    const headersList = [
      { name: 'Basic key:', header: authHeader1 },
      { name: 'Basic key (no trailing colon):', header: authHeader2 },
      { name: 'Raw didKey:', header: authHeader3 }
    ];

    for (const item of headersList) {
      try {
        log(`Checking D-ID header format "${item.name}"...`);
        const res = await axios.get('https://api.d-id.com/credits', {
          headers: { Authorization: item.header }
        });
        log(`✅ D-ID SUCCESS with "${item.name}"! Credits data: ${JSON.stringify(res.data)}`);
        
        // Try a minimal talks request to see if it accepts creation
        try {
          log('Attempting mock D-ID talk generation with longer script...');
          const createRes = await axios.post('https://api.d-id.com/talks', {
            source_url: 'https://d-id-public-bucket.s3.us-east-1.amazonaws.com/alice.jpg',
            script: {
              type: 'text',
              input: 'Hello world! Welcome to FIC AI.',
              provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' }
            }
          }, {
            headers: {
              Authorization: item.header,
              'Content-Type': 'application/json'
            }
          });
          log(`✅ D-ID Talk Mock Success! ID: ${createRes.data?.id}`);
        } catch (createErr) {
          log(`❌ D-ID Talk Mock Failed: Status ${createErr.response?.status} - ${JSON.stringify(createErr.response?.data) || createErr.message}`);
        }
        break;
      } catch (err) {
        log(`❌ D-ID FAILED with "${item.name}": Status ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
      }
    }
  } else {
    log('D-ID Key is missing from env.');
  }

  const heyGenKey = process.env.HEYGEN_API_KEY;
  const maskedHeyGen = heyGenKey ? `${heyGenKey.slice(0, 4)}...${heyGenKey.slice(-4)}` : 'empty';
  log(`\nHEYGEN_API_KEY value: "${maskedHeyGen}"`);
  
  if (heyGenKey) {
    try {
      log('Checking HeyGen API key at /v1/user/me...');
      const res = await axios.get('https://api.heygen.com/v1/user/me', {
        headers: {
          'X-Api-Key': heyGenKey.trim()
        }
      });
      log(`✅ HeyGen SUCCESS! User info: ${JSON.stringify(res.data)}`);

      // Query HeyGen available voices list
      let fetchedVoiceId = null;
      try {
        log('Fetching HeyGen available voices...');
        const voiceRes = await axios.get('https://api.heygen.com/v2/voices', {
          headers: {
            'X-Api-Key': heyGenKey.trim()
          }
        });
        const voices = voiceRes.data?.data?.voices || [];
        log(`Fetched ${voices.length} voices from HeyGen.`);
        
        // Find a female English voice and a Tamil voice
        const enVoice = voices.find(v => v.language === 'English' && v.gender === 'female');
        const taVoice = voices.find(v => v.language === 'Tamil' || v.language_code?.startsWith('ta'));
        
        log(`Sample English Female Voice: ${JSON.stringify(enVoice)}`);
        log(`Sample Tamil Voice: ${JSON.stringify(taVoice)}`);
        
        fetchedVoiceId = taVoice?.voice_id || enVoice?.voice_id || (voices[0]?.voice_id);
      } catch (voiceErr) {
        log(`❌ HeyGen Fetch Voices Failed: ${voiceErr.message}`);
      }

      // Query HeyGen available avatars list
      let fetchedAvatarId = null;
      try {
        log('Fetching HeyGen available avatars...');
        const avatarRes = await axios.get('https://api.heygen.com/v2/avatars', {
          headers: {
            'X-Api-Key': heyGenKey.trim()
          }
        });
        const avatars = avatarRes.data?.data?.avatars || [];
        log(`Fetched ${avatars.length} avatars from HeyGen.`);
        for (let j = 0; j < Math.min(5, avatars.length); j++) {
          log(`Avatar ${j + 1}: ID="${avatars[j].avatar_id}", Name="${avatars[j].avatar_name}"`);
        }
        fetchedAvatarId = avatars[0]?.avatar_id;
      } catch (avatarErr) {
        log(`❌ HeyGen Fetch Avatars Failed: ${avatarErr.message}`);
      }

      // Try a mock HeyGen video generation
      if (fetchedVoiceId && fetchedAvatarId) {
        try {
          log(`Attempting mock HeyGen video generation with avatar_id: ${fetchedAvatarId} and voice_id: ${fetchedVoiceId}...`);
          const createRes = await axios.post('https://api.heygen.com/v2/video/generate', {
            video_inputs: [{
              character: {
                type: 'avatar',
                avatar_id: fetchedAvatarId,
                avatar_style: 'normal',
              },
              voice: {
                type: 'text',
                input_text: 'Hello world!',
                voice_id: fetchedVoiceId,
              }
            }],
            dimension: { width: 1280, height: 720 }
          }, {
            headers: {
              'X-Api-Key': heyGenKey.trim(),
              'Content-Type': 'application/json'
            }
          });
          log(`✅ HeyGen Video Mock Success! ID: ${createRes.data?.data?.video_id}`);
        } catch (createErr) {
          log(`❌ HeyGen Video Mock Failed: Status ${createErr.response?.status} - ${JSON.stringify(createErr.response?.data) || createErr.message}`);
        }
      } else {
        log('Skipping HeyGen generation test due to no valid voice or avatar ID.');
      }
    } catch (err) {
      log(`❌ HeyGen FAILED: Status ${err.response?.status} - ${JSON.stringify(err.response?.data) || err.message}`);
    }
  } else {
    log('HeyGen Key is missing from env.');
  }

  fs.writeFileSync(logFile, logContent);
  console.log(`Test results written to ${logFile}`);
}
