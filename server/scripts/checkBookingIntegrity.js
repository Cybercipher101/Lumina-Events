const mongoose = require('mongoose');
const readConfig = require('../config/env');
const connectDB = require('../config/db');
const transaction = require('../utils/transaction');
const Event = require('../models/Event');
const Booking = require('../models/Booking');

// Read-only inventory audit. Never infer a repair or silently overwrite history.
async function checkIntegrity() {
  return transaction(async session => {
    const counts = await Booking.aggregate([
      { $group: { _id: '$event', reserved: { $sum: { $cond: [{ $ne: ['$booking_status', 'cancelled'] }, '$number_of_tickets', 0] } } } }
    ]).session(session);
    const events = await Event.find().select('_id total_capacity tickets_sold').session(session).lean();
    const reserved = new Map(counts.map(record => [record._id.toString(), record.reserved]));
    const issues = [];
    for (const event of events) {
      const id = event._id.toString();
      const expected = reserved.get(id) || 0;
      if (event.tickets_sold !== expected || event.tickets_sold < 0 || event.tickets_sold > event.total_capacity) {
        issues.push({ event: id, tickets_sold: event.tickets_sold, booking_tickets: expected, capacity: event.total_capacity });
      }
      reserved.delete(id);
    }
    for (const [id, count] of reserved) issues.push({ event: id, missing_event: true, booking_tickets: count });
    return issues;
  });
}

if (require.main === module) {
  (async () => {
    readConfig();
    await connectDB();
    const issues = await checkIntegrity();
    console.log(JSON.stringify({ consistent: issues.length === 0, issues }, null, 2));
    process.exitCode = issues.length ? 1 : 0;
  })().catch(() => {
    console.error('Inventory audit failed. Check your configuration and database connection.');
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = checkIntegrity;
