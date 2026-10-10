const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0.1 },
  price: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  consumerId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, default: undefined },
  requestHash: { type: String, default: '' },
  items: { type: [orderItemSchema], required: true, validate: value => value.length > 0 },
  batchId: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 0.1 },
  price: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  deliveryDate: { type: Date, required: true },
  deliveryAddress: { type: String, required: true, trim: true },
  paymentMethod: { type: String, default: 'UPI' },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Assigned', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Confirmed',
    index: true
  },
  assignedAgentId: { type: String, default: '' },
  tracking: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: '' },
    notes: { type: String, default: '' }
  }]
}, { timestamps: true });

orderSchema.index({ consumerId: 1, createdAt: -1 });
orderSchema.index(
  { consumerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
