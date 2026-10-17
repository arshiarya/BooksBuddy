import { apiRequest, setCsrfToken } from './client.js';

/**
 * Normalizes backend user profile data (snake_case) to consistent frontend model (camelCase).
 */
export function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return rawUser;
  return {
    ...rawUser,
    fullName: rawUser.fullName ?? rawUser.full_name ?? '',
    societyLocality: rawUser.societyLocality ?? rawUser.society_locality ?? '',
    flatHouseNumber: rawUser.flatHouseNumber ?? rawUser.flat_house_number ?? '',
    createdAt: rawUser.createdAt ?? rawUser.created_at ?? null,
    memberships: Array.isArray(rawUser.memberships) ? rawUser.memberships : (rawUser.memberships || []),
  };
}

export const authApi = {
  async register(data) {
    const payload = {
      email: data.email,
      password: data.password,
      full_name: data.full_name ?? data.fullName,
      phone: data.phone,
      society_locality: data.society_locality ?? data.societyLocality,
      flat_house_number: data.flat_house_number ?? data.flatHouseNumber,
      city: data.city,
    };
    const res = await apiRequest('/api/v1/auth/register', {
      method: 'POST',
      body: payload,
    });
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    if (res.user) {
      res.user = normalizeUser(res.user);
    }
    return res;
  },

  async login(credentials) {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: credentials,
    });
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    if (res.user) {
      res.user = normalizeUser(res.user);
    }
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
    if (res.user) {
      res.user = normalizeUser(res.user);
    }
    return res;
  },

  async fetchCsrf() {
    const res = await apiRequest('/api/v1/auth/csrf');
    if (res.csrfToken) setCsrfToken(res.csrfToken);
    return res.csrfToken;
  },
};
