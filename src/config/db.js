const mongoose = require('mongoose');
const config = require('./index');

async function connectDB(uri = config.mongodbUri) {
  try {
    await mongoose.connect(uri);
    console.log('✓ MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.error('✗ MongoDB connection error:', err.message);
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
