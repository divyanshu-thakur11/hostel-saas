const mongoose = require('mongoose');

const maintenanceItemSchema = new mongoose.Schema({
  description: String,
  amount: { type: Number, default: 0 },
}, { _id: false });

const salarySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  employeeName: { type: String, required: true },
  staffName: String, // backwards compat alias
  role: { type: String },
  mobileNo: String,
  address: String,
  month: { type: Number },
  year: { type: Number },
  basicSalary: { type: Number, default: 0 },
  allowances: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
  maintenanceCosts: { type: [maintenanceItemSchema], default: [] },
  totalExpense: { type: Number, default: 0 },
  modeOfPayment: { type: String, enum: ['cash', 'online'], default: 'cash' },
  paidOn: { type: Date, default: Date.now },
  paidDate: Date,
  notes: String,
}, { timestamps: true });

salarySchema.pre('save', function(next) {
  this.netSalary = (this.basicSalary || 0) + (this.allowances || 0) - (this.deductions || 0);
  const maintTotal = (this.maintenanceCosts || []).reduce((s, c) => s + (c.amount || 0), 0);
  this.totalExpense = this.netSalary + maintTotal;
  if (this.employeeName && !this.staffName) this.staffName = this.employeeName;
  next();
});

module.exports = mongoose.model('Salary', salarySchema);
