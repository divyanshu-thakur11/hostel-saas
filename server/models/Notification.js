const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  type: { type: String, enum: ['due_reminder', 'expiry_alert', 'overdue', 'payment_received', 'new_member', 'member_left', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  memberName: String,
  roomNumber: Number,
  isRead: { type: Boolean, default: false, index: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: Date,
  amount: Number,
}, { timestamps: true });

notificationSchema.index({ hostelId: 1, isRead: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
