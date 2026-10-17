import { apiRequest } from './client.js';

/**
 * Platform Admin API Client
 */
export const adminApi = {
  /**
   * Fetches global platform metrics.
   */
  async getStats() {
    return apiRequest('/api/v1/admin/stats');
  },

  /**
   * Fetches all libraries across the platform.
   */
  async getAllLibraries() {
    return apiRequest('/api/v1/admin/libraries');
  },

  /**
   * Updates library status (ACTIVE, SUSPENDED, DEACTIVATED).
   */
  async updateStatus(libraryId, status) {
    return apiRequest(`/api/v1/admin/libraries/${libraryId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  /**
   * Permanently deletes a discarded or suspicious library.
   */
  async deleteLibrary(libraryId) {
    return apiRequest(`/api/v1/admin/libraries/${libraryId}`, {
      method: 'DELETE',
    });
  },
};
