const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
