const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  memberId: { type: String },
  memberIdNumber: { type: Number },
  name: { type: String, required: true, trim: true },
  mobileNo: {
    type: String, required: true,
    validate: { validator: v => /^\d{10}$/.test(v.replace(/\s|-/g,'')), message: 'Mobile must be 10 digits' }
  },
  fathersName: { type: String, required: true, trim: true },
  fathersMobileNo: {
    type: String, required: true,
    validate: { validator: v => /^\d{10}$/.test(v.replace(/\s|-/g,'')), message: "Father's mobile must be 10 digits" }
  },
  aadharNumber: {
    type: String, required: true,
    validate: { validator: v => /^\d{12}$/.test(v.replace(/\s/g,'')), message: 'Aadhar must be 12 digits' }
  },
  fathersOccupation: { type: String, required: true },
  studentOccupation: { type: String },
  admissionDate: { type: Date },
  permanentAddress: { type: String, required: true },
  permanentAddressRelativeName: String,
  permanentAddressRelativeAddress: String,
  permanentAddressRelativeMobile: String,
  localRelativeName: String,
  localRelativeAddress: String,
  localRelativeMobile: String,
  photoUrl: String,
  roomNumber: { type: Number, default: null, index: true },
  numberOfMembers: { type: Number, default: 1 },
  rent: { type: Number, default: 0 },
  advance: { type: Number, default: 0 },
  roomJoinDate: { type: Date },
  roomLeavingDate: { type: Date, default: null },
  policeFormVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  registrationYear: String,
}, { timestamps: true });

memberSchema.index({ hostelId: 1, roomNumber: 1 });
memberSchema.index({ hostelId: 1, mobileNo: 1 });
memberSchema.index({ hostelId: 1, isActive: 1 });

module.exports = mongoose.model('Member', memberSchema);
