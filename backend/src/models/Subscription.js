const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: { type: String, required: true, unique: true, index: true },
  consumerId: { type: String, required: true, index: true },
  planName: { type: String, required: true, trim: true },
  planType: { type: String, default: 'Daily' },
  dailyLiters: { type: Number, required: true, min: 0.1 },
  totalDays: { type: Number, required: true, min: 1 },
  daysRemaining: { type: Number, required: true, min: 0 },
  pricePerLiter: { type: Number, required: true, min: 0, default: 65 },
  totalAmountPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['Active', 'Paused', 'Expired'], default: 'Active', index: true },
  schedule: { type: String, default: 'Daily' },
  deliveryTimeSlot: { type: String, default: '6:30 AM - 7:30 AM' },
  deliveryAddress: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  pauseStartDate: { type: Date, default: null },
  pauseEndDate: { type: Date, default: null },
  resumeDate: { type: Date, default: null },
  lastDeliveryDate: { type: Date, default: null }
}, { timestamps: true });

subscriptionSchema.index({ consumerId:  1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
