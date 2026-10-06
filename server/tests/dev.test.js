const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { spawnSync } = require('node:child_process');
const readConfig = require('../config/env');
const ensureDevelopmentEnv = require('../../scripts/setup');
const { waitForBackend } = require('../../scripts/dev');
const { startupMessage } = require('../server');
const setupProxy = require('../../src/setupProxy');

async function listen(t, app) {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const env = { MONGO_URI: 'mongodb://127.0.0.1/lumina', JWT_SECRET: 'test-development-secret' };

test('existing MongoDB and legacy PORT settings are supported', () => {
  assert.equal(readConfig({ ...env, PORT: '5100' }).port, 5100);
  assert.equal(readConfig({ ...env, PORT: '5100', API_PORT: '5200' }).port, 5200);
  assert.equal(readConfig(env).frontendPort, 3000);
  assert.equal(readConfig({ ...env, NODE_ENV: 'production' }).host, '0.0.0.0');
  assert.equal(readConfig({ ...env, API_HOST: '127.0.0.2' }).apiOrigin, 'http://127.0.0.2:5000');
  assert.equal(readConfig({ ...env, API_HOST: '::' }).apiOrigin, 'http://[::1]:5000');
  assert.throws(() => readConfig({ ...env, API_PORT: '3000' }), /different ports/);
  assert.throws(() => readConfig({ ...env, JWT_EXPIRE: 'not-a-duration' }), /JWT_EXPIRE/);
});

test('missing configuration has actionable messages instead of mongoose URI errors', () => {
  assert.throws(() => readConfig({}), /Set MONGO_URI/);
  assert.throws(() => readConfig({ MONGO_URI: env.MONGO_URI }), /Set JWT_SECRET/);
  assert.throws(() => readConfig({ ...env, MONGO_URI: 'your_mongodb_connection_string' }), /Set MONGO_URI/);
});

test('development setup generates a private secret and preserves an existing .env', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-setup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.equal(ensureDevelopmentEnv(dir), true);
  const before = fs.readFileSync(path.join(dir, '.env'), 'utf8');
  assert.match(before, /JWT_SECRET=[a-f0-9]{96}/);
  assert.equal(ensureDevelopmentEnv(dir), false);
  assert.equal(fs.readFileSync(path.join(dir, '.env'), 'utf8'), before);
});

test('frontend readiness requires the correct ready backend, not just a listening port', async t => {
  const app = express();
  let ready = false;
  app.get('/api/health', (req, res) => res.status(ready ? 200 : 503).json({ service: 'lumina-api', status: ready ? 'ready' : 'database-unavailable' }));
  const { url } = await listen(t, app);
  const timer = setTimeout(() => { ready = true; }, 100);
  t.after(() => clearTimeout(timer));
  await waitForBackend(`${url}/api/health`, () => false, 2000);
});

test('readiness rejects a stopped backend and unrelated HTTP services', async t => {
  await assert.rejects(waitForBackend('http://127.0.0.1:1/api/health', () => true, 100), /backend stopped/);
  const app = express();
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  const { url } = await listen(t, app);
  await assert.rejects(waitForBackend(`${url}/api/health`, () => false, 150), /frontend was not started/);
});

test('proxy preserves API paths, JSON bodies, and LAN-origin headers', async t => {
  const backend = express();
  backend.use(express.json());
  backend.post('/api/auth/register', (req, res) => res.json({ path: req.path, body: req.body, origin: req.get('Origin') }));
  const { url } = await listen(t, backend);
  const frontend = express();
  setupProxy(frontend, url);
  const proxy = await listen(t, frontend);
  const result = await fetch(`${proxy.url}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://192.168.1.27:3000' }, body: JSON.stringify({ email: 'user@test.example' }) });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { path: '/api/auth/register', body: { email: 'user@test.example' }, origin: 'http://192.168.1.27:3000' });
});

test('unavailable backend returns an actionable JSON error instead of the proxy documentation link', async t => {
  const backend = await listen(t, express());
  await new Promise(resolve => backend.server.close(resolve));
  const frontend = express();
  setupProxy(frontend, backend.url);
  const proxy = await listen(t, frontend);
  const response = await fetch(`${proxy.url}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 503);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.match((await response.json()).error, /Check the terminal running npm run dev/);
});

test('startup diagnostics distinguish port conflicts, missing databases, and database credentials', () => {
  assert.match(startupMessage({ code: 'EADDRINUSE' }), /port is already in use/);
  assert.match(startupMessage({ name: 'MongooseServerSelectionError' }), /Cannot reach MongoDB/);
  const message = startupMessage({ code: 18, message: 'bad auth: user-secret' });
  assert.match(message, /database username\/password/);
  assert.doesNotMatch(message, /user-secret/);
});

test('server exits with guidance before connecting when environment configuration is missing', () => {
  const result = spawnSync(process.execPath, ['server/server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, MONGO_URI: '', JWT_SECRET: '' }, encoding: 'utf8', timeout: 5000
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set MONGO_URI/);
  assert.doesNotMatch(result.stdout, /Backend ready|Server running/);
});
