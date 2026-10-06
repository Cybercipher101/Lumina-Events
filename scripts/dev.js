const path = require('node:path');
const { spawn } = require('node:child_process');
const ensureDevelopmentEnv = require('./setup');
const readConfig = require('../server/config/env');
const startClient = require('./client');

async function waitForBackend(url, isStopped = () => false, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isStopped()) throw new Error('The backend stopped before becoming ready. Fix the backend message above, then run npm run dev again.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      const data = await response.json();
      if (response.ok && data.service === 'lumina-api' && data.status === 'ready') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('The backend did not become ready. Check MongoDB and .env; the frontend was not started.');
}

async function runDev() {
  ensureDevelopmentEnv();
  // setup may have just created .env, so load it now rather than before setup.
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const config = readConfig();
  const backend = spawn(process.execPath, ['server/server.js'], { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } });
  let client;
  let stopped = false;
  let closing = false;
  const stop = (code = 0) => {
    if (closing) return;
    closing = true;
    backend.kill('SIGTERM');
    if (client) client.kill('SIGTERM');
    process.exitCode = code;
  };
  backend.once('error', () => { stopped = true; stop(1); });
  backend.once('exit', code => { stopped = true; stop(code || (closing ? 0 : 1)); });
  process.once('SIGINT', () => stop());
  process.once('SIGTERM', () => stop());
  try {
    console.log(`Checking backend on port ${config.port} before starting the website...`);
    await waitForBackend(`${config.apiOrigin}/api/health`, () => stopped || closing);
    if (closing) return;
    console.log(`Backend and database are ready. Website: http://localhost:${config.frontendPort}`);
    client = startClient(config);
    client.once('error', () => stop(1));
    client.once('exit', code => stop(code || 0));
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
}
if (require.main === module) runDev().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { runDev, waitForBackend };
