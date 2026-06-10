const Receipt  = require('../models/Receipt');
const Hostel   = require('../models/Hostel');
const audit    = require('../services/audit');
const notify   = require('../services/notifications');
const validate = require('../utils/validate');
const mongoose = require('mongoose');
const { getHostelId } = require('../utils/tenantHelper');

exports.list = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;
    const query = hostelId
      ? { organizationId: req.organizationId, hostelId }
      : { organizationId: req.organizationId };
    if (req.query.room)   query.roomNumber    = parseInt(req.query.room);
    if (req.query.type)   query.packageName   = req.query.type;
    if (req.query.mode)   query.modeOfPayment = req.query.mode;
    if (req.query.from)   query.receiptDate   = { ...query.receiptDate, $gte: new Date(req.query.from) };
    if (req.query.to)     query.receiptDate   = { ...query.receiptDate, $lte: new Date(req.query.to) };
    if (req.query.search) {
      query.$or = [
        { memberName:   { $regex: req.query.search, $options: 'i' } },
        { memberMobile: { $regex: req.query.search } },
        { billNumber:   { $regex: req.query.search, $options: 'i' } },
        ...(!isNaN(parseInt(req.query.search)) ? [{ roomNumber: parseInt(req.query.search) }] : []),
      ];
    }
    const [data, total] = await Promise.all([
      Receipt.find(query).sort({ receiptDate: -1 }).skip(skip).limit(limit).lean(),
      Receipt.countDocuments(query),
    ]);
    res.json({ data, total, page, pages: Math.ceil(total / limit), limit });
  } catch(err) { next(err); }
};

exports.nextNumbers = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const query    = hostelId ? { organizationId: req.organizationId, hostelId } : { organizationId: req.organizationId };
    const last     = await Receipt.findOne(query).sort({ receiptNumber: -1 });
    const nextNum  = last ? (last.receiptNumber || 0) + 1 : 1;
    const year     = new Date().getFullYear();
    const shortYear= `${String(year).slice(2)}-${String(year+1).slice(2)}`;
    const lastBill = await Receipt.findOne({ ...query, billYear: shortYear }).sort({ billSerial: -1 });
    const nextSerial = lastBill ? (lastBill.billSerial || 0) + 1 : 1;
    res.json({ receiptNumber: nextNum, billNumber: `SB/${shortYear}/${String(nextSerial).padStart(3,'0')}`, billYear: shortYear, billSerial: nextSerial });
  } catch(err) { next(err); }
};

exports.resetSerial = async (req, res, next) => {
  try {
    const now = new Date();
    const { yearType } = req.body;
    let fromYear, toYear;
    if (yearType === 'april') {
      fromYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      toYear   = fromYear + 1;
    } else {
      fromYear = toYear = now.getFullYear();
    }
    const newYear = `${String(fromYear).slice(2)}-${String(toYear).slice(2)}`;
    res.json({ message: `Bill numbers will now use year: SB/${newYear}/001`, newYear, nextBill: `SB/${newYear}/001` });
  } catch(err) { next(err); }
};

exports.clearDue = async (req, res, next) => {
  try {
    const updated = await Receipt.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      { $set: { balanceDue: 0 } }, { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Receipt not found' });
    res.json(updated);
  } catch(err) { next(err); }
};

exports.byRoom = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const query    = { organizationId: req.organizationId, roomNumber: parseInt(req.params.roomNumber) };
    if (hostelId)  query.hostelId = hostelId;
    const receipts = await Receipt.find(query).sort({ receiptDate: -1 }).lean();
    res.json(receipts);
  } catch(err) { next(err); }
};

exports.roomSummary = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const query    = { organizationId: req.organizationId, roomNumber: parseInt(req.params.roomNumber) };
    if (hostelId)  query.hostelId = hostelId;
    const receipts = await Receipt.find(query).sort({ receiptDate: -1 }).lean();
    res.json({
      totalPaid:     receipts.reduce((s,r) => s+(r.totalAmount||0), 0),
      totalRent:     receipts.filter(r=>r.packageName==='rent').reduce((s,r)=>s+(r.totalAmount||0),0),
      totalAdvance:  receipts.filter(r=>r.packageName==='advance').reduce((s,r)=>s+(r.totalAmount||0),0),
      totalElectric: receipts.filter(r=>r.packageName==='electric').reduce((s,r)=>s+(r.totalAmount||0),0),
      receiptCount:  receipts.length,
      lastPayment:   receipts[0] || null,
      receipts,
    });
  } catch(err) { next(err); }
};

exports.create = async (req, res, next) => {
  let session = null;
  try { session = await mongoose.startSession(); session.startTransaction(); } catch(e) { session = null; }
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(400).json({ message: 'No hostel assigned' });
    }
    const { roomNumber, totalAmount } = req.body;
    const errors = validate.collect([
      validate.required(roomNumber,        'Room number'),
      validate.required(totalAmount,       'Amount'),
      validate.number(totalAmount,         'Amount'),
      validate.positive(totalAmount,       'Amount'),
      validate.positive(req.body.amountPaid,'Amount paid'),
    ]);
    if (errors.length) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(400).json({ message: errors[0], errors });
    }

    const receiptData = { ...req.body, hostelId, organizationId: req.organizationId };
    const saved = session
      ? (await Receipt.create([receiptData], { session }))[0]
      : await Receipt.create(receiptData);

    await audit.log({ hostelId, organizationId: req.organizationId, action: 'CREATE_RECEIPT', entity: 'receipt', entityId: saved._id, description: `Receipt ${saved.billNumber} Room ${roomNumber} ₹${totalAmount}`, user: req.user });
    await notify.create({ hostelId, organizationId: req.organizationId, type: 'payment_received', title: `Payment: Room ${roomNumber}`, message: `₹${totalAmount} received`, roomNumber: parseInt(roomNumber), priority: 'low', amount: parseFloat(totalAmount) });
    if (session) await session.commitTransaction().catch(()=>{});
    res.status(201).json(saved);
  } catch(err) {
    if (session) await session.abortTransaction().catch(()=>{});
    next(err);
  } finally {
    if (session) session.endSession().catch(()=>{});
  }
};

exports.remove = async (req, res, next) => {
  try {
    const receipt = await Receipt.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    await audit.log({ hostelId: receipt.hostelId, organizationId: req.organizationId, action: 'DELETE_RECEIPT', entity: 'receipt', entityId: receipt._id, description: `Deleted receipt ${receipt.billNumber} Room ${receipt.roomNumber}`, user: req.user });
    res.json({ message: 'Deleted' });
  } catch(err) { next(err); }
};
