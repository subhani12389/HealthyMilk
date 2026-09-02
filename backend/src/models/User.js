const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  countryCode: {
    type: String,
    default: '+91',
    trim: true
  },
  role: {
    type: String,
    enum: ['farmer', 'consumer', 'delivery_agent', 'agent'],
    required: [true, 'User role is required'],
    default: 'consumer'
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  name: {
    type: String,
    default: function() {
      if (this.role === 'farmer') return 'Farmer User';
      if (this.role === 'delivery_agent' || this.role === 'agent') return 'Delivery Agent';
      return 'Consumer User';
    }
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

// Explicit unique index for phoneNumber to enforce DB-level duplicate prevention
userSchema.index({ phoneNumber: 1 }, { unique: true });

// Instance Method: Sanitize user object for API responses
userSchema.methods.toAuthJSON = function() {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  obj.id = obj._id ? obj._id.toString() : obj.id;
  obj.phone = obj.phoneNumber || obj.phone;
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
