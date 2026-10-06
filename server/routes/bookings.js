const express = require('express');
const { body, param, header, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const protect = require('../middleware/auth');
const { createBooking, cancelBooking, eventFields } = require('../services/bookings');

const router = express.Router();

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array().map(e => e.msg).join('. '), 400);
}

router.post('/', protect, [
  body('event').isString().bail().isMongoId().withMessage('Valid event ID is required'),
  body('attendee_name').isString().bail().trim().isLength({ min: 1, max: 100 }).withMessage('Attendee name is required (up to 100 characters)'),
  body('attendee_email').isString().bail().trim().isEmail().isLength({ max: 254 }).withMessage('Valid attendee email is required').toLowerCase(),
  body('attendee_phone').optional().isString().bail().trim().isLength({ max: 30 }),
  body('number_of_tickets').custom(value => typeof value === 'number' || typeof value === 'string').bail()
    .isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).withMessage('Must book a positive whole number of tickets').toInt(),
  body('special_requirements').optional().isString().bail().trim().isLength({ max: 500 }).withMessage('Special requirements cannot exceed 500 characters'),
  header('Idempotency-Key').optional().isUUID(4).withMessage('Idempotency-Key must be a UUID v4')
], async (req, res) => {
  validate(req);
  const input = {
    event: req.body.event,
    attendee_name: req.body.attendee_name,
    attendee_email: req.body.attendee_email,
    attendee_phone: req.body.attendee_phone || '',
    number_of_tickets: req.body.number_of_tickets,
    special_requirements: req.body.special_requirements || ''
  };
  const { booking, replayed } = await createBooking(req.user.id, input, req.get('Idempotency-Key'));
  res.status(replayed ? 200 : 201).json({ success: true, booking, replayed });
});

router.get('/my', protect, async (req, res) => {
  const bookings = await Booking.find({ user: req.user.id })
    .populate('event', eventFields).sort('-createdAt');
  res.json({ success: true, count: bookings.length, bookings });
});

router.put('/:id/cancel', protect, [param('id').isMongoId().withMessage('Valid booking ID is required')], async (req, res) => {
  validate(req);
  const booking = await cancelBooking(req.params.id, req.user.id);
  res.json({ success: true, booking });
});

module.exports = router;
