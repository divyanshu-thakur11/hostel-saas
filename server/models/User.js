const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const activitySchema = new mongoose.Schema({
  action: String, path: String, method: String,
  timestamp: { type: Date, default: Date.now }, details: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
  username:           { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:           { type: String, required: true },
  role:               { type: String, enum: ['superadmin', 'owner', 'manager'], default: 'owner' },
  name:               { type: String, required: true },
  mobile:             { type: String },
  isActive:           { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  lastLogin:          { type: Date },
  loginAttempts:      { type: Number, default: 0 },
  lockUntil:          { type: Date },
  // organizationId: null for superadmin, set for owners and managers
  organizationId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  hostelId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', default: null },
  recentActivity:     { type: [activitySchema], default: [] },
}, { timestamps: true });

userSchema.virtual('isLocked').get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(pw) {
  return bcrypt.compare(pw, this.password);
};

userSchema.methods.incLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

userSchema.methods.logActivity = async function(action, path, method, details) {
  this.recentActivity.unshift({ action, path, method, details, timestamp: new Date() });
  if (this.recentActivity.length > 50) this.recentActivity = this.recentActivity.slice(0, 50);
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
