const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('eventhub_token');

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = response.headers.get('content-type') || '';
    const isJSON = /\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType);
    let data = {};
    if (isJSON) {
      try { data = await response.json(); }
      catch { throw new ApiError('The backend returned an invalid response. Check the backend terminal.', response.status, null); }
    }

    if (!response.ok) {
      // If token is expired/invalid, clear auth
      if (response.status === 401) {
        localStorage.removeItem('eventhub_token');
      }
      throw new ApiError(data?.error || (response.status >= 500 ? 'The backend is unavailable. Check the npm run dev terminal and database connection.' : `Request failed with status ${response.status}`), response.status, data);
    }

    if (!isJSON || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError('The API returned an unexpected response. Check that the backend is running.', response.status, data);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Network error
    throw new ApiError('Connection failed. Please check your internet and try again.', 0, null);
  }
}

// Auth API
export const authAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiFetch('/auth/me'),
};

// Events API
export const eventsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/events${query ? `?${query}` : ''}`);
  },
  getOne: (id) => apiFetch(`/events/${id}`),
  create: (data) => apiFetch('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/events/${id}`, { method: 'DELETE' }),
  getMyEvents: () => apiFetch('/events/my/events'),
};

// Bookings API
export const bookingsAPI = {
  create: (data) => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getMy: () => apiFetch('/bookings/my'),
  cancel: (id) => apiFetch(`/bookings/${id}/cancel`, { method: 'PUT' }),
};

export { ApiError };
export default apiFetch;
