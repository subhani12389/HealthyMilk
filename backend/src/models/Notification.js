const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
