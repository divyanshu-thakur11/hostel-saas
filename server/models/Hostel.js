const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  organizationId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name:            { type: String, required: true, trim: true },
  address:         { type: String, required: true },
  city:            { type: String, default: '' },
  mobile:          { type: String },
  totalRooms:      { type: Number, default: 20, min: 1, max: 500 },
  isActive:        { type: Boolean, default: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

hostelSchema.index({ organizationId: 1, name: 1 });
module.exports = mongoose.model('Hostel', hostelSchema);
