const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long']
  },
  role: {
    type: String,
    enum: ['farmer', 'consumer', 'delivery_agent', 'agent'],
    required: [true, 'User role is required'],
    default: 'consumer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional role-specific fields for seamless HealthyMilk dashboard integration
  farmName: { type: String, default: '' },
  address: { type: String, default: '' },
  vehicleNo: { type: String, default: '' },
  assignedArea: { type: String, default: '' },
  location: { type: String, default: 'Kaira Valley, Anand' },
  cattleCount: { type: Number, default: 15 },
  balance: { type: Number, default: 0.00 },
  bankDetails: {
    accountNo: { type: String, default: 'XXXX-XXXX-1234' },
    ifsc: { type: String, default: 'SBIN0001234' },
    bankName: { type: String, default: 'State Bank of India' }
  },
  subscription: {
    type: Object,
    default: function() {
      return {
        id: `sub_${Date.now()}`,
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
      };
    }
  }
}, {
  timestamps: true
});

// Explicit unique indexes for email and mobile to enforce DB-level duplicate prevention
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ mobile: 1 }, { unique: true });

// Pre-save hook: Hash password before saving if modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance Method: Verify password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance Method: Sanitize user object for API responses (never return password)
userSchema.methods.toAuthJSON = function() {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.password;
  delete obj.__v;
  // Map fields for frontend compatibility
  obj.id = obj._id ? obj._id.toString() : obj.id;
  obj.phone = obj.mobile || obj.phone;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
