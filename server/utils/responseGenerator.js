function isLearningQuestion(message) {
  const lower = message.toLowerCase();
  // detect common learning question patterns
  return /^(what is|explain|tell me about|give me an overview of|overview of|describe)/i.test(lower);
}

function generateEducationalResponse(prompt) {
  // Strip leading question phrase
  const topic = prompt.replace(/^(what is|explain|tell me about|give me an overview of|overview of|describe)\s+/i, '').trim();
  const title = `## ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
  const sections = [];
  sections.push({ heading: '### Introduction', content: `A concise overview of **${topic}**.` });
  sections.push({ heading: '### Technology Breakdown', content: `- Core concepts of ${topic}\n- Key components and their interactions.` });
  sections.push({ heading: '### Benefits', content: `- Main advantages of using ${topic}\n- Situations where it shines.` });
  sections.push({ heading: '### Use Cases', content: `- Typical scenarios where ${topic} is applied.\n- Industry examples.` });
  sections.push({ heading: '### Example', content: "```\n// Example snippet for ${topic}\n${topic} example code here\n```" });
  return `${title}\n\n${sections.map(s => `${s.heading}\n${s.content}`).join('\n\n')}`;
}

module.exports = { isLearningQuestion, generateEducationalResponse };
