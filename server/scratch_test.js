import { searchOfficialWebsite } from '../utils/webSearch.js';

async function test() {
  const queries = [
    "Give me the website link for Anna University",
    "website of Oxford University",
    "official link for Madras Christian College"
  ];

  for (const q of queries) {
    console.log(`\nTesting query: "${q}"`);
    const result = await searchOfficialWebsite(q);
    console.log(`Result: ${result}`);
  }
}

test();
