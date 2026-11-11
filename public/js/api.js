/**
 * API Client Utility
 * Lightweight, beginner-friendly wrapper around the native browser fetch API.
 * Handles JSON serialization, headers, and error parsing.
 */

const API = {
  /**
   * Performs an HTTP request and parses the JSON response
   * @param {string} endpoint - The URL or endpoint path (e.g. '/api/collections')
   * @param {object} options - Fetch options (method, headers, body, etc.)
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Serialize object body to JSON string if needed
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
