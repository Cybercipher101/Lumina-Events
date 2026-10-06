const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
  app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ service: 'lumina-api', status: ready ? 'ready' : 'database-unavailable' });
  });
  app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1) return next(new AppError('The database is unavailable. Check the backend terminal and MONGO_URI in .env.', 503));
    next();
  });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api', (req, res, next) => next(new AppError('API endpoint not found', 404)));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
