const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const protect = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const transaction = require('../utils/transaction');

const router = express.Router();
const editableFields = ['title', 'description', 'event_type', 'venue_name', 'venue_address', 'venue_city', 'venue_country', 'start_date', 'end_date', 'ticket_price', 'currency', 'total_capacity', 'status', 'image_url', 'tags'];

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array().map(e => e.msg).join('. '), 400);
}

function eventInput(input) {
  return Object.fromEntries(editableFields.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
}

function checkEvent(event, requireFuture = false) {
  if (event.end_date && event.end_date <= event.start_date) {
    throw new AppError('End date must be after the start date', 400);
  }
  if (requireFuture && event.status === 'published' && event.start_date <= new Date()) {
    throw new AppError('Published events must start in the future', 400);
  }
  if (event.total_capacity < event.tickets_sold) {
    throw new AppError('Capacity cannot be lower than the number of reserved tickets', 409);
  }
}

function eventValidation(partial = false) {
  const field = key => partial ? body(key).optional({ values: 'undefined' }) : body(key);
  return [
    field('title').isString().bail().trim().isLength({ min: 1, max: 120 }),
    field('event_type').isIn(Event.schema.path('event_type').enumValues),
    field('venue_name').isString().bail().trim().isLength({ min: 1, max: 200 }),
    field('venue_city').isString().bail().trim().isLength({ min: 1, max: 100 }),
    field('start_date').isISO8601().withMessage('Valid start date is required'),
    field('ticket_price').isFloat({ min: 0, max: 10000000 }).withMessage('Ticket price must be between 0 and 10000000').toFloat()
      .custom(value => Number.isFinite(value) && Number(value.toFixed(2)) === value).withMessage('Ticket price must have at most two decimal places'),
    field('total_capacity').isInt({ min: 1, max: 10000000 }).withMessage('Capacity must be a positive whole number (up to 10000000)').toInt(),
    body('end_date').optional({ values: 'null' }).isISO8601().withMessage('Valid end date is required'),
    body('description').optional().isString().bail().trim().isLength({ max: 2000 }),
    body('venue_address').optional().isString().bail().trim().isLength({ max: 500 }),
    body('venue_country').optional().isString().bail().trim().isLength({ min: 1, max: 100 }),
    body('currency').optional().isIn(['INR', 'USD', 'EUR', 'GBP']),
    body('status').optional().isIn(['draft', 'published', 'cancelled', 'completed']),
    body('image_url').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).isLength({ max: 2000 }),
    body('tags').optional().isArray({ max: 20 }),
    body('tags.*').optional().isString().bail().trim().isLength({ min: 1, max: 50 })
  ];
}

const idValidation = [param('id').isMongoId().withMessage('Valid event ID is required')];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', [
  query('search').optional().isString().isLength({ max: 120 }),
  query('type').optional().isString().isLength({ max: 30 }),
  query('city').optional().isString().isLength({ max: 100 }),
  query('featured').optional().isIn(['true', 'false']),
  query('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  validate(req);
  const { search, type, city, featured } = req.query;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const filter = { status: 'published', start_date: { $gt: new Date() } };
  if (search) {
    filter.$or = [{ title: { $regex: escapeRegex(search), $options: 'i' } }, { description: { $regex: escapeRegex(search), $options: 'i' } }];
  }
  if (type && type !== 'all') filter.event_type = type;
  if (city && city !== 'all') filter.venue_city = { $regex: escapeRegex(city), $options: 'i' };
  if (featured === 'true') filter.featured = true;
  const [events, total] = await Promise.all([
    Event.find(filter).populate('organizer', 'name').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Event.countDocuments(filter)
  ]);
  res.json({ success: true, count: events.length, total, page, pages: Math.ceil(total / limit), events });
});

router.get('/my/events', protect, authorize('organizer'), async (req, res) => {
  const events = await Event.find({ organizer: req.user.id }).sort('-createdAt');
  res.json({ success: true, count: events.length, events });
});

router.get('/:id', protect.optional, idValidation, async (req, res) => {
  validate(req);
  const event = await Event.findById(req.params.id).populate('organizer', 'name');
  if (!event || (event.status === 'draft' && event.organizer?._id.toString() !== req.user?.id)) {
    throw new AppError('Event not found', 404);
  }
  res.json({ success: true, event });
});

router.post('/', protect, authorize('organizer'), eventValidation(), async (req, res) => {
  validate(req);
  // Server-controlled fields (inventory, organizer and featured) cannot be supplied by clients.
  const event = new Event({ ...eventInput(req.body), organizer: req.user.id });
  checkEvent(event, true);
  await event.save();
  res.status(201).json({ success: true, event });
});

router.put('/:id', protect, authorize('organizer'), idValidation, eventValidation(true), async (req, res) => {
  validate(req);
  const event = await transaction(async (session) => {
    const current = await Event.findById(req.params.id).session(session);
    if (!current) throw new AppError('Event not found', 404);
    if (current.organizer.toString() !== req.user.id) throw new AppError('Not authorized to update this event', 403);
    current.set(eventInput(req.body));
    checkEvent(current, Object.hasOwn(req.body, 'start_date') || Object.hasOwn(req.body, 'status'));
    await current.save({ session });
    return current;
  });
  res.json({ success: true, event });
});

router.delete('/:id', protect, authorize('organizer'), idValidation, async (req, res) => {
  validate(req);
  await transaction(async (session) => {
    const current = await Event.findById(req.params.id).session(session);
    if (!current) throw new AppError('Event not found', 404);
    if (current.organizer.toString() !== req.user.id) throw new AppError('Not authorized to delete this event', 403);

    // Write the event before reading history. Booking writes the same document,
    // so concurrent reservations conflict and retry against the committed state.
    await Event.deleteOne({ _id: current._id }, { session });
    if (await Booking.exists({ event: current._id }).session(session)) {
      throw new AppError('Cannot delete an event with booking history. Cancel the event instead.', 409);
    }
  });
  res.json({ success: true, message: 'Event deleted successfully' });
});

module.exports = router;
