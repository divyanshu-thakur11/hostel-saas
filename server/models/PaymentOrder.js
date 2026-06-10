const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  hostelId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
  memberId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
  memberName:     { type: String },
  memberMobile:   { type: String },
  roomNumber:     { type: Number, required: true },

  // UPIGateway.dev fields
  upiGatewayOrderId:    { type: String, unique: true, sparse: true },  // order id from UPIGateway
  upiGatewayTxnId:      { type: String, sparse: true },                // UTR / transaction ref from UPIGateway webhook
  upiPayerVpa:          { type: String, default: '' },                  // payer's UPI ID if returned

  amount:        { type: Number, required: true },   // in INR
  paymentType:   { type: String, enum: ['rent','advance','electric','other'], default: 'rent' },
  description:   { type: String, default: '' },
  month:         { type: String },

  status:    { type: String, enum: ['created','paid','failed','expired'], default: 'created', index: true },
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },

  paidAt:        { type: Date, default: null },
  failureReason: { type: String, default: '' },
  webhookRaw:    { type: mongoose.Schema.Types.Mixed, default: null },  // store raw webhook for audit
}, { timestamps: true });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
