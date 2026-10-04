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
    const data = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('eventhub_token');
      }
      throw new ApiError(data.error || `Request failed with status ${response.status}`, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Connection failed. Please check your internet and try again.', 0, null);
  }
}

export const authAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiFetch('/auth/me'),
};

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

export const bookingsAPI = {
  create: (data) => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getMy: () => apiFetch('/bookings/my'),
  cancel: (id) => apiFetch(`/bookings/${id}/cancel`, { method: 'PUT' }),
};

export { ApiError };
export default apiFetch;
