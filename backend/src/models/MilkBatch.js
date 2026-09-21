const mongoose = require('mongoose');

const qualityTestSchema = new mongoose.Schema({
  fatPercentage: {
    type: Number,
    required: true,
    min: [0.5, 'Fat percentage must be at least 0.5%'],
    max: [15.0, 'Fat percentage cannot exceed 15.0%']
  },
  snfPercentage: {
    type: Number,
    required: true,
    min: [4.0, 'SNF percentage must be at least 4.0%'],
    max: [15.0, 'SNF percentage cannot exceed 15.0%']
  },
  lactometerReading: {
    type: Number,
    required: true,
    min: [15.0, 'Lactometer reading must be at least 15.0'],
    max: [38.0, 'Lactometer reading cannot exceed 38.0']
  },
  temperature: {
    type: Number,
    required: true,
    min: [-2.0, 'Temperature cannot be below -2°C'],
    max: [45.0, 'Temperature cannot exceed 45°C'],
    default: 4.0
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 85
  },
  qualityStatus: {
    type: String,
    enum: ['Pending', 'Passed', 'Needs Review', 'Rejected'],
    default: 'Passed'
  },
  ratePerLiter: {
    type: Number,
    default: 45
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  testedAt: {
    type: Date,
    default: Date.now
  },
  testedBy: {
    type: String,
    default: 'Delivery Agent'
  },
  testedById: {
    type: String
  },
  remarks: {
    type: String,
    default: ''
  }
}, { _id: false, timestamps: true });

const auditHistorySchema = new mongoose.Schema({
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  changedBy: { type: String, required: true },
  changedById: { type: String },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String, default: '' },
  remarks: { type: String, default: '' }
}, { _id: false });

const rejectionSchema = new mongoose.Schema({
  reason: {
    type: String,
    enum: [
      'Low quality reading',
      'Abnormal Fat/SNF',
      'Abnormal Lactometer Reading',
      'Temperature issue',
      'Contamination concern',
      'Damaged/unsafe batch',
      'Other'
    ],
    required: true
  },
  remarks: { type: String, default: '' },
  agentId: { type: String, required: true },
  agentName: { type: String, default: 'Delivery Agent' },
  rejectedAt: { type: Date, default: Date.now },
  evidencePhoto: { type: String, default: '' },
  reviewStatus: {
    type: String,
    enum: ['Pending', 'Confirmed Rejected', 'Under Review', 'Approved'],
    default: 'Pending'
  },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date },
  adminRemarks: { type: String, default: '' }
}, { _id: false });

const milkBatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: [true, 'Milk Batch ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  farmerId: {
    type: String,
    required: [true, 'Farmer ID is required'],
    index: true
  },
  farmerName: {
    type: String,
    required: true,
    default: 'Dairy Farmer'
  },
  farmName: {
    type: String,
    default: 'Organic Dairy Farm'
  },
  farmLocation: {
    type: String,
    default: 'Kaira Valley, Anand'
  },
  agentId: {
    type: String,
    index: true
  },
  agentName: {
    type: String,
    default: 'Assigned Delivery Agent'
  },
  liters: {
    type: Number,
    required: [true, 'Milk volume in liters is required'],
    min: [0.1, 'Milk quantity must be greater than 0']
  },
  status: {
    type: String,
    enum: ['Collected', 'Quality Checked', 'Accepted', 'Rejected', 'In Transit', 'Delivered'],
    default: 'Collected',
    index: true
  },
  collectionDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  notes: {
    type: String,
    default: 'Fresh milk collection'
  },
  qualityTest: {
    type: qualityTestSchema,
    default: null
  },
  qualityHistory: {
    type: [qualityTestSchema],
    default: []
  },
  rejection: {
    type: rejectionSchema,
    default: null
  },
  auditHistory: {
    type: [auditHistorySchema],
    default: []
  }
}, {
  timestamps: true
});

// Compound & Single Indexes for high performance querying
milkBatchSchema.index({ batchId: 1 }, { unique: true });
milkBatchSchema.index({ farmerId: 1, collectionDate: -1 });
milkBatchSchema.index({ agentId: 1, status: 1 });
milkBatchSchema.index({ status: 1, collectionDate: -1 });

// Instance method to add audit log
milkBatchSchema.methods.addAuditLog = function(fromStatus, toStatus, changedBy, changedById, reason, remarks) {
  this.auditHistory.push({
    fromStatus,
    toStatus,
    changedBy: changedBy || 'System',
    changedById: changedById || '',
    changedAt: new Date(),
    reason: reason || '',
    remarks: remarks || ''
  });
};

const MilkBatch = mongoose.models.MilkBatch || mongoose.model('MilkBatch', milkBatchSchema);

module.exports = MilkBatch;
