const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const Organization = require('../models/Organization');
const User         = require('../models/User');
const Hostel       = require('../models/Hostel');
const Member       = require('../models/Member');
const { JWT_SECRET, COOKIE_NAME, authMiddleware, superAdminOnly } = require('../middleware/auth');
const logger       = require('../utils/logger');

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   12 * 60 * 60 * 1000,
  path:     '/',
};

// ── List all organizations ────────────────────────────────────────────────────
router.get('/organizations', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 }).lean();
    // Attach owner info and stats
    const enriched = await Promise.all(orgs.map(async (org) => {
      const owner   = await User.findOne({ organizationId: org._id, role: 'owner' }).select('username name lastLogin isActive').lean();
      const hostels = await Hostel.countDocuments({ organizationId: org._id, isActive: true });
      const members = await Member.countDocuments({ organizationId: org._id, isActive: true });
      return { ...org, owner, hostelCount: hostels, memberCount: members };
    }));
    res.json(enriched);
  } catch(err) { next(err); }
});

// ── Create organization + owner account ───────────────────────────────────────
router.post('/organizations', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const { orgName, ownerName, email, mobile, plan, planDays, username, password, notes } = req.body;
    if (!orgName || !ownerName || !username || !password) {
      return res.status(400).json({ message: 'orgName, ownerName, username, and password are required' });
    }
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: `Username "${username}" is already taken` });

    const expiresAt = new Date(Date.now() + (planDays || 365) * 24 * 60 * 60 * 1000);
    const org = await new Organization({
      name: orgName, ownerName, email, mobile,
      plan: plan || 'basic',
      planExpiresAt: expiresAt,
      notes: notes || '',
      createdBy: req.user.id,
    }).save();

    const owner = await new User({
      username:          username.toLowerCase().trim(),
      password,
      name:              ownerName,
      mobile,
      role:              'owner',
      organizationId:    org._id,
      mustChangePassword: true,
    }).save();

    logger.info('Organization created', { org: org.name, owner: owner.username, by: req.user.username });
    res.status(201).json({
      message: `Organization "${orgName}" created. Owner login: ${username}`,
      organization: org,
      owner: { _id: owner._id, username: owner.username, name: owner.name },
    });
  } catch(err) { next(err); }
});

// ── Update organization ───────────────────────────────────────────────────────
router.put('/organizations/:id', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const { orgName, ownerName, email, mobile, plan, planDays, notes } = req.body;
    const update = {};
    if (orgName)    update.name      = orgName;
    if (ownerName)  update.ownerName = ownerName;
    if (email)      update.email     = email;
    if (mobile)     update.mobile    = mobile;
    if (plan)       update.plan      = plan;
    if (notes !== undefined) update.notes = notes;
    if (planDays) update.planExpiresAt = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000);
    const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch(err) { next(err); }
});

// ── Suspend / reactivate organization ─────────────────────────────────────────
router.put('/organizations/:id/suspend', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const { suspend, reason } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { isActive: !suspend, suspendedAt: suspend ? new Date() : null, suspendReason: suspend ? (reason||'') : '' },
      { new: true }
    );
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    // Also deactivate/reactivate owner user
    await User.updateMany({ organizationId: org._id, role: 'owner' }, { isActive: !suspend });
    logger.info(`Org ${suspend ? 'suspended' : 'reactivated'}`, { org: org.name, by: req.user.username });
    res.json({ message: `Organization ${suspend ? 'suspended' : 'reactivated'}`, organization: org });
  } catch(err) { next(err); }
});

// ── Extend subscription ───────────────────────────────────────────────────────
router.put('/organizations/:id/extend', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const { days } = req.body;
    if (!days || days < 1) return res.status(400).json({ message: 'days must be >= 1' });
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    const base = org.planExpiresAt > new Date() ? org.planExpiresAt : new Date();
    org.planExpiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await org.save();
    res.json({ message: `Extended by ${days} days. Expires: ${org.planExpiresAt.toDateString()}`, organization: org });
  } catch(err) { next(err); }
});

// ── Delete organization (hard delete — use with caution) ──────────────────────
router.delete('/organizations/:id', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    // Cascade soft-delete
    await Organization.findByIdAndDelete(req.params.id);
    await User.deleteMany({ organizationId: req.params.id });
    await Hostel.updateMany({ organizationId: req.params.id }, { isActive: false });
    logger.warn('Organization deleted', { org: org.name, by: req.user.username });
    res.json({ message: `Organization "${org.name}" and all its users deleted` });
  } catch(err) { next(err); }
});

// ── Reset owner password ──────────────────────────────────────────────────────
router.post('/organizations/:id/reset-password', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const owner = await User.findOne({ organizationId: req.params.id, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    owner.password           = newPassword;
    owner.mustChangePassword = true;
    owner.loginAttempts      = 0;
    owner.lockUntil          = undefined;
    await owner.save();
    res.json({ message: `Password reset for ${owner.name}. They must change it on next login.` });
  } catch(err) { next(err); }
});

// ── System analytics ─────────────────────────────────────────────────────────
router.get('/analytics', authMiddleware, superAdminOnly, async (req, res, next) => {
  try {
    const [totalOrgs, activeOrgs, suspendedOrgs, expiredOrgs, totalMembers, totalHostels] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ isActive: true, planExpiresAt: { $gt: new Date() } }),
      Organization.countDocuments({ isActive: false }),
      Organization.countDocuments({ isActive: true, planExpiresAt: { $lte: new Date() } }),
      Member.countDocuments({ isActive: true }),
      Hostel.countDocuments({ isActive: true }),
    ]);
    const planBreakdown = await Organization.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    const recentOrgs = await Organization.find().sort({ createdAt: -1 }).limit(5).lean();
    res.json({ totalOrgs, activeOrgs, suspendedOrgs, expiredOrgs, totalMembers, totalHostels, planBreakdown, recentOrgs });
  } catch(err) { next(err); }
});

module.exports = router;

// ── Enable/update Razorpay for an org (owner sets their own keys) ─────────────
// This is also accessible by the owner themselves via /api/settings/razorpay
