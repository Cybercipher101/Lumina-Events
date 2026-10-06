const { createHash } = require('node:crypto');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const transaction = require('../utils/transaction');

const eventFields = 'title start_date end_date venue_name venue_city venue_country ticket_price currency image_url event_type status';

function fingerprint(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function checkReplay(booking, requestFingerprint) {
  if (booking.request_fingerprint !== requestFingerprint) {
    throw new AppError('This booking request key was already used for different details', 409);
  }
  return { booking, replayed: true };
}

async function createBooking(userId, input, idempotencyKey) {
  const requestFingerprint = fingerprint(input);
  const replayQuery = { user: userId, idempotency_key: idempotencyKey };

  try {
    return await transaction(async (session) => {
      if (idempotencyKey) {
        const existing = await Booking.findOne(replayQuery)
          .select('+request_fingerprint').session(session);
        if (existing) {
          checkReplay(existing, requestFingerprint);
          await existing.populate({ path: 'event', select: eventFields, options: { session } });
          return { booking: existing, replayed: true };
        }
      }

      const tickets = input.number_of_tickets;
      const event = await Event.findOneAndUpdate({
        _id: input.event,
        status: 'published',
        start_date: { $gt: new Date() },
        $expr: { $lte: [{ $add: ['$tickets_sold', tickets] }, '$total_capacity'] }
      }, { $inc: { tickets_sold: tickets } }, { new: true, session });

      if (!event) {
        const current = await Event.findById(input.event).session(session);
        if (!current) throw new AppError('Event not found', 404);
        if (current.status !== 'published' || current.start_date <= new Date()) {
          throw new AppError('This event is not available for booking', 409);
        }
        const available = Math.max(0, current.total_capacity - current.tickets_sold);
        throw new AppError(`Only ${available} tickets available`, 409);
      }

      const [booking] = await Booking.create([{
        ...input,
        user: userId,
        total_amount: Number((event.ticket_price * tickets).toFixed(2)),
        booking_status: 'confirmed',
        ...(idempotencyKey && { idempotency_key: idempotencyKey, request_fingerprint: requestFingerprint }),
        event_snapshot: {
          title: event.title,
          start_date: event.start_date,
          venue_name: event.venue_name,
          venue_city: event.venue_city,
          currency: event.currency
        }
      }], { session });
      // Populate before committing so a failed read cannot look like a failed booking.
      await booking.populate({ path: 'event', select: eventFields, options: { session } });
      return { booking, replayed: false };
    });
  } catch (error) {
    // A simultaneous retry can lose the unique-index race. Its transaction has
    // rolled back; return the committed winner without reserving any more seats.
    if (idempotencyKey && error.code === 11000 && error.keyPattern?.idempotency_key) {
      const existing = await Booking.findOne(replayQuery).select('+request_fingerprint').populate('event', eventFields);
      if (existing) return checkReplay(existing, requestFingerprint);
    }
    throw error;
  }
}

async function cancelBooking(bookingId, userId) {
  return transaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.user.toString() !== userId.toString()) {
      throw new AppError('Not authorized to cancel this booking', 403);
    }
    // Cancellation retries succeed and never release tickets twice.
    if (booking.booking_status === 'cancelled') return booking;

    const event = await Event.findOneAndUpdate({
      _id: booking.event,
      tickets_sold: { $gte: booking.number_of_tickets }
    }, { $inc: { tickets_sold: -booking.number_of_tickets } }, { new: true, session });

    if (!event) {
      throw new AppError('Booking inventory is inconsistent. Please contact the organizer.', 409);
    }
    booking.booking_status = 'cancelled';
    await booking.save({ session });
    return booking;
  });
}

module.exports = { createBooking, cancelBooking, eventFields };
