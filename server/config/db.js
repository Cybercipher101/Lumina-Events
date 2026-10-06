const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');

const connectDB = async (uri = process.env.MONGO_URI) => {
  mongoose.set('bufferCommands', false);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== 'isdbgrid') {
      throw new Error('MongoDB transactions require a replica set or MongoDB Atlas; standalone MongoDB is unsupported');
    }
    // Ensure the unique idempotency and user indexes exist before accepting traffic.
    // createIndexes is additive: it never removes indexes from existing databases.
    await User.createIndexes();
    await Event.createIndexes();
    await Booking.createIndexes();
    return mongoose.connection;
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
};

module.exports = connectDB;
