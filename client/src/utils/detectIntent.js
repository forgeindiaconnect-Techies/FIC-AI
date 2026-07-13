// client/src/utils/detectIntent.js
// Detect the user's intent from a chat message. Returns one of:
// 'chat', 'image', 'poster', 'pdf', 'ppt', 'docx', 'excel', 'image_edit'

// ── Category keywords for auto-poster intent detection ─────────────────────
const POSTER_CATEGORY_KEYWORDS = [
  // Explicit poster words
  'poster', 'flyer', 'banner', 'advertisement', 'ad design',
  // Festival / Celebration
  'diwali', 'pongal', 'christmas', 'new year', 'eid', 'holi', 'navratri',
  'ugadi', 'sankranti', 'harvest', 'wishes poster', 'celebration poster',
  'birthday poster', 'anniversary poster', 'independence day poster',
  // Business / Hiring
  'hiring poster', 'job poster', 'vacancy poster', 'recruitment poster',
  'we are hiring', 'looking for developer',
  // Restaurant / Food
  'restaurant poster', 'food poster', 'menu poster', 'cafe poster',
  // Real Estate
  'real estate poster', 'property poster', 'apartment poster',
  // Grand Opening
  'grand opening poster', 'inauguration poster', 'launch poster',
  // Offer / Sale
  'sale poster', 'offer poster', 'discount poster', 'promotion poster',
  // Education
  'course poster', 'training poster', 'workshop poster',
];

export function detectIntent(message) {
  if (!message) return 'chat';
  const lower = message.toLowerCase();

  const intents = [
    { type: 'pdf',        keywords: ['create pdf', 'generate pdf', 'pdf for', 'pdf about', 'make pdf'] },
    { type: 'ppt',        keywords: ['create ppt', 'generate ppt', 'ppt about', 'ppt on', 'make ppt', 'presentation on', 'powerpoint'] },
    { type: 'docx',       keywords: ['create word', 'generate word', 'docx', 'word document', 'make word'] },
    { type: 'excel',      keywords: ['create excel', 'generate excel', 'excel sheet', 'spreadsheet', 'make excel'] },
    { type: 'image_edit', keywords: ['edit image', 'modify image', 'image edit', 'inpaint', 'remove background', 'mask image'] },
    { type: 'image',      keywords: ['create image', 'generate image', 'make image', 'cartoon', 'illustration', 'draw me', 'show me a picture'] },
    { type: 'poster',     keywords: POSTER_CATEGORY_KEYWORDS },
  ];

  for (const intent of intents) {
    if (intent.keywords.some(k => lower.includes(k))) {
      return intent.type;
    }
  }

  return 'chat';
}
