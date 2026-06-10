const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', index: true },
  action: { type: String, required: true, index: true },
  entity: { type: String }, // 'member', 'receipt', 'room', etc.
  entityId: { type: String },
  description: { type: String },
  performedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    name: String,
    role: String,
  },
  meta: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

auditSchema.index({ hostelId: 1, timestamp: -1 });
auditSchema.index({ 'performedBy.userId': 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditSchema);
