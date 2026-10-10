const mongoose = require('mongoose');

const otpChallengeSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true, trim: true },
  hashedOtp: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  resendCooldownEnd: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0, max: 5 },
  verified: { type: Boolean, default: false },
  hashedVerificationToken: { type: String, select: false }
}, { timestamps: true });

module.exports = mongoose.models.OtpChallenge || mongoose.model('OtpChallenge', otpChallengeSchema);
