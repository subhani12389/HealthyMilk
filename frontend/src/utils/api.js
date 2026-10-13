// Centralized High-Performance API Client Helper for HealthyMilk
// Features: Timeout Protection (AbortController), Memory Cache for GET, Mutation Invalidation, Safe Error Parsing

const apiCache = new Map();
const inFlightMutations = new Map();
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

export function apiFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body;
  const canDedupe = method !== 'GET' &&
    options.dedupe !== false &&
    !options.signal &&
    (body == null || typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean');

  if (!canDedupe) return performApiFetch(endpoint, options);

  const token = localStorage.getItem('healthymilk_token') || '';
  const bodyKey = typeof body === 'string' ? body : JSON.stringify(body);
  const requestKey = `${method}|${endpoint}|${token}|${bodyKey || ''}`;
  const existingRequest = inFlightMutations.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = performApiFetch(endpoint, options).finally(() => {
    inFlightMutations.delete(requestKey);
  });
  inFlightMutations.set(requestKey, request);
  return request;
}

async function performApiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('healthymilk_token');
  
  // Strips legacy absolute URLs to enforce clean relative endpoints
  let cleanEndpoint = String(endpoint || '');
  if (cleanEndpoint.includes('healthymilk-api.vercel.app')) {
    cleanEndpoint = cleanEndpoint.replace(/https?:\/\/healthymilk-api\.vercel\.app/, '');
  }
  
  const url = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const { noCache, timeout, dedupe, signal: callerSignal, ...fetchOptions } = options;

  // Cache Lookup for GET requests (unless explicitly disabled)
  const isGet = method === 'GET';
  const shouldCache = isGet && !noCache;
  const cacheKey = `${url}|${token || ''}`;

  if (shouldCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  // AbortController with 20-second timeout to allow for serverless cold-starts and prevent false network timeouts
  const controller = new AbortController();
  const timeoutMs = timeout || 20000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort(callerSignal.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      method,
      headers,
      signal: controller.signal
    });

    // Auto-invalidate cache on mutation requests (POST, PUT, DELETE, PATCH)
    if (!isGet) {
      invalidateApiCache();
    }

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = res.status === 204 ? {} : await res.json();
    } else {
      const text = await res.text();
      data = { success: res.ok, message: text };
    }

    // Save successful GET responses to cache
    if (shouldCache && res.ok && data?.success !== false) {
      apiCache.set(cacheKey, { timestamp: Date.now(), data });
    }

    if (!res.ok && data?.success !== false) {
      data = {
        ...data,
        success: false,
        message: 'The request could not be completed. Please try again.'
      };
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: callerSignal?.aborted
          ? 'Request cancelled.'
          : 'Request timed out. Please check your internet connection and retry.'
      };
    }

    console.error(`API Error on ${url}:`, err);
    return {
      success: false,
      message: 'Unable to connect to the server. Please check your internet connection or try again.'
    };
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
