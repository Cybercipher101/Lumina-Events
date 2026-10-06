const API_BASE = '/api';
export const AUTH_EXPIRED_EVENT = 'lumina:auth-expired';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiFetch(endpoint, options = {}) {
  const { timeoutMs = 20000, ...requestOptions } = options;
  const token = localStorage.getItem('eventhub_token');
  const headers = new Headers(requestOptions.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (requestOptions.signal?.aborted) abort();
  requestOptions.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, { ...requestOptions, headers, signal: controller.signal });
    if (response.status === 401 && token && localStorage.getItem('eventhub_token') === token) {
      localStorage.removeItem('eventhub_token');
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    if (response.status === 204) return {};
    const isJSON = /\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') || '');
    let data = {};
    if (isJSON) {
      try {
        data = await response.json();
      } catch {
        throw new ApiError(response.ok ? 'The server returned an invalid response. Please try again.' : `Request failed with status ${response.status}`, response.status, null);
      }
    }
    if (!response.ok) {
      throw new ApiError(data?.error || `Request failed with status ${response.status}`, response.status, data);
    }
    if (!isJSON || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError('The server returned an invalid response. Please try again.', response.status, data);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError('The request timed out or was interrupted. Please try again.', 0, null);
    throw new ApiError('Connection failed. Please check your internet and try again.', 0, null);
  } finally {
    clearTimeout(timeout);
    requestOptions.signal?.removeEventListener('abort', abort);
  }
}

export const authAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: (options = {}) => apiFetch('/auth/me', options),
};

export const eventsAPI = {
  getAll: (params = {}, options = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/events${query ? `?${query}` : ''}`, options);
  },
  getOne: (id) => apiFetch(`/events/${id}`),
  create: (data) => apiFetch('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/events/${id}`, { method: 'DELETE' }),
  getMyEvents: () => apiFetch('/events/my/events'),
};

export const bookingsAPI = {
  create: (data, key) => apiFetch('/bookings', {
    method: 'POST', body: JSON.stringify(data),
    ...(key && { headers: { 'Idempotency-Key': key } }),
  }),
  getMy: () => apiFetch('/bookings/my'),
  cancel: (id) => apiFetch(`/bookings/${id}/cancel`, { method: 'PUT' }),
};

export { ApiError };
export default apiFetch;
