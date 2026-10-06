const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.isOperational ? err.statusCode : 500;
  let message = err.isOperational ? err.message : 'An unexpected error occurred. Please try again.';

  if (err.status === 404) {
    status = 404;
    message = 'Resource not found';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid resource ID or field value';
  } else if (err.code === 11000) {
    status = 409;
    message = err.keyPattern?.email ? 'An account with this email already exists' : 'This record already exists';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map(e => e.message).join('. ');
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body must contain valid JSON';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError'].includes(err.name)) {
    status = 503;
    message = 'The service is temporarily unavailable. Please try again.';
  }

  // Log server failures without including request bodies, tokens or connection strings.
  if (status >= 500) console.error('Request failed', { requestId: req.id, name: err.name, code: err.code });
  res.status(status).json({ success: false, error: message, requestId: req.id });
};

module.exports = errorHandler;
