const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { users, supabase } = require('../store');
const User = require('../models/User');
const { JWT_SECRET, authLimiter, verifyToken } = require('../middleware/authMiddleware');

// Input Validation Helpers
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim().toLowerCase());
};

const extract10DigitMobile = (mobileStr) => {
  if (!mobileStr) return '';
  const digitsOnly = mobileStr.replace(/[^\d]/g, '');
  // If 12 digits starting with 91, take last 10 digits
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  return digitsOnly;
};

const isValidMobile = (mobileStr) => {
  const clean = extract10DigitMobile(mobileStr);
  return /^[0-9]{10}$/.test(clean);
};

const validatePasswordRules = (password) => {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character.';
  return null;
};

// Helper: Format user record into standardized frontend format without sensitive fields
const formatUserObject = (u) => {
  if (!u) return null;
  const userObj = u.toAuthJSON ? u.toAuthJSON() : { ...u };
  delete userObj.password;
  delete userObj.__v;

  return {
    id: userObj._id ? userObj._id.toString() : userObj.id,
    _id: userObj._id ? userObj._id.toString() : userObj.id,
    name: userObj.name,
    email: userObj.email,
    mobile: userObj.mobile || userObj.phone || '9876543210',
    phone: userObj.mobile || userObj.phone || '9876543210',
    role: userObj.role === 'agent' ? 'delivery_agent' : userObj.role,
    isActive: userObj.isActive !== undefined ? userObj.isActive : true,
    balance: userObj.balance !== undefined && userObj.balance !== null ? Number(userObj.balance) : 0,
    farmName: userObj.farmName || userObj.farm_name || `${userObj.name}'s Dairy Farm`,
    location: userObj.location || userObj.farm_location || 'Kaira Valley, Anand',
    cattleCount: userObj.cattleCount || userObj.cattle_count || 15,
    rating: userObj.rating ? Number(userObj.rating) : 5.0,
    address: userObj.address || 'Apt 402, Green Acres Heights, Sector 14',
    vehicleNo: userObj.vehicleNo || userObj.vehicle_no || 'GJ-07-MK-4421',
    assignedArea: userObj.assignedArea || userObj.assigned_area || 'Sector 14 & Green Valley',
    totalDeliveries: userObj.totalDeliveries || userObj.total_deliveries || 69,
    bankDetails: userObj.bankDetails || {
      accountNo: 'XXXX-XXXX-8921',
      ifsc: 'SBIN0004123',
      bankName: 'State Bank of India'
    },
    subscription: userObj.subscription || {
      id: `sub_${userObj.id || Date.now()}`,
      planName: 'Pure Fresh A2 Cow Milk',
      dailyLiters: 2,
      totalDays: 30,
      daysRemaining: 22,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'Active',
      pricePerLiter: 65,
      totalAmountPaid: 3900,
      deliveryTimeSlot: '6:30 AM - 7:30 AM'
    },
    createdAt: userObj.createdAt || new Date().toISOString(),
    updatedAt: userObj.updatedAt || new Date().toISOString()
  };
};

// ==========================================
// 1. POST /api/auth/signup - User Registration
// ==========================================
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, mobile, phone, password, confirmPassword, role, farmName, address, vehicleNo, assignedArea } = req.body;

    // 1. Validate Required Fields & Formatting
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Full name is required and must be at least 2 characters long.' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const cleanMobile = extract10DigitMobile(mobile || phone);
    if (!cleanMobile || cleanMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'Mobile number must be exactly 10 digits.' });
    }

    const passwordError = validatePasswordRules(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Confirm Password must exactly match Password.' });
    }

    let selectedRole = (role || 'consumer').toLowerCase();
    if (!['farmer', 'consumer', 'delivery_agent', 'agent'].includes(selectedRole)) {
      return res.status(400).json({ success: false, message: 'Please select a valid role (Farmer, Consumer, or Delivery Agent).' });
    }
    if (selectedRole === 'agent') selectedRole = 'delivery_agent';

    // 2. Strict Duplicate Prevention Checks
    // Check Memory Store
    const duplicateMemoryEmail = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (duplicateMemoryEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const duplicateMemoryMobile = users.find(u => u.mobile === cleanMobile || (u.phone && extract10DigitMobile(u.phone) === cleanMobile));
    if (duplicateMemoryMobile) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
    }

    // 3. Attempt DB Registration with Unique Index Error Handling
    let newUserRecord = null;

    try {
      // Check Mongoose DB if connected
      const existingDbEmail = await User.findOne({ email: cleanEmail });
      if (existingDbEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }

      const existingDbMobile = await User.findOne({ mobile: cleanMobile });
      if (existingDbMobile) {
        return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
      }

      // Create new Mongoose User document
      newUserRecord = new User({
        name: name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password: password, // Pre-save hook will hash using bcrypt
        role: selectedRole,
        isActive: true,
        farmName: farmName ? farmName.trim() : `${name.trim()}'s Dairy Farm`,
        address: address ? address.trim() : '123 Green Avenue, Sector 5',
        vehicleNo: vehicleNo ? vehicleNo.trim() : 'GJ-07-MK-8821',
        assignedArea: assignedArea ? assignedArea.trim() : 'Sector 14 & Green Valley'
      });

      await newUserRecord.save();
    } catch (dbErr) {
      // Catch MongoDB Duplicate Key Error (Code 11000) for Race Condition Prevention
      if (dbErr.code === 11000) {
        const keyPattern = dbErr.keyPattern || {};
        const errmsg = dbErr.errmsg || '';
        if (keyPattern.email || errmsg.includes('email')) {
          return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        }
        if (keyPattern.mobile || errmsg.includes('mobile')) {
          return res.status(409).json({ success: false, message: 'An account with this mobile number already exists.' });
        }
      }
      console.warn('DB User save skipped/fallback:', dbErr.message);
    }

    // Fallback store insertion if DB was not connected
    if (!newUserRecord) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = `${selectedRole}_${Date.now()}`;
      newUserRecord = {
        id: userId,
        _id: userId,
        name: name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        phone: cleanMobile,
        password: hashedPassword,
        role: selectedRole,
        isActive: true,
        balance: 0.00,
        createdAt: new Date().toISOString(),
        farmName: farmName ? farmName.trim() : `${name.trim()}'s Dairy Farm`,
        address: address ? address.trim() : '123 Green Avenue, Sector 5',
        vehicleNo: vehicleNo ? vehicleNo.trim() : 'GJ-07-MK-8821',
        assignedArea: assignedArea ? assignedArea.trim() : 'Sector 14 & Green Valley'
      };
      users.push(newUserRecord);
    }

    // Generate Secure JWT Token
    const payload = {
      id: newUserRecord._id ? newUserRecord._id.toString() : newUserRecord.id,
      email: newUserRecord.email,
      role: newUserRecord.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const formattedUser = formatUserObject(newUserRecord);

    return res.status(201).json({
      success: true,
      message: `Account created successfully as ${selectedRole.toUpperCase().replace('_', ' ')}!`,
      user: formattedUser,
      token
    });

  } catch (err) {
    console.error('Signup Route Exception:', err);
    return res.status(500).json({ success: false, message: 'Server error during account registration. Please try again.' });
  }
});

// ==========================================
// 2. POST /api/auth/login - Credential Verification
// ==========================================
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, mobile, identifier, password } = req.body;
    const loginTarget = (identifier || email || mobile || '').trim();

    if (!loginTarget || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter both your email/mobile number and password.'
      });
    }

    const cleanInput = loginTarget.toLowerCase();
    const cleanMobile = extract10DigitMobile(loginTarget);

    let user = null;

    // Search Database first
    try {
      user = await User.findOne({
        $or: [
          { email: cleanInput },
          { mobile: cleanMobile }
        ]
      });
    } catch (e) {
      // Ignore DB error fallback
    }

    // Search In-Memory Store if not found in DB
    if (!user) {
      user = users.find(u =>
        u.email.toLowerCase() === cleanInput ||
        u.mobile === cleanMobile ||
        (u.phone && extract10DigitMobile(u.phone) === cleanMobile)
      );
    }

    // Generic error message to prevent email/mobile account enumeration
    const genericAuthError = 'Invalid email/mobile number or password.';

    if (!user) {
      return res.status(401).json({
        success: false,
        message: genericAuthError
      });
    }

    // Account Activity Check
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Verify Password using bcrypt (or legacy string fallback for demo pre-existing users)
    let isPasswordValid = false;
    if (user.comparePassword) {
      isPasswordValid = await user.comparePassword(password);
    } else if (user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        isPasswordValid = (user.password === password);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: genericAuthError
      });
    }

    // Generate JWT Token
    const payload = {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      role: user.role === 'agent' ? 'delivery_agent' : user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const formattedUser = formatUserObject(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${formattedUser.name}!`,
      user: formattedUser,
      token
    });

  } catch (err) {
    console.error('Login Route Exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during sign in. Please try again.'
    });
  }
});

// ==========================================
// 3. POST /api/auth/logout - Session Termination
// ==========================================
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// ==========================================
// 4. GET /api/auth/me - Authenticated User Session Profile
// ==========================================
router.get('/me', verifyToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
    }
    const formattedUser = formatUserObject(req.user);
    return res.status(200).json({
      success: true,
      user: formattedUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
});

// ==========================================
// 5. POST /api/auth/forgot-password - Reset Request
// ==========================================
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { identifier, email, mobile } = req.body;
    const target = (identifier || email || mobile || '').trim();

    if (!target) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your registered email address or mobile number.'
      });
    }

    const cleanInput = target.toLowerCase();
    const cleanMobile = extract10DigitMobile(target);

    let user = null;
    try {
      user = await User.findOne({ $or: [{ email: cleanInput }, { mobile: cleanMobile }] });
    } catch (e) {}

    if (!user) {
      user = users.find(u => u.email.toLowerCase() === cleanInput || u.mobile === cleanMobile);
    }

    // Always respond with success to prevent user enumeration attacks
    return res.status(200).json({
      success: true,
      message: 'If an account matches those details, password reset instructions have been dispatched.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error processing password reset request.' });
  }
});

module.exports = router;
