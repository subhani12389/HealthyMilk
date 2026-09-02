const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/healthymilk';

  try {
    const conn = await mongoose.connect(mongoURI, {
      autoIndex: true, // Ensure unique indexes are built
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.warn(`⚠️ MongoDB Connection Warning: ${err.message}. Operating in database fallback mode.`);
    return null;
  }
};

module.exports = connectDB;
