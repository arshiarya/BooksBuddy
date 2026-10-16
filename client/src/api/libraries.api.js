import { apiRequest } from './client';

export const librariesApi = {
  async search(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.city) query.set('city', params.city);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return apiRequest(`/api/v1/libraries${queryString ? `?${queryString}` : ''}`);
  },

  async getById(id) {
    return apiRequest(`/api/v1/libraries/${id}`);
  },

  async create(data) {
    return apiRequest('/api/v1/libraries', {
      method: 'POST',
      body: data,
    });
  },

  async join(id, inviteCode) {
    return apiRequest(`/api/v1/libraries/${id}/join`, {
      method: 'POST',
      body: inviteCode ? { invite_code: inviteCode } : {},
    });
  },

  async updateRules(id, rulesData) {
    return apiRequest(`/api/v1/libraries/${id}`, {
      method: 'PUT',
      body: rulesData,
    });
  },

  async listMembers(id, params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return apiRequest(`/api/v1/libraries/${id}/members${queryString ? `?${queryString}` : ''}`);
  },

  async updateMember(libraryId, memberId, { status, role }) {
    return apiRequest(`/api/v1/libraries/${libraryId}/members/${memberId}`, {
      method: 'PUT',
      body: { status, role },
    });
  },

  async regenerateInviteCode(id) {
    return apiRequest(`/api/v1/libraries/${id}/invite-code`, {
      method: 'POST',
    });
  },
};
