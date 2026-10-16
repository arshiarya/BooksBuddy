import { apiRequest } from './client';

export const chatApi = {
  async getMessages(borrowRequestId, params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit);
    if (params.before) query.set('before', params.before);

    const queryString = query.toString();
    return apiRequest(`/api/v1/chat/requests/${borrowRequestId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  async postMessage(borrowRequestId, content) {
    return apiRequest(`/api/v1/chat/requests/${borrowRequestId}/messages`, {
      method: 'POST',
      body: { content },
    });
  },
};
