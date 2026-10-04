const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const protect = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// @route   GET /api/events
// @desc    Get all published events (with search/filter)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { search, type, city, featured } = req.query;

    let query = { status: 'published' };

    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by event type
    if (type && type !== 'all') {
      query.event_type = type;
    }

    // Filter by city
    if (city && city !== 'all') {
      query.venue_city = { $regex: city, $options: 'i' };
    }

    // Filter featured
    if (featured === 'true') {
      query.featured = true;
    }

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/events/my/events
// @desc    Get organizer's own events
// @access  Private (Organizer)
router.get('/my/events', protect, authorize('organizer'), async (req, res, next) => {
  try {
    const events = await Event.find({ organizer: req.user.id })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/events/:id
// @desc    Get single event
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email');

    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private (Organizer)
router.post('/', protect, authorize('organizer'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('event_type').notEmpty().withMessage('Event type is required'),
  body('venue_name').trim().notEmpty().withMessage('Venue name is required'),
  body('venue_city').trim().notEmpty().withMessage('Venue city is required'),
  body('start_date').notEmpty().withMessage('Start date is required'),
  body('ticket_price').isNumeric().withMessage('Ticket price must be a number'),
  body('total_capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return next(new AppError(messages, 400));
    }

    // Attach organizer
    req.body.organizer = req.user.id;

    const event = await Event.create(req.body);

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/events/:id
// @desc    Update an event
// @access  Private (Organizer — owner only)
router.put('/:id', protect, authorize('organizer'), async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    // Check ownership
    if (event.organizer.toString() !== req.user.id) {
      return next(new AppError('Not authorized to update this event', 403));
    }

    // Don't allow changing organizer
    delete req.body.organizer;
    delete req.body.tickets_sold;

    event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event
// @access  Private (Organizer — owner only)
router.delete('/:id', protect, authorize('organizer'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    // Check ownership
    if (event.organizer.toString() !== req.user.id) {
      return next(new AppError('Not authorized to delete this event', 403));
    }

    const bookingCount = await Booking.countDocuments({ event: event._id });
    if (bookingCount > 0) {
      return next(new AppError('Cannot delete an event with booking history. Cancel the event instead.', 400));
    }

    await Event.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
