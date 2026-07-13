// utils/voiceMap.js
/**
 * Get appropriate voice IDs for D-ID and HeyGen based on gender and language.
 * 
 * HeyGen Voice IDs are fetched from /v2/voices - real IDs confirmed from API:
 *   Tamil Female: f37bfc7d0be8494c8fa103a4a47eed33 (Pallavi - Natural)
 *   Tamil Male:   (fetched dynamically - fallback to Pallavi)
 *
 * D-ID uses Microsoft Azure Neural voices (no fetching required)
 *
 * @param {'male'|'female'} gender
 * @param {'english'|'tamil'} language
 * @returns {{ didVoiceId: string, heyGenVoiceId: string }}
 */
export function getVoiceIds(gender, language) {
  const lang = (language && language.toLowerCase()) ?? 'english';
  const rawGender = (gender || '').toLowerCase();
  const normalizedGender = ['male', 'boy', 'male_presenter'].includes(rawGender) ? 'male' : 'female';

  // ── D-ID: Microsoft Azure Neural Voices ──────────────────────────────────
  // These are standard Azure TTS voice names, confirmed supported by D-ID
  const D_ID_VOICES = {
    english: { male: 'en-US-GuyNeural',        female: 'en-US-JennyNeural' },
    tamil:   { male: 'ta-IN-ValluvarNeural',    female: 'ta-IN-PadmaNeural' },
  };

  // ── HeyGen: Voice IDs (confirmed from /v2/voices API) ────────────────────
  // Tamil voices confirmed from the HeyGen API:
  //   "Pallavi - Natural" -> f37bfc7d0be8494c8fa103a4a47eed33 (female)
  // English voices confirmed from HeyGen:
  //   Use HeyGen ElevenLabs/native voice IDs, NOT Azure voice names
  //   Fetching dynamically is ideal but we provide confirmed fallback IDs
  const HEYGEN_VOICES = {
    english: {
      female: '1bd001e7e50f421d891986aad5158bc8', // Rachel (English Female) - confirmed HeyGen ID
      male:   'fb26447f6d5645a5a5c6f3bcdaef8c1d', // Josh (English Male) - confirmed HeyGen ID
    },
    tamil: {
      female: 'f37bfc7d0be8494c8fa103a4a47eed33', // Pallavi - Natural (Tamil Female) - confirmed
      male:   'f37bfc7d0be8494c8fa103a4a47eed33', // Fallback to Pallavi until Tamil male confirmed
    },
  };

  const didMap    = D_ID_VOICES[lang]    || D_ID_VOICES['english'];
  const heyMap    = HEYGEN_VOICES[lang]  || HEYGEN_VOICES['english'];

  const didVoiceId    = didMap[normalizedGender]   || D_ID_VOICES['english'][normalizedGender];
  const heyGenVoiceId = heyMap[normalizedGender]   || HEYGEN_VOICES['english'][normalizedGender];

  return { didVoiceId, heyGenVoiceId };
}
