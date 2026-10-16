import { apiRequest, setCsrfToken } from './client';

export const authApi = {
  async register(data) {
    const res = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: data,
    });
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res;
  },

  async login(credentials) {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: credentials,
    });
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res;
  },

  async logout() {
    const res = await apiRequest('/api/v1/auth/logout', {
      method: 'POST',
    });
    setCsrfToken(null);
    return res;
  },

  async getMe() {
    const res = await apiRequest('/api/v1/auth/me');
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res;
  },

  async fetchCsrf() {
    const res = await apiRequest('/api/v1/auth/csrf');
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res.csrfToken;
  },
};
