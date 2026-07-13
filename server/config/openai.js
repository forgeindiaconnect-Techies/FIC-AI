const { OpenAI } = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is missing from environment');
} else {
  console.log('OpenAI API key loaded');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('OpenAI Connected');

module.exports = openai;
