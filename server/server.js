const mongoose = require('mongoose');
const readConfig = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');

async function start({ config = readConfig(), uri = process.env.MONGO_URI } = {}) {
  process.env.NODE_ENV = config.mode;
  await connectDB(uri);
  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(config.port, config.host, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`Backend ready: http://${config.host}:${config.port}/api/health (MongoDB connected)`);
  const shutdown = () => server.close(() => mongoose.disconnect().then(() => { process.exitCode = 0; }));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { app, server };
}

function startupMessage(error) {
  if (error.code === 'EADDRINUSE') return 'The backend port is already in use. Stop the other server or change API_PORT in .env.';
  if (error.code === 'EACCES') return 'The backend cannot listen on this port. Choose an API_PORT above 1024.';
  if (error.code === 18 || /authentication failed|bad auth/i.test(error.message || '')) {
    return 'MongoDB authentication failed. Check the database username/password in MONGO_URI (not your application login).';
  }
  if (['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError'].includes(error.name)) {
    return 'Cannot reach MongoDB. Start your local MongoDB service, or check MONGO_URI, the network and Atlas IP access settings. The frontend has not been started.';
  }
  if (error.name === 'MongoParseError') return 'The MongoDB connection string is invalid. Check MONGO_URI in .env.';
  if (/^(Set MONGO_URI|MONGO_URI must|Set JWT_SECRET|JWT_EXPIRE|API_PORT|FRONTEND_PORT)/.test(error.message || '')) return error.message;
  return 'Backend startup failed. Check your .env settings and database connection.';
}

if (require.main === module) {
  start().catch(async error => {
    console.error(`Backend could not start: ${startupMessage(error)}`);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
module.exports = { start, startupMessage };
