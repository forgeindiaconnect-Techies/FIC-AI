const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Get AI reply from Groq Llama‑3.1‑8b‑instant model.
 * @param {string} message - User message.
 * @returns {Promise<string>} AI reply string.
 */
async function getGroqReply(message) {
  if (!message) return '';
  try {
    console.log('Incoming Message to GroqService:', message);
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are FIC AI, a helpful assistant. Reply clearly like ChatGPT.' },
        { role: 'user', content: message },
      ],
    });
    const aiReply = completion.choices[0].message.content;
    console.log('Groq AI Reply:', aiReply);
    return aiReply;
  } catch (error) {
    console.error('Groq API error:', error.message, '\nFull error:', error);
    // Propagate error to caller for proper response handling
    throw error;
  }
}

module.exports = { getGroqReply };
