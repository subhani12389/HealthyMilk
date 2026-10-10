const mongoose = require('mongoose');

const emailOtpChallengeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID reference is required']
  },
  hashedOtp: {
    type: String,
    required: [true, 'Hashed OTP is required'],
    select: false
  },
  purpose: {
    type: String,
    enum: ['email_verification', 'password_reset'],
    default: 'email_verification',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  resendCooldownEnd: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const EmailOtpChallenge = mongoose.models.EmailOtpChallenge || mongoose.model('EmailOtpChallenge', emailOtpChallengeSchema);

module.exports = EmailOtpChallenge;
