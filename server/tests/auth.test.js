const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { waitForBackend } = require('../../scripts/dev');
const User = require('../models/User');

process.env.JWT_SECRET = 'disposable-auth-test-secret-never-for-production';
delete process.env.JWT_EXPIRE;
let mongo, dev, base;
let output = '';

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

before(async () => {
  // Explicit disposable URI: tests never connect to the user's MONGO_URI.
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.16' } });
  const uri = mongo.getUri('lumina-auth-tests');
  await mongoose.connect(uri);
  await User.init();
  const apiPort = await freePort();
  let frontendPort = await freePort();
  while (frontendPort === apiPort) frontendPort = await freePort();
  base = `http://127.0.0.1:${frontendPort}`;
  // This is npm run dev's entry point, including CRA and its real setupProxy.
  // Legacy PORT must not make CRA compete with the backend for port 5000.
  dev = spawn(process.execPath, ['scripts/dev.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, NODE_ENV: 'development', MONGO_URI: uri, JWT_SECRET: process.env.JWT_SECRET, JWT_EXPIRE: '', PORT: '5000', API_PORT: String(apiPort), API_HOST: '127.0.0.1', FRONTEND_PORT: String(frontendPort), FRONTEND_HOST: '127.0.0.1', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const capture = data => { output = (output + data.toString()).slice(-16000); };
  dev.stdout.on('data', capture);
  dev.stderr.on('data', capture);
  try {
    await waitForBackend(`${base}/api/health`, () => dev.exitCode !== null, 90000);
  } catch (error) {
    throw new Error(`${error.message}\nDevelopment output:\n${output}`);
  }
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="root"/);
}, { timeout: 120000 });

after(async () => {
  if (dev && dev.exitCode === null) {
    const closed = once(dev, 'exit');
    dev.kill('SIGTERM');
    const timer = setTimeout(() => dev.kill('SIGKILL'), 10000);
    try { await closed; } finally { clearTimeout(timer); }
  }
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => { await User.deleteMany({}); });

async function request(endpoint, body, token) {
  const response = await fetch(`${base}/api/auth/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Origin: 'http://192.168.1.27:3000', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json() };
}
const account = { name: 'Test User', email: 'user@test.example', password: 'password123' };

test('registration and login work through the actual development proxy on standalone MongoDB', async () => {
  const registered = await request('register', account);
  assert.equal(registered.status, 201, JSON.stringify(registered.data));
  assert.ok(registered.data.token);
  assert.equal(registered.data.user.email, account.email);
  assert.equal(registered.data.user.password, undefined);
  assert.ok(jwt.verify(registered.data.token, process.env.JWT_SECRET).exp);
  const saved = await User.findOne({ email: account.email }).select('+password');
  assert.notEqual(saved.password, account.password);
  assert.equal(await saved.matchPassword(account.password), true);
  const loggedIn = await request('login', { email: account.email, password: account.password });
  assert.equal(loggedIn.status, 200);
  const me = await request('me', undefined, loggedIn.data.token);
  assert.equal(me.status, 200);
  assert.equal(me.data.user.id, registered.data.user.id);
});

test('email whitespace and casing do not prevent login', async () => {
  assert.equal((await request('register', { ...account, email: '  USER@test.example  ' })).status, 201);
  assert.equal((await request('login', { email: ' USER@TEST.EXAMPLE ', password: account.password })).status, 200);
});

test('duplicate registration and incorrect passwords return real application errors', async () => {
  await request('register', account);
  const duplicate = await request('register', account);
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.data.error, /already exists/);
  const denied = await request('login', { email: account.email, password: 'wrong-password' });
  assert.equal(denied.status, 401);
  assert.match(denied.data.error, /Invalid email or password/);
  assert.equal(await User.countDocuments({}), 1);
});

test('invalid registrations do not create accounts', async () => {
  for (const body of [{ ...account, email: 'bad-email' }, { ...account, password: '123' }, { ...account, role: 'admin' }]) {
    assert.equal((await request('register', body)).status, 400);
  }
  assert.equal(await User.countDocuments({}), 0);
});

test('authenticated sessions fail cleanly for missing or expired tokens', async () => {
  assert.equal((await request('me')).status, 401);
  const registered = await request('register', account);
  const expired = jwt.sign({ id: registered.data.user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await request('me', undefined, expired)).status, 401);
});
