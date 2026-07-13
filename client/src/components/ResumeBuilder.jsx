// client/src/components/ResumeBuilder.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL as API_URL } from '../config/api';
import LimitModal from './LimitModal';
import { isLimitReached, incrementUsage, getFeatureLimitDetails } from '../utils/limitChecker';

const getSkillsString = (skills) => {
  if (!skills) return '';
  if (typeof skills === 'string') return skills;
  if (Array.isArray(skills)) {
    return skills.map(s => typeof s === 'string' ? s : JSON.stringify(s)).join(', ');
  }
  if (typeof skills === 'object') {
    return Object.entries(skills)
      .map(([key, value]) => {
        const valStr = Array.isArray(value) 
          ? value.join(', ') 
          : typeof value === 'string' 
            ? value 
            : typeof value === 'object' && value !== null 
              ? JSON.stringify(value)
              : '';
        const categoryName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return valStr ? `${categoryName}: ${valStr}` : '';
      })
      .filter(Boolean)
      .join(' | ');
  }
  return '';
};

const cleanResumeData = (data) => {
  if (!data) return {};
  return {
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    email: typeof data.email === 'string' ? data.email : '',
    address: typeof data.address === 'string' ? data.address : '',
    linkedin: typeof data.linkedin === 'string' ? data.linkedin : '',
    github: typeof data.github === 'string' ? data.github : '',
    objective: typeof data.objective === 'string' ? data.objective : '',
    skills: getSkillsString(data.skills),
    certifications: typeof data.certifications === 'string' ? data.certifications : '',
    languages: typeof data.languages === 'string' ? data.languages : '',
    achievements: typeof data.achievements === 'string' ? data.achievements : '',
    education: Array.isArray(data.education) ? data.education.map(e => ({
      school: typeof e.school === 'string' ? e.school : '',
      degree: typeof e.degree === 'string' ? e.degree : '',
      year: typeof e.year === 'string' ? e.year : '',
      score: typeof e.score === 'string' ? e.score : ''
    })) : [],
    experience: Array.isArray(data.experience) ? data.experience.map(e => ({
      company: typeof e.company === 'string' ? e.company : '',
      role: typeof e.role === 'string' ? e.role : '',
      duration: typeof e.duration === 'string' ? e.duration : '',
      description: typeof e.description === 'string' ? e.description : ''
    })) : [],
    projects: Array.isArray(data.projects) ? data.projects.map(p => ({
      title: typeof p.title === 'string' ? p.title : '',
      description: typeof p.description === 'string' ? p.description : ''
    })) : []
  };
};

export default function ResumeBuilder() {
  // 1. STATE FOR RESUME DATA
  const [resumeData, setResumeData] = useState({
    fullName: 'John Doe',
    phone: '+1 (555) 019-2834',
    email: 'johndoe@example.com',
    address: 'New York, NY',
    linkedin: 'linkedin.com/in/johndoe',
    github: 'github.com/johndoe',
    objective: 'Motivated Software Engineer with 3+ years of experience building scalable web applications. Passionate about AI integrations, cloud architecture, and optimizing user experiences.',
    education: [
      { school: 'State University', degree: 'B.S. in Computer Science', year: '2019 - 2023', score: 'GPA 3.8/4.0' }
    ],
    experience: [
      { company: 'Tech Solutions Inc.', role: 'Associate Software Engineer', duration: '2023 - Present', description: 'Developed core features for SaaS platforms. Optimized database queries which reduced loading times by 15%. Worked with React, Node.js, and MongoDB.' }
    ],
    projects: [
      { title: 'AI Travel Planner', description: 'Built an interactive travel recommendation web application powered by LLMs. Integrated Google Maps API and styled with custom CSS glassmorphism.' }
    ],
    skills: 'JavaScript, React, Node.js, Express, MongoDB, HTML5, CSS3, REST APIs, Git',
    certifications: 'AWS Certified Cloud Practitioner, React Developer Certification',
    languages: 'English (Fluent), Spanish (Conversational)',
    achievements: 'Winner of local Hackathon 2024, Best Performance Award Q3'
  });

  // UI STATES
  const [formTab, setFormTab] = useState('personal'); // personal, education, experience, projects, skills
  const [activeTemplate, setActiveTemplate] = useState('modern'); // modern, minimal, creative, professional
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [activePanel, setActivePanel] = useState('ats'); // ats, matching, coverletter, interview
  
  // GENERATION WIZARD MODAL STATES
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [generationModalStep, setGenerationModalStep] = useState(1);
  const [chosenStyle, setChosenStyle] = useState('modern');
  
  // JOB DESCRIPTION STATE
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [positionName, setPositionName] = useState('');
  
  // AI OUTPUT STATES
  const [atsAnalysis, setAtsAnalysis] = useState(null);
  const [jobMatch, setJobMatch] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [interviewPrep, setInterviewPrep] = useState([]);
  
  const [notification, setNotification] = useState('');

  // 1a. SKILL MODAL & ATS SYSTEM STATES
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [proficiency, setProficiency] = useState('Intermediate');
  const [experienceYears, setExperienceYears] = useState(2);
  const [showSuccessStep, setShowSuccessStep] = useState(false);
  const [showAiImproveStep, setShowAiImproveStep] = useState(false);

  // Score states to show dynamic improvements
  const [resumeScore, setResumeScore] = useState(82);
  const [atsScore, setAtsScore] = useState(74);

  const MISSING_SKILLS_LIST = [
    { name: 'Python', focus: 'AI/ML Focus', impact: 8, desc: 'Python is one of the most in-demand programming languages for AI, Machine Learning, Data Science, Automation, and Backend Development. Used in 85%+ AI Engineer job postings.' },
    { name: 'SQL', focus: 'Database Queries', impact: 6, desc: 'Structured Query Language (SQL) is standard for storing, manipulating and retrieving data in relational databases.' },
    { name: 'Docker', focus: 'Containerization', impact: 5, desc: 'Pack software into standardized units called containers that contain everything needed to run.' },
    { name: 'Kubernetes', focus: 'Orchestration', impact: 4, desc: 'Open-source container-orchestration system for automating computer application deployment, scaling, and management.' },
    { name: 'CI/CD', focus: 'DevOps Pipelines', impact: 4, desc: 'Continuous Integration & Continuous Delivery processes to automate software releases.' },
    { name: 'Unit Testing', focus: 'Software Quality', impact: 3, desc: 'Testing individual units of source code to determine whether they are fit for use.' },
    { name: 'Data Structures & Algorithms', focus: 'Problem Solving', impact: 6, desc: 'Crucial for writing optimized, clean code and passing technical evaluations.' }
  ];

  const handleOpenSkillModal = (skill) => {
    setSelectedSkill(skill);
    setProficiency('Intermediate');
    setExperienceYears(2);
    setShowSuccessStep(false);
    setShowAiImproveStep(false);
    setSkillModalOpen(true);
  };

  const handleAddSkillToResume = () => {
    if (!selectedSkill) return;
    
    // Add skill to the skills field
    let skillsStr = getSkillsString(resumeData.skills);
    let updatedSkills = skillsStr;
    if (updatedSkills.trim()) {
      // Avoid duplicate appending
      if (!updatedSkills.toLowerCase().includes(selectedSkill.name.toLowerCase())) {
        updatedSkills = `${updatedSkills.trim()}, ${selectedSkill.name}`;
      }
    } else {
      updatedSkills = selectedSkill.name;
    }
    
    setResumeData(prev => ({ ...prev, skills: updatedSkills }));
    
    // Simulate score improvements
    setResumeScore(prev => Math.min(prev + selectedSkill.impact, 99));
    setAtsScore(prev => Math.min(prev + selectedSkill.impact - 1, 99));
    
    // Show success screen step
    setShowSuccessStep(true);
  };

  const handleCloseSkillModal = () => {
    setSkillModalOpen(false);
    setSelectedSkill(null);
  };

  const handleAiImproveResume = async () => {
    // Closes the modal and runs the AI improvement
    setSkillModalOpen(false);
    await handleEnhanceResume();
  };

  // Auto-run basic local scoring on resume updates
  useEffect(() => {
    // Basic local scoring simulation before running premium AI analysis
    const wordCount = JSON.stringify(cleanResumeData(resumeData)).split(/\s+/).length;
    const scoreVal = Math.min(60 + Math.floor(wordCount / 15), 95);
    setAtsAnalysis(prev => prev || {
      score: scoreVal,
      atsScore: Math.floor(scoreVal * 0.95),
      readabilityScore: 82,
      writingScore: 85,
      missingSkills: ['Docker', 'AWS Cloud', 'Jest Testing'],
      keywordSuggestions: ['Agile Methodologies', 'System Architecture', 'CI/CD Pipelines'],
      formattingTips: ['Ensure clear margins and headings.', 'Include bullet points for experience description.'],
      objectiveTips: ['Begin summary with years of experience.'],
      projectTips: ['Describe the tools/stack used in each project description.']
    });
  }, [resumeData]);

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // 2. INPUT CHANGE HANDLERS
  const handleInputChange = (field, value) => {
    setResumeData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (section, index, field, value) => {
    const updated = [...resumeData[section]];
    updated[index][field] = value;
    setResumeData(prev => ({ ...prev, [section]: updated }));
  };

  const addArrayItem = (section, defaultValue) => {
    setResumeData(prev => ({ ...prev, [section]: [...prev[section], defaultValue] }));
  };

  const removeArrayItem = (section, index) => {
    const updated = resumeData[section].filter((_, i) => i !== index);
    setResumeData(prev => ({ ...prev, [section]: updated }));
  };

  // 3. BACKEND API CALLS (AI LOGIC)
  const handleEnhanceResume = async (overrideStyle) => {
    if (isLimitReached('resume')) {
      setShowLimitModal(true);
      return;
    }
    setLoading(true);
    try {
      const targetStyle = (typeof overrideStyle === 'string' ? overrideStyle : '') || chosenStyle || activeTemplate;
      const response = await axios.post(`${API_URL}/api/resume/enhance`, { 
        resumeData: cleanResumeData(resumeData), 
        style: targetStyle 
      });
      if (response.data?.success && response.data.data) {
        setResumeData(response.data.data);
        triggerNotification('✨ Resume enhanced and formatted by AI!');
        incrementUsage('resume'); // Increment resume usage count!
      } else {
        throw new Error(response.data?.error || 'Enhancement failed');
      }
    } catch (err) {
      triggerNotification('⚠️ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeResume = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/resume/analyze`, { resumeData: cleanResumeData(resumeData) });
      if (response.data?.success && response.data.data) {
        setAtsAnalysis(response.data.data);
        triggerNotification('📊 ATS Analysis Complete!');
      } else {
        throw new Error(response.data?.error || 'Analysis failed');
      }
    } catch (err) {
      triggerNotification('⚠️ Analysis failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJobMatch = async () => {
    if (!jobDescription.trim()) {
      triggerNotification('⚠️ Please enter a Job Description');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/resume/match`, { resumeData: cleanResumeData(resumeData), jobDescription });
      if (response.data?.success && response.data.data) {
        setJobMatch(response.data.data);
        if (response.data.data.rewrittenExperience?.length > 0) {
          // Provide optimized suggestions
          setNotification('🎯 Job matching completed! Keyword suggestions loaded.');
        }
      } else {
        throw new Error(response.data?.error || 'Match analysis failed');
      }
    } catch (err) {
      triggerNotification('⚠️ Job match failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/resume/cover-letter`, {
        resumeData: cleanResumeData(resumeData),
        jobDescription,
        companyName,
        position: positionName
      });
      if (response.data?.success && response.data.coverLetter) {
        setCoverLetter(response.data.coverLetter);
        triggerNotification('✍️ Custom Cover Letter generated!');
      } else {
        throw new Error(response.data?.error || 'Cover letter failed');
      }
    } catch (err) {
      triggerNotification('⚠️ Cover letter failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInterviewPrep = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/resume/interview-prep`, { resumeData: cleanResumeData(resumeData) });
      if (response.data?.success && response.data.questions) {
        setInterviewPrep(response.data.questions);
        triggerNotification('🎤 Interview Prep Questions Loaded!');
      } else {
        throw new Error(response.data?.error || 'Prep generation failed');
      }
    } catch (err) {
      triggerNotification('⚠️ Prep failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. PRINT EXPORT (PDF ENGINE)
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent select-none animate-fadeIn">
      {/* CSS PRINT RULES INJECTION */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #resume-print-area, #resume-print-area * {
            visibility: visible;
          }
          #resume-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          aside, header, nav, button, .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HEADER BAR (DESKTOP) */}
      <div className="hidden md:flex h-16 border-b border-white/5 bg-[#0B1020]/50 backdrop-blur-md px-6 items-center justify-between shrink-0 no-print">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            FIC Premium AI Resume Suite
          </span>
        </div>
        {/* pr-28 gives clearance for the fixed ThemeToggle (💎 + avatar) at top-right */}
        <div className="flex items-center gap-3 pr-28">
          <button
            onClick={() => handleEnhanceResume()}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 font-bold text-xs uppercase tracking-wider hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            {loading ? 'AI Processing...' : '🤖 AI Auto-Improve'}
          </button>
          <button
            onClick={handlePrintPDF}
            className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            📥 Export to PDF
          </button>
        </div>
      </div>

      {/* HEADER & QUICK ACTIONS (MOBILE) */}
      <div className="block md:hidden border-b border-white/5 bg-[#0B1020]/50 backdrop-blur-md px-4 py-4 shrink-0 no-print flex flex-col gap-4">
        {/* Title Block */}
        <div className="text-center">
          <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center justify-center gap-2">
            ✨ AI RESUME SUITE
          </h2>
          <p className="text-[10px] text-slate-400 mt-1">Build Your Perfect Resume with AI</p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl flex flex-col justify-between h-14 cursor-pointer hover:bg-violet-600/20 transition-all">
            <span className="text-[9px] font-bold text-violet-300">📄 AI Resume Suite</span>
            <span className="text-[8px] text-slate-500">Builder Active</span>
          </div>
          <button 
            onClick={() => handleEnhanceResume()}
            disabled={loading}
            className="p-3 bg-cyan-600/10 border border-cyan-500/20 rounded-xl flex flex-col justify-between h-14 text-left hover:bg-cyan-600/20 transition-all cursor-pointer"
          >
            <span className="text-[9px] font-bold text-cyan-300">🤖 AI Auto-Improve</span>
            <span className="text-[8px] text-slate-500">{loading ? 'Improving...' : 'Optimize Content'}</span>
          </button>
          <button 
            onClick={handlePrintPDF}
            className="p-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl flex flex-col justify-between h-14 text-left hover:bg-emerald-600/20 transition-all cursor-pointer"
          >
            <span className="text-[9px] font-bold text-emerald-300">📥 Export to PDF</span>
            <span className="text-[8px] text-slate-500">Download Print</span>
          </button>
          <div 
            onClick={() => {
              const sel = document.getElementById('template-selector-box');
              if (sel) sel.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-3 bg-amber-600/10 border border-amber-500/20 rounded-xl flex flex-col justify-between h-14 text-left hover:bg-amber-600/20 transition-all cursor-pointer"
          >
            <span className="text-[9px] font-bold text-amber-300">🎛️ Templates</span>
            <span className="text-[8px] text-slate-500">Change Design</span>
          </div>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 bg-slate-900 border border-violet-500/30 text-slate-200 text-xs font-bold rounded-xl shadow-2xl animate-slideIn no-print">
          {notification}
        </div>
      )}

      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-full pb-20 lg:pb-0">

          {/* LEFT COLUMN: EDIT FORM & DATA ENTRY (5 Columns) */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden no-print min-h-[500px] lg:min-h-0 lg:h-full">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              📝 Resume Creator
            </h3>

            {/* CONNECTED CIRCULAR STEP PROGRESS INDICATOR */}
            <div className="relative flex justify-between items-center mb-6 px-1.5 no-print">
              {/* Connecting line */}
              <div style={{
                position: 'absolute',
                top: '13px',
                left: '20px',
                right: '20px',
                height: '2px',
                background: 'rgba(255,255,255,0.08)',
                zIndex: 1
              }} />
              
              {[
                { id: 'personal', num: 1, label: 'Personal' },
                { id: 'education', num: 2, label: 'Education' },
                { id: 'experience', num: 3, label: 'Experience' },
                { id: 'skills', num: 4, label: 'Skills' },
                { id: 'projects', num: 5, label: 'Projects' },
                { id: 'summary', num: 6, label: 'Summary' }
              ].map(step => {
                const isActive = formTab === step.id;
                const tabsList = ['personal', 'education', 'experience', 'skills', 'projects', 'summary'];
                const isCompleted = tabsList.indexOf(formTab) > tabsList.indexOf(step.id);
                return (
                  <div 
                    key={step.id} 
                    className="flex flex-col items-center flex-1 relative group cursor-pointer" 
                    onClick={() => setFormTab(step.id)}
                    style={{ zIndex: 2 }}
                  >
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isActive ? '#7C3AED' : isCompleted ? '#10B981' : 'rgba(15, 23, 42, 0.9)',
                      border: isActive ? '2.5px solid #A78BFA' : isCompleted ? '2.5px solid #10B981' : '1.5px solid rgba(255,255,255,0.12)',
                      color: isActive || isCompleted ? '#FFFFFF' : '#9CA3AF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 900,
                      transition: 'all 0.25s ease',
                      boxShadow: isActive ? '0 0 12px rgba(124, 58, 237, 0.4)' : 'none'
                    }}>
                      {isCompleted ? '✓' : step.num}
                    </div>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: isActive ? 800 : 500,
                      color: isActive ? '#FFFFFF' : '#64748B',
                      marginTop: '5px',
                      textAlign: 'center',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* TAB PANELS */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              
              {/* PERSONAL INFO PANEL */}
              {formTab === 'personal' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={resumeData.fullName}
                      onChange={e => handleInputChange('fullName', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                      <input
                        type="text"
                        value={resumeData.phone}
                        onChange={e => handleInputChange('phone', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                      <input
                        type="email"
                        value={resumeData.email}
                        onChange={e => handleInputChange('email', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                    <input
                      type="text"
                      value={resumeData.address}
                      onChange={e => handleInputChange('address', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">LinkedIn Profile</label>
                      <input
                        type="text"
                        value={resumeData.linkedin}
                        onChange={e => handleInputChange('linkedin', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">GitHub Profile</label>
                      <input
                        type="text"
                        value={resumeData.github}
                        onChange={e => handleInputChange('github', e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Objective / Executive Summary</label>
                    <textarea
                      rows={4}
                      value={resumeData.objective}
                      onChange={e => handleInputChange('objective', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* EDUCATION PANEL */}
              {formTab === 'education' && (
                <div className="space-y-4">
                  {(resumeData.education || []).map((edu, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-3 relative">
                      <button
                        onClick={() => removeArrayItem('education', idx)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-red-400 bg-transparent border-none cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">School / College</label>
                          <input
                            type="text"
                            value={edu.school}
                            onChange={e => handleArrayChange('education', idx, 'school', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={e => handleArrayChange('education', idx, 'degree', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Duration / Year</label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={e => handleArrayChange('education', idx, 'year', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">GPA / Score</label>
                          <input
                            type="text"
                            value={edu.score}
                            onChange={e => handleArrayChange('education', idx, 'score', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('education', { school: '', degree: '', year: '', score: '' })}
                    className="w-full py-2 bg-transparent hover:bg-white/5 border border-dashed border-white/10 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
                  >
                    ➕ Add Education Section
                  </button>
                </div>
              )}

              {/* EXPERIENCE PANEL */}
              {formTab === 'experience' && (
                <div className="space-y-4">
                  {(resumeData.experience || []).map((exp, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-3 relative">
                      <button
                        onClick={() => removeArrayItem('experience', idx)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-red-400 bg-transparent border-none cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={e => handleArrayChange('experience', idx, 'company', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Job Title</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={e => handleArrayChange('experience', idx, 'role', e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Duration / Date Range</label>
                        <input
                          type="text"
                          value={exp.duration}
                          onChange={e => handleArrayChange('experience', idx, 'duration', e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description / Key Impacts</label>
                        <textarea
                          rows={3}
                          value={exp.description}
                          onChange={e => handleArrayChange('experience', idx, 'description', e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none resize-none"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('experience', { company: '', role: '', duration: '', description: '' })}
                    className="w-full py-2 bg-transparent hover:bg-white/5 border border-dashed border-white/10 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
                  >
                    ➕ Add Work Experience
                  </button>
                </div>
              )}

              {/* PROJECTS PANEL */}
              {formTab === 'projects' && (
                <div className="space-y-4">
                  {(resumeData.projects || []).map((proj, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-3 relative">
                      <button
                        onClick={() => removeArrayItem('projects', idx)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-red-400 bg-transparent border-none cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Name</label>
                        <input
                          type="text"
                          value={proj.title}
                          onChange={e => handleArrayChange('projects', idx, 'title', e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Project Description & Tech Stack</label>
                        <textarea
                          rows={3}
                          value={proj.description}
                          onChange={e => handleArrayChange('projects', idx, 'description', e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none resize-none"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addArrayItem('projects', { title: '', description: '' })}
                    className="w-full py-2 bg-transparent hover:bg-white/5 border border-dashed border-white/10 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
                  >
                    ➕ Add Project Section
                  </button>
                </div>
              )}

              {/* SKILLS PANEL (STEP 4) */}
              {formTab === 'skills' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Core Skills (comma separated)</label>
                    <textarea
                      rows={4}
                      value={resumeData.skills}
                      onChange={e => handleInputChange('skills', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {/* SUMMARY & EXTRA PANEL (STEP 6) */}
              {formTab === 'summary' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Certifications</label>
                    <input
                      type="text"
                      value={resumeData.certifications}
                      onChange={e => handleInputChange('certifications', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Languages</label>
                    <input
                      type="text"
                      value={resumeData.languages}
                      onChange={e => handleInputChange('languages', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Key Achievements</label>
                    <textarea
                      rows={3}
                      value={resumeData.achievements}
                      onChange={e => handleInputChange('achievements', e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-violet-500 transition-all resize-none"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* STEP NAVIGATION BUTTONS (MOBILE FIRST PROGRESS FLOW) */}
            <div className="flex gap-2.5 mt-5 pt-3.5 border-t border-white/5 no-print">
              {formTab !== 'personal' && (
                <button
                  onClick={() => {
                    const tabs = ['personal', 'education', 'experience', 'skills', 'projects', 'summary'];
                    const currentIdx = tabs.indexOf(formTab);
                    if (currentIdx > 0) setFormTab(tabs[currentIdx - 1]);
                  }}
                  className="flex-1 py-2 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-transparent text-slate-300 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  ← Previous
                </button>
              )}
              {formTab !== 'summary' ? (
                <button
                  onClick={() => {
                    const tabs = ['personal', 'education', 'experience', 'skills', 'projects', 'summary'];
                    const currentIdx = tabs.indexOf(formTab);
                    if (currentIdx < tabs.length - 1) setFormTab(tabs[currentIdx + 1]);
                  }}
                  className="flex-[2] py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider border-none cursor-pointer transition-all"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={() => {
                    setGenerationModalStep(1);
                    setGenerationModalOpen(true);
                  }}
                  className="flex-[2] py-2 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider border-none cursor-pointer transition-all shadow-lg"
                >
                  ✨ Generate Resume
                </button>
              )}
            </div>

          </div>

          {/* CENTER/RIGHT: TEMPLATE PREVIEW & DESIGN CHANGER (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden min-h-[600px] lg:min-h-0 lg:h-full">
            
            <div className="flex flex-col shrink-0 mb-4 no-print">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                🎨 Live View & Templates
              </h3>
              {/* Visual Template Selector Cards Grid */}
              <div id="template-selector-box" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'modern', label: 'Modern', icon: '💼', desc: 'Stylish professional model' },
                  { id: 'minimal', label: 'Minimalist', icon: '📝', desc: 'Clean single-column text' },
                  { id: 'creative', label: 'Creative', icon: '🎨', desc: 'Modern side-by-side split' },
                  { id: 'professional', label: 'Executive', icon: '🎖️', desc: 'Traditional classic layout' }
                ].map(t => {
                  const isSel = activeTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTemplate(t.id)}
                      className="p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between h-[76px]"
                      style={{
                        background: isSel ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: isSel ? '#7C3AED' : 'rgba(255,255,255,0.06)',
                        boxShadow: isSel ? '0 4px 16px rgba(124, 58, 237, 0.15)' : 'none'
                      }}
                      onMouseEnter={e => {
                        if (!isSel) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                      }}
                      onMouseLeave={e => {
                        if (!isSel) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm">{t.icon}</span>
                        {isSel && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />}
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-white block uppercase tracking-wider">{t.label}</span>
                        <span className="text-[8px] text-slate-500 block truncate mt-0.5" style={{ color: isSel ? '#A78BFA' : '#64748B' }}>{t.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RENDERED PREVIEW CONTAINER */}
            <div className="flex-1 overflow-y-auto bg-white text-slate-800 rounded-xl p-6 shadow-2xl scrollbar-thin flex flex-col">
              <div id="resume-print-area" className="flex-1 font-sans text-[10px] leading-normal" style={{ fontSize: '10px' }}>
                
                {/* 1. MODERN TEMPLATE */}
                {activeTemplate === 'modern' && (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b-2 border-violet-600 pb-3 flex justify-between items-end">
                      <div>
                        <h2 className="text-lg font-black tracking-wide text-violet-800 uppercase" style={{ margin: 0 }}>{resumeData.fullName}</h2>
                        <p className="text-[9px] text-slate-500 mt-1" style={{ margin: 0 }}>{resumeData.address} · {resumeData.phone} · {resumeData.email}</p>
                      </div>
                      <div className="text-right text-[8px] text-violet-700">
                        {resumeData.linkedin && <p style={{ margin: 0 }}>{resumeData.linkedin}</p>}
                        {resumeData.github && <p style={{ margin: 0 }}>{resumeData.github}</p>}
                      </div>
                    </div>
                    {/* Objective */}
                    {resumeData.objective && (
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider" style={{ margin: 0 }}>Professional Summary</h4>
                        <p className="text-slate-600 leading-relaxed" style={{ margin: 0 }}>{resumeData.objective}</p>
                      </div>
                    )}
                    {/* Experience */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider" style={{ margin: 0 }}>Work Experience</h4>
                      {(resumeData.experience || []).map((exp, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between font-bold text-slate-700">
                            <span>{exp.company} — {exp.role}</span>
                            <span className="text-[9px] font-normal text-slate-500">{exp.duration}</span>
                          </div>
                          <p className="text-slate-600" style={{ margin: 0 }}>{exp.description}</p>
                        </div>
                      ))}
                    </div>
                    {/* Projects */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider" style={{ margin: 0 }}>Key Projects</h4>
                      {(resumeData.projects || []).map((proj, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="font-bold text-slate-700">{proj.title}</div>
                          <p className="text-slate-600" style={{ margin: 0 }}>{proj.description}</p>
                        </div>
                      ))}
                    </div>
                    {/* Grid for Education, Skills & Extra */}
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider" style={{ margin: 0 }}>Education</h4>
                        {(resumeData.education || []).map((edu, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="font-bold text-slate-700">{edu.school}</div>
                            <p className="text-slate-500" style={{ margin: 0 }}>{edu.degree} · {edu.year}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-violet-800 uppercase tracking-wider" style={{ margin: 0 }}>Core Competencies</h4>
                        <p className="text-slate-600" style={{ margin: 0 }}>{getSkillsString(resumeData.skills)}</p>
                        {resumeData.certifications && (
                          <div className="pt-1">
                            <span className="font-bold text-slate-700">Certs:</span> <span className="text-slate-600">{resumeData.certifications}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. MINIMAL TEMPLATE */}
                {activeTemplate === 'minimal' && (
                  <div className="space-y-3.5 font-sans">
                    <div className="text-center pb-2 border-b border-slate-200">
                      <h2 className="text-base font-bold text-slate-900 tracking-tight" style={{ margin: 0 }}>{resumeData.fullName}</h2>
                      <p className="text-[8px] text-slate-500 mt-0.5" style={{ margin: 0 }}>
                        {resumeData.email} | {resumeData.phone} | {resumeData.address}
                      </p>
                      <div className="flex justify-center gap-2 text-[8px] text-slate-400 mt-1">
                        {resumeData.linkedin && <span>{resumeData.linkedin}</span>}
                        {resumeData.github && <span>{resumeData.github}</span>}
                      </div>
                    </div>
                    {resumeData.objective && (
                      <div className="text-center max-w-lg mx-auto">
                        <p className="text-slate-600 leading-relaxed italic" style={{ margin: 0 }}>"{resumeData.objective}"</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <h3 className="text-[9px] font-bold uppercase tracking-wider border-b border-slate-100 pb-0.5 text-slate-700" style={{ margin: 0 }}>Experience</h3>
                      {(resumeData.experience || []).map((exp, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>{exp.company} / {exp.role}</span>
                            <span className="text-[8px] font-normal text-slate-400">{exp.duration}</span>
                          </div>
                          <p className="text-slate-600 mt-0.5" style={{ margin: 0 }}>{exp.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[9px] font-bold uppercase tracking-wider border-b border-slate-100 pb-0.5 text-slate-700" style={{ margin: 0 }}>Projects</h3>
                      {(resumeData.projects || []).map((proj, idx) => (
                        <div key={idx}>
                          <div className="font-semibold text-slate-800">{proj.title}</div>
                          <p className="text-slate-600 mt-0.5" style={{ margin: 0 }}>{proj.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[9px] font-bold uppercase tracking-wider border-b border-slate-100 pb-0.5 text-slate-700" style={{ margin: 0 }}>Education</h3>
                      {(resumeData.education || []).map((edu, idx) => (
                        <div key={idx} className="flex justify-between text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-800">{edu.school}</span> — {edu.degree}
                          </div>
                          <span className="text-[8px] text-slate-400">{edu.year}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-[9px] font-bold uppercase tracking-wider border-b border-slate-100 pb-0.5 text-slate-700" style={{ margin: 0 }}>Skills & Frameworks</h3>
                      <p className="text-slate-600" style={{ margin: 0 }}>{getSkillsString(resumeData.skills)}</p>
                    </div>
                  </div>
                )}

                {/* 3. CREATIVE TEMPLATE */}
                {activeTemplate === 'creative' && (
                  <div className="flex gap-4">
                    {/* Left narrow accent bar */}
                    <div className="w-1/3 bg-slate-50 p-3 rounded-lg flex flex-col justify-between border-r border-slate-100">
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-sm font-black text-cyan-700 uppercase" style={{ margin: 0 }}>{resumeData.fullName}</h2>
                          <p className="text-[8px] text-slate-400 mt-0.5" style={{ margin: 0 }}>{resumeData.address}</p>
                        </div>
                        <div className="space-y-1 text-[8px] text-slate-500">
                          <p style={{ margin: 0 }}>📞 {resumeData.phone}</p>
                          <p style={{ margin: 0 }}>✉️ {resumeData.email}</p>
                          {resumeData.linkedin && <p style={{ margin: 0 }}>🔗 {resumeData.linkedin}</p>}
                          {resumeData.github && <p style={{ margin: 0 }}>🐙 {resumeData.github}</p>}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[9px] font-black uppercase text-cyan-800" style={{ margin: 0 }}>Core Stack</h4>
                          <div className="flex flex-wrap gap-1">
                            {(getSkillsString(resumeData.skills)).split(',').map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-cyan-50 text-cyan-800 text-[7px] font-bold rounded-md">{s.trim()}</span>
                            ))}
                          </div>
                        </div>
                        {resumeData.certifications && (
                          <div className="space-y-1">
                            <h4 className="text-[9px] font-black uppercase text-cyan-800" style={{ margin: 0 }}>Credentials</h4>
                            <p className="text-slate-600 text-[8px]" style={{ margin: 0 }}>{resumeData.certifications}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Right core panel */}
                    <div className="w-2/3 space-y-4">
                      {resumeData.objective && (
                        <div className="space-y-1 border-l-2 border-cyan-500 pl-2">
                          <h3 className="text-[9px] font-bold uppercase text-slate-800" style={{ margin: 0 }}>About Me</h3>
                          <p className="text-slate-600" style={{ margin: 0 }}>{resumeData.objective}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold uppercase text-slate-800" style={{ margin: 0 }}>Professional Journey</h3>
                        {(resumeData.experience || []).map((exp, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span>{exp.company} · {exp.role}</span>
                              <span className="text-[8px] font-normal text-slate-400">{exp.duration}</span>
                            </div>
                            <p className="text-slate-600" style={{ margin: 0 }}>{exp.description}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold uppercase text-slate-800" style={{ margin: 0 }}>Signature Projects</h3>
                        {(resumeData.projects || []).map((proj, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="font-bold text-slate-700">{proj.title}</div>
                            <p className="text-slate-600" style={{ margin: 0 }}>{proj.description}</p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold uppercase text-slate-800" style={{ margin: 0 }}>Education</h3>
                        {(resumeData.education || []).map((edu, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="font-bold text-slate-700">{edu.school}</div>
                            <p className="text-slate-600" style={{ margin: 0 }}>{edu.degree} · {edu.year}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. TRADITIONAL PROFESSIONAL TEMPLATE */}
                {activeTemplate === 'professional' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-1">
                      <h2 className="text-base font-extrabold uppercase text-slate-900 tracking-wide" style={{ margin: 0 }}>{resumeData.fullName}</h2>
                      <p className="text-slate-500 font-bold" style={{ margin: 0 }}>
                        {resumeData.address} · {resumeData.phone} · {resumeData.email}
                      </p>
                      <p className="text-slate-400" style={{ margin: 0 }}>
                        {resumeData.linkedin} | {resumeData.github}
                      </p>
                    </div>
                    {resumeData.objective && (
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-bold uppercase border-b border-slate-900 pb-0.5 text-slate-800" style={{ margin: 0 }}>Objective</h3>
                        <p className="text-slate-700 text-justify" style={{ margin: 0 }}>{resumeData.objective}</p>
                      </div>
                    )}
                    <div className="space-y-2.5">
                      <h3 className="text-[10px] font-bold uppercase border-b border-slate-900 pb-0.5 text-slate-800" style={{ margin: 0 }}>Professional Experience</h3>
                      {(resumeData.experience || []).map((exp, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{exp.company} — {exp.role}</span>
                            <span>{exp.duration}</span>
                          </div>
                          <p className="text-slate-700 text-justify" style={{ margin: 0 }}>{exp.description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      <h3 className="text-[10px] font-bold uppercase border-b border-slate-900 pb-0.5 text-slate-800" style={{ margin: 0 }}>Academic History</h3>
                      {(resumeData.education || []).map((edu, idx) => (
                        <div key={idx} className="flex justify-between font-bold text-slate-800">
                          <span>{edu.school} — {edu.degree}</span>
                          <span>{edu.year}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-[10px] font-bold uppercase border-b border-slate-900 pb-0.5 text-slate-800" style={{ margin: 0 }}>Technical Skills</h3>
                      <p className="text-slate-700" style={{ margin: 0 }}>{getSkillsString(resumeData.skills)}</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: AI ANALYZER & INTERACTIVE CHATTER (3 Columns) */}
          <div className="lg:col-span-3 flex flex-col bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden no-print min-h-[500px] lg:min-h-0 lg:h-full">
            
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 shrink-0">
              🔮 AI Assistant Suite
            </h3>

            {/* SUITE NAVIGATION TAB SWITCHER (SCROLLABLE CHIPS) */}
            <div 
              className="flex gap-2 border-b border-white/5 pb-2.5 mb-3 overflow-x-auto shrink-0 scrollbar-none"
              style={{ whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}
            >
              {[
                { id: 'ats', label: 'ATS Score' },
                { id: 'matching', label: 'Job Matching' },
                { id: 'coverletter', label: 'Cover Letter' },
                { id: 'interview', label: 'Interview' }
              ].map(panel => {
                const isActive = activePanel === panel.id;
                return (
                  <button
                    key={panel.id}
                    onClick={() => setActivePanel(panel.id)}
                    className="py-1 px-3.5 rounded-full text-[9px] font-extrabold uppercase border cursor-pointer text-center transition-all shrink-0"
                    style={{
                      background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                      color: isActive ? '#06B6D4' : '#64748B',
                      borderColor: isActive ? 'rgba(6, 182, 212, 0.35)' : 'rgba(255,255,255,0.08)'
                    }}
                  >
                    {panel.label}
                  </button>
                );
              })}
            </div>

            {/* SUITE CONTENT AREA */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-4">
              
              {/* ATS SCORE & OPTIMIZER PANELS */}
              {activePanel === 'ats' && (
                <div className="space-y-4">
                  {/* ATS Compatibility score widget */}
                  <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl text-center space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ATS Match Score</span>
                    
                    {/* Circle Score Meter */}
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center rounded-full border-4 border-slate-800 bg-slate-900 shadow-2xl">
                      <div className="text-center">
                        <span className="text-2xl font-black text-cyan-400">{atsScore}</span>
                        <span className="text-[9px] font-bold text-slate-500 block">/100</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2.5">
                      <div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Resume Score</span>
                        <span className="text-xs font-black text-white">{resumeScore}%</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Grammar & Writing</span>
                        <span className="text-xs font-black text-white">{atsAnalysis?.writingScore || 85}%</span>
                      </div>
                    </div>

                    <button
                      onClick={handleAnalyzeResume}
                      disabled={loading}
                      className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition-all border-none"
                    >
                      {loading ? 'Analyzing...' : '🔄 Run Detailed ATS Scan'}
                    </button>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-3.5">
                    {/* Missing Skills Analysis Table */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wider">⚠️ Missing Skills Analysis</span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Estimated +25 pts Max</span>
                      </div>
                      
                      <div className="bg-slate-950/60 border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
                        {MISSING_SKILLS_LIST.map((item, i) => {
                          const skillsStr = getSkillsString(resumeData.skills);
                          const isAdded = skillsStr.toLowerCase().includes(item.name.toLowerCase());
                          return (
                            <div key={i} className="p-2 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-white">{item.name}</span>
                                <span className="text-[8px] text-slate-500">{item.focus}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] text-green-400 font-extrabold">+{item.impact} pts</span>
                                {isAdded ? (
                                  <span className="text-[9px] text-green-500 font-extrabold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">✓ Added</span>
                                ) : (
                                  <button
                                    onClick={() => handleOpenSkillModal(item)}
                                    className="px-2 py-0.5 bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-black uppercase rounded cursor-pointer border-none"
                                  >
                                    Add Skill
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Optimization Tips */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">💡 ATS Optimization Tips</span>
                      <ul className="list-disc list-inside text-[9px] text-slate-400 space-y-1 pl-1">
                        {atsAnalysis?.formattingTips?.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* JOB MATCHING PANEL */}
              {activePanel === 'matching' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Paste target Job Description</label>
                    <textarea
                      rows={4}
                      placeholder="Paste the details of the job listing you are applying for..."
                      value={jobDescription}
                      onChange={e => setJobDescription(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-violet-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleJobMatch}
                    disabled={loading || !jobDescription.trim()}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all border-none"
                  >
                    {loading ? 'Comparing...' : '🎯 Calculate Job Match %'}
                  </button>

                  {jobMatch && (
                    <div className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Match Compatibility</span>
                        <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-xs rounded-md">{jobMatch.matchPercentage}%</span>
                      </div>

                      {/* Missing Keywords */}
                      {jobMatch.missingKeywords?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">❌ Missing ATS Keywords</span>
                          <div className="flex flex-wrap gap-1">
                            {jobMatch.missingKeywords.map((kw, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] rounded-md">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestions list */}
                      {jobMatch.suggestions?.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">📌 Custom Recommendations</span>
                          <ul className="list-disc list-inside text-[9px] text-slate-400 space-y-1">
                            {jobMatch.suggestions.map((sug, i) => (
                              <li key={i}>{sug}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* COVER LETTER PANEL */}
              {activePanel === 'coverletter' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Google"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Position</label>
                      <input
                        type="text"
                        placeholder="e.g. Senior Frontend Developer"
                        value={positionName}
                        onChange={e => setPositionName(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateCoverLetter}
                    disabled={loading}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all border-none"
                  >
                    {loading ? 'Writing...' : '✍️ Generate Cover Letter'}
                  </button>

                  {coverLetter && (
                    <div className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Generated Cover Letter</span>
                      <textarea
                        readOnly
                        rows={8}
                        value={coverLetter}
                        className="w-full bg-slate-950 border border-white/5 rounded-lg p-2 text-[9px] text-slate-300 font-mono outline-none resize-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coverLetter);
                          triggerNotification('📋 Copied to clipboard!');
                        }}
                        className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-bold uppercase rounded-lg border-none cursor-pointer"
                      >
                        Copy Letter Text
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* INTERVIEW PREP PANEL */}
              {activePanel === 'interview' && (
                <div className="space-y-4">
                  <span className="text-[10px] text-slate-400 block leading-relaxed">
                    AI analyzes your experience fields and skills to generate potential technical, HR, and behavioral questions with suggested answers.
                  </span>

                  <button
                    onClick={handleGenerateInterviewPrep}
                    disabled={loading}
                    className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all border-none"
                  >
                    {loading ? 'Preparing Questions...' : '🎤 Generate Prep Questions'}
                  </button>

                  {interviewPrep.length > 0 && (
                    <div className="space-y-3.5">
                      {interviewPrep.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center border-b border-white/5 pb-1">
                            <span className="text-[9px] font-bold uppercase text-slate-500">Question {idx + 1}</span>
                            <span className="px-1.5 py-0.2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[7px] font-bold rounded">{item.type}</span>
                          </div>
                          <p className="text-[10px] font-bold text-white leading-normal" style={{ margin: 0 }}>Q: {item.question}</p>
                          <p className="text-[9px] text-slate-400 leading-relaxed" style={{ margin: 0 }}><span className="font-bold text-slate-500">Ans:</span> {item.answer}</p>
                          <p className="text-[8px] text-cyan-400/80 italic leading-relaxed" style={{ margin: 0 }}><span className="font-bold text-cyan-500/90">Prep Tip:</span> {item.tips}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

      </div>

      {/* 1b. RECOMMENDATION & ADD SKILL MODAL */}
      {skillModalOpen && selectedSkill && (
        <div className="fixed inset-0 bg-[#060814]/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 no-print animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            {/* STEP 1: SELECT PROFICIENCY & YEARS OF EXPERIENCE */}
            {!showSuccessStep ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block">Recommended Missing Skill</span>
                    <h3 className="text-base font-black text-white">{selectedSkill.name} <span className="text-xs font-normal text-slate-400">({selectedSkill.focus})</span></h3>
                  </div>
                  <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-xs rounded-md">
                    +{selectedSkill.impact} Points
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Why is this recommended?</span>
                  <ul className="list-disc list-inside text-[9px] text-slate-400 space-y-1">
                    <li>Frequently required for AI and Machine Learning roles.</li>
                    <li>Mentioned in target job description benchmarks.</li>
                    <li>Improves overall ATS formatting & density.</li>
                  </ul>
                  <div className="flex items-center gap-1.5 text-[9px] pt-1">
                    <span className="text-slate-500 font-bold">Current Status:</span>
                    <span className="text-red-400 font-black">❌ Not Found</span>
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/5 pt-3">
                  {/* Select Proficiency */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Your Proficiency</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Beginner', 'Intermediate', 'Advanced'].map(p => (
                        <button
                          key={p}
                          onClick={() => setProficiency(p)}
                          className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                            proficiency === p ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Years of Experience */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                      <span>Years of Experience</span>
                      <span className="text-white">{experienceYears} Years</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={experienceYears}
                      onChange={e => setExperienceYears(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                    />
                    <div className="flex justify-between text-[8px] text-slate-600 font-bold">
                      <span>0 Years</span>
                      <span>10 Years</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 border-t border-white/5 pt-4">
                  <button
                    onClick={handleCloseSkillModal}
                    className="flex-1 py-2 bg-slate-950 border border-white/5 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSkillToResume}
                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all border-none"
                  >
                    Add to Resume
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: SUCCESS DIALOG & AI ENHANCEMENT OFFER */
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xl mx-auto">
                    ✓
                  </div>
                  <span className="text-[9px] font-black text-green-400 uppercase tracking-widest block">Skill Added Successfully</span>
                  <h3 className="text-sm font-black text-white">✅ {selectedSkill.name} has been added to your Skills section.</h3>
                </div>

                <div className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center">Score Improvements</span>
                  <div className="grid grid-cols-2 gap-2 text-center divide-x divide-white/5">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Resume Score</span>
                      <span className="text-xs font-black text-white">82 → 88</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">ATS Score</span>
                      <span className="text-xs font-black text-white">74 → 81</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-violet-600/10 border border-violet-500/20 rounded-xl space-y-2 text-center">
                  <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">🤖 AI Resume Enhancer</span>
                  <p className="text-[10px] text-slate-300 leading-normal" style={{ margin: 0 }}>
                    Would you like AI to improve your resume using this skill?
                  </p>
                  <ul className="text-[8px] text-slate-400 space-y-0.5 text-left inline-block">
                    <li>· Add references to project descriptions</li>
                    <li>· Enhance your work experience achievements</li>
                    <li>· Insert relevant keyword pairings</li>
                  </ul>
                  
                  <div className="flex gap-2.5 pt-2">
                    <button
                      onClick={handleCloseSkillModal}
                      className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 rounded-lg text-[9px] font-black uppercase cursor-pointer"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleAiImproveResume()}
                      className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[9px] font-black uppercase cursor-pointer border-none"
                    >
                      Yes, Improve Resume
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERSISTENT STICKY MOBILE DOWNLOAD ACTION BUTTON */}
      <div className="block md:hidden fixed bottom-4 left-4 right-4 z-[999] no-print">
        <button
          onClick={handlePrintPDF}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
            color: '#FFFFFF',
            borderRadius: '16px',
            border: 'none',
            fontSize: '11px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45), 0 0 1px rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          📥 Download PDF
        </button>
      </div>
    </div>

    {/* 1c. RESUME STYLE SELECTION & ACTIONS MODAL */}
    {generationModalOpen && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        animation: 'backdropFadeIn 0.25s ease-out forwards',
      }}>
        <div style={{
          background: 'var(--sidebar-bg, #0B0F19)',
          border: '1.5px solid var(--sidebar-border, rgba(255, 255, 255, 0.08))',
          borderRadius: '24px',
          padding: '32px 28px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.05)',
          position: 'relative',
          animation: 'modalFadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <button
            onClick={() => setGenerationModalOpen(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>

          {generationModalStep === 1 ? (
            <div className="space-y-5 text-center">
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>✨</span>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 800, 
                color: '#FFFFFF', 
                margin: '0 0 6px 0',
                fontFamily: 'Inter, sans-serif'
              }}>
                Choose Resume Style
              </h3>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--muted-color, #9CA3AF)', 
                margin: '0 0 20px 0',
                lineHeight: '1.5'
              }}>
                Select the template style you would like to generate for your resume:
              </p>

              {/* Style Choice Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { id: 'modern', label: 'Modern', icon: '💼', desc: 'Elegant & professional' },
                  { id: 'minimal', label: 'Minimalist', icon: '📝', desc: 'Clean text style' },
                  { id: 'creative', label: 'Creative', icon: '🎨', desc: 'Double-column layout' },
                  { id: 'professional', label: 'Executive', icon: '🎖️', desc: 'Traditional classic' }
                ].map(t => {
                  const isSel = chosenStyle === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setChosenStyle(t.id)}
                      className="p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between h-[76px]"
                      style={{
                        background: isSel ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255,255,255,0.02)',
                        borderColor: isSel ? '#7C3AED' : 'rgba(255,255,255,0.06)',
                        boxShadow: isSel ? '0 4px 12px rgba(124, 58, 237, 0.1)' : 'none'
                      }}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm">{t.icon}</span>
                        {isSel && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold text-white block uppercase tracking-wider">{t.label}</span>
                        <span className="text-[8px] text-slate-500 block truncate mt-0.5" style={{ color: isSel ? '#A78BFA' : '#64748B' }}>{t.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={async () => {
                  setActiveTemplate(chosenStyle);
                  await handleEnhanceResume(chosenStyle);
                  setGenerationModalStep(2);
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? '⚡ Generating...' : '⚡ Generate Resume'}
              </button>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <div style={{
                width: '56px',
                height: '56px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 12px auto'
              }}>
                ✓
              </div>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 800, 
                color: '#FFFFFF', 
                margin: '0 0 6px 0',
                fontFamily: 'Inter, sans-serif'
              }}>
                Resume Generated!
              </h3>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--muted-color, #9CA3AF)', 
                margin: '0 0 24px 0',
                lineHeight: '1.5'
              }}>
                Your resume has been successfully generated in the <strong className="text-violet-400 capitalize">{chosenStyle}</strong> style. What would you like to do next?
              </p>

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <button
                  onClick={async () => {
                    setGenerationModalOpen(false);
                    await handleAnalyzeResume();
                    setActivePanel('ats');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(6, 182, 212, 0.3)',
                    background: 'rgba(6, 182, 212, 0.08)',
                    color: '#06B6D4',
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📊 Analyze
                </button>
                <button
                  onClick={() => {
                    setGenerationModalOpen(false);
                    handlePrintPDF();
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  📥 Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    <LimitModal
      isOpen={showLimitModal}
      onClose={() => setShowLimitModal(false)}
      {...getFeatureLimitDetails('resume')}
    />
  </div>
);
}
