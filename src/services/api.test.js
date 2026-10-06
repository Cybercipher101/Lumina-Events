import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import apiFetch, { AUTH_EXPIRED_EVENT, bookingsAPI } from './api';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const response = (status, contentType, data) => ({ status, ok: status >= 200 && status < 300, headers: new Headers({ 'content-type': contentType }), json: vi.fn().mockResolvedValue(data) });

test('preserves Authorization and custom Headers including booking retry keys', async () => {
  localStorage.setItem('eventhub_token', 'token');
  fetch.mockResolvedValue(response(200, 'application/json', { success: true }));
  await apiFetch('/bookings', { method: 'POST', headers: new Headers({ 'X-Custom': 'value' }) });
  const config = fetch.mock.calls[0][1];
  expect(config.headers.get('authorization')).toBe('Bearer token');
  expect(config.headers.get('x-custom')).toBe('value');
  expect(config.headers.get('content-type')).toBe('application/json');
  await bookingsAPI.create({ event: 'id' }, 'request-key');
  expect(fetch.mock.calls[1][1].headers.get('idempotency-key')).toBe('request-key');
});

test('custom authorization headers override defaults case-insensitively', async () => {
  localStorage.setItem('eventhub_token', 'token');
  fetch.mockResolvedValue(response(200, 'application/json', {}));
  await apiFetch('/auth/me', { headers: { authorization: 'Bearer override' } });
  expect(fetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer override');
});

test('non-JSON errors keep their HTTP status and never display HTML', async () => {
  fetch.mockResolvedValue(response(502, 'text/html', null));
  await expect(apiFetch('/events')).rejects.toMatchObject({ status: 502, message: 'Request failed with status 502' });
});

test('HTML successes are rejected instead of confirming a booking', async () => {
  fetch.mockResolvedValue(response(200, 'text/html', null));
  await expect(bookingsAPI.create({})).rejects.toMatchObject({ status: 200, message: expect.stringContaining('invalid response') });
});

test('handles JSON error media types and empty successful responses', async () => {
  fetch.mockResolvedValueOnce(response(409, 'application/problem+json', { error: 'Only 1 ticket available' }));
  await expect(apiFetch('/bookings')).rejects.toMatchObject({ status: 409, message: 'Only 1 ticket available' });
  fetch.mockResolvedValueOnce(response(204, '', undefined));
  await expect(apiFetch('/events')).resolves.toEqual({});
});

test('malformed JSON errors preserve status and expire the active session', async () => {
  localStorage.setItem('eventhub_token', 'old-token');
  const expired = vi.fn();
  window.addEventListener(AUTH_EXPIRED_EVENT, expired);
  const invalid = response(401, 'application/json', null);
  invalid.json.mockRejectedValue(new SyntaxError('bad JSON'));
  fetch.mockResolvedValue(invalid);
  await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem('eventhub_token')).toBeNull();
  expect(expired).toHaveBeenCalledOnce();
  window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
});

test('an old failed request cannot clear a newer login', async () => {
  localStorage.setItem('eventhub_token', 'old-token');
  fetch.mockImplementation(async () => {
    localStorage.setItem('eventhub_token', 'new-token');
    return response(401, 'text/plain', null);
  });
  await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem('eventhub_token')).toBe('new-token');
});

test('network errors are distinguishable from HTTP failures', async () => {
  fetch.mockRejectedValue(new TypeError('offline'));
  await expect(apiFetch('/events')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Connection failed') });
});

test('requests time out and can be retried using the same booking key', async () => {
  vi.useFakeTimers();
  fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const request = apiFetch('/bookings', { timeoutMs: 10 });
  const assertion = expect(request).rejects.toMatchObject({ status: 0, message: expect.stringContaining('timed out') });
  await vi.advanceTimersByTimeAsync(10);
  await assertion;
});
