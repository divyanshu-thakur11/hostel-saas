const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  ownerName:       { type: String, required: true, trim: true },
  email:           { type: String, trim: true, lowercase: true },
  mobile:          { type: String },
  plan:            { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
  planExpiresAt:   { type: Date, default: () => new Date(Date.now() + 365*24*60*60*1000) },
  isActive:        { type: Boolean, default: true },
  suspendedAt:     { type: Date, default: null },
  suspendReason:   { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:           { type: String, default: '' },
  // UPIGateway.dev credentials (per organization)
  upiGatewayApiKey:  { type: String, default: '' },   // API key from upigateway.dev dashboard
  upiRecipientVpa:   { type: String, default: '' },   // owner's UPI ID, e.g. hostel@upi
  paymentEnabled:    { type: Boolean, default: false },
}, { timestamps: true });

organizationSchema.index({ name: 1 });
module.exports = mongoose.model('Organization', organizationSchema);
