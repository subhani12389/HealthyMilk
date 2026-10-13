const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmer');
const consumerRoutes = require('./routes/consumer');
const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');
const batchRoutes = require('./routes/batch');
const adminRoutes = require('./routes/admin');
const { connectDB, databaseStatus, requireDatabase } = require('./config/db');
const { jwtSecretConfigured } = require('./middleware/authMiddleware');
const { getSmsConfigurationStatus } = require('./services/smsService');

const app = express();
const PORT = process.env.PORT || 5000;

// Audit SMS Provider Configuration Status
const smsConfiguration = getSmsConfigurationStatus();
console.info('SMS provider configuration', {
  configured: smsConfiguration.configured,
  provider: smsConfiguration.provider,
  invalidSettings: smsConfiguration.invalidSettings,
  missingVariables: smsConfiguration.configured
    ? []
    : smsConfiguration.providers.map(provider => ({
      provider: provider.name,
      missingVariables: provider.missingVariables
    }))
});

// Security Headers Middleware (Helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Universal CORS Middleware
const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? configuredCorsOrigins
    : configuredCorsOrigins.length ? configuredCorsOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key']
};
if (process.env.NODE_ENV === 'production' && configuredCorsOrigins.length === 0) {
  console.error('CORS_ORIGINS must list trusted frontend origins in production; browser API requests will be denied.');
}
app.use(cors(corsOptions));

app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health Check & Root Endpoints
app.get('/api/health', (req, res) => {
  const database = databaseStatus();
  res.json({
    server: 'ok',
    database: database.connected ? 'connected' : 'disconnected',
    databaseState: database.state,
    status: 'online',
    app: 'HealthyMilk Production API',
    smsConfigured: smsConfiguration.configured,
    time: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'HealthyMilk Production REST API Server',
    endpoints: [
      '/api/health', 
      '/api/auth/send-otp', 
      '/api/auth/verify-otp', 
      '/api/auth/create-account', 
      '/api/auth/me',
      '/api/batches',
      '/api/admin/dashboard'
    ]
  });
});

// All application APIs require the persistent database; auto-connect for serverless invocations.
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  if (!databaseStatus().connected) {
    try {
      await connectDB();
    } catch (e) {}
  }
  if (!databaseStatus().connected) return requireDatabase(req, res, next);
  if (!jwtSecretConfigured) {
    return res.status(503).json({
      success: false,
      code: 'AUTH_CONFIGURATION_MISSING',
      message: 'Authentication requires a JWT secret of at least 32 bytes.'
    });
  }
  return requireDatabase(req, res, next);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/consumer', consumerRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err);
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (field === 'phoneNumber' || field === 'mobile' || field === 'phone') {
      return res.status(409).json({ success: false, message: 'An account already exists with this phone number.' });
    }
    if (field === 'batchId') {
      return res.status(409).json({ success: false, message: 'A milk batch with this Batch ID already exists.' });
    }
    return res.status(409).json({ success: false, message: `An account with this ${field} already exists.` });
  }

  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

if (require.main === module) {
  const startServer = async () => {
    console.log('Starting HealthyMilk backend...');
    console.log('Connecting to MongoDB...');

    try {
      await connectDB();
    } catch (error) {
      console.error(`Backend starting in health-only mode because MongoDB is unavailable: ${error.message}`);
    }

    const server = app.listen(PORT, () => {
      if (databaseStatus().connected) console.log(`Server running on port ${PORT}.`);
      else console.error(`Server listening on port ${PORT}; application APIs return 503 until MongoDB connects.`);
    });

    const retryTimer = setInterval(async () => {
      if (databaseStatus().connected) return;
      try {
        await connectDB();
        console.log('MongoDB reconnected; application APIs are available.');
      } catch (error) {
        console.error(`MongoDB retry failed: ${error.message}`);
      }
    }, 10000);
    retryTimer.unref();

    const shutdown = () => {
      clearInterval(retryTimer);
      server.close(() => {
        require('mongoose').disconnect().finally(() => process.exit(0));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  };

  startServer();
}

module.exports = app;
