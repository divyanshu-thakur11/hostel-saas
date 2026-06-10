const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Separate lightweight auth for member self-service portal.
// Linked to a Member record by memberId (our internal ObjectId).
const memberAuthSchema = new mongoose.Schema({
  memberId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, unique: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  hostelId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
  mobile:         { type: String, required: true, index: true },  // login identifier
  pin:            { type: String, required: true },               // bcrypt-hashed 4-6 digit PIN
  isActive:       { type: Boolean, default: true },
  lastLogin:      { type: Date },
  loginAttempts:  { type: Number, default: 0 },
  lockUntil:      { type: Date },
}, { timestamps: true });

memberAuthSchema.virtual('isLocked').get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

memberAuthSchema.pre('save', async function(next) {
  if (!this.isModified('pin')) return next();
  this.pin = await bcrypt.hash(this.pin, 10);
  next();
});

memberAuthSchema.methods.comparePin = async function(pin) {
  return bcrypt.compare(pin, this.pin);
};

module.exports = mongoose.model('MemberAuth', memberAuthSchema);
