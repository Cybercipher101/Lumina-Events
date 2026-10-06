const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const protect = require('../middleware/auth');

const router = express.Router();

// Helper: send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').isString().bail().trim().isLength({ min: 1, max: 50 }).withMessage('Name is required (up to 50 characters)'),
  body('email').isString().bail().trim().isEmail().isLength({ max: 254 }).withMessage('Please provide a valid email').toLowerCase(),
  body('password').isString().bail().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must be at most 72 bytes'),
  body('role').optional().isIn(['attendee', 'organizer']).withMessage('Role must be attendee or organizer')
], async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return next(new AppError(messages, 400));
    }

    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('An account with this email already exists', 409));
    }

    // Create user
    const user = await User.create({ name, email, password, role: role || 'attendee' });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user & return JWT
// @access  Public
router.post('/login', [
  body('email').isString().bail().trim().isEmail().isLength({ max: 254 }).withMessage('Please provide a valid email').toLowerCase(),
  body('password').isString().bail().notEmpty().withMessage('Password is required')
    .custom(value => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must be at most 72 bytes')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return next(new AppError(messages, 400));
    }

    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
