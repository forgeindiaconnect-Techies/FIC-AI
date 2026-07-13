const { Groq } = require('groq-sdk');

// Initialize Groq client with API key from environment variables.
// Ensure GROQ_API_KEY is set in your .env file.
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

module.exports = groq;
