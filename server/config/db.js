const mongoose = require('mongoose');

const connectDB = async (uri = process.env.MONGO_URI) => {
  // Existing standalone MongoDB and Atlas connections are both supported.
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
};

module.exports = connectDB;
