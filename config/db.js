const mongoose = require('mongoose');

let isConnected = false; // Track connection status globally

const connectDB = async () => {
  if (isConnected) {
    console.log('=> Using existing database connection');
    return;
  }

  console.log('=> Creating new database connection');
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: true, // Builds indexes for fast queries; good for scheduling constraints
    });
    
    isConnected = db.connections[0].readyState === 1;
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    // In serverless environment, do not process.exit(1); throw error instead so function can retry safely
    throw error;
  }
};

module.exports = connectDB;