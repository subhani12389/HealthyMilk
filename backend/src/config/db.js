const mongoose = require('mongoose');

// Disable command buffering when disconnected to enable instant zero-latency fallback mode
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 1500);

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/healthymilk';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2500,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      autoIndex: true, // Ensure performance indexes are built
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.warn(`⚠️ MongoDB Connection Warning: ${err.message}. Operating in database fallback mode.`);
    return null;
  }
};

module.exports = connectDB;
