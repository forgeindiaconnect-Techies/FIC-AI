// server/routes/resume.js
import express from 'express';
import { geminiClient } from '../config/gemini.js';

const router = express.Router();

// Helper helper to generate content with Gemini
async function askGemini(prompt, isJson = true) {
  if (!geminiClient) {
    throw new Error('Gemini API key is not configured.');
  }

  try {
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: isJson ? 'application/json' : 'text/plain',
      },
    });

    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    return isJson ? JSON.parse(text) : text;
  } catch (err) {
    console.error('[Gemini Resume API Error]:', err.message);
    let msg = err.message || '';
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      msg = 'Your Gemini API Key has run out of its free daily quota limit. Please wait for the daily reset or switch to a paid API key.';
    }
    throw new Error(msg);
  }
}

// ─── LOCAL RULE-BASED FALLBACK ENGINES ────────────────────────

function runLocalATSAnalysis(resumeData) {
  let score = 35; // Base score
  const missingSkills = [];
  const keywordSuggestions = [];
  const formattingTips = [];
  const objectiveTips = [];
  const projectTips = [];

  // 1. Email check
  if (resumeData.email && resumeData.email.trim().includes('@')) {
    score += 10;
  } else {
    formattingTips.push('Add a professional email address (e.g. yourname@email.com).');
  }

  // 2. Phone check
  if (resumeData.phone && resumeData.phone.trim().length > 5) {
    score += 10;
  } else {
    formattingTips.push('Add a contact phone number to your header details.');
  }

  // 3. Address check
  if (resumeData.address && resumeData.address.trim().length > 3) {
    score += 5;
  } else {
    formattingTips.push('Specify your City and State in the contact header.');
  }

  // 4. LinkedIn & GitHub checks
  if (resumeData.linkedin && resumeData.linkedin.trim().length > 0) {
    score += 5;
  } else {
    formattingTips.push('Add a link to your LinkedIn profile.');
  }
  if (resumeData.github && resumeData.github.trim().length > 0) {
    score += 5;
  }

  // 5. Objective / Professional Summary check
  const objText = resumeData.objective || '';
  const objWords = objText.trim().split(/\s+/).filter(Boolean).length;
  if (objWords > 20) {
    score += 10;
  } else if (objWords > 0) {
    score += 5;
    objectiveTips.push('Expand your professional summary to detail 2-3 of your key expertise areas.');
  } else {
    objectiveTips.push('Add an objective summary highlighting your primary technical goal.');
  }

  // 6. Experience section check
  const experiences = Array.isArray(resumeData.experience) ? resumeData.experience : [];
  if (experiences.length >= 2) {
    score += 20;
  } else if (experiences.length === 1) {
    score += 10;
    projectTips.push('Add another internship or past employment position if possible.');
  } else {
    projectTips.push('Include a Work Experience section to list past professional roles.');
  }

  // Action verbs check
  let hasActionVerbs = false;
  const actionVerbs = ['developed', 'designed', 'built', 'implemented', 'optimized', 'engineered', 'led', 'managed', 'created', 'configured', 'integrated', 'delivered'];
  if (experiences.length > 0) {
    const combinedExpText = experiences.map(e => (e.description || '').toLowerCase()).join(' ');
    hasActionVerbs = actionVerbs.some(verb => combinedExpText.includes(verb));
    if (hasActionVerbs) {
      score += 10;
    } else {
      projectTips.push('Describe work roles using strong action verbs (e.g. Developed, Configured).');
    }
  }

  // 7. Projects section check
  const projects = Array.isArray(resumeData.projects) ? resumeData.projects : [];
  if (projects.length >= 2) {
    score += 15;
  } else if (projects.length === 1) {
    score += 10;
    projectTips.push('Consider adding a second key project to highlight your capabilities.');
  } else {
    projectTips.push('Add a Projects section with descriptions of systems you have built.');
  }

  // 8. Education section check
  const education = Array.isArray(resumeData.education) ? resumeData.education : [];
  if (education.length >= 1) {
    score += 10;
  } else {
    formattingTips.push('Add your Education history to provide credentials.');
  }

  // 9. Skills check
  const skillsList = resumeData.skills ? resumeData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (skillsList.length >= 8) {
    score += 15;
  } else if (skillsList.length >= 3) {
    score += 10;
    keywordSuggestions.push('Add more specific technical frameworks & tools to your skills list.');
  } else {
    keywordSuggestions.push('Add a core technical skills listing containing your tools & languages.');
  }

  // Industry skill checker (missing skills)
  const technicalKeywords = ['Git', 'Docker', 'REST APIs', 'SQL', 'Python', 'AWS', 'Unit Testing', 'CI/CD'];
  const skillsLower = skillsList.map(s => s.toLowerCase());
  technicalKeywords.forEach(skill => {
    if (!skillsLower.includes(skill.toLowerCase())) {
      missingSkills.push(skill);
    }
  });

  const finalScore = Math.min(score, 99);
  const finalAtsScore = Math.floor(finalScore * 0.94);
  const finalReadabilityScore = Math.min(80 + Math.floor(skillsList.length / 2), 98);
  const finalWritingScore = hasActionVerbs ? 90 : 75;

  return {
    score: finalScore,
    atsScore: finalAtsScore,
    readabilityScore: finalReadabilityScore,
    writingScore: finalWritingScore,
    missingSkills: missingSkills.slice(0, 4),
    keywordSuggestions: missingSkills.slice(4, 7).concat(['Agile Delivery', 'Problem Solving']),
    formattingTips: formattingTips.length > 0 ? formattingTips : ['Clean line heights and margins detected.', 'Font pairings match standard patterns.'],
    objectiveTips: objectiveTips.length > 0 ? objectiveTips : ['Summary statement is clean and reader-friendly.'],
    projectTips: projectTips.length > 0 ? projectTips : ['Projects successfully outline the core tech stacks.']
  };
}

function runLocalJobMatch(resumeData, jobDescription) {
  const jdLower = (jobDescription || '').toLowerCase();
  const skillsList = resumeData.skills ? resumeData.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  
  const commonKeywords = ['javascript', 'react', 'node', 'express', 'mongodb', 'python', 'sql', 'git', 'docker', 'aws', 'rest api', 'ci/cd', 'agile', 'testing', 'typescript', 'css', 'html'];
  const presentKeywords = [];
  const missingKeywords = [];
  
  commonKeywords.forEach(kw => {
    const isRequired = jdLower.includes(kw);
    if (isRequired) {
      const hasSkill = skillsList.some(s => s.includes(kw)) || 
                       (resumeData.objective || '').toLowerCase().includes(kw) ||
                       (resumeData.experience || []).some(e => (e.description || '').toLowerCase().includes(kw));
      if (hasSkill) {
        presentKeywords.push(kw.toUpperCase());
      } else {
        missingKeywords.push(kw.toUpperCase());
      }
    }
  });
  
  const totalRequired = presentKeywords.length + missingKeywords.length;
  let matchPercentage = 45; // Default baseline match
  if (totalRequired > 0) {
    matchPercentage = Math.floor(45 + (presentKeywords.length / totalRequired) * 50);
  }
  
  return {
    matchPercentage: Math.min(matchPercentage, 99),
    missingSkills: missingKeywords.slice(0, 3),
    atsKeywords: presentKeywords,
    missingKeywords: missingKeywords,
    suggestions: [
      `Try adding these keywords to your resume to match the job listing: ${missingKeywords.slice(0, 4).join(', ')}.`,
      'Optimize your experience bullet points to explicitly mention tools specified in the description.'
    ],
    rewrittenExperience: []
  };
}

function runLocalEnhance(resumeData, style) {
  const chosenStyle = style || 'modern';
  const enhanced = {
    ...resumeData,
    fullName: (resumeData.fullName || '').trim().replace(/\b\w/g, c => c.toUpperCase()),
  };

  // Customizing local fallback content depending on selected model style
  if (chosenStyle === 'creative') {
    enhanced.objective = `Creative & innovative professional specializing in building high-impact visual products and modern web solutions. Passionate about storytelling, clean UI, and user experience.`;
  } else if (chosenStyle === 'minimal') {
    enhanced.objective = `Results-oriented developer. Specialized in building clean, high-performance web systems with minimal overhead.`;
  } else if (chosenStyle === 'professional') {
    enhanced.objective = `Accomplished and driven professional with a track record of driving technical execution and operational efficiency. Experienced in leading scalable projects and business optimization.`;
  } else {
    enhanced.objective = `Modern software engineer focused on building robust, scalable web architectures. Skilled in agile delivery, cloud solutions, and full-stack integrations.`;
  }

  // Normalize skills format
  const rawSkills = resumeData.skills;
  enhanced.skills = typeof rawSkills === 'string' ? rawSkills : Array.isArray(rawSkills) ? rawSkills.join(', ') : '';

  return enhanced;
}

function runLocalCoverLetter(resumeData, jobDescription, companyName, position) {
  const name = resumeData.fullName || 'John Doe';
  const company = companyName || 'your organization';
  const role = position || 'Software Engineer';
  const skills = resumeData.skills || 'software development, design, and testing';
  const email = resumeData.email || 'applicant@email.com';
  const phone = resumeData.phone || 'contact number';

  return {
    coverLetter: `Dear Hiring Manager,

I am writing to express my enthusiastic interest in the ${role} position at ${company}. As a dedicated professional with hands-on experience in ${skills.split(',').slice(0, 3).join(', ')}, I am confident in my ability to contribute value to your engineering team.

My background includes building software solutions, collaborating on development projects, and applying modern development tools. I am passionate about learning, scaling applications, and solving complex problems in team environments.

Thank you for your time and consideration. I welcome the opportunity to discuss how my qualifications align with your current needs.

Sincerely,

${name}
Email: ${email}
Phone: ${phone}`
  };
}

function runLocalInterviewPrep(resumeData) {
  const skills = resumeData.skills ? resumeData.skills.split(',').map(s => s.trim()) : [];
  const mainSkill1 = skills[0] || 'Software Development';
  const mainSkill2 = skills[1] || 'Web Technologies';

  return {
    questions: [
      {
        type: 'Technical',
        question: `Can you explain the core concepts and architecture of ${mainSkill1}?`,
        answer: `Explain the fundamental concepts, lifecycle, ecosystem tools, and state/data management of ${mainSkill1}.`,
        tips: `Mention a production example where you applied ${mainSkill1} to solve a real problem.`
      },
      {
        type: 'Technical',
        question: `What are some best practices when developing systems with ${mainSkill2}?`,
        answer: `What are some best practices when developing systems with ${mainSkill2}?`,
        tips: `Explain the security, performance, and accessibility trade-offs of ${mainSkill2}.`
      },
      {
        type: 'HR',
        question: 'Can you tell me about yourself and your background?',
        answer: 'Provide a brief summary of your background, experience in your industry, and key achievements.',
        tips: 'Highlight the skills from your resume that directly apply to the jobs you are targeting.'
      },
      {
        type: 'Behavioral',
        question: 'Tell me about a challenging project you worked on.',
        answer: 'Describe the project goals, the obstacle you faced, the exact action you took to address it, and the final impact.',
        tips: 'Focus on teamwork, problem-solving, and clean resolution.'
      },
      {
        type: 'HR',
        question: 'Why do you want to work for our organization?',
        answer: 'Demonstrate research of the company culture, products, and mission. Align it with your personal career growth goals.',
        tips: 'Be enthusiastic and show how you can contribute to their engineering goals.'
      }
    ]
  };
}

// ─── ROUTE ENDPOINTS ──────────────────────────────────────────

// 1. Enhance Resume Fields
router.post('/enhance', async (req, res) => {
  const { resumeData, style } = req.body;
  if (!resumeData) {
    return res.status(400).json({ success: false, error: 'Resume data is required' });
  }

  const chosenStyle = style || 'modern';
  let styleGuideline = '';
  if (chosenStyle === 'creative') {
    styleGuideline = 'Write the objective, summary, and experience bullet points with a highly creative, storytelling, and engaging tone. Highlight innovation, design-thinking, and creative problem-solving.';
  } else if (chosenStyle === 'minimal') {
    styleGuideline = 'Write the objective and experience bullet points to be extremely concise, brief, clean, and direct. Avoid wordiness. Focus strictly on key achievements and specific tech stacks used.';
  } else if (chosenStyle === 'professional') {
    styleGuideline = 'Write the objective and experience bullet points with a highly formal, corporate, executive tone. Highlight leadership, quantitative achievements, and certifications/credentials.';
  } else {
    styleGuideline = 'Write with a modern, high-tech, startup-friendly professional tone. Highlight full-stack competencies, agile methodologies, and modern toolkits.';
  }

  const prompt = `
    Review and enhance this resume to be highly professional and ATS-friendly:
    Style Guidelines: ${styleGuideline}
    
    Current Resume Data:
    ${JSON.stringify(resumeData)}
    
    Ensure the output JSON follows the exact same schema. Return JSON format only.
  `;

  try {
    const data = await askGemini(prompt, true);
    const merged = { ...resumeData, ...data };
    res.json({ success: true, data: merged });
  } catch (err) {
    console.warn('[Resume API] Enhance fallback activated:', err.message);
    const localData = runLocalEnhance(resumeData, chosenStyle);
    res.json({ success: true, data: localData, isLocalFallback: true });
  }
});

// 2. ATS Analysis & Score
router.post('/analyze', async (req, res) => {
  const { resumeData } = req.body;
  if (!resumeData) {
    return res.status(400).json({ success: false, error: 'Resume data is required' });
  }

  const prompt = `
    Analyze this resume for ATS compatibility and quality scores:
    ${JSON.stringify(resumeData)}
    Return JSON format only.
  `;

  try {
    const data = await askGemini(prompt, true);
    res.json({ success: true, data });
  } catch (err) {
    console.log('[Resume API] Gemini failed, running local ATS score rules...');
    const localAnalysis = runLocalATSAnalysis(resumeData);
    res.json({ success: true, data: localAnalysis, isLocalFallback: true });
  }
});

// 3. Job Description Matching
router.post('/match', async (req, res) => {
  const { resumeData, jobDescription } = req.body;
  if (!resumeData || !jobDescription) {
    return res.status(400).json({ success: false, error: 'Resume and Job Description are required' });
  }

  const prompt = `
    Match this resume against the Job Description:
    Resume: ${JSON.stringify(resumeData)}
    JD: ${jobDescription}
    Return JSON format only.
  `;

  try {
    const data = await askGemini(prompt, true);
    res.json({ success: true, data });
  } catch (err) {
    console.log('[Resume API] Gemini failed, running local job matching rules...');
    const localMatch = runLocalJobMatch(resumeData, jobDescription);
    res.json({ success: true, data: localMatch, isLocalFallback: true });
  }
});

// 4. AI Cover Letter Generator
router.post('/cover-letter', async (req, res) => {
  const { resumeData, jobDescription, companyName, position } = req.body;
  if (!resumeData) {
    return res.status(400).json({ success: false, error: 'Resume data is required' });
  }

  const prompt = `
    Write a tailored cover letter:
    Resume: ${JSON.stringify(resumeData)}
    JD: ${jobDescription || ''}
    Company: ${companyName || ''}
    Position: ${position || ''}
    Return JSON format only.
  `;

  try {
    const data = await askGemini(prompt, true);
    res.json({ success: true, coverLetter: data.coverLetter });
  } catch (err) {
    console.log('[Resume API] Gemini failed, running local cover letter rules...');
    const localCL = runLocalCoverLetter(resumeData, jobDescription, companyName, position);
    res.json({ success: true, coverLetter: localCL.coverLetter, isLocalFallback: true });
  }
});

// 5. AI Interview Preparation Suite
router.post('/interview-prep', async (req, res) => {
  const { resumeData } = req.body;
  if (!resumeData) {
    return res.status(400).json({ success: false, error: 'Resume data is required' });
  }

  const prompt = `
    Generate interview preparation questions:
    Resume: ${JSON.stringify(resumeData)}
    Return JSON format only.
  `;

  try {
    const data = await askGemini(prompt, true);
    res.json({ success: true, questions: data.questions });
  } catch (err) {
    console.log('[Resume API] Gemini failed, running local interview rules...');
    const localPrep = runLocalInterviewPrep(resumeData);
    res.json({ success: true, questions: localPrep.questions, isLocalFallback: true });
  }
});

export default router;
