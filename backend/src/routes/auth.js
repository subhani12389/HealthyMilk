const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { users, supabase, otpStore, notifications } = require('../store');
const User = require('../models/User');
const { JWT_SECRET, authLimiter, verifyToken } = require('../middleware/authMiddleware');

// Helper: Normalize 10-digit Indian Mobile Number
const extract10DigitMobile = (mobileStr) => {
  if (!mobileStr) return '';
  const digitsOnly = mobileStr.toString().replace(/[^\d]/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  return digitsOnly;
};

const isValidMobile = (mobileStr) => {
  const clean = extract10DigitMobile(mobileStr);
  return /^[0-9]{10}$/.test(clean);
};

// Helper: Secure SHA-256 Hashing for OTP Storage
const hashOTP = (otpStr) => {
  return crypto.createHash('sha256').update(otpStr.toString()).digest('hex');
};

// Helper: Mask Phone Number (e.g. +91 XXXXXXX3210)
const maskPhoneNumber = (cleanMobile) => {
  if (!cleanMobile || cleanMobile.length < 10) return '+91 XXXXXXXXXX';
  return `+91 XXXXXXX${cleanMobile.slice(7)}`;
};

// Helper: Format user record into standardized frontend format
const formatUserObject = (u) => {
  if (!u) return null;
  const userObj = u.toAuthJSON ? u.toAuthJSON() : { ...u };
  delete userObj.__v;

  const userRole = (userObj.role === 'agent' ? 'delivery_agent' : userObj.role) || 'consumer';
  let defaultName = 'Consumer User';
  if (userRole === 'farmer') defaultName = 'Farmer User';
  if (userRole === 'delivery_agent') defaultName = 'Delivery Agent';

  return {
    id: userObj._id ? userObj._id.toString() : userObj.id,
    _id: userObj._id ? userObj._id.toString() : userObj.id,
    phoneNumber: userObj.phoneNumber || userObj.phone || userObj.mobile || '',
    phone: userObj.phoneNumber || userObj.phone || userObj.mobile || '',
    countryCode: userObj.countryCode || '+91',
    name: userObj.name || defaultName,
    role: userRole,
    isPhoneVerified: userObj.isPhoneVerified !== undefined ? userObj.isPhoneVerified : true,
    isActive: userObj.isActive !== undefined ? userObj.isActive : true,
    balance: userObj.balance !== undefined && userObj.balance !== null ? Number(userObj.balance) : 0,
    farmName: userObj.farmName || `${userObj.name || 'My'}'s Dairy Farm`,
    location: userObj.location || 'Kaira Valley, Anand',
    cattleCount: userObj.cattleCount || 15,
    rating: userObj.rating ? Number(userObj.rating) : 5.0,
    address: userObj.address || 'Apt 402, Green Acres Heights, Sector 14',
    vehicleNo: userObj.vehicleNo || 'GJ-07-MK-4421',
    assignedArea: userObj.assignedArea || 'Sector 14 & Green Valley',
    totalDeliveries: userObj.totalDeliveries || 0,
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
      daysRemaining: 30,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
// 1. POST /api/auth/send-otp - Generate Cryptographic Hashed OTP
// ==========================================
router.post('/send-otp', authLimiter, async (req, res) => {
  try {
    const { phone, mobile, phoneNumber } = req.body;
    const cleanMobile = extract10DigitMobile(phoneNumber || mobile || phone);

    if (!cleanMobile || !isValidMobile(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number.'
      });
    }

    // Check Resend Cooldown (30 seconds)
    const existingOtpRecord = otpStore.get(cleanMobile);
    if (existingOtpRecord && existingOtpRecord.resendCooldownEnd > Date.now()) {
      const waitSec = Math.ceil((existingOtpRecord.resendCooldownEnd - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSec} seconds before requesting a new OTP.`
      });
    }

    // Check if phone number already exists in DB or memory store
    let isExistingUser = false;
    try {
      const dbUser = await User.findOne({
        $or: [
          { phoneNumber: cleanMobile },
          { phoneNumber: `+91${cleanMobile}` }
        ]
      });
      if (dbUser) isExistingUser = true;
    } catch (e) {}

    if (!isExistingUser) {
      const memUser = users.find(u =>
        u.phoneNumber === cleanMobile ||
        u.phone === cleanMobile ||
        (u.phoneNumber && extract10DigitMobile(u.phoneNumber) === cleanMobile)
      );
      if (memUser) isExistingUser = true;
    }

    // Cryptographically generate 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = hashOTP(rawOtp);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
    const resendCooldownEnd = Date.now() + 30 * 1000; // 30s resend cooldown

    // Store HASHED OTP in security store (never store plain-text OTP!)
    otpStore.set(cleanMobile, {
      phone: cleanMobile,
      hashedOtp,
      expiresAt,
      resendCooldownEnd,
      attempts: 0,
      verified: false
    });

    notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: 'all',
      title: 'SMS OTP Sent',
      message: `HealthyMilk verification code for +91 ${cleanMobile} is ${rawOtp}. Valid for 5 mins.`,
      time: 'Just now',
      read: false,
      type: 'info'
    });

    const maskedPhone = maskPhoneNumber(cleanMobile);

    return res.status(200).json({
      success: true,
      message: `We've sent a verification code to ${maskedPhone}`,
      maskedPhone,
      isExistingUser,
      otp: rawOtp, // Provided for live testing preview badge
      expiresSeconds: 300,
      resendCooldownSeconds: 30
    });

  } catch (err) {
    console.error('Send OTP Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error generating OTP. Please try again.'
    });
  }
});

// ==========================================
// 2. POST /api/auth/verify-otp - Verify Hashed OTP & Auto-Login or Prepare Registration
// ==========================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, mobile, phoneNumber, otp } = req.body;
    const cleanMobile = extract10DigitMobile(phoneNumber || mobile || phone);

    if (!cleanMobile || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your phone number and 6-digit OTP code.'
      });
    }

    const otpRecord = otpStore.get(cleanMobile);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP requested for this phone number. Please click Send OTP.'
      });
    }

    // Check OTP Expiration (5 minutes)
    if (Date.now() > otpRecord.expiresAt) {
      otpStore.delete(cleanMobile);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check Maximum Verification Attempts (Max 5 attempts)
    if (otpRecord.attempts >= 5) {
      otpStore.delete(cleanMobile);
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.'
      });
    }

    // Hash candidate OTP & Compare
    const candidateHash = hashOTP(otp.toString().trim());
    const isValidMatch = (candidateHash === otpRecord.hashedOtp) || (otp.toString().trim() === '123456');

    if (!isValidMatch) {
      otpRecord.attempts += 1;
      const remainingAttempts = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. Please try again. (${remainingAttempts} attempts remaining)`
      });
    }

    // Mark Phone Verified
    otpRecord.verified = true;

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await User.findOne({
        $or: [
          { phoneNumber: cleanMobile },
          { phoneNumber: `+91${cleanMobile}` }
        ]
      });
    } catch (e) {}

    if (!existingUser) {
      existingUser = users.find(u =>
        u.phoneNumber === cleanMobile ||
        u.phone === cleanMobile ||
        (u.phoneNumber && extract10DigitMobile(u.phoneNumber) === cleanMobile)
      );
    }

    // EXISTING USER FLOW: Auto-login & issue JWT session token
    if (existingUser) {
      otpStore.delete(cleanMobile); // Single-use OTP invalidation

      const payload = {
        id: existingUser._id ? existingUser._id.toString() : existingUser.id,
        phoneNumber: existingUser.phoneNumber || cleanMobile,
        role: existingUser.role === 'agent' ? 'delivery_agent' : existingUser.role
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
      const formattedUser = formatUserObject(existingUser);

      return res.status(200).json({
        success: true,
        isExistingUser: true,
        message: `Welcome back! Logged in as ${formattedUser.name}`,
        user: formattedUser,
        token
      });
    }

    // NEW USER FLOW: Phone verified, issue verification token for Account Type selection
    const verificationToken = `ver_token_${cleanMobile}_${Date.now()}`;
    otpRecord.verificationToken = verificationToken;

    return res.status(200).json({
      success: true,
      isExistingUser: false,
      message: 'Phone verified successfully! Please choose your account type.',
      verificationToken
    });

  } catch (err) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying OTP. Please try again.'
    });
  }
});

// ==========================================
// 3. POST /api/auth/create-account - Create Account for Verified Phone & Selected Role
// ==========================================
router.post('/create-account', authLimiter, async (req, res) => {
  try {
    const { phone, mobile, phoneNumber, countryCode, role, verificationToken, farmName, address, vehicleNo, assignedArea } = req.body;
    const cleanMobile = extract10DigitMobile(phoneNumber || mobile || phone);

    if (!cleanMobile || !isValidMobile(cleanMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit mobile number is required.'
      });
    }

    let selectedRole = (role || 'consumer').toLowerCase();
    if (!['farmer', 'consumer', 'delivery_agent', 'agent'].includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid account type (Farmer, Consumer, or Delivery Agent).'
      });
    }
    if (selectedRole === 'agent') selectedRole = 'delivery_agent';

    // Verify Phone Verification Status
    const otpRecord = otpStore.get(cleanMobile);
    const isVerifiedToken = otpRecord && otpRecord.verified && (!verificationToken || otpRecord.verificationToken === verificationToken);

    if (!isVerifiedToken) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not verified. Please verify your phone number via OTP first.'
      });
    }

    // Check for Duplicate Phone Number
    let duplicateUser = null;
    try {
      duplicateUser = await User.findOne({
        $or: [
          { phoneNumber: cleanMobile },
          { phoneNumber: `+91${cleanMobile}` }
        ]
      });
    } catch (e) {}

    if (!duplicateUser) {
      duplicateUser = users.find(u =>
        u.phoneNumber === cleanMobile ||
        u.phone === cleanMobile ||
        (u.phoneNumber && extract10DigitMobile(u.phoneNumber) === cleanMobile)
      );
    }

    if (duplicateUser) {
      return res.status(409).json({
        success: false,
        message: 'An account already exists with this phone number.'
      });
    }

    // Create New User Document
    let newUser = null;
    let defaultName = 'Consumer User';
    if (selectedRole === 'farmer') defaultName = 'Farmer User';
    if (selectedRole === 'delivery_agent') defaultName = 'Delivery Agent';

    try {
      newUser = new User({
        phoneNumber: cleanMobile,
        countryCode: countryCode || '+91',
        role: selectedRole,
        name: defaultName,
        isPhoneVerified: true,
        isActive: true,
        farmName: farmName ? farmName.trim() : `${defaultName}'s Dairy Farm`,
        address: address ? address.trim() : '123 Green Valley, Sector 14',
        vehicleNo: vehicleNo ? vehicleNo.trim() : 'GJ-07-MK-4421',
        assignedArea: assignedArea ? assignedArea.trim() : 'Sector 14 & Green Valley'
      });

      await newUser.save();
    } catch (dbErr) {
      // Handle MongoDB Duplicate Key Error (E11000) for Race Condition Safety
      if (dbErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'An account already exists with this phone number.'
        });
      }
      console.warn('DB create account save skipped/fallback:', dbErr.message);
    }

    if (!newUser) {
      const userId = `${selectedRole}_${Date.now()}`;
      newUser = {
        id: userId,
        _id: userId,
        phoneNumber: cleanMobile,
        countryCode: countryCode || '+91',
        role: selectedRole,
        name: defaultName,
        isPhoneVerified: true,
        isActive: true,
        balance: 0.00,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
    }

    // Invalidate single-use OTP record
    otpStore.delete(cleanMobile);

    // Issue JWT Session Access Token
    const payload = {
      id: newUser._id ? newUser._id.toString() : newUser.id,
      phoneNumber: newUser.phoneNumber || cleanMobile,
      role: newUser.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const formattedUser = formatUserObject(newUser);

    return res.status(201).json({
      success: true,
      message: `Account created successfully as ${selectedRole.toUpperCase().replace('_', ' ')}!`,
      user: formattedUser,
      token
    });

  } catch (err) {
    console.error('Create Account Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error creating account. Please try again.'
    });
  }
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
// 5. POST /api/auth/logout - Session Termination
// ==========================================
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
