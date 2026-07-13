import axios from 'axios';

/**
 * Verifies if a URL is actually live and responding with a successful HTTP code.
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
async function isUrlLive(url) {
  try {
    const res = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
      timeout: 3000 // 3 seconds timeout
    });
    return res.status >= 200 && res.status < 400;
  } catch (err) {
    // If HEAD fails, try a GET request (some sites block HEAD requests)
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        },
        timeout: 3000
      });
      return res.status >= 200 && res.status < 400;
    } catch (getErr) {
      console.log(`[Web Search] URL unreachable: ${url} (${getErr.message})`);
      return false;
    }
  }
}

/**
 * Cleans a user query to create a highly optimized search string for official websites.
 * @param {string} query 
 * @returns {string}
 */
export function cleanSearchQuery(query) {
  let cleaned = query.toLowerCase()
    .replace(/\b(give|show|get|tell|find|what is|what's|where is|can you find|please|me|us|the|link|website|url|site|page|homepage|home page|official|for|of|to)\b/gi, '')
    .replace(/[?,.!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length === 0) {
    return query + ' official website';
  }
  return `${cleaned} official website`;
}

/**
 * Searches DuckDuckGo HTML search page, decodes the redirect URL, and returns the official website.
 * @param {string} query 
 * @returns {Promise<string|null>}
 */
export async function searchOfficialWebsite(query) {
  try {
    const searchQuery = cleanSearchQuery(query);
    console.log(`[Web Search] Cleaning query: "${query}" -> "${searchQuery}"`);

    // Fetch search page with browser headers
    const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const html = response.data;
    const urlRegex = /href="([^"]+)"/g;
    let match;
    const rawUrls = [];

    while ((match = urlRegex.exec(html)) !== null) {
      let url = match[1];

      // Decode DuckDuckGo redirect uddg parameter
      if (url.includes('uddg=')) {
        try {
          const parts = url.split('uddg=');
          if (parts.length > 1) {
            const encodedUrl = parts[1].split('&')[0];
            const decodedUrl = decodeURIComponent(encodedUrl);
            if (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://')) {
              url = decodedUrl;
            }
          }
        } catch (decodeErr) {
          console.warn('[Web Search] Decode failed for redirect link:', decodeErr.message);
        }
      }

      // Filter out search engines, wiki, tracking links
      if (
        (url.startsWith('http://') || url.startsWith('https://')) &&
        !url.includes('duckduckgo.com') && 
        !url.includes('google.com') && 
        !url.includes('yahoo.com') && 
        !url.includes('wikipedia.org') &&
        !url.includes('w3.org') &&
        !url.includes('duck.com')
      ) {
        rawUrls.push(url);
      }
    }

    // Validate the extracted URLs by checking if they are live
    for (const url of rawUrls) {
      const isLive = await isUrlLive(url);
      if (isLive) {
        console.log(`[Web Search] Found verified active official link: ${url}`);
        return url;
      } else {
        console.warn(`[Web Search] Skipping dead/unreachable URL: ${url}`);
      }
    }
  } catch (err) {
    console.error('[Web Search] Search failed:', err.message);
  }
  return null;
}
