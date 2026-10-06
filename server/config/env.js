const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

function readConfig(env = process.env) {
  const mode = env.NODE_ENV || (process.argv.includes('--dev') ? 'development' : 'production');
  if (!['development', 'production', 'test'].includes(mode)) throw new Error('NODE_ENV must be development, production or test');
  if (!env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32 || /^(change[-_ ]?me|your_|replace)/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 bytes');
  }
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isSafeInteger(trustProxy) || trustProxy < 0 || trustProxy > 10) throw new Error('TRUST_PROXY must be a hop count between 0 and 10');
  const allowedOrigins = (env.CORS_ORIGINS || (mode === 'development' ? 'http://localhost:3000' : '')).split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');
    if (mode === 'production' && url.protocol !== 'https:') throw new Error('Production CORS origins must use HTTPS');
  }
  return { mode, port, host: env.HOST || '0.0.0.0', trustProxy, allowedOrigins };
}

module.exports = readConfig;
