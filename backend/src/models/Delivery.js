const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true, index: true },
  consumerId: { type: String, required: true, index: true },
  orderId: { type: String, default: '', index: true },
  subscriptionId: { type: String, default: '' },
  scheduledDate: { type: Date, default: undefined },
  batchId: { type: String, default: '', index: true },
  agentId: { type: String, default: '', index: true },
  deliveryAddress: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.1 },
  status: {
    type: String,
    enum: ['Pending', 'Assigned', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  eta: { type: String, default: '' },
  timeSlot: { type: String, default: '' },
  commission: { type: Number, default: 0, min: 0 },
  commissionPaid: { type: Boolean, default: false },
  tracking: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: '' },
    notes: { type: String, default: '' }
  }],
  deliveredAt: { type: Date, default: null }
}, { timestamps: true });

deliverySchema.index({ consumerId: 1, createdAt: -1 });
deliverySchema.index({ agentId: 1, status: 1, createdAt: -1 });
deliverySchema.index(
  { subscriptionId: 1, scheduledDate: 1 },
  { unique: true, partialFilterExpression: { scheduledDate: { $exists: true } } }
);

module.exports = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);
