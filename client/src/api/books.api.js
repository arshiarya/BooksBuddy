import { apiRequest } from './client';

export const booksApi = {
  async search(params = {}) {
    const query = new URLSearchParams();
    if (params.library_id) query.set('library_id', params.library_id);
    if (params.q) query.set('q', params.q);
    if (params.genre) query.set('genre', params.genre);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return apiRequest(`/api/v1/books${queryString ? `?${queryString}` : ''}`);
  },

  async getById(id) {
    return apiRequest(`/api/v1/books/${id}`);
  },

  async donate(data) {
    return apiRequest('/api/v1/books', {
      method: 'POST',
      body: data,
    });
  },

  async remove(id, removalReason) {
    return apiRequest(`/api/v1/books/${id}`, {
      method: 'DELETE',
      body: { removal_reason: removalReason },
    });
  },

  async searchMetadata(query) {
    if (!query || !query.trim()) return { results: [] };
    const q = encodeURIComponent(query.trim());
    return apiRequest(`/api/v1/books/metadata/search?q=${q}`);
  },
};
