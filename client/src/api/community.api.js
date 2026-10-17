import { apiRequest } from './client';

export const communityApi = {
  // ─── 1. Book Demand Wishlist ─────────────────────────────

  async listDemands(libraryId) {
    return apiRequest(`/api/v1/community/${libraryId}/demands`);
  },

  async createDemand(libraryId, { title, author, isbn, notes }) {
    return apiRequest(`/api/v1/community/${libraryId}/demands`, {
      method: 'POST',
      body: { title, author, isbn, notes },
    });
  },

  async toggleVote(demandId) {
    return apiRequest(`/api/v1/community/demands/${demandId}/vote`, {
      method: 'POST',
    });
  },

  async updateDemandStatus(demandId, { status, librarian_notes }) {
    return apiRequest(`/api/v1/community/demands/${demandId}/status`, {
      method: 'PUT',
      body: { status, librarian_notes },
    });
  },

  // ─── 2. Financial Ledger ──────────────────────────────────

  async getLedger(libraryId, params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const queryString = query.toString();
    return apiRequest(`/api/v1/community/${libraryId}/ledger${queryString ? `?${queryString}` : ''}`);
  },

  async createLedgerEntry(libraryId, data) {
    return apiRequest(`/api/v1/community/${libraryId}/ledger`, {
      method: 'POST',
      body: data,
    });
  },

  // ─── 3. Community Notices ─────────────────────────────────

  async listNotices(libraryId, category) {
    const query = new URLSearchParams();
    if (category && category !== 'ALL') query.set('category', category);

    const queryString = query.toString();
    return apiRequest(`/api/v1/community/${libraryId}/notices${queryString ? `?${queryString}` : ''}`);
  },

  async createNotice(libraryId, data) {
    const payload = {
      ...data,
      description: data.description || data.content,
      contact_info: data.contact_info || 'Community Member',
    };
    return apiRequest(`/api/v1/community/${libraryId}/notices`, {
      method: 'POST',
      body: payload,
    });
  },

  async deleteNotice(noticeId) {
    return apiRequest(`/api/v1/community/notices/${noticeId}`, {
      method: 'DELETE',
    });
  },
};
