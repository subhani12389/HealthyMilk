const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { requireDatabase } = require('../config/db');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const jwtSecretConfigured = typeof JWT_SECRET === 'string' && Buffer.byteLength(JWT_SECRET) >= 32;

// 1. Rate Limiting Middleware for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.AUTH_RATE_LIMIT_MAX ? Number(process.env.AUTH_RATE_LIMIT_MAX) : 100, // limit each IP per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

const otpVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please try again later.'
  }
});

// 2. JWT Verification Middleware
const verifyToken = async (req, res, next) => {
  try {
    if (!jwtSecretConfigured) {
      return res.status(503).json({ success: false, message: 'Authentication requires a JWT secret of at least 32 bytes.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No authorization token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {}

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid token. Please log in again.'
      });
    }

    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or session revoked.'
      });
    }

    if (currentUser.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Attach sanitized user to request
    req.user = currentUser.toAuthJSON ? currentUser.toAuthJSON() : currentUser;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Invalid or expired token.'
    });
  }
};

// 3. Role-Based Access Control Middleware (RBAC)
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated. Please log in.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    
    // Normalize role synonyms: 'agent' <-> 'delivery_agent', 'delivery' <-> 'delivery_agent'
    const normalizedUserRoles = [
      userRole,
      userRole === 'agent' ? 'delivery_agent' : null,
      userRole === 'delivery' ? 'delivery_agent' : null,
      userRole === 'delivery_agent' ? 'agent' : null
    ].filter(Boolean);

    const isAllowed = allowedRoles.some(role => 
      normalizedUserRoles.includes(role.toLowerCase())
    );

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Unauthorized role access. You do not have permission to access this resource.',
        assignedRole: userRole,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

module.exports = {
  JWT_SECRET,
  jwtSecretConfigured,
  authLimiter,
  otpVerificationLimiter,
  verifyToken,
  requireDatabase,
  requireRole
};
