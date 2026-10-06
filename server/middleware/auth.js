const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Protect routes — verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && /^Bearer \S+$/i.test(req.headers.authorization)) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized — no token provided', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Attach user to request
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return next(new AppError('User belonging to this token no longer exists', 401));
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Not authorized — invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Not authorized — token expired', 401));
    }
    return next(error);
  }
};

module.exports = protect;
module.exports.optional = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next();
