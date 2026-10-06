import apiFetch from './api';

beforeEach(() => { global.fetch = jest.fn(); localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());
const response = (status, type, data) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => type }, json: jest.fn().mockResolvedValue(data) });

test('proxy errors show backend guidance instead of being classified as internet failures', async () => {
  fetch.mockResolvedValue(response(503, 'application/json', { error: 'The backend is unavailable. Check MongoDB.' }));
  await expect(apiFetch('/auth/register')).rejects.toMatchObject({ status: 503, message: 'The backend is unavailable. Check MongoDB.' });
});

test('legacy non-JSON proxy errors retain their HTTP status', async () => {
  fetch.mockResolvedValue(response(504, 'text/html', null));
  await expect(apiFetch('/auth/register')).rejects.toMatchObject({ status: 504, message: expect.stringContaining('backend is unavailable') });
});

test('empty JSON errors retain their HTTP status and backend guidance', async () => {
  fetch.mockResolvedValue(response(503, 'application/json', null));
  await expect(apiFetch('/auth/register')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('backend is unavailable') });
});

test('HTML success responses cannot look like successful logins', async () => {
  fetch.mockResolvedValue(response(200, 'text/html', null));
  await expect(apiFetch('/auth/login')).rejects.toMatchObject({ status: 200, message: expect.stringContaining('unexpected response') });
});

test('custom headers preserve Authorization and JSON headers', async () => {
  localStorage.setItem('eventhub_token', 'token');
  fetch.mockResolvedValue(response(200, 'application/json', {}));
  await apiFetch('/auth/me', { headers: { 'X-Custom': 'value' } });
  expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer token', 'X-Custom': 'value' });
});

test('invalid credentials return the server message and expire an invalid session', async () => {
  localStorage.setItem('eventhub_token', 'old-token');
  fetch.mockResolvedValue(response(401, 'application/json', { error: 'Invalid email or password' }));
  await expect(apiFetch('/auth/login')).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });
  expect(localStorage.getItem('eventhub_token')).toBeNull();
});
