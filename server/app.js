const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');

function createApp(config, { clientDir = path.join(__dirname, '..', 'dist') } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: config.mode === 'production' ? {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"]
      }
    } : false,
    strictTransportSecurity: config.mode === 'production'
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      // Same-origin requests need no CORS permission. Decline CORS headers for
      // other origins; authorization is still enforced by the API.
      callback(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !/^application\/json(?:;|$)/i.test(req.get('Content-Type') || '')) {
      return next(new AppError('Content-Type must be application/json', 415));
    }
    if (req.body !== undefined && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')) {
      return next(new AppError('Request body must be a JSON object', 400));
    }
    next();
  });

  const rateLimitOptions = {
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please try again later.' }
  };
  app.use('/api', rateLimit({ ...rateLimitOptions, windowMs: 60000, limit: 300, skip: req => ['/health', '/health/ready'].includes(req.path) }));
  app.use(['/api/auth/login', '/api/auth/register'], rateLimit({ ...rateLimitOptions, windowMs: 15 * 60000, limit: 20 }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/health/ready', async (req, res) => {
    try {
      if (app.locals.draining || mongoose.connection.readyState !== 1) throw new Error('not ready');
      await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api', (req, res, next) => {
    if (app.locals.draining || mongoose.connection.readyState !== 1) {
      return next(new AppError('The service is temporarily unavailable. Please try again.', 503));
    }
    next();
  });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/bookings', require('./routes/bookings'));
  // API errors and missing assets must never receive the SPA's HTML fallback.
  app.use('/api', (req, res, next) => next(new AppError('API endpoint not found', 404)));

  if (fs.existsSync(path.join(clientDir, 'index.html'))) {
    app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
    app.use(express.static(clientDir, { index: false, maxAge: 0 }));
    app.get('/{*path}', (req, res, next) => {
      if (path.extname(req.path) || !req.accepts('html')) return next(new AppError('Resource not found', 404));
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }
  app.use((req, res, next) => next(new AppError('Resource not found', 404)));
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
