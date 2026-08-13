const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmer');
const consumerRoutes = require('./routes/consumer');
const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Universal CORS Middleware for all origins & preflight OPTIONS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json());

// Health Check & Root Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'HealthyMilk Production API',
    time: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'HealthyMilk Production REST API Server',
    endpoints: ['/api/health', '/api/auth/login', '/api/farmer/dashboard', '/api/consumer/dashboard', '/api/delivery/dashboard']
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/consumer', consumerRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🥛 HealthyMilk Backend Server running on port ${PORT}`);
  });
}

module.exports = app;
