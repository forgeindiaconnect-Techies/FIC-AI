# Poster Content Generation Enhancement Plan

## Goal Description
Enhance the poster generation pipeline to produce richer, category‑aware content:
1. **Main Title** – already exists.
2. **Subtitle** – already exists.
3. **Description** – a concise paragraph describing the poster purpose.
4. **Benefits / Features** – expand existing `features` field to include up to 6 items.
5. **CTA** – already exists.
6. **Contact Information** – structured object with fields like `phone`, `email`, `address`, `website`.
7. **Offer Details** (optional) – object with `offerTitle`, `offerDescription`, `validity`.

The backend AI prompt and JSON schema will be updated, fallback data will include these fields for categories (Restaurant, Hiring, Real Estate, Festival), and the frontend `PosterEditor.jsx` will render the new sections with premium styling.

## User Review Required
- Confirm the additional fields and their naming (e.g., `description`, `contactInfo`, `offerDetails`).
- Approve the UI layout changes for displaying description, contact info, and offer details.

## Open Questions
- Do you want the **Contact Information** displayed at the bottom as a small footer block or integrated within the main body?
- For **Offer Details**, should it be rendered as a highlighted badge near the CTA?
- Any specific color palette or typography preferences for the new text blocks?

## Proposed Changes
### Backend (`server/routes/poster.js`)
- Update `systemPrompt` (lines ~285‑315) to include new fields in the JSON schema:
  ```json
  {
    "title": "...",
    "subtitle": "...",
    "description": "...",
    "cta": "...",
    "theme": "...",
    "colorPalette": [...],
    "fontPairing": {...},
    "skills": [...],
    "features": [{"title":"...","desc":"...","icon":"..."}],
    "contactInfo": {"phone":"...","email":"...","address":"...","website":"..."},
    "offerDetails": {"offerTitle":"...","offerDescription":"...","validity":"..."},
    "backgroundQuery": "..."
  }
  ```
- Adjust the AI handling after `model.generateContent` to parse the added fields (no code change needed as JSON will include them).
- Extend `getLocalFallbackPoster(userPrompt)` (around line 745) to return category‑specific objects containing the new fields. Example for Restaurant:
  ```js
  return {
    title,
    subtitle,
    description: `${restaurantName} offers a culinary journey of ${cuisineType} delights.`,
    cta: 'Book Table',
    theme: 'business',
    features: [...],
    contactInfo: { phone, address, website },
    offerDetails: { offerTitle: offer, offerDescription: `${offer} available this week`, validity: 'Valid till 31 Dec' },
    backgroundQuery: 'restaurant food chef fine dining background'
  };
  ```
- Ensure the `poster` JSON passed to the client contains these fields.

### Frontend (`client/src/components/PosterEditor.jsx`)
- Extend `renderTextContent` to add three new groups:
  1. **Description** – large paragraph below subtitle.
  2. **Contact Info** – small footer with icons (phone, email, location) using `getIconUrl`.
  3. **Offer Details** – optional badge styled with accent color, positioned near CTA.
- Add new safe‑text helpers:
  ```js
  const getSafeObject = (obj, defaults = {}) => typeof obj === 'object' ? obj : defaults;
  ```
- In `renderPoster`, after extracting `poster` fields, pull:
  ```js
  const description = getSafeText(poster.description);
  const contact = getSafeObject(poster.contactInfo);
  const offer = getSafeObject(poster.offerDetails);
  ```
- Render description using `fabricObj.Textbox` with appropriate font (`fontPrimary`), size ~28, color `style.text`.
- Render contact info as a horizontal group at `footerY` with icons via `getIconUrl` and text.
- If `offer` exists, render a rectangular badge (`fabricObj.Rect`) with accent background and `offer.offerTitle` + `offer.offerDescription` inside.
- Adjust layout calculations (`layout`) to reserve space for description (increase `subtitleY` offset) and ensure empty space <10%.
- Update any CSS/inline styles to keep premium look (glassmorphic overlay already present).

### Tests & Verification
- Run existing unit tests (if any) to ensure no breakage.
- Manually generate posters for each category and verify:
  * JSON response contains new fields.
  * UI displays description, contact, and optional offer.
  * Visual checklist still passes (hero image occupies ~60%).
- Log additional fields in server logs for debugging.

## Verification Plan
### Automated Tests
- Add a test case in `tests/poster.test.js` that sends a sample prompt for each category and asserts the response JSON includes `description` and `contactInfo` keys.
- Mock Gemini/OpenRouter responses to include the new fields and ensure the server forwards them unchanged.

### Manual Verification
- Run the development server (`npm run dev`).
- Create posters for Restaurant, Hiring, Real Estate, Festival.
- Confirm UI renders the new sections with correct styling, no overflow, and total empty space <10%.
- Check that the background image still loads via local URL.
- Verify logs show generated image URL, saved path, and final public URL.

---
*End of implementation plan.*
