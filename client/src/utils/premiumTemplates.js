// Central repository of five premium Canva‑style poster templates
export const PREMIUM_TEMPLATES = {
  "fullstack-infographic": {
    name: "Full Stack Developer Infographic",
    layoutType: "infographic-roadmap",
    colors: ["#0A1128", "#00FFFF", "#7C3AED"], // Midnight Cyber
    typography: { primary: "Poppins", secondary: "Inter" },
    sections: [
      { type: "heroTitle", text: "FULL STACK", highlightText: "DEVELOPER", x: 100, y: 150, fontSize: 68, highlightFontSize: 82, fontWeight: "900", color: "#FFFFFF", highlightColor: "#00FFFF" },
      { type: "subtitle", text: "From Front‑end to Back‑end Mastery", x: 100, y: 270, fontSize: 24, color: "#00FFFF" },
      { type: "sidePanel", title: "Prerequisites", items: ["HTML & CSS", "JavaScript Fundamentals", "React Basics", "Node.js Intro"], x: 60, y: 350, width: 280, height: 700 },
      { type: "timeline", title: "Learning Milestones", steps: [
          { label: "Phase 1: UI Foundations", desc: "HTML, CSS, Flexbox, Grid" },
          { label: "Phase 2: React & State", desc: "Hooks, Context, Redux" },
          { label: "Phase 3: Backend APIs", desc: "Express, MongoDB, Auth" },
          { label: "Phase 4: Deployment", desc: "Docker, CI/CD, Cloud" }
        ], x: 370, y: 350, width: 650, height: 700 },
      { type: "cardsGrid", title: "Core Skills", cards: [
          { title: "JS Mastery", desc: "Advanced ES2024 features", icon: "Code" },
          { title: "API Design", desc: "RESTful & GraphQL", icon: "Database" },
          { title: "UI/UX", desc: "Design systems & accessibility", icon: "Palette" }
        ], x: 370, y: 1060, width: 650, height: 250, columns: 3 },
      { type: "ctaButton", text: "ENROLL NOW", x: 370, y: 1330, width: 280, height: 70, color: "#7C3AED", textColor: "#FFFFFF" },
      { type: "footer", text: "education@forgeindia.com | www.forgeindia.com", x: 100, y: 1420, color: "#64748B" }
    ]
  },
  "hiring-poster": {
    name: "Premium Hiring Poster",
    layoutType: "hiring-poster",
    colors: ["#090D1A", "#06B6D4", "#7C3AED"], // Dark Navy + Cyan + Indigo
    typography: { primary: "Montserrat", secondary: "Inter" },
    sections: [
      { type: "heroTitle", text: "WE ARE", highlightText: "HIRING", x: 100, y: 120, fontSize: 62, highlightFontSize: 78, fontWeight: "900", color: "#FFFFFF", highlightColor: "#06B6D4" },
      { type: "subtitle", text: "MERN Full‑Stack Engineer", x: 100, y: 240, fontSize: 24, color: "#06B6D4" },
      { type: "cardsGrid", title: "Open Roles", cards: [
          { title: "Frontend Specialist", desc: "React, CSS‑in‑JS, Canvas APIs", icon: "Code" },
          { title: "Backend Architect", desc: "Node, Express, MongoDB, Scaling", icon: "Database" }
        ], x: 100, y: 310, width: 880, height: 380, columns: 2 },
      { type: "sidePanel", title: "What We Offer", items: ["Remote‑first", "Competitive salary", "Equity", "Learning budget"], x: 100, y: 720, width: 880, height: 380 },
      { type: "ctaButton", text: "APPLY NOW", x: 100, y: 1140, width: 280, height: 70, color: "#06B6D4", textColor: "#FFFFFF" },
      { type: "footer", text: "careers@forgeindia.com | www.forgeindia.com", x: 420, y: 1160, color: "#64748B" }
    ]
  },
  "course-poster": {
    name: "Technical Course / Training Poster",
    layoutType: "tech-course-poster",
    colors: ["#0B0F19", "#3B82F6", "#10B981"], // Slate + Tech Blue + Mint
    typography: { primary: "Poppins", secondary: "Inter" },
    sections: [
      { type: "heroTitle", text: "ADVANCED GRAPHICS", highlightText: "COURSE", x: 100, y: 120, fontSize: 62, highlightFontSize: 80, fontWeight: "900", color: "#FFFFFF", highlightColor: "#3B82F6" },
      { type: "subtitle", text: "Master Canvas API & AI‑driven Layouts", x: 100, y: 230, fontSize: 24, color: "#3B82F6" },
      { type: "cardsGrid", title: "Learning Perks", cards: [
          { title: "Interactive Labs", desc: "Sandboxed Fabric.js exercises", icon: "Code" },
          { title: "Expert Mentorship", desc: "Live Q&A with senior engineers", icon: "User" },
          { title: "Certification", desc: "Official Forge AI badge", icon: "Award" }
        ], x: 100, y: 310, width: 880, height: 440, columns: 3 },
      { type: "timeline", title: "Course Roadmap", steps: [
          { label: "Weeks 1‑2", desc: "Fabric.js Foundations" },
          { label: "Weeks 3‑4", desc: "AI‑enhanced Composition" },
          { label: "Weeks 5‑6", desc: "Export & Production" }
        ], x: 100, y: 780, width: 880, height: 300 },
      { type: "ctaButton", text: "ENROLL TODAY", x: 415, y: 1120, width: 250, height: 70, color: "#10B981", textColor: "#FFFFFF" },
      { type: "footer", text: "academy@forgeindia.com | www.forgeindia.com", x: 100, y: 1240, color: "#64748B" }
    ]
  },
  "festival-poster": {
    name: "Festival Celebration Poster",
    layoutType: "festival-poster",
    colors: ["#2E0854", "#FFD700", "#FF4500"], // Royal Purple, Gold, Orange
    typography: { primary: "Playfair Display", secondary: "Montserrat" },
    sections: [
      { type: "heroTitle", text: "HAPPY", highlightText: "DIWALI", x: 100, y: 150, fontSize: 68, highlightFontSize: 84, fontWeight: "900", color: "#FFFFFF", highlightColor: "#FFD700" },
      { type: "subtitle", text: "Celebrating Light & Innovation", x: 100, y: 270, fontSize: 24, color: "#FFD700" },
      { type: "sidePanel", title: "Festival Wishes", items: ["Prosperity", "Joy", "Togetherness"], x: 60, y: 350, width: 280, height: 700 },
      { type: "cardsGrid", title: "Highlights", cards: [
          { title: "Fireworks", desc: "Spectacular night sky", icon: "Sparkles" },
          { title: "Sweets", desc: "Traditional treats", icon: "Cake" },
          { title: "Family", desc: "Gatherings & love", icon: "Heart" }
        ], x: 370, y: 350, width: 650, height: 400, columns: 3 },
      { type: "ctaButton", text: "CELEBRATE WITH US", x: 370, y: 1330, width: 280, height: 70, color: "#FF4500", textColor: "#FFFFFF" },
      { type: "footer", text: "forgeindia.com | @forgeindia", x: 100, y: 1420, color: "#64748B" }
    ]
  },
  "business-promo-poster": {
    name: "Business Promotion Poster",
    layoutType: "premium-corporate-poster",
    colors: ["#0B0F19", "#D97706", "#E2E8F0"], // Midnight + Amber + Light Gray
    typography: { primary: "Playfair Display", secondary: "Montserrat" },
    sections: [
      { type: "heroTitle", text: "DRIVE", highlightText: "VALUE", x: 100, y: 150, fontSize: 62, highlightFontSize: 78, fontWeight: "900", color: "#FFFFFF", highlightColor: "#D97706" },
      { type: "subtitle", text: "Premium Solutions for Modern Enterprises", x: 100, y: 270, fontSize: 24, color: "#D97706" },
      { type: "sidePanel", title: "Key Benefits", items: ["Scalable Architecture", "AI‑powered Analytics", "24/7 Support"], x: 100, y: 360, width: 400, height: 700 },
      { type: "cardsGrid", title: "Our Services", cards: [
          { title: "Consulting", desc: "Strategic roadmap", icon: "Briefcase" },
          { title: "Platform", desc: "Custom SaaS solutions", icon: "Cloud" },
          { title: "Support", desc: "Dedicated C‑level assistance", icon: "Headset" }
        ], x: 540, y: 360, width: 440, height: 700, columns: 1 },
      { type: "ctaButton", text: "GET STARTED", x: 100, y: 1110, width: 280, height: 70, color: "#D97706", textColor: "#FFFFFF" },
      { type: "footer", text: "leadership@forgeindia.com | www.forgeindia.com", x: 100, y: 1220, color: "#64748B" }
    ]
  }
};
