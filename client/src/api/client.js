/**
 * BooksBuddy API HTTP Client
 * Enforces session credentials, automatic CSRF injection for mutations,
 * and structured error normalization.
 */

let inMemoryCsrfToken = null;

export function setCsrfToken(token) {
  inMemoryCsrfToken = token;
}

export function getCsrfToken() {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;

  // Fallback to reading the non-HttpOnly booksbuddy_csrf cookie
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)booksbuddy_csrf=([^;]+)/);
    if (match) {
      inMemoryCsrfToken = decodeURIComponent(match[1]);
      return inMemoryCsrfToken;
    }
  }
  return null;
}

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : endpoint;
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  // Add Content-Type for requests with JSON body
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  // Attach CSRF token on mutating requests
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!safeMethods.includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include', // Strictly include HttpOnly session cookie
  });

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Update in-memory CSRF token if returned in response payload
  if (data && typeof data === 'object' && data.csrfToken) {
    setCsrfToken(data.csrfToken);
  }

  if (!response.ok) {
    const errorMessage =
      (data && data.error && data.error.message) ||
      (data && data.message) ||
      `Request failed with status ${response.status}`;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.errors = data?.error?.errors || [];
    error.raw = data;
    throw error;
  }

  return data;
}
