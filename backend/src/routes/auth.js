const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const EmailOtpChallenge = require('../models/EmailOtpChallenge');
const Subscription = require('../models/Subscription');
const { JWT_SECRET, authLimiter, verifyToken } = require('../middleware/authMiddleware');
const { sendVerificationEmail, maskEmail } = require('../services/emailService');

// Helper: Password strength validator
// Minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number
const isValidPassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUppercase && hasLowercase && hasNumber;
};

// Helper: Email format validator
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

// Helper: SHA-256 Hashing for OTP and Tokens
const hashString = (str) => {
  return crypto.createHash('sha256').update(str.toString()).digest('hex');
};

// Helper: Format user record into standardized frontend format
const formatUserObject = (u) => {
  if (!u) return null;
  const userObj = u.toAuthJSON ? u.toAuthJSON() : { ...u };
  delete userObj.__v;
  delete userObj.passwordHash;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpires;

  const userRole = (userObj.role === 'agent' ? 'delivery_agent' : userObj.role) || 'consumer';
  let defaultName = 'Consumer User';
  if (userRole === 'farmer') defaultName = 'Farmer User';
  if (userRole === 'delivery_agent') defaultName = 'Delivery Agent';
  if (userRole === 'admin') defaultName = 'System Admin';

  return {
    id: userObj._id ? userObj._id.toString() : userObj.id,
    _id: userObj._id ? userObj._id.toString() : userObj.id,
    email: userObj.email || '',
    name: userObj.name || defaultName,
    role: userRole,
    phoneNumber: userObj.phoneNumber || userObj.phone || '',
    phone: userObj.phoneNumber || userObj.phone || '',
    countryCode: userObj.countryCode || '+91',
    isEmailVerified: userObj.isEmailVerified !== undefined ? userObj.isEmailVerified : false,
    isPhoneVerified: userObj.isPhoneVerified !== undefined ? userObj.isPhoneVerified : true,
    isActive: userObj.isActive !== undefined ? userObj.isActive : true,
    balance: userObj.balance !== undefined && userObj.balance !== null ? Number(userObj.balance) : 0,
    farmName: userObj.farmName || (userRole === 'farmer' ? `${userObj.name || 'My'}'s Dairy Farm` : ''),
    location: userObj.location || 'Kaira Valley, Anand',
    cattleCount: userObj.cattleCount || 15,
    rating: userObj.rating ? Number(userObj.rating) : 5.0,
    address: userObj.address || (userRole === 'consumer' ? 'Apt 402, Green Acres Heights, Sector 14' : ''),
    vehicleNo: userObj.vehicleNo || (userRole === 'delivery_agent' ? 'GJ-07-MK-4421' : ''),
    assignedArea: userObj.assignedArea || (userRole === 'delivery_agent' ? 'Sector 14 & Green Valley' : ''),
    totalDeliveries: userObj.totalDeliveries || 0,
    bankDetails: userObj.bankDetails || {
      accountNo: 'XXXX-XXXX-8921',
      ifsc: 'SBIN0004123',
      bankName: 'State Bank of India'
    },
    subscription: userObj.subscription || null,
    lastLoginAt: userObj.lastLoginAt || null,
    createdAt: userObj.createdAt || new Date().toISOString(),
    updatedAt: userObj.updatedAt || new Date().toISOString()
  };
};

// ==========================================
// 1. POST /api/auth/register - Register Pending Account & Send Email OTP
// ==========================================
router.post('/register', authLimiter, async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      fullName,
      role = 'consumer',
      phoneNumber = '',
      farmName,
      address,
      vehicleNo,
      assignedArea
    } = req.body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Validate password strength
    if (!password || !isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.'
      });
    }

    // Validate Name
    const displayName = (fullName || name || '').trim();
    if (!displayName || displayName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your full name (minimum 2 characters).'
      });
    }

    // Validate and whitelist role
    let selectedRole = (role || 'consumer').toString().trim().toLowerCase();
    if (selectedRole === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin self-registration is not allowed. Please contact an administrator.'
      });
    }

    if (selectedRole === 'agent') selectedRole = 'delivery_agent';

    const allowedRoles = ['farmer', 'consumer', 'delivery_agent'];
    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid account role (Farmer, Consumer, or Delivery Agent).'
      });
    }

    // Check for existing verified user with this email
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    // Hash password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    let userDoc;
    if (existingUser && !existingUser.isEmailVerified) {
      // Update pending unverified account
      existingUser.passwordHash = passwordHash;
      existingUser.name = displayName;
      existingUser.role = selectedRole;
      existingUser.phoneNumber = (phoneNumber || '').trim();
      if (farmName) existingUser.farmName = farmName.trim();
      if (address) existingUser.address = address.trim();
      if (vehicleNo) existingUser.vehicleNo = vehicleNo.trim();
      if (assignedArea) existingUser.assignedArea = assignedArea.trim();
      await existingUser.save();
      userDoc = existingUser;
    } else {
      // Create new pending unverified user record
      userDoc = new User({
        email: cleanEmail,
        passwordHash,
        name: displayName,
        role: selectedRole,
        phoneNumber: (phoneNumber || '').trim(),
        farmName: farmName ? farmName.trim() : (selectedRole === 'farmer' ? `${displayName}'s Dairy Farm` : ''),
        address: address ? address.trim() : (selectedRole === 'consumer' ? '123 Green Valley, Sector 14' : ''),
        vehicleNo: vehicleNo ? vehicleNo.trim() : (selectedRole === 'delivery_agent' ? 'GJ-07-MK-4421' : ''),
        assignedArea: assignedArea ? assignedArea.trim() : (selectedRole === 'delivery_agent' ? 'Sector 14 & Green Valley' : ''),
        isEmailVerified: false,
        isActive: true
      });
      await userDoc.save();
    }

    // Generate Cryptographically Secure 6-Digit Email OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashString(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendCooldownEnd = new Date(Date.now() + 60 * 1000); // 60 seconds

    // Save Email OTP Challenge
    await EmailOtpChallenge.findOneAndUpdate(
      { email: cleanEmail, purpose: 'email_verification' },
      {
        $set: {
          email: cleanEmail,
          userId: userDoc._id,
          hashedOtp,
          purpose: 'email_verification',
          expiresAt,
          resendCooldownEnd,
          attempts: 0,
          verified: false
        }
      },
      { upsert: true, runValidators: true }
    );

    // Send Verification Email
    const emailResult = await sendVerificationEmail({
      toEmail: cleanEmail,
      otp: rawOtp,
      name: displayName
    });

    const displayMaskedEmail = maskEmail(cleanEmail);

    return res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      message: `We sent a 6-digit verification code to ${displayMaskedEmail}. Please verify your email to continue.`,
      email: cleanEmail,
      maskedEmail: displayMaskedEmail,
      expiresSeconds: 300,
      resendCooldownSeconds: 60,
      emailDelivery: emailResult.providerStatus,
      devOtp: emailResult.devOtp || undefined
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }
    console.error('Registration Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error creating account. Please try again.'
    });
  }
});

// ==========================================
// 2. POST /api/auth/verify-email - Verify Email OTP & Activate Session
// ==========================================
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !isValidEmail(email) || !/^\d{6}$/.test(String(otp || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address and the 6-digit verification code.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const challenge = await EmailOtpChallenge.findOne({
      email: cleanEmail,
      purpose: 'email_verification'
    }).select('+hashedOtp');

    if (!challenge) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code found for this email. Please request a new code.'
      });
    }

    // Check expiration (5 minutes)
    if (Date.now() > challenge.expiresAt.getTime()) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.'
      });
    }

    // Check max attempts (5)
    if (challenge.attempts >= 5) {
      await EmailOtpChallenge.deleteOne({ _id: challenge._id });
      return res.status(400).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new verification code.'
      });
    }

    // Compare SHA-256 hash using timing-safe comparison
    const candidateHash = Buffer.from(hashString(otp));
    const storedHash = Buffer.from(challenge.hashedOtp);
    const isMatch = candidateHash.length === storedHash.length &&
      crypto.timingSafeEqual(candidateHash, storedHash);

    if (!isMatch) {
      const updated = await EmailOtpChallenge.findOneAndUpdate(
        { _id: challenge._id, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' }
      );
      if (!updated || updated.attempts >= 5) {
        await EmailOtpChallenge.deleteOne({ _id: challenge._id });
        return res.status(400).json({
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new code.'
        });
      }
      const remaining = 5 - updated.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. Please try again. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
      });
    }

    // Atomic claim of challenge
    const verifiedChallenge = await EmailOtpChallenge.findOneAndDelete({
      _id: challenge._id,
      expiresAt: { $gt: new Date() }
    });

    if (!verifiedChallenge) {
      return res.status(400).json({
        success: false,
        message: 'This verification code was already used or has expired.'
      });
    }

    // Mark user as email verified and active
    const user = await User.findById(challenge.userId || challenge._id);
    const targetUser = user || await User.findOne({ email: cleanEmail });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    targetUser.isEmailVerified = true;
    targetUser.isActive = true;
    targetUser.lastLoginAt = new Date();
    await targetUser.save();

    // Auto-create initial 30-day subscription for consumer
    if (targetUser.role === 'consumer') {
      try {
        const existingSub = await Subscription.findOne({ consumerId: targetUser._id.toString() });
        if (!existingSub) {
          const subscriptionStart = new Date();
          const defaultDays = 30;
          await Subscription.create({
            subscriptionId: `SUB-${crypto.randomUUID()}`,
            consumerId: targetUser._id.toString(),
            planName: 'Pure Fresh A2 Cow Milk',
            planType: 'Daily',
            dailyLiters: 2,
            totalDays: defaultDays,
            daysRemaining: defaultDays,
            status: 'Active',
            schedule: 'Daily',
            pricePerLiter: 65,
            totalAmountPaid: 3900,
            deliveryTimeSlot: '6:30 AM - 7:30 AM',
            deliveryAddress: targetUser.address || '123 Green Valley, Sector 14',
            startDate: subscriptionStart,
            endDate: new Date(subscriptionStart.getTime() + defaultDays * 86400000)
          });
        }
      } catch (subErr) {
        console.warn('Consumer subscription auto-init note:', subErr.message);
      }
    }

    // Issue JWT Access Token
    const payload = {
      id: targetUser._id.toString(),
      email: targetUser.email,
      role: targetUser.role === 'agent' ? 'delivery_agent' : targetUser.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    const formattedUser = formatUserObject(targetUser);

    return res.status(200).json({
      success: true,
      message: `Email verified successfully! Welcome to HealthyMilk, ${formattedUser.name}.`,
      user: formattedUser,
      token
    });

  } catch (err) {
    console.error('Verify Email Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying email. Please try again.'
    });
  }
});

// ==========================================
// 3. POST /api/auth/resend-verification - Resend Email OTP
// ==========================================
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account email is already verified. Please sign in.'
      });
    }

    const currentChallenge = await EmailOtpChallenge.findOne({
      email: cleanEmail,
      purpose: 'email_verification'
    });

    // Enforce 60-second resend cooldown
    if (currentChallenge && currentChallenge.resendCooldownEnd > new Date()) {
      const waitSeconds = Math.ceil((currentChallenge.resendCooldownEnd.getTime() - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting another verification code.`
      });
    }

    // Generate new random OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashString(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendCooldownEnd = new Date(Date.now() + 60 * 1000);

    await EmailOtpChallenge.findOneAndUpdate(
      { email: cleanEmail, purpose: 'email_verification' },
      {
        $set: {
          email: cleanEmail,
          userId: user._id,
          hashedOtp,
          purpose: 'email_verification',
          expiresAt,
          resendCooldownEnd,
          attempts: 0,
          verified: false
        }
      },
      { upsert: true, runValidators: true }
    );

    const emailResult = await sendVerificationEmail({
      toEmail: cleanEmail,
      otp: rawOtp,
      name: user.name
    });

    const displayMasked = maskEmail(cleanEmail);

    return res.status(200).json({
      success: true,
      message: `A new verification code has been sent to ${displayMasked}.`,
      maskedEmail: displayMasked,
      expiresSeconds: 300,
      resendCooldownSeconds: 60,
      emailDelivery: emailResult.providerStatus,
      devOtp: emailResult.devOtp || undefined
    });

  } catch (err) {
    console.error('Resend Verification Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error sending verification code. Please try again.'
    });
  }
});

// ==========================================
// 4. POST /api/auth/login - Email & Password Sign In
// ==========================================
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Query user including passwordHash
    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Verify bcrypt password hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if account email is verified
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        unverified: true,
        email: user.email,
        maskedEmail: maskEmail(user.email),
        message: 'Your email address is not verified yet. Please enter the verification code sent to your email.'
      });
    }

    // Check if account is active
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Issue JWT Access Token
    const payload = {
      id: user._id.toString(),
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
    console.error('Login Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error logging in. Please try again.'
    });
  }
});

// ==========================================
// 5. POST /api/auth/forgot-password - Secure Password Reset Request
// ==========================================
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    // Account enumeration protection: Always return standard message
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email, password reset instructions have been generated.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate secure random reset token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashString(rawResetToken);

    // Save hashed token and expiry (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    return res.status(200).json({
      ...genericResponse,
      resetToken: rawResetToken
    });

  } catch (err) {
    console.error('Forgot Password Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error processing password reset request.'
    });
  }
});

// ==========================================
// 6. POST /api/auth/reset-password - Reset Password with Token
// ==========================================
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { resetToken, token, newPassword, password } = req.body;
    const suppliedToken = resetToken || token;
    const suppliedPassword = newPassword || password;

    if (!suppliedToken) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is required.'
      });
    }

    if (!suppliedPassword || !isValidPassword(suppliedPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long and contain uppercase, lowercase, and a number.'
      });
    }

    const hashedToken = hashString(suppliedToken);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+passwordHash +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    // Hash new password and clear reset token
    user.passwordHash = await bcrypt.hash(suppliedPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully! Please sign in with your new password.'
    });

  } catch (err) {
    console.error('Reset Password Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password. Please try again.'
    });
  }
});

// ==========================================
// 7. GET /api/auth/me - Authenticated User Session Profile
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
// 8. POST /api/auth/logout - Session Termination
// ==========================================
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
