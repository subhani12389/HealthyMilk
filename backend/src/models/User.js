const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    select: false
  },
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    default: 'HealthyMilk User'
  },
  role: {
    type: String,
    enum: ['farmer', 'consumer', 'delivery_agent', 'agent', 'admin'],
    required: [true, 'User role is required'],
    default: 'consumer'
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  countryCode: {
    type: String,
    default: '+91',
    trim: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  // Additional role-specific fields for seamless HealthyMilk dashboard integration
  farmName: { type: String, default: '' },
  address: { type: String, default: '' },
  vehicleNo: { type: String, default: '' },
  assignedArea: { type: String, default: '' },
  location: { type: String, default: 'Kaira Valley, Anand' },
  cattleCount: { type: Number, default: 15 },
  balance: { type: Number, default: 0.00 },
  totalDeliveries: { type: Number, default: 0, min: 0 },
  bankDetails: {
    accountNo: { type: String, default: 'XXXX-XXXX-1234' },
    ifsc: { type: String, default: 'SBIN0001234' },
    bankName: { type: String, default: 'State Bank of India' }
  },
  subscription: { type: Object, default: null }
}, {
  timestamps: true
});

// Compare candidate password with stored bcrypt hash
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance Method: Sanitize user object for API responses
userSchema.methods.toAuthJSON = function() {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  obj.id = obj._id ? obj._id.toString() : obj.id;
  obj.phone = obj.phoneNumber || obj.phone || '';
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
