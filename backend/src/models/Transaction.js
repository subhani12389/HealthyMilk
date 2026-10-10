const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  farmerId: { type: String, index: true },
  agentId: { type: String, index: true },
  amount: { type: Number, required: true, min: 0 },
  type: { type: String, required: true },
  date: { type: String, default: () => new Date().toLocaleDateString() },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, required: true, default: 'Processing' },
  reference: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, default: undefined, unique: true, sparse: true },
  requestHash: { type: String, default: '' }
}, { timestamps: true });

transactionSchema.index({ farmerId: 1, timestamp: -1 });
transactionSchema.index({ agentId: 1, timestamp: -1 });

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
