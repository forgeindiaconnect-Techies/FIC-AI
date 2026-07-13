// utils/markdownToTts.js
/**
 * Convert markdown to a TTS-friendly plain text script.
 * Strips code blocks, inline code, headers, formatting, tables, etc.
 * Truncates to maxLength characters, ending at a sentence boundary.
 *
 * @param {string} markdown - The markdown content.
 * @param {number} [maxLength=800] - Maximum length of output script.
 * @returns {string} Clean text suitable for TTS engines.
 */
export function markdownToTtsScript(markdown, maxLength = 800) {
  let text = markdown
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/`[^`]+`/g, '') // remove inline code
    .replace(/#{1,6}\s+/g, '\n') // headers to newlines
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/[-*+]\s+/g, '') // list markers
    .replace(/\d+\.\s+/g, '') // numbered list markers
    .replace(/\|.*\|/g, '') // table rows
    .replace(/\n{3,}/g, '\n\n') // collapse excess newlines
    .trim();

  if (text.length > maxLength) {
    const truncated = text.slice(0, maxLength);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    text = lastPeriod > maxLength * 0.6 ? truncated.slice(0, lastPeriod + 1) : truncated;
  }
  return text;
}
