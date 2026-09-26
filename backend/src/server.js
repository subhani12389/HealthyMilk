require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmer');
const consumerRoutes = require('./routes/consumer');
const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');
const batchRoutes = require('./routes/batch');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database Connection
connectDB();

// Audit SMS Provider Configuration Status
const isSmsConfigured = !!(
  process.env.FAST2SMS_API_KEY ||
  process.env.TWILIO_ACCOUNT_SID ||
  process.env.MSG91_AUTH_KEY ||
  process.env.SMS_API_URL
);
console.log(`📱 SMS API Configured: ${isSmsConfigured ? 'YES ✅' : 'NO (Set FAST2SMS_API_KEY, TWILIO, MSG91, or SMS_API_URL in .env) ⚠️'}`);

// Security Headers Middleware (Helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Universal CORS Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health Check & Root Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'HealthyMilk Production API',
    smsConfigured: isSmsConfigured,
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
  app.listen(PORT, () => {
    console.log(`🥛 HealthyMilk Backend Server running on port ${PORT}`);
  });
}

module.exports = app;
