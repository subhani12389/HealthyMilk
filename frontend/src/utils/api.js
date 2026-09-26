// Centralized High-Performance API Client Helper for HealthyMilk
// Features: Timeout Protection (AbortController), Memory Cache for GET, Mutation Invalidation, Safe Error Parsing

const apiCache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds cache for idempotent GET requests

export function invalidateApiCache(prefix = '') {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(prefix)) {
      apiCache.delete(key);
    }
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('healthymilk_token');
  
  // Strips legacy absolute URLs to enforce clean relative endpoints
  let cleanEndpoint = String(endpoint || '');
  if (cleanEndpoint.includes('healthymilk-api.vercel.app')) {
    cleanEndpoint = cleanEndpoint.replace(/https?:\/\/healthymilk-api\.vercel\.app/, '');
  }
  
  const url = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // Cache Lookup for GET requests (unless explicitly disabled)
  const isGet = method === 'GET';
  const shouldCache = isGet && !options.noCache;
  const cacheKey = `${url}|${token || ''}`;

  if (shouldCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  // AbortController with 8-second timeout to prevent permanently hung requests
  const controller = new AbortController();
  const timeoutMs = options.timeout || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Auto-invalidate cache on mutation requests (POST, PUT, DELETE, PATCH)
    if (!isGet) {
      invalidateApiCache();
    }

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { success: res.ok, message: text };
    }

    // Save successful GET responses to cache
    if (shouldCache && res.ok && data?.success !== false) {
      apiCache.set(cacheKey, { timestamp: Date.now(), data });
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timed out. Please check your internet connection and retry.'
      };
    }

    console.error(`API Error on ${url}:`, err);
    return {
      success: false,
      message: 'Unable to connect to the server. Please check your internet connection or try again.'
    };
  }
}
