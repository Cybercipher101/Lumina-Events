const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const readConfig = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');

async function start() {
  const config = readConfig();
  process.env.NODE_ENV = config.mode;
  if (config.mode === 'production' && !fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html'))) {
    throw new Error('Production frontend is missing. Run npm run build before npm start.');
  }
  await connectDB();
  const app = createApp(config);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(config.port, config.host, () => resolve(listener));
    listener.once('error', reject);
  });
  server.requestTimeout = 30000;
  console.log(`Lumina listening on port ${config.port} (${config.mode})`);

  let shuttingDown = false;
  function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.locals.draining = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 15000);
    deadline.unref();
    server.close(async () => {
      try {
        await mongoose.disconnect();
        clearTimeout(deadline);
        process.exit(exitCode);
      } catch {
        process.exit(1);
      }
    });
  }
  process.once('SIGTERM', () => shutdown());
  process.once('SIGINT', () => shutdown());
  process.once('uncaughtException', () => { console.error('Uncaught server exception'); shutdown(1); });
  process.once('unhandledRejection', () => { console.error('Unhandled server rejection'); shutdown(1); });
  return { app, server };
}

if (require.main === module) {
  start().catch(async error => {
    // Never print a MongoDB URI or secret embedded in a connection error.
    console.error('Startup failed', ['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoParseError', 'MongoServerError'].includes(error.name)
      ? 'Check the database connection and credentials' : error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = start;
