const path = require('node:path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

function readConfig(env = process.env) {
  if (!env.MONGO_URI || env.MONGO_URI === 'your_mongodb_connection_string') {
    throw new Error('Set MONGO_URI in the project-root .env file to your local MongoDB or Atlas connection string.');
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI)) {
    throw new Error('MONGO_URI must start with mongodb:// or mongodb+srv://.');
  }
  if (!env.JWT_SECRET || !env.JWT_SECRET.trim()) {
    throw new Error('Set JWT_SECRET in .env to a private random secret. npm run setup generates one when creating a new .env.');
  }
  try {
    jwt.sign({ configurationCheck: true }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRE || '30d' });
  } catch {
    throw new Error('JWT_EXPIRE is invalid. Use a duration such as 30d or 7d in .env.');
  }
  const port = Number(env.API_PORT || env.PORT || 5000);
  const frontendPort = Number(env.FRONTEND_PORT || 3000);
  for (const [name, value] of [['API_PORT', port], ['FRONTEND_PORT', frontendPort]]) {
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a number between 1 and 65535.`);
  }
  if (port === frontendPort) throw new Error('API_PORT and FRONTEND_PORT must use different ports (for example 5000 and 3000).');
  const mode = env.NODE_ENV || 'development';
  const host = env.API_HOST || (mode === 'production' ? '0.0.0.0' : '127.0.0.1');
  const proxyHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host;
  const apiOrigin = `http://${proxyHost.includes(':') ? `[${proxyHost}]` : proxyHost}:${port}`;
  return { port, frontendPort, host, mode, apiOrigin };
}

module.exports = readConfig;
