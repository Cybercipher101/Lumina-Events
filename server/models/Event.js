const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [120, 'Title cannot exceed 120 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  event_type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['conference', 'meeting', 'gala', 'tournament', 'workshop', 'webinar', 'concert', 'exhibition', 'networking', 'seminar'],
      message: '{VALUE} is not a valid event type'
    }
  },
  venue_name: {
    type: String,
    required: [true, 'Venue name is required'],
    trim: true
  },
  venue_address: {
    type: String,
    trim: true
  },
  venue_city: {
    type: String,
    required: [true, 'Venue city is required'],
    trim: true
  },
  venue_country: {
    type: String,
    trim: true,
    default: 'India'
  },
  start_date: {
    type: Date,
    required: [true, 'Start date is required']
  },
  end_date: {
    type: Date
  },
  ticket_price: {
    type: Number,
    required: [true, 'Ticket price is required'],
    min: [0, 'Ticket price cannot be negative'],
    max: 10000000,
    validate: { validator: value => Number.isFinite(value) && Number(value.toFixed(2)) === value, message: 'Ticket price must have at most two decimal places' }
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  total_capacity: {
    type: Number,
    required: [true, 'Total capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: 10000000,
    validate: { validator: Number.isSafeInteger, message: 'Capacity must be a whole number' }
  },
  tickets_sold: {
    type: Number,
    default: 0,
    min: 0,
    validate: { validator: Number.isSafeInteger, message: 'Reserved tickets must be a whole number' }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  image_url: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available tickets
eventSchema.virtual('availableTickets').get(function() {
  return this.total_capacity - this.tickets_sold;
});

// Virtual for sold out status
eventSchema.virtual('isSoldOut').get(function() {
  return this.tickets_sold >= this.total_capacity;
});

// Index for search and filtering
eventSchema.index({ title: 'text', description: 'text' });
eventSchema.index({ event_type: 1, venue_city: 1, status: 1 });
eventSchema.index({ organizer: 1 });

module.exports = mongoose.model('Event', eventSchema);
