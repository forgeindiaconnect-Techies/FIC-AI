// server/utils/detectIntent.js
/**
 * Simple intent detection based on keyword matching.
 * Returns one of: 'chat', 'image', 'poster', 'pdf', 'ppt', 'docx', 'excel', 'image_edit'
 */
function detectIntent(message) {
  if (!message) return 'chat';
  const lower = message.toLowerCase();
  const intents = [
    { type: 'pdf', keywords: ['create pdf', 'generate pdf', 'pdf for', 'pdf about'] },
    { type: 'ppt', keywords: ['create ppt', 'generate ppt', 'ppt about', 'ppt on'] },
    { type: 'docx', keywords: ['create word', 'generate word', 'word document', 'docx'] },
    { type: 'excel', keywords: ['create excel', 'generate excel', 'excel sheet', 'spreadsheet'] },
    { type: 'poster', keywords: ['poster', 'flyer', 'banner', 'advert'] },
    { type: 'image', keywords: ['image', 'picture', 'photo', 'draw', 'illustrate', 'generate image', 'cartoon'] },
    { type: 'image_edit', keywords: ['edit image', 'inpaint', 'mask', 'remove background'] },
  ];
  for (const intent of intents) {
    if (intent.keywords.some(k => lower.includes(k))) {
      return intent.type;
    }
  }
  return 'chat';
}
module.exports = { detectIntent };
