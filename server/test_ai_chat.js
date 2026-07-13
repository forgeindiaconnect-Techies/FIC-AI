import { getOllamaReply } from './services/aiChatService.js';

async function runTest() {
  console.log('--- Testing AI Chat Service ---');
  console.log('Sending message: "Hello, who are you? Tell me in 1 sentence."');
  
  const start = Date.now();
  try {
    const reply = await getOllamaReply('Hello, who are you? Tell me in 1 sentence.');
    const duration = Date.now() - start;
    console.log('\n--- SUCCESS ---');
    console.log(`Duration: ${duration}ms`);
    console.log(`Reply: "${reply}"`);
  } catch (err) {
    console.error('\n--- FAILED ---');
    console.error(err);
  }
}

runTest();
