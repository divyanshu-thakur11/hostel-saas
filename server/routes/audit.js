const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authMiddleware, ownerOnly, tenantGuard } = require('../middleware/auth');
const Hostel = require('../models/Hostel');

router.use(authMiddleware, ownerOnly);

router.get('/', async (req, res, next) => {
  try {
    const hostelId = req.query.hostelId || (await Hostel.findOne({ isActive: true }).sort({ createdAt: 1 }))?._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const query = hostelId ? { organizationId: req.organizationId, hostelId } : { organizationId: req.organizationId };
    if (req.query.action) query.action = req.query.action;
    if (req.query.user) query['performedBy.username'] = { $regex: req.query.user, $options: 'i' };
    if (req.query.entity) query.entity = req.query.entity;
    const [data, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query),
    ]);
    res.json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch(err) { next(err); }
});

module.exports = router;
