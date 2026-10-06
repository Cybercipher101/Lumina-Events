const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const bookingSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  attendee_name: {
    type: String,
    required: [true, 'Attendee name is required'],
    trim: true,
    maxlength: 100
  },
  attendee_email: {
    type: String,
    required: [true, 'Attendee email is required'],
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  attendee_phone: {
    type: String,
    trim: true,
    maxlength: 30
  },
  number_of_tickets: {
    type: Number,
    required: [true, 'Number of tickets is required'],
    min: [1, 'Must book at least 1 ticket'],
    validate: { validator: Number.isSafeInteger, message: 'Tickets must be a whole number' }
  },
  total_amount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },
  booking_status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled'],
    default: 'confirmed'
  },
  booking_reference: {
    type: String,
    unique: true
  },
  idempotency_key: { type: String, select: false },
  request_fingerprint: { type: String, select: false },
  event_snapshot: {
    title: String,
    start_date: Date,
    venue_name: String,
    venue_city: String,
    currency: String
  },
  special_requirements: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requirements cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.idempotency_key;
      delete ret.request_fingerprint;
      return ret;
    }
  }
});

// Auto-generate booking reference before saving
bookingSchema.pre('save', function() {
  if (!this.booking_reference) {
    this.booking_reference = `EVT-${randomUUID().toUpperCase()}`;
  }
});

// Index for user booking lookups
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ event: 1 });
bookingSchema.index({ user: 1, idempotency_key: 1 }, {
  unique: true,
  partialFilterExpression: { idempotency_key: { $type: 'string' } }
});

module.exports = mongoose.model('Booking', bookingSchema);
