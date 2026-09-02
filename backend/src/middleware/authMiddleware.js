const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { users } = require('../store');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'healthymilk_jwt_super_secret_key_2026';

// 1. Rate Limiting Middleware for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 15, // limit each IP to 15 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

// 2. JWT Verification Middleware
const verifyToken = async (req, res, next) => {
  try {
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
    } catch (err) {
      // Fallback check for simulated legacy format tokens e.g. jwt_token_<id>_
      if (token.startsWith('jwt_token_')) {
        const idMatch = token.split('_')[2];
        const matchedUser = users.find(u => u.id === idMatch || token.includes(u.id));
        if (matchedUser) {
          decoded = { id: matchedUser.id, role: matchedUser.role, email: matchedUser.email };
        }
      }
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid token. Please log in again.'
      });
    }

    // Load active user profile from DB or Memory
    let currentUser = null;
    try {
      currentUser = await User.findById(decoded.id);
    } catch (e) {
      // DB check optional if not connected
    }

    if (!currentUser) {
      currentUser = users.find(u => u.id === decoded.id || u.email === decoded.email);
    }

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
  authLimiter,
  verifyToken,
  requireRole
};
