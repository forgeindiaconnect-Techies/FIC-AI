// client/src/utils/limitChecker.js

const LIMITS = {
  chat: 20,
  image: 3,
  docs: 2,
  poster: 4,
  video: 1,
  voice: 5,
  resume: 3,
};

const FEATURE_NAMES = {
  chat: 'AI Chat message',
  image: 'Image Generation',
  docs: 'Document Generation',
  poster: 'Poster Generation',
  video: 'Video Generation',
  voice: 'Voice Generation',
  resume: 'Resume Build',
};

/**
 * Gets the current daily usage stats from localStorage
 */
export function getUsageStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  const stored = localStorage.getItem('fic_usage_stats');
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date === todayStr) {
        return parsed;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Return fresh initial values if date changed or nothing stored
  return {
    date: todayStr,
    chat: 0,
    image: 0,
    docs: 0,
    poster: 0,
    video: 0,
    voice: 0,
    resume: 0,
  };
}

/**
 * Checks if the user is premium (Pro or Business tier)
 */
export function isPremiumUser() {
  const tier = localStorage.getItem('fic_user_tier') || '';
  return tier === 'pro' || tier === 'business';
}

/**
 * Checks if a specific feature's daily limit is exhausted.
 * @returns {boolean} true if limit is hit (and user is not premium), false otherwise
 */
export function isLimitReached(feature) {
  if (isPremiumUser()) {
    // Pro/Business users have unlimited access
    return false;
  }
  
  const stats = getUsageStats();
  const currentCount = stats[feature] || 0;
  const limit = LIMITS[feature] || 999;
  
  return currentCount >= limit;
}

/**
 * Increments the usage count for a feature.
 */
export function incrementUsage(feature) {
  if (isPremiumUser()) return; // No need to increment for premium users
  
  const stats = getUsageStats();
  stats[feature] = (stats[feature] || 0) + 1;
  localStorage.setItem('fic_usage_stats', JSON.stringify(stats));
  window.dispatchEvent(new Event('fic_usage_stats_updated'));
}

/**
 * Helper to retrieve limit and label details for modal popups
 */
export function getFeatureLimitDetails(feature) {
  return {
    limitValue: LIMITS[feature] || 0,
    featureName: FEATURE_NAMES[feature] || feature,
  };
}
