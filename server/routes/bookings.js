const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const protect = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, [
  body('event').notEmpty().withMessage('Event ID is required'),
  body('attendee_name').trim().notEmpty().withMessage('Attendee name is required'),
  body('attendee_email').isEmail().withMessage('Valid attendee email is required'),
  body('number_of_tickets').isInt({ min: 1 }).withMessage('Must book at least 1 ticket')
], async (req, res, next) => {
  let reservedEvent = null;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(e => e.msg).join('. ');
      return next(new AppError(messages, 400));
    }

    const {
      event: eventId,
      attendee_name,
      attendee_email,
      attendee_phone,
      number_of_tickets,
      special_requirements
    } = req.body;

    const requestedTickets = Number(number_of_tickets);

    const event = await Event.findById(eventId);
    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    if (event.status !== 'published') {
      return next(new AppError('This event is not available for booking', 400));
    }

    // Reserve tickets atomically so concurrent bookings cannot oversell the event.
    reservedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: 'published',
        $expr: {
          $lte: [
            { $add: ['$tickets_sold', requestedTickets] },
            '$total_capacity'
          ]
        }
      },
      { $inc: { tickets_sold: requestedTickets } },
      { new: true }
    );

    if (!reservedEvent) {
      const latestEvent = await Event.findById(eventId);
      const availableTickets = latestEvent
        ? Math.max(0, latestEvent.total_capacity - latestEvent.tickets_sold)
        : 0;
      return next(new AppError(`Only ${availableTickets} tickets available`, 400));
    }

    const total_amount = reservedEvent.ticket_price * requestedTickets;

    let booking;
    try {
      booking = await Booking.create({
        event: eventId,
        user: req.user.id,
        attendee_name,
        attendee_email,
        attendee_phone,
        number_of_tickets: requestedTickets,
        total_amount,
        special_requirements,
        booking_status: 'confirmed'
      });
    } catch (error) {
      // Roll back the reservation if booking creation fails.
      await Event.findByIdAndUpdate(eventId, {
        $inc: { tickets_sold: -requestedTickets }
      });
      reservedEvent = null;
      throw error;
    }

    await booking.populate('event', 'title start_date venue_name venue_city ticket_price currency');

    res.status(201).json({
      success: true,
      booking
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/bookings/my
// @desc    Get current user's bookings
// @access  Private
router.get('/my', protect, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('event', 'title start_date end_date venue_name venue_city venue_country ticket_price currency image_url event_type status')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel a booking
// @access  Private (owner only)
router.put('/:id/cancel', protect, async (req, res, next) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id,
        booking_status: { $ne: 'cancelled' }
      },
      { booking_status: 'cancelled' },
      { new: true }
    );

    if (!booking) {
      const existingBooking = await Booking.findById(req.params.id);

      if (!existingBooking) {
        return next(new AppError('Booking not found', 404));
      }

      if (existingBooking.user.toString() !== req.user.id) {
        return next(new AppError('Not authorized to cancel this booking', 403));
      }

      return next(new AppError('Booking is already cancelled', 400));
    }

    await Event.findByIdAndUpdate(booking.event, {
      $inc: { tickets_sold: -booking.number_of_tickets }
    });

    res.status(200).json({
      success: true,
      booking
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
