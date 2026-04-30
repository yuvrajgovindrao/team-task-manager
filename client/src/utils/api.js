const API_BASE = '/api';

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    if (data.requiresVerification) err.requiresVerification = true;
    if (data.email) err.email = data.email;
    throw err;
  }

  return data;
}

export const get = (url) => api(url);
export const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });
export const put = (url, body) => api(url, { method: 'PUT', body: JSON.stringify(body) });
export const del = (url) => api(url, { method: 'DELETE' });
