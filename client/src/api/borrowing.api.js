import { apiRequest } from './client';

export const borrowingApi = {
  async createRequest(bookId) {
    return apiRequest('/api/v1/borrowing/requests', {
      method: 'POST',
      body: { book_id: bookId },
    });
  },

  async getRequest(requestId) {
    return apiRequest(`/api/v1/borrowing/requests/${requestId}`);
  },

  async listBookRequests(bookId) {
    return apiRequest(`/api/v1/borrowing/books/${bookId}/requests`);
  },

  async approveRequest(requestId) {
    return apiRequest(`/api/v1/borrowing/requests/${requestId}/approve`, {
      method: 'POST',
    });
  },

  async declineRequest(requestId) {
    return apiRequest(`/api/v1/borrowing/requests/${requestId}/decline`, {
      method: 'POST',
    });
  },

  async cancelRequest(requestId) {
    return apiRequest(`/api/v1/borrowing/requests/${requestId}/cancel`, {
      method: 'POST',
    });
  },

  async getHandover(sessionId) {
    return apiRequest(`/api/v1/borrowing/handovers/${sessionId}`);
  },

  async verifyPin(sessionId, pin) {
    return apiRequest(`/api/v1/borrowing/handovers/${sessionId}/verify-pin`, {
      method: 'POST',
      body: { pin },
    });
  },

  async confirmCondition(sessionId, { condition_rating, condition_notes }) {
    return apiRequest(`/api/v1/borrowing/handovers/${sessionId}/confirm-condition`, {
      method: 'POST',
      body: { condition_rating, condition_notes },
    });
  },

  async earlyRelease(bookId) {
    return apiRequest(`/api/v1/borrowing/books/${bookId}/early-release`, {
      method: 'POST',
    });
  },

  async getMyRequests() {
    return apiRequest('/api/v1/borrowing/my-requests');
  },
};
