

// Update hiring fallback to use role-specific hero images
// In getFallbackPoster, modify the Hiring block (lines around 141-154) to incorporate role detection

// Existing code snippet replaced with role-aware logic:
// Original block:
//   } else if (categoryInfo.category === 'Hiring') {
//     // Tech hiring layout with hero illustration and skill badges
//     template = 'hiring';
//     backgroundPrompt = 'tech background with abstract circuit patterns, hero illustration of a professional, floating skill badges';
//     heading = categoryInfo.title;
// ...
//   }
// New block with role detection:
//   } else if (categoryInfo.category === 'Hiring') {
//     template = 'hiring';
//     const role = detectHiringRole(prompt);
//     // Default hero prompt
//     let heroPrompt = 'tech background with abstract circuit patterns, generic professional hero illustration, floating skill badges';
//     if (role === 'frontend') {
//       heroPrompt = 'modern office background with React code editor on laptop screen, frontend developer working, bright UI elements';
//     } else if (role === 'digital_marketing') {
//       heroPrompt = 'digital marketing workspace with analytics dashboard, social media icons, laptop displaying charts and campaigns';
//     } else if (role === 'hr') {
//       heroPrompt = 'HR interview scene with handshake, office desk, documents and coffee cup, friendly recruiter';
//     } else if (role === 'backend') {
//       heroPrompt = 'backend engineer at workstation with server racks, code terminal, API architecture diagrams';
//     } else if (role === 'fullstack') {
//       heroPrompt = 'full-stack developer juggling frontend UI on one screen and backend terminal on another, cohesive workspace';
//     } else if (role === 'data_engineer') {
//       heroPrompt = 'data engineer analyzing pipelines, big data visualizations, cloud storage icons and SQL queries on screen';
//     }
//     backgroundPrompt = heroPrompt;
//     heading = categoryInfo.title;
//     subheading = categoryInfo.subtitle || 'Join Our Creative Tech Team';
//     details = 'We are looking for top talent to drive innovative AI solutions.';
//     bullets = ['Competitive Salary', 'Growth Opportunities', 'Innovative Projects'];
//     contactInfo = 'careers@forgeindia.com | forgeindia.com';
//     cta = 'APPLY NOW';
//     colors = ['#090D1A', '#3B82F6', '#8B5CF6'];
//     typography = { primary: 'Montserrat', secondary: 'Inter' };
//     icons = ['Briefcase', 'Code', 'Star'];
//   }

// This replacement ensures role-specific hero images are generated for hiring posters.
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper: detect specific hiring role from prompt
export function detectHiringRole(prompt) {
  const lower = (prompt || '').toLowerCase();
  // Try to extract role after keywords like "hiring" or "for"
  const roleMatch = lower.match(/(?:hiring|looking for|need|recruit|join).*?([a-zA-Z0-9\s\-]+)\s?(developer|engineer|designer|marketer|marketing|hr|recruiter)?/);
  if (roleMatch) {
    const raw = roleMatch[1].trim();
    // Normalize common role keywords
    if (raw.includes('frontend') || raw.includes('react')) return 'frontend';
    if (raw.includes('digital') && raw.includes('marketing')) return 'digital_marketing';
    if (raw.includes('hr') || raw.includes('human resources') || raw.includes('recruiter')) return 'hr';
    if (raw.includes('backend') || raw.includes('node') || raw.includes('api')) return 'backend';
    if (raw.includes('fullstack') || raw.includes('full stack')) return 'fullstack';
    if (raw.includes('data') && raw.includes('engineer')) return 'data_engineer';
    // default fallback
    return raw.replace(/\s+/g, '_');
  }
  return null;
}

// Helper: parse hiring details from user prompt
function parseHiringDetails(prompt) {
  const result = {};
  const lines = prompt.split(/[\n;,.]/).map(l => l.trim()).filter(Boolean);
  const findField = (label) => {
    const regex = new RegExp(`${label}\s*[:=-]\s*([^;,.]+)`, 'i');
    for (const line of lines) {
      const m = line.match(regex);
      if (m) return m[1].trim();
    }
    return null;
  };
  result.jobTitle = findField('title') || findField('position') || null;
  const skillsStr = findField('skills') || findField('required skills') || null;
  result.skills = skillsStr ? skillsStr.split(/[\/,&]/).map(s => s.trim()).filter(Boolean) : [];
  result.experience = findField('experience') || null;
  const benefitsStr = findField('benefits') || findField('what we offer') || null;
  result.benefits = benefitsStr ? benefitsStr.split(/[\/,&]/).map(b => b.trim()).filter(Boolean) : [];
  result.location = findField('location') || null;
  result.cta = findField('cta') || 'APPLY NOW';
  return result;
}





  

  

import { computeComposition } from './compositionEngine.js';
import { detectCategoryAndTemplate, getHeuristicCategoryAndTemplate } from './categoryDetectionEngine.js';
import { selectTemplate } from './templateDefinitions.js';


export function sanitizeColor(color, defaultColor) {
  if (!color || typeof color !== 'string') return defaultColor;
  let trimmed = color.trim();
  if (trimmed.startsWith('#')) return trimmed;
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return '#' + trimmed;
  }
  return trimmed;
}

// Helper: robust JSON extraction from LLM response
export function parseJSON(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    return JSON.parse(text);
  } catch (err) {
    console.warn('[Poster AI Helper] JSON parsing failed, using fallback rules:', err.message);
    return null;
  }
}

// Poster Intent Detector
export function posterIntentDetector(prompt) {
  const lower = prompt.toLowerCase().trim();
  let intent = 'hiring'; // default fallback template type

  const hiringKeywords = ['hiring', 'job', 'vacancy', 'recruitment', 'developer', 'apply now', 'recruit'];
  const internshipKeywords = ['internship', 'intern', 'stipend', 'student'];
  const festivalKeywords = ['pongal', 'diwali', 'christmas', 'new year', 'festival', 'wishes', 'celebration', 'sankranti', 'harvest'];
  const birthdayKeywords = ['birthday', 'birth day', 'bday', 'happy birthday', 'anniversary', 'wedding', 'marriage', 'engagement', 'baby shower', 'graduation', 'farewell', 'retirement'];
  const eventKeywords = ['event', 'summit', 'conference', 'seminar', 'meetup', 'conclave', 'webinar'];
  const educationKeywords = ['course', 'training', 'workshop', 'class', 'learn', 'education', 'educational', 'academy'];
  const businessKeywords = ['sale', 'offer', 'discount', 'business', 'launch', 'promotion', 'marketing', 'corporate', 'branding'];
  const infographicKeywords = ['infographic', 'metric', 'chart', 'stats', 'architecture', 'workflow', 'diagram'];

  // Birthday/personal takes highest priority
  if (birthdayKeywords.some(k => lower.includes(k))) {
    intent = 'birthday';
  } else if (festivalKeywords.some(k => lower.includes(k))) {
    intent = 'festival';
  } else if (hiringKeywords.some(k => lower.includes(k))) {
    intent = 'hiring';
  } else if (internshipKeywords.some(k => lower.includes(k))) {
    intent = 'internship';
  } else if (eventKeywords.some(k => lower.includes(k))) {
    intent = 'event';
  } else if (educationKeywords.some(k => lower.includes(k))) {
    intent = 'education';
  } else if (businessKeywords.some(k => lower.includes(k))) {
    intent = 'business';
  } else if (infographicKeywords.some(k => lower.includes(k))) {
    intent = 'infographic';
  }

  console.log("Detected poster intent:", intent);
  return intent;
}

// Dynamic prompt enhancer
export function enhancePrompt(prompt, intent) {
  const lower = prompt.toLowerCase().trim();
  if (lower.includes('pongal')) {
    return 'Create a premium Pongal celebration poster with sugarcane, Pongal pot, kolam, warm festive lighting, traditional Tamil festival theme, elegant typography, yellow and orange festive palette, modern celebration poster design.';
  }
  if (lower.includes('diwali')) {
    return 'Create a premium Diwali celebration poster with bright diyas, sparkles, glowing lights, warm festive lighting, traditional Indian festival theme, elegant typography, gold and purple festive palette, modern celebration poster design.';
  }
  if (lower.includes('christmas')) {
    return 'Create a premium Christmas celebration poster with decorated Christmas tree, glowing snow particles, warm festive lighting, holiday theme, elegant typography, red and green festive palette, modern holiday poster design.';
  }
  if (lower.includes('birthday') || lower.includes('bday')) {
    return `Create a premium birthday celebration poster for ${prompt}, colorful balloons, birthday cake with candles, confetti, sparkles, festive party atmosphere, joyful typography, vibrant pink and gold palette, modern celebration design.`;
  }
  if (lower.includes('anniversary')) {
    return `Create a premium anniversary celebration poster for ${prompt}, romantic roses, golden rings, elegant champagne, soft bokeh lights, sophisticated typography, gold and champagne color palette.`;
  }
  if (lower.includes('graduation')) {
    return `Create a premium graduation celebration poster for ${prompt}, graduation cap and diploma, confetti, achievement theme, academic pride atmosphere, bold modern typography, navy and gold palette.`;
  }
  if (lower.includes('wedding')) {
    return `Create a premium wedding invitation poster for ${prompt}, elegant floral arrangements, romantic soft bokeh, luxurious gold accents, beautiful serif typography, white and gold palette.`;
  }

  if (intent === 'birthday') {
    return `Create a premium birthday celebration poster for ${prompt}, colorful balloons, confetti, birthday cake, sparkles, joyful festive party atmosphere, vibrant pastel and gold palette, modern premium design.`;
  }
  if (intent === 'festival') {
    return `Create a premium celebration wishes poster for ${prompt}, traditional festive theme, elegant typography, vibrant festive color palette, modern design, high quality.`;
  }
  if (intent === 'hiring') {
    return `Create a premium hiring recruitment poster for ${prompt}, modern tech startup theme, clean geometry, abstract lines, professional developer checklist, dark blue and cyan palette, high quality.`;
  }
  if (intent === 'internship') {
    return `Create a premium internship opportunity poster for ${prompt}, modern learning tech theme, clean geometry, stipend indicator, professional developer checklist, green and gold palette, high quality.`;
  }
  if (intent === 'event') {
    return `Create a premium tech conclave conference poster for ${prompt}, cybersecurity theme, date-time badge, guest speaker circles, map pin location details, modern indigo gradient, high quality.`;
  }
  if (intent === 'education') {
    return `Create a premium training course poster for ${prompt}, virtual learning theme, certification badge, curriculum list, clean tech background, high quality.`;
  }
  if (intent === 'business') {
    return `Create a premium business promotion poster for ${prompt}, commercial product launch theme, executive layout, discount details, thin border grids, navy and amber gold palette, high quality.`;
  }
  if (intent === 'infographic') {
    return `Create a premium tech infographic poster for ${prompt}, data-driven system architecture breakdown, metric visualization cards, statistics layout, high quality.`;
  }
  return `Create a premium high-quality poster for: ${prompt}.`;
}

// Fallback rule-based poster designer
export function getFallbackPoster(prompt, categoryInfo = null) {
  if (!categoryInfo) {
    categoryInfo = getHeuristicCategoryAndTemplate(prompt);
  }
  const lower = prompt.toLowerCase();

  let template = categoryInfo.template;
  let heading = categoryInfo.title;
  let subheading = categoryInfo.subtitle;
  let details = 'Celebrate this special moment with joy, love and unforgettable memories.';
  let bullets = [
    'Advanced composition framework',
    'AI-powered generation',
    'Custom branding elements'
  ];
  let contactInfo = 'careers@forgeindia.com | www.forgeindia.com';
  let cta = 'CELEBRATE';
  let colors = ['#090D1A', '#06B6D4', '#7C3AED'];
  let typography = { primary: 'Montserrat', secondary: 'Inter' };
  let icons = ['Briefcase', 'Code', 'Star'];
  let backgroundType = 'image';
  let backgroundPrompt = enhancePrompt(prompt, template);
  let overlayOpacity = 0.25;

  // ── Birthday / Personal Occasion ──────────────────────────────────────────
  if (categoryInfo.category === 'Birthday') {
    template = 'birthday';
    const isBday = lower.includes('birthday') || lower.includes('bday');
    const isAnniv = lower.includes('anniversary');
    const isGrad = lower.includes('graduation');
    const isWedding = lower.includes('wedding') || lower.includes('marriage');
    const isFarewell = lower.includes('farewell') || lower.includes('retirement');

    if (isAnniv) {
      heading = categoryInfo.title || 'HAPPY ANNIVERSARY';
      subheading = categoryInfo.subtitle || 'Celebrating Love & Togetherness';
      backgroundPrompt = 'romantic anniversary celebration background, red roses, golden rings, champagne glasses, soft bokeh lights, elegant warm atmosphere, no text';
      colors = ['#1A0520', '#D4AF37', '#E91E8C'];
      cta = 'CELEBRATE WITH US';
      bullets = ['Cherished Memories', 'Years of Love', 'Forever Together'];
    } else if (isGrad) {
      heading = categoryInfo.title || 'CONGRATULATIONS GRADUATE';
      subheading = categoryInfo.subtitle || 'Your Achievement Shines Bright';
      backgroundPrompt = 'graduation celebration background, graduation cap diploma confetti streamers, academic achievement, gold sparkles, navy blue sky, no text';
      colors = ['#0A1628', '#D4AF37', '#FFFFFF'];
      cta = 'CONGRATULATIONS';
      bullets = ['Academic Excellence', 'New Beginnings', 'Bright Future Ahead'];
    } else if (isWedding) {
      heading = categoryInfo.title || 'WEDDING CELEBRATION';
      subheading = categoryInfo.subtitle || 'Two Hearts, One Beautiful Journey';
      backgroundPrompt = 'elegant wedding celebration background, white floral arrangements, romantic bokeh lights, golden accents, rose petals, soft pink and gold, no text';
      colors = ['#2C1810', '#D4AF37', '#FAF0E6'];
      cta = 'JOIN THE CELEBRATION';
      bullets = ['Eternal Love', 'Beautiful Ceremony', 'Joyous Celebration'];
    } else if (isFarewell) {
      heading = categoryInfo.title || 'FAREWELL & BEST WISHES';
      subheading = categoryInfo.subtitle || 'Thank You for the Beautiful Journey';
      backgroundPrompt = 'farewell appreciation celebration background, golden confetti, soft bokeh lights, elegant warm sunset tones, appreciation theme, no text';
      colors = ['#1A1A2E', '#F59E0B', '#FFFFFF'];
      cta = 'BEST WISHES';
      bullets = ['Cherished Memories', 'Great Achievements', 'New Adventures Ahead'];
    } else {
      // Default birthday
      const nameMatch = prompt.match(/(?:birthday|bday)\s+(?:for|of|to)?\s*([a-zA-Z]+)/i);
      const name = nameMatch ? nameMatch[1] : null;
      heading = name ? `HAPPY BIRTHDAY ${name.toUpperCase()}` : (categoryInfo.title || 'HAPPY BIRTHDAY');
      subheading = categoryInfo.subtitle || 'Wishing You a Day Full of Magic & Joy';
      backgroundPrompt = 'birthday party celebration background, colorful balloons, birthday cake with glowing candles, confetti, sparkles, festive party atmosphere, vibrant pink gold purple, no text';
      colors = ['#2D0A4E', '#FF69B4', '#FFD700'];
      cta = 'MAKE A WISH';
      bullets = ['Joyful Celebrations', 'Wonderful Surprises', 'Beautiful Memories'];
    }
    contactInfo = 'With Love & Best Wishes';
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Sparkles', 'Heart', 'Star'];
  } else if (categoryInfo.category === 'Grand Opening') {
    // Luxury grand opening layout with gold frame and celebration elements
    template = 'business'; // maps to business layout
    backgroundPrompt = 'luxury gold frame, balloons, ribbons, confetti, soft glowing lights, elegant event style';
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Join Us for the Celebration';
    details = 'Celebrating our new location with exclusive launch events and welcome gifts.';
    // Remove cardsGrid and heroArea, content will float on background
    bullets = ['Inaugural Ribbon Cutting', 'Welcome Gifts', 'Meet the Founders'];
    contactInfo = 'info@forgeindia.com | forgeindia.com';
    cta = 'JOIN US';
    colors = ['#0A0A0A', '#D4AF37', '#E2E8F0'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Sparkles', 'Award', 'Users'];
  } else if (categoryInfo.category === 'Hiring') {
    // Role-aware hiring layout with hero illustration and parsed details
    template = 'hiring';
    const role = detectHiringRole(prompt);
    // Default hero prompt (used as full background)
    let heroPrompt = 'tech background with abstract circuit patterns, generic professional hero illustration, floating skill badges';
    if (role === 'frontend') {
      heroPrompt = 'modern office background with React code editor on laptop screen, frontend developer working, bright UI elements';
    } else if (role === 'digital_marketing') {
      heroPrompt = 'digital marketing workspace with analytics dashboard, social media icons, laptop displaying charts and campaigns';
    } else if (role === 'hr') {
      heroPrompt = 'HR interview scene with handshake, office desk, documents and coffee cup, friendly recruiter';
    } else if (role === 'backend') {
      heroPrompt = 'backend engineer at workstation with server racks, code terminal, API architecture diagrams';
    } else if (role === 'fullstack') {
      heroPrompt = 'full‑stack developer juggling frontend UI on one screen and backend terminal on another, cohesive workspace';
    } else if (role === 'data_engineer') {
      heroPrompt = 'data engineer analyzing pipelines, big data visualizations, cloud storage icons and SQL queries on screen';
    }
    backgroundPrompt = heroPrompt; // use as full background image
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Join Our Creative Tech Team';
    // Parse additional hiring details from prompt if available
    const hiringDetails = parseHiringDetails(prompt);
    details = hiringDetails.jobTitle ? `We are hiring a ${hiringDetails.jobTitle}.` : 'We are looking for top talent to drive innovative AI solutions.';
    const skillList = hiringDetails.skills && hiringDetails.skills.length ? hiringDetails.skills.join(', ') : null;
    bullets = [];
    if (skillList) bullets.push(`Required Skills: ${skillList}`);
    if (hiringDetails.experience) bullets.push(`Experience: ${hiringDetails.experience}`);
    if (hiringDetails.benefits && hiringDetails.benefits.length) bullets.push(`Benefits: ${hiringDetails.benefits.join(', ')}`);
    if (!bullets.length) bullets = ['Competitive Salary', 'Growth Opportunities', 'Innovative Projects'];
    contactInfo = 'careers@forgeindia.com | forgeindia.com';
    cta = hiringDetails.cta || 'APPLY NOW';
    colors = ['#090D1A', '#3B82F6', '#8B5CF6'];
    typography = { primary: 'Montserrat', secondary: 'Inter' };
    icons = ['Briefcase', 'Code', 'Star'];
    // No heroArea or cardsGrid, content floats on background
  } else if (categoryInfo.category === 'Restaurant') {
    // Premium restaurant layout with food hero image and warm palette
    template = 'business';
    backgroundPrompt = 'warm food hero image, elegant table setting, soft steam, rich gold and amber palette';
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Experience Premium Fine Dining';
    details = 'Enjoy culinary delights crafted by expert chefs in a cozy, elegant ambiance.';
    bullets = ['Signature Dishes', 'Fresh Local Ingredients', 'Premium Dining'];
    contactInfo = 'dining@forgeindia.com | forgeindia.com';
    cta = 'BOOK TABLE';
    colors = ['#1A120B', '#F97316', '#EF4444'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Heart', 'Star', 'Award'];
    // No content boxes, overlay only
  } else if (categoryInfo.category === 'Sale / Offer' || categoryInfo.category === 'Offer') {
    // Offer layout with big discount badge and product focus
    template = 'business';
    backgroundPrompt = 'big discount badge, product showcase, vibrant accent colors, sparkles and subtle glow';
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Limited Time Discount Deals';
    details = 'Claim exclusive flash discounts on premium services and AI tools today.';
    bullets = ['Up to 50% Off', 'Exclusive Discounts', 'Limited Stock'];
    contactInfo = 'sales@forgeindia.com | forgeindia.com';
    cta = 'CLAIM OFFER';
    colors = ['#0B0F19', '#F97316', '#EF4444'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['TrendingUp', 'Rocket', 'Award'];
  } else if (categoryInfo.category === 'Education' || categoryInfo.category === 'Training') {
    // Training/education layout with corporate learning theme
    template = 'education';
    backgroundPrompt = 'corporate learning theme, clean tech background, subtle grid lines, knowledge icons, soft blue glow';
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Master Premium Engineering Skills';
    details = 'Join our advanced training course to upskill in cutting‑edge AI technologies.';
    bullets = ['Hands‑on Labs', 'Expert Instructors', 'Certificate of Completion'];
    contactInfo = 'training@forgeindia.com | forgeindia.com';
    cta = 'ENROLL NOW';
    colors = ['#090D1A', '#3B82F6', '#10B981'];
    typography = { primary: 'Montserrat', secondary: 'Inter' };
    icons = ['Book', 'GraduationCap', 'Star'];
  } else if (categoryInfo.category === 'Real Estate') {
    // Real Estate template layout
    template = 'real_estate';
    backgroundPrompt = 'luxury real estate background, modern villa facade, elegant sunset view, golden hour lighting';
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Find Your Luxury Dream Home';
    details = 'Explore exclusive high-end residential listings designed for modern luxury living.';
    bullets = ['Premium Location', 'High-end Amenities', 'Double Gold Border'];
    contactInfo = 'realty@forgeindia.com | forgeindia.com';
    cta = 'VIEW DETAILS';
    colors = ['#0A0A0A', '#D4AF37', '#F5F2EB'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Home', 'Star', 'Award'];
  } else if (categoryInfo.category === 'Corporate') {
    // Existing corporate fallback (premium corporate poster)
    template = 'corporate';
    backgroundPrompt = enhancePrompt(prompt, template);
    heading = categoryInfo.title;
    subheading = categoryInfo.subtitle || 'Driving Premium Business Value';
    details = 'Scale operations and drive transformation with Forge India Connect solutions.';
    bullets = ['Enterprise Scalability', 'Advanced AI Analytics', 'Strategic Consulting'];
    contactInfo = 'sales@forgeindia.com | forgeindia.com';
    cta = 'GET STARTED';
    colors = ['#0B0F19', '#3B82F6', '#10B981'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Briefcase', 'Globe', 'Award'];
  } else if (template === 'festival') {
    heading = categoryInfo.title || 'HAPPY CELEBRATION';
    subheading = categoryInfo.subtitle || 'May Light & Prosperity Guide You';
    details = 'Wishing our wonderful team, partners, and clients a safe, joyous, and boundaryless celebration.';
    bullets = [
      'Spreading light, love, and happiness',
      'Celebrating success and new beginnings',
      'Grateful for our collaborative journey'
    ];
    contactInfo = 'Celebrate with FIC AI';
    cta = 'CELEBRATE';
    colors = ['#2A0815', '#FFD700', '#EF4444'];
    typography = { primary: 'Playfair Display', secondary: 'Montserrat' };
    icons = ['Sparkles', 'Star', 'Award'];

    if (lower.includes('pongal')) {
      heading = 'HAPPY PONGAL';
      subheading = 'Celebrate Harvest, Happiness & Prosperity';
      details = 'Wishing you and your family a traditional harvest season filled with abundance, joy and sweet moments.';
      bullets = [
        'Traditional Kolam & Festive Colors',
        'Sugarcanes & Harvest Blessings',
        'Sun Salutations & Rice Overflow'
      ];
      contactInfo = 'Wishing You a Joyful Pongal';
      cta = 'WISHING YOU A JOYFUL PONGAL';
      colors = ['#FFFDD0', '#FF8C00', '#2E7D32']; // cream, orange, green
      typography = { primary: 'Montserrat', secondary: 'Inter' };
      icons = ['Sparkles', 'Star', 'Award'];
    } else if (lower.includes('diwali')) {
      heading = 'HAPPY DIWALI';
      subheading = 'May the Festival of Lights Bring Prosperity';
      details = 'Wishing you and your family a bright, prosperous, and joyful Diwali filled with love, laughter, and light.';
      bullets = [
        'Festival of Lights & Joy',
        'Prosperity & Sweet Celebrations',
        'Subtle Diyas & Glowing Sparkles'
      ];
      cta = 'HAPPY DIWALI';
      colors = ['#1E0F2E', '#FFD700', '#F97316'];
    } else if (lower.includes('christmas')) {
      heading = 'MERRY CHRISTMAS';
      subheading = 'Joy, Peace & Celebration';
      details = 'Wishing you a season filled with sweet moments, cozy warmth, and the joy of sharing with family and friends.';
      bullets = [
        'Spreading Joy & Happiness',
        'Warm Holiday Blessings',
        'A Bright & Peaceful Season'
      ];
      cta = 'MERRY CHRISTMAS';
      colors = ['#1C0A0A', '#EF4444', '#10B981'];
    }
  } else if (template === 'internship') {
    heading = categoryInfo.title || 'INTERN INITIATIVE';
    subheading = categoryInfo.subtitle || 'Software Engineering Intern';
    details = 'Gain hands-on professional mentorship, build real products, and jumpstart your career in tech.';
    bullets = [
      'Paid monthly stipend with certificates',
      'One-on-one professional mentorship',
      'Potential full-time conversion opportunities'
    ];
    contactInfo = 'internships@forgeindia.com';
    cta = 'START INTERNSHIP';
    colors = ['#022C22', '#10B981', '#F59E0B'];
    typography = { primary: 'Poppins', secondary: 'Inter' };
    icons = ['GraduationCap', 'Code', 'Sparkles'];
  } else if (template === 'event') {
    heading = categoryInfo.title || 'FIC TECH SUMMIT 2026';
    subheading = categoryInfo.subtitle || 'Unlocking Intelligent Solutions';
    details = 'Join us for a day of inspiring tech talks, product showcases, and interactive developer workshops.';
    bullets = [
      'Keynote: Future of Agentic Coding',
      'Date: October 25, 2026 at 6:00 PM',
      'Venue: FIC Innovation Conference Center'
    ];
    contactInfo = 'events@forgeindia.com';
    cta = 'REGISTER NOW';
    colors = ['#1E1B4B', '#A855F7', '#F43F5E'];
    typography = { primary: 'Montserrat', secondary: 'Poppins' };
    icons = ['Calendar', 'MapPin', 'User'];
  } else if (template === 'education') {
    heading = categoryInfo.title || 'ADVANCED COURSE';
    subheading = categoryInfo.subtitle || 'Master Modern Engineering Patterns';
    details = 'Join our comprehensive, hands-on training program designed by industry professionals at Forge India Connect.';
    bullets = [
      'Interactive hands-on sandbox labs',
      'Expert instructor feedback & QA',
      'Professional certification on completion'
    ];
    contactInfo = 'education@forgeindia.com | forgeindia.com';
    cta = 'ENROLL NOW';
    colors = ['#0B0F19', '#3B82F6', '#10B981'];
    typography = { primary: 'Montserrat', secondary: 'Inter' };
    icons = ['GraduationCap', 'Calendar', 'Award'];
  } else if (template === 'infographic') {
    heading = categoryInfo.title || 'AI POSTER WORKFLOW';
    subheading = categoryInfo.subtitle || 'FIC ENGINE COMMUNICATIONS ARCHITECTURE';
    details = 'A clean infographic diagram visualizing data transmission, prompt enhancement pipelines, and dynamic Fabric.js layers.';
    bullets = [
      'React / Fabric.js Canvas UI Engine',
      'Node.js AI Prompt Enhancer API',
      'Image Background Generator Integration'
    ];
    contactInfo = 'FIC AI Systems Architecture';
    cta = 'EXPLORE STACK';
    colors = ['#0B0F19', '#F97316', '#3B82F6'];
    typography = { primary: 'Bebas Neue', secondary: 'Inter' };
    icons = ['Code', 'TrendingUp', 'Info'];
  }

  // Parse specific details if mentioned in prompt (mostly for Hiring MERN Developer)
  const matchRole = prompt.match(/for\s+([a-zA-Z0-9\s\-]+)/i);
  if (matchRole && template === 'mernhiring') {
    subheading = `Join as ${matchRole[1].trim()}`;
  }

  return {
    heading,
    subheading,
    details,
    bullets,
    contactInfo,
    cta,
    template,
    colors,
    typography,
    icons,
    backgroundType,
    backgroundPrompt,
    overlayOpacity
  };
}

// Main logic to generate poster metadata from prompt
export async function generatePosterMetadata(prompt) {
  const categoryInfo = await detectCategoryAndTemplate(prompt);
  console.log("[Poster API Helper] Detected category details:", categoryInfo);

  const intent = categoryInfo.template;
  const enhancedPrompt = enhancePrompt(prompt, intent);
  console.log("Detected poster intent:", intent);
  console.log("Enhanced prompt:", enhancedPrompt);

  const systemPrompt = `You are a professional graphic designer and Creative Director AI creating premium Canva Pro-quality marketing posters with rich, detailed copywriter-grade text content.
Analyze the user's prompt and return a structured design plan in strict JSON format.
Follow these guidelines to provide rich, comprehensive text content (like a high-quality ChatGPT response):
1. "title": Generate a specific, premium business headline/title. NEVER use generic placeholder words like "POSTER", "FLYER", "ADVERTISING", or "AD". Make it a real catchy marketing headline.
2. "subtitle": A compelling supporting copy/subtitle. Must be a rich, descriptive tagline outlining the main value proposition in a highly informative way.
3. "cta": Action text, e.g. REGISTER NOW, CLAIM OFFER, BOOK TABLE, APPLY NOW.
4. "date": Date, time, location or event details if any (or relevant placeholder).
5. "footer": Contact info, email, website or footer text.
6. "skills": Provide exactly 3 to 5 highly descriptive bullet points or highlights. Do NOT use short 1-word tags like "React". Instead, write detailed, informative marketing highlights (e.g., "Full-Stack Development with React & Node", "Advanced Database Integration via MongoDB", "Scalable Enterprise REST API Design").
7. "features": Provide exactly 3 to 6 distinct, highly descriptive feature cards. Do not use generic placeholders. Each feature object must have:
   - "title": A short feature header (2-4 words)
   - "desc": Premium detail copy explaining the feature. Must be a complete, high-quality, descriptive sentence that gives concrete details (ChatGPT-range depth).
   - "icon": A matching icon keyword from this set: code, briefcase, award, star, rocket, calendar, graduationcap, shield, users, trendingup, home, building, light, check, info, globe, target, chart, lock, wrench, gears, heart, sparkles, bell

Output ONLY a valid JSON object matching the schema. No markdown wrapping, no explanation.

JSON Schema:
{
  "category": "Detected category (must be one of: Grand Opening, Hiring, Restaurant, Sale / Offer, Education, Event, Festival, Healthcare, Real Estate, Product Launch, Birthday, Invitation)",
  "theme": "A creative design theme matching the category",
  "title": "Catchy specific headline/title (uppercase, 2-5 words, specific to prompt, no generic placeholders like 'GRAND OPENING POSTER')",
  "subtitle": "Compelling, detailed subtitle describing value proposition",
  "cta": "Action text, e.g. REGISTER NOW, CLAIM OFFER, BOOK TABLE, APPLY NOW",
  "date": "Date, time, location or event details if any (or relevant placeholder)",
  "footer": "Contact info, email, website or footer text",
  "colors": {
    "primary": "#hex_color",
    "accent": "#hex_color",
    "bg": "#hex_color",
    "text": "#hex_color"
  },
  "layout": {
    "titleAlign": "center or left",
    "titleSize": 75,
    "subtitleSize": 22,
    "heroAreaType": "image|photo|illustration|gradient",
    "ctaType": "rounded-glow"
  },
  "decorations": ["balloon", "sparkles", "ribbons", "confetti"],
  "skills": ["Detailed highlight bullet 1", "Detailed highlight bullet 2", "Detailed highlight bullet 3"],
  "features": [
    { "title": "Feature 1 Title", "desc": "Detailed sentence explaining feature 1 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 2 Title", "desc": "Detailed sentence explaining feature 2 with ChatGPT-range depth.", "icon": "icon_keyword" },
    { "title": "Feature 3 Title", "desc": "Detailed sentence explaining feature 3 with ChatGPT-range depth.", "icon": "icon_keyword" }
  ],
  "backgroundQuery": "A highly detailed descriptive prompt to generate the background image ONLY. Must NOT request any text in the image."
}`;

  let parsed = null;

  // ─── 1. Attempt Gemini with retries and model fallback ─────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const callGeminiModel = async (modelName) => {
      const maxRetries = 3;
      let attempt = 0;
      let delay = 500;
      while (attempt < maxRetries) {
        try {
          console.log(`[Poster API Helper] Calling Gemini model ${modelName}, attempt ${attempt + 1}`);
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              responseMimeType: 'application/json',
            },
          });
          const result = await model.generateContent([
            { text: systemPrompt + `\n\nPrompt: "${prompt}"` },
          ]);
          const response = await result.response;
          const aiText = response.text();
          const p = parseJSON(aiText);
          if (p && (p.title || p.heading || p.category)) {
            console.log('[Poster API Helper] Gemini parsed successful.');
            return p;
          }
          console.warn('[Poster API Helper] Gemini response could not be parsed.');
          return null;
        } catch (err) {
          const status = err?.response?.status;
          console.error(`[Poster API Helper] Gemini error (model ${modelName}, attempt ${attempt + 1}):`, err.message);
          if (status === 503 || !status) {
            attempt++;
            if (attempt < maxRetries) {
              await sleep(delay);
              delay *= 2;
              continue;
            }
          }
          break;
        }
      }
      return null;
    };

    parsed = await callGeminiModel(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
    if (!parsed) {
      console.log('[Poster API Helper] Falling back to gemini-2.5-flash...');
      parsed = await callGeminiModel('gemini-2.5-flash');
    }
  }

  // ─── 2. Attempt Groq ────────────────────────────────────────────────────────
  if (!parsed && process.env.GROQ_API_KEY) {
    try {
      console.log('[Poster API Helper] Calling Groq API...');
      const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const aiText = groqResponse.data?.choices?.[0]?.message?.content || '';
      const p = parseJSON(aiText);
      if (p && (p.title || p.heading || p.category)) {
        console.log('[Poster API Helper] Groq parsed successful.');
        parsed = p;
      }
    } catch (groqError) {
      console.error('[Poster API Helper] Groq failed, checking Ollama:', groqError.message);
    }
  }

  // ─── 3. Attempt Ollama ──────────────────────────────────────────────────────
  if (!parsed) {
    try {
      const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
      const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tinyllama';
      console.log(`[Poster API Helper] Calling Ollama (${OLLAMA_MODEL})...`);

      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: OLLAMA_MODEL,
        prompt: systemPrompt + `\n\nPrompt: "${prompt}"`,
        stream: false,
      }, { timeout: 30000 });

      const aiText = response.data?.response?.trim() || '';
      const p = parseJSON(aiText);
      if (p && (p.title || p.heading || p.category)) {
        console.log('[Poster API Helper] Ollama parsed successful.');
        parsed = p;
      }
    } catch (ollamaErr) {
      console.warn('[Poster API Helper] Ollama failed, falling back to heuristics:', ollamaErr.message);
    }
  }

  // ─── 4. Fallback if AI failed ───────────────────────────────────────────────
  if (!parsed) {
    console.log('[Poster API Helper] Returning rule-based fallback.');
    parsed = getFallbackPoster(prompt, categoryInfo);
  }

  // Choose a template randomly based on the detected or AI category
  const finalCategory = parsed.category || categoryInfo.category || "Grand Opening";
  const selectedTpl = selectTemplate(finalCategory);
  console.log(`[Poster API Helper] Randomly selected template: ${selectedTpl.id} for category ${finalCategory}`);

  // Merge the template layout, colors, and decorations
  const mergedLayout = { ...selectedTpl.layout, ...(parsed.layout || {}) };
  const mergedColors = { ...selectedTpl.colors, ...(parsed.colors || {}) };
  const mergedDecorations = [...new Set([...(selectedTpl.decorations || []), ...(parsed.decorations || [])])];

  // Guarantee Pollinations no-text instructions are appended
  let bgPrompt = parsed.backgroundPrompt || parsed.imagePrompt || selectedTpl.backgroundPrompt || `A premium poster background for ${finalCategory} ${parsed.title || parsed.heading}`;
  const textlessInstruction = "no text, no letters, no typography, empty space for title, premium poster background";
  if (!bgPrompt.toLowerCase().includes("no text")) {
    bgPrompt = `${bgPrompt}, ${textlessInstruction}`;
  }

  // Set overlay opacity for transparent background overlay (20-30%)
  const overlayOpacity = parsed.overlayOpacity || 0.25;

  // Build the strict output object
  const posterPlan = {
    category: finalCategory,
    theme: selectedTpl.id,
    title: (parsed.title || parsed.heading || categoryInfo.title || "EXCLUSIVE EVENT").toUpperCase(),
    subtitle: parsed.subtitle || parsed.subheading || categoryInfo.subtitle || "Experience Premium Luxury & Style",
    cta: (parsed.cta || parsed.CTA || "JOIN US NOW").toUpperCase(),
    date: parsed.date || parsed.details || "FIC Center • Join Us Today",
    footer: parsed.footer || parsed.contactInfo || "careers@forgeindia.com | www.forgeindia.com",
    colors: mergedColors,
    layout: mergedLayout,
    decorations: mergedDecorations,
    backgroundPrompt: bgPrompt,
    overlayOpacity,
    
    // Fallback/compatibility values
    heading: (parsed.title || parsed.heading || categoryInfo.title || "EXCLUSIVE EVENT").toUpperCase(),
    subheading: parsed.subtitle || parsed.subheading || categoryInfo.subtitle || "Experience Premium Luxury & Style",
    bullets: parsed.bullets || parsed.skills || [
      "Premium quality design assets",
      "Interactive customized layers",
      "High resolution canvas exports"
    ],
    features: parsed.features || [
      { title: "Premium Design", desc: "Crafted for maximum aesthetic appeal.", icon: "star" },
      { title: "Interactive Canvas", desc: "Easily modify titles, badges and CTAs.", icon: "code" },
      { title: "Vector Graphics", desc: "High resolution clean layouts.", icon: "award" }
    ],
    backgroundType: "image",
    backgroundImageUrl: null // will be resolved in route generator
  };

  return sanitizePosterJSON(posterPlan, prompt);
}


// Helper to calculate coordinates if they are missing
export function applyLayoutCoordinates(parsed, layoutType, primaryColor, accentColor, textColor) {
  parsed.canvas = { width: 1080, height: 1350 };

  if (!parsed.sections || !Array.isArray(parsed.sections)) {
    parsed.sections = [];
  }

  // If sections is empty, populate from parsed root fields
  if (parsed.sections.length === 0) {
    parsed.sections.push({
      type: 'logoPosition',
      text: parsed.logoPosition?.text || 'FIC SOLUTIONS',
      color: primaryColor
    });

    parsed.sections.push({
      type: 'heroTitle',
      text: parsed.posterTitle || parsed.title?.text || parsed.heading || 'WE ARE HIRING',
      highlightText: '',
      color: textColor,
      highlightColor: primaryColor,
      fontWeight: '900'
    });

    parsed.sections.push({
      type: 'subtitle',
      text: parsed.subtitle || parsed.subtitle?.text || parsed.subheading || 'Join Our Creative Tech Team',
      color: primaryColor
    });

    // Extract bullets/items into sidePanel
    const bulletTexts = parsed.bullets ? parsed.bullets.map(b => typeof b === 'string' ? b : (b.text || '')) : [];
    if (bulletTexts.length > 0) {
      parsed.sections.push({
        type: 'sidePanel',
        title: 'Requirements',
        items: bulletTexts
      });
    }

    // Extract cards into cardsGrid
    const cardsList = parsed.cards || [];
    if (cardsList.length > 0) {
      parsed.sections.push({
        type: 'cardsGrid',
        title: 'Core Features',
        cards: cardsList
      });
    }

    // Extract timeline items into timeline
    const timelineData = parsed.timeline?.items || parsed.timeline?.steps || [];
    if (timelineData.length > 0) {
      parsed.sections.push({
        type: 'timeline',
        title: parsed.timeline?.title || 'Our Process',
        steps: timelineData.map(step => ({ label: step.label || step.title || '', desc: step.desc || step.description || '' }))
      });
    }

    if (parsed.details?.text || parsed.details) {
      parsed.sections.push({
        type: 'details',
        text: typeof parsed.details === 'string' ? parsed.details : parsed.details.text,
        color: '#94A3B8'
      });
    }

    parsed.sections.push({
      type: 'ctaButton',
      text: parsed.CTA || parsed.ctaButton?.text || parsed.cta || 'APPLY NOW',
      color: accentColor,
      textColor: '#FFFFFF'
    });

    parsed.sections.push({
      type: 'footer',
      text: parsed.footerPosition?.text || parsed.contactInfo || 'careers@forgeindia.com',
      color: '#64748B'
    });
  }

  let sidePanelCount = 0;
  parsed.sections.forEach((sec) => {
    if (layoutType === 'infographic-roadmap') {
      if (sec.type === 'logoPosition') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 80;
        if (sec.width === undefined) sec.width = 150;
        if (sec.height === undefined) sec.height = 40;
      }
      else if (sec.type === 'heroTitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 150;
        if (sec.fontSize === undefined) sec.fontSize = 68;
        if (sec.fontWeight === undefined) sec.fontWeight = '900';
        if (sec.color === undefined) sec.color = textColor;
        if (sec.highlightColor === undefined) sec.highlightColor = primaryColor;
      }
      else if (sec.type === 'subtitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 270;
        if (sec.fontSize === undefined) sec.fontSize = 24;
        if (sec.color === undefined) sec.color = primaryColor;
      }
      else if (sec.type === 'sidePanel') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 350;
        if (sec.width === undefined) sec.width = 280;
        if (sec.height === undefined) sec.height = 700;
      }
      else if (sec.type === 'timeline') {
        if (sec.x === undefined) sec.x = 370;
        if (sec.y === undefined) sec.y = 350;
        if (sec.width === undefined) sec.width = 650;
        if (sec.height === undefined) sec.height = 700;
      }
      else if (sec.type === 'ctaButton') {
        if (sec.x === undefined) sec.x = 370;
        if (sec.y === undefined) sec.y = 1090;
        if (sec.width === undefined) sec.width = 280;
        if (sec.height === undefined) sec.height = 70;
        if (sec.color === undefined) sec.color = accentColor;
        if (sec.textColor === undefined) sec.textColor = '#FFFFFF';
      }
      else if (sec.type === 'footer') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 1220;
        if (sec.color === undefined) sec.color = '#64748B';
      }
    }
    else if (layoutType === 'hiring-poster') {
      if (sec.type === 'logoPosition') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 60;
      }
      else if (sec.type === 'heroTitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 120;
        if (sec.fontSize === undefined) sec.fontSize = 62;
      }
      else if (sec.type === 'subtitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 240;
      }
      else if (sec.type === 'cardsGrid') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 310;
        if (sec.width === undefined) sec.width = 880;
        if (sec.height === undefined) sec.height = 380;
        if (sec.columns === undefined) sec.columns = 2;
      }
      else if (sec.type === 'sidePanel') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 720;
        if (sec.width === undefined) sec.width = 880;
        if (sec.height === undefined) sec.height = 380;
      }
      else if (sec.type === 'ctaButton') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 1140;
        if (sec.width === undefined) sec.width = 280;
        if (sec.height === undefined) sec.height = 70;
      }
      else if (sec.type === 'footer') {
        if (sec.x === undefined) sec.x = 420;
        if (sec.y === undefined) sec.y = 1160;
      }
    }
    else if (layoutType === 'split-hero') {
      if (sec.type === 'logoPosition') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 80;
      }
      else if (sec.type === 'heroTitle') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 150;
        if (sec.fontSize === undefined) sec.fontSize = 58;
        if (sec.color === undefined) sec.color = textColor;
        if (sec.highlightColor === undefined) sec.highlightColor = primaryColor;
      }
      else if (sec.type === 'subtitle') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 270;
        if (sec.fontSize === undefined) sec.fontSize = 24;
        if (sec.color === undefined) sec.color = primaryColor;
      }
      else if (sec.type === 'sidePanel') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 350;
        if (sec.width === undefined) sec.width = 420;
        if (sec.height === undefined) sec.height = 500;
      }
      else if (sec.type === 'cardsGrid') {
        if (sec.x === undefined) sec.x = 580;
        if (sec.y === undefined) sec.y = 150;
        if (sec.width === undefined) sec.width = 440;
        if (sec.height === undefined) sec.height = 950;
        if (sec.columns === undefined) sec.columns = 1;
      }
      else if (sec.type === 'ctaButton') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 900;
        if (sec.width === undefined) sec.width = 280;
        if (sec.height === undefined) sec.height = 70;
      }
      else if (sec.type === 'footer') {
        if (sec.x === undefined) sec.x = 60;
        if (sec.y === undefined) sec.y = 1220;
      }
    }
    else if (layoutType === 'tech-course-poster') {
      if (sec.type === 'logoPosition') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 60;
      }
      else if (sec.type === 'heroTitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 120;
        if (sec.fontSize === undefined) sec.fontSize = 62;
      }
      else if (sec.type === 'subtitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 230;
      }
      else if (sec.type === 'cardsGrid') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 310;
        if (sec.width === undefined) sec.width = 880;
        if (sec.height === undefined) sec.height = 440;
        if (sec.columns === undefined) sec.columns = 3;
      }
      else if (sec.type === 'timeline') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 780;
        if (sec.width === undefined) sec.width = 880;
        if (sec.height === undefined) sec.height = 300;
      }
      else if (sec.type === 'ctaButton') {
        if (sec.x === undefined) sec.x = 415;
        if (sec.y === undefined) sec.y = 1120;
        if (sec.width === undefined) sec.width = 250;
        if (sec.height === undefined) sec.height = 70;
      }
      else if (sec.type === 'footer') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 1240;
      }
    }
    else {
      // premium-corporate-poster
      if (sec.type === 'logoPosition') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 80;
      }
      else if (sec.type === 'heroTitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 150;
        if (sec.fontSize === undefined) sec.fontSize = 62;
      }
      else if (sec.type === 'subtitle') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 270;
      }
      else if (sec.type === 'sidePanel') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 360;
        if (sec.width === undefined) sec.width = 400;
        if (sec.height === undefined) sec.height = 700;
      }
      else if (sec.type === 'cardsGrid') {
        if (sec.x === undefined) sec.x = 540;
        if (sec.y === undefined) sec.y = 360;
        if (sec.width === undefined) sec.width = 440;
        if (sec.height === undefined) sec.height = 700;
        if (sec.columns === undefined) sec.columns = 1;
      }
      else if (sec.type === 'ctaButton') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 1110;
        if (sec.width === undefined) sec.width = 280;
        if (sec.height === undefined) sec.height = 70;
      }
      else if (sec.type === 'footer') {
        if (sec.x === undefined) sec.x = 100;
        if (sec.y === undefined) sec.y = 1220;
      }
    }
  });

  // Ensure decorationElements card exists for split-hero layout
  if (layoutType === 'split-hero' && (!parsed.decorationElements || parsed.decorationElements.length === 0)) {
    parsed.decorationElements = [
      { type: 'card', x: 0, y: 0, width: 540, height: 1350, color: '#090D1A', opacity: 0.8 },
      { type: 'line', x: 538, y: 0, width: 4, height: 1350, color: primaryColor, opacity: 0.9 }
    ];
  }
}

export function sanitizePosterJSON(parsed, prompt = '') {
  // Ensure template is set
  if (!parsed.template) {
    let checkLType = parsed.layoutType || '';
    if (checkLType.includes('hiring') || checkLType.includes('split')) {
      parsed.template = 'hiring';
    } else if (checkLType.includes('course') || checkLType.includes('education')) {
      parsed.template = 'education';
    } else if (checkLType.includes('corporate') || checkLType.includes('business')) {
      parsed.template = 'business';
    } else {
      parsed.template = 'business';
    }
  }

  // 1. Normalize layoutType to one of the 5 allowed types
  let lType = parsed.layoutType || parsed.template || '';
  lType = lType.toLowerCase().trim();
  if (lType.includes('roadmap') || lType.includes('infographic-roadmap') || lType.includes('infographic')) {
    parsed.layoutType = 'infographic-roadmap';
  } else if (lType.includes('hiring') || lType.includes('recruit') || lType.includes('mernhiring') || lType.includes('internship')) {
    parsed.layoutType = 'hiring-poster';
  } else if (lType.includes('split')) {
    parsed.layoutType = 'split-hero';
  } else if (lType.includes('course') || lType.includes('education') || lType.includes('saas') || lType.includes('landing') || lType.includes('event')) {
    parsed.layoutType = 'tech-course-poster';
  } else if (lType.includes('corporate') || lType.includes('premium') || lType.includes('tech') || lType.includes('cyber') || lType.includes('futuristic') || lType.includes('business')) {
    parsed.layoutType = 'premium-corporate-poster';
  } else {
    parsed.layoutType = 'infographic-roadmap'; // fallback default
  }

  // Safety check: Never use hiring-poster layout for Grand Opening or non-hiring categories
  const categoryInfo = getHeuristicCategoryAndTemplate(prompt);
  if (categoryInfo.category === 'Grand Opening' || categoryInfo.category !== 'Hiring') {
    if (parsed.layoutType === 'hiring-poster' || parsed.layoutType === 'split-hero') {
      console.log(`[Poster API Helper] Safety override: changing layoutType from ${parsed.layoutType} to premium-corporate-poster for category: ${categoryInfo.category}`);
      parsed.layoutType = 'premium-corporate-poster';
    }
  }

  // 2. Map root-level keys
  parsed.posterTitle = parsed.posterTitle || parsed.heading || parsed.title?.text || 'Title';
  parsed.subtitle = parsed.subtitle || parsed.subtitle?.text || parsed.subheading || '';
  parsed.CTA = parsed.CTA || parsed.cta || parsed.ctaButton?.text || 'APPLY NOW';
  parsed.colorPalette = parsed.colorPalette || parsed.colors || ['#090D1A', '#00D4FF', '#8B5CF6'];
  parsed.fontPairing = parsed.fontPairing || parsed.typography || { primary: 'Poppins', secondary: 'Inter' };
  parsed.imagePrompt = parsed.imagePrompt || parsed.fluxPrompt || parsed.backgroundPrompt || `A premium background design for ${prompt}`;

  // 3. Make sure old structure keys also exist for backward compatibility
  parsed.heading = parsed.posterTitle;
  parsed.subheading = parsed.subtitle;
  parsed.cta = parsed.CTA;
  parsed.colors = parsed.colorPalette;
  parsed.typography = parsed.fontPairing;
  parsed.fluxPrompt = parsed.imagePrompt;
  parsed.backgroundPrompt = parsed.imagePrompt;

  // Cleanup title/heading for festival intents (e.g. Pongal, Diwali, etc.)
  const isPongal = prompt.toLowerCase().includes('pongal');
  const isDiwali = prompt.toLowerCase().includes('diwali');
  const isChristmas = prompt.toLowerCase().includes('christmas');
  const isNewYear = prompt.toLowerCase().includes('new year');
  const isFestival = isPongal || isDiwali || isChristmas || isNewYear || prompt.toLowerCase().includes('festival');

  if (isFestival) {
    parsed.template = 'festival';
    const lowerTitle = parsed.posterTitle.toLowerCase();
    if (lowerTitle.includes('hiring') || lowerTitle.includes('job') || lowerTitle.includes('vacancy')) {
      if (isPongal) parsed.posterTitle = 'HAPPY PONGAL';
      else if (isDiwali) parsed.posterTitle = 'HAPPY DIWALI';
      else if (isChristmas) parsed.posterTitle = 'MERRY CHRISTMAS';
      else parsed.posterTitle = 'HAPPY CELEBRATION';

      parsed.heading = parsed.posterTitle;
    }
  }

  if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
    parsed.bullets = ['Custom Design Layout', 'Editable Typography Fills', 'High-res Vector Exports'];
  }
  parsed.bullets = parsed.bullets.map(b => typeof b === 'string' ? { text: b } : b);

  if (!parsed.theme) {
    parsed.theme = {
      background: 'dark futuristic',
      primary: parsed.colorPalette?.[1] || '#00D4FF',
      accent: parsed.colorPalette?.[2] || '#8B5CF6',
      text: '#FFFFFF'
    };
  }

  if (!parsed.title || typeof parsed.title !== 'object') {
    parsed.title = { text: parsed.posterTitle };
  }
  if (!parsed.subtitle || typeof parsed.subtitle !== 'object') {
    parsed.subtitle = { text: parsed.subtitle };
  }
  if (!parsed.ctaButton || typeof parsed.ctaButton !== 'object') {
    parsed.ctaButton = { text: parsed.CTA };
  }
  if (!parsed.logoPosition || typeof parsed.logoPosition !== 'object') {
    parsed.logoPosition = { text: isFestival ? 'FIC FESTIVAL' : 'FIC SOLUTIONS' };
  }
  if (!parsed.footerPosition || typeof parsed.footerPosition !== 'object') {
    parsed.footerPosition = { text: parsed.contactInfo || 'careers@forgeindia.com' };
  }

  const c1 = sanitizeColor(parsed.theme.primary, '#00D4FF');
  const c2 = sanitizeColor(parsed.theme.accent, '#8B5CF6');
  const c3 = sanitizeColor(parsed.theme.text, '#FFFFFF');
  applyLayoutCoordinates(parsed, parsed.layoutType, c1, c2, c3);
  computeComposition(parsed);

  return parsed;
}
