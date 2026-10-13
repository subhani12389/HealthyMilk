const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 1500);
mongoose.connection.on('disconnected', () => {
  console.error('MongoDB disconnected. Persistent API requests are temporarily disabled.');
});
mongoose.connection.on('error', (error) => {
  console.error(`MongoDB connection error: ${error.message}`);
});

let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null, lastError: null };
}
let transactionSupportPromise;

class TransactionsUnavailableError extends Error {
  constructor() {
    super('Financial operations require a MongoDB replica set or sharded cluster.');
    this.name = 'TransactionsUnavailableError';
    this.code = 'MONGO_TRANSACTIONS_UNAVAILABLE';
  }
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection;
    return mongoose.connection;
  }
  if (cached.promise) return cached.promise;

  const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isLocalhost = !mongoURI || mongoURI.includes('127.0.0.1') || mongoURI.includes('localhost');

  if (isServerless && isLocalhost) {
    cached.lastError = 'Production Vercel deployment requires a cloud MongoDB URI (e.g. MongoDB Atlas). Localhost (127.0.0.1) cannot be reached from serverless functions. Please set MONGODB_URI in Vercel project environment variables.';
    console.error(cached.lastError);
    throw new Error(cached.lastError);
  }

  if (!mongoURI) {
    cached.lastError = 'MONGODB_URI is required. Configure a MongoDB connection string before starting HealthyMilk.';
    throw new Error(cached.lastError);
  }

  const isAtlas = mongoURI.includes('mongodb+srv://') || mongoURI.includes('.mongodb.net');
  const connectOptions = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 15000,
    maxPoolSize: 10,
    minPoolSize: 1,
    autoIndex: true
  };
  if (isAtlas) {
    connectOptions.serverApi = { version: '1', strict: false, deprecationErrors: true };
  }

  cached.promise = mongoose.connect(mongoURI, connectOptions).then((connection) => {
    cached.conn = connection.connection;
    cached.lastError = null;
    console.log(`MongoDB connected successfully: ${connection.connection.host}/${connection.connection.name}`);
    return connection.connection;
  }).catch((error) => {
    cached.promise = null;
    cached.conn = null;
    cached.lastError = error.message;
    console.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  });

  return cached.promise;
}

function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
    error: cached.lastError || null
  };
}

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    code: 'DATABASE_UNAVAILABLE',
    message: 'The service is temporarily unavailable because the database is not connected.',
    details: cached.lastError || (!process.env.MONGODB_URI ? 'MONGODB_URI environment variable is not configured.' : 'Database connection could not be established.')
  });
}

async function withMongoTransaction(work) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected.');
  }

  if (!transactionSupportPromise) {
    transactionSupportPromise = mongoose.connection.db.admin().command({ hello: 1 })
      .then(hello => Boolean(hello.setName || hello.msg === 'isdbgrid'))
      .catch(() => {
        transactionSupportPromise = null;
        return false;
      });
  }
  const hasTx = await transactionSupportPromise;
  const allowStandalone = process.env.ALLOW_STANDALONE_TRANSACTIONS !== 'false' && process.env.ALLOW_STANDALONE_WRITES !== 'false';

  if (!hasTx) {
    if (allowStandalone) {
      return await work(null);
    }
    throw new TransactionsUnavailableError();
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function respondToDatabaseWriteError(res, error, message) {
  if (error.code === 'MONGO_TRANSACTIONS_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      code: error.code,
      message: 'Financial operations are unavailable until MongoDB transaction support is configured.'
    });
  }
  console.error(message, error);
  return res.status(500).json({ success: false, message });
}

module.exports = {
  connectDB,
  databaseStatus,
  requireDatabase,
  withMongoTransaction,
  respondToDatabaseWriteError
};
