const CACHE_TTL_MS = 60 * 1000;
const SCHEMA_VERSION = "phase12-v1";
const cache = new Map();

export const analyticsCacheKey = (userId, filters) =>
  `${SCHEMA_VERSION}:${userId}:${JSON.stringify(filters)}`;

export const getCachedAnalytics = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

export const setCachedAnalytics = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 250) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
};

export const invalidateAnalyticsCache = (userId) => {
  const prefix = `${SCHEMA_VERSION}:${userId}:`;
  [...cache.keys()].forEach((key) => {
    if (key.startsWith(prefix)) cache.delete(key);
  });
};

export const clearAnalyticsCache = () => cache.clear();
