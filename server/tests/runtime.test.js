const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mongoose = require('mongoose');
const readConfig = require('../config/env');
const createApp = require('../app');
require('../models/User');
require('../models/Event');
require('../models/Booking');

const validEnv = { NODE_ENV: 'production', MONGO_URI: 'mongodb://127.0.0.1/lumina', JWT_SECRET: 'test-only-at-least-32-bytes-long-secret' };

test('configuration rejects missing secrets and invalid deployment settings', () => {
  assert.throws(() => readConfig({}), /MONGO_URI/);
  assert.throws(() => readConfig({ ...validEnv, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => readConfig({ ...validEnv, PORT: 'abc' }), /PORT/);
  assert.throws(() => readConfig({ ...validEnv, TRUST_PROXY: 'true' }), /TRUST_PROXY/);
  assert.throws(() => readConfig({ ...validEnv, CORS_ORIGINS: '*' }), /Invalid URL|origins/);
  assert.throws(() => readConfig({ ...validEnv, CORS_ORIGINS: 'http://example.com' }), /HTTPS/);
  assert.deepEqual(readConfig(validEnv).allowedOrigins, []);
  assert.equal(readConfig({ ...validEnv, PORT: '8080', TRUST_PROXY: '1' }).port, 8080);
});

async function withServer(t, app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('production serves deep links and immutable assets while API misses remain JSON', async t => {
  const previous = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previous; });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-client-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>Lumina test app</body></html>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-hash.js'), 'console.log("Lumina");');
  const base = await withServer(t, createApp(readConfig(validEnv), { clientDir: dir }));
  const deep = await fetch(`${base}/events/123`, { headers: { Accept: 'text/html' } });
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /Lumina test app/);
  assert.match(deep.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(deep.headers.get('cache-control'), /no-cache/);
  assert.equal(deep.headers.get('x-powered-by'), null);
  const asset = await fetch(`${base}/assets/app-hash.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  for (const url of ['/api/unknown', '/assets/missing.js', '/missing.png']) {
    const response = await fetch(`${base}${url}`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal((await response.json()).success, false);
  }
});

test('liveness remains available and readiness reports database outages', async t => {
  const previous = mongoose.connection._readyState;
  mongoose.connection._readyState = 0;
  t.after(() => { mongoose.connection._readyState = previous; });
  const base = await withServer(t, createApp(readConfig(validEnv)));
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/api/health/ready`)).status, 503);
  const unavailable = await fetch(`${base}/api/events`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).success, false);
});

test('malformed JSON and unsupported content types return sanitized API errors', async t => {
  const previous = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previous; });
  const base = await withServer(t, createApp(readConfig(validEnv)));
  const invalid = await fetch(`${base}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, 'Request body must contain valid JSON');
  const wrong = await fetch(`${base}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'data' });
  assert.equal(wrong.status, 415);
  const emptyCancel = await fetch(`${base}/api/bookings/123/cancel`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
  assert.equal(emptyCancel.status, 401);
});

test('authentication endpoints are rate limited without database access', async t => {
  const previous = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previous; });
  const base = await withServer(t, createApp(readConfig(validEnv)));
  let response;
  for (let i = 0; i < 21; i++) {
    response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await response.text();
  }
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('ratelimit'));
});

test('demo seeding refuses production databases before connecting', () => {
  const result = spawnSync(process.execPath, ['server/seed/seeder.js', '--reset'], { cwd: path.join(__dirname, '..', '..'), env: { ...process.env, ...validEnv }, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Demo seeding deletes data/);
});
