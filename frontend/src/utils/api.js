// Centralized API client helper for HealthyMilk - Hardened Same-Origin Relative API Routing

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('healthymilk_token');
  
  // Strips any legacy domain prefixes to guarantee same-origin relative paths (/api/...)
  let cleanEndpoint = String(endpoint || '');
  if (cleanEndpoint.includes('healthymilk-api.vercel.app')) {
    cleanEndpoint = cleanEndpoint.replace(/https?:\/\/healthymilk-api\.vercel\.app/, '');
  }
  
  const url = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      console.warn(`HTTP ${res.status} on ${url}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    return { success: false, message: 'Network or server connection error.' };
  }
}
