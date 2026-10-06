const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

function ensureDevelopmentEnv(root = path.join(__dirname, '..')) {
  const filename = path.join(root, '.env');
  try {
    fs.writeFileSync(filename, [
      'NODE_ENV=development',
      'API_PORT=5000',
      'FRONTEND_PORT=3000',
      'MONGO_URI=mongodb://127.0.0.1:27017/lumina',
      `JWT_SECRET=${randomBytes(48).toString('hex')}`,
      'JWT_EXPIRE=30d',
      ''
    ].join('\n'), { flag: 'wx', mode: 0o600 });
    console.log('Created .env with a generated development secret and a local MongoDB address.');
    console.log('If you use Atlas, replace MONGO_URI in .env with your Atlas connection string.');
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

if (require.main === module) {
  try {
    if (!ensureDevelopmentEnv()) console.log('Existing .env preserved.');
  } catch {
    console.error('Could not create .env. Check the project directory permissions.');
    process.exitCode = 1;
  }
}
module.exports = ensureDevelopmentEnv;
