const path = require('node:path');
const { spawn } = require('node:child_process');
const readConfig = require('../server/config/env');

function startClient(config = readConfig()) {
  return spawn(process.execPath, [require.resolve('react-scripts/scripts/start')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(config.frontendPort),
      HOST: process.env.FRONTEND_HOST || '0.0.0.0',
      API_PROXY_TARGET: config.apiOrigin,
      BROWSER: process.env.BROWSER || 'none'
    }
  });
}
if (require.main === module) {
  try {
    const client = startClient();
    client.once('exit', code => { process.exitCode = code || 0; });
    process.once('SIGINT', () => client.kill('SIGINT'));
    process.once('SIGTERM', () => client.kill('SIGTERM'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = startClient;
