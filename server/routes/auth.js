const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const Hostel   = require('../models/Hostel');
const { JWT_SECRET, COOKIE_NAME, authMiddleware, ownerOnly, superAdminOnly } = require('../middleware/auth');
const logger   = require('../utils/logger');

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   12 * 60 * 60 * 1000,
  path:     '/',
};

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid credentials or account disabled' });
    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${remaining} minute(s).` });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.incLoginAttempts();
      const left = 5 - (user.loginAttempts + 1);
      return res.status(401).json({ message: left > 0 ? `Invalid credentials. ${left} attempt(s) remaining.` : 'Account locked for 15 minutes.' });
    }

    // Check org suspension for non-superadmin
    if (user.role !== 'superadmin' && user.organizationId) {
      const Organization = require('../models/Organization');
      const org = await Organization.findById(user.organizationId);
      if (!org || !org.isActive) return res.status(403).json({ message: 'Your organization account is suspended. Contact the platform admin.' });
      if (org.planExpiresAt && org.planExpiresAt < new Date()) return res.status(403).json({ message: 'Your subscription has expired. Contact the platform admin.' });
    }

    await user.updateOne({ $set: { loginAttempts: 0, lastLogin: new Date() }, $unset: { lockUntil: 1 } });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name, hostelId: user.hostelId, organizationId: user.organizationId },
      JWT_SECRET, { expiresIn: '12h' }
    );
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    logger.info('User logged in', { username: user.username, role: user.role });

    if (user.mustChangePassword) {
      return res.json({
        requirePasswordChange: true,
        user: { id: user._id, username: user.username, name: user.name, role: user.role, hostelId: user.hostelId, organizationId: user.organizationId },
      });
    }

    res.json({
      user: { id: user._id, username: user.username, name: user.name, role: user.role, hostelId: user.hostelId, organizationId: user.organizationId, lastLogin: user.lastLogin },
    });
  } catch(err) { next(err); }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: 0 });
  res.json({ message: 'Logged out' });
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch(err) { next(err); }
});

// ── Change Password ───────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password           = newPassword;
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch(err) { next(err); }
});

// ── Reset Manager Password (owner only, within same org) ─────────────────────
router.post('/users/:id/reset-password', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Tenant check: owner can only reset managers in their own org
    if (req.user.role === 'owner') {
      if (!user.organizationId || user.organizationId.toString() !== req.organizationId?.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    user.password           = newPassword;
    user.mustChangePassword = true;
    user.loginAttempts      = 0;
    user.lockUntil          = undefined;
    await user.save();
    res.json({ message: `Password reset for ${user.name}. They will be prompted to change it on next login.` });
  } catch(err) { next(err); }
});

// ── List Users (owner: own org managers only) ─────────────────────────────────
router.get('/users', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const query = req.user.role === 'superadmin'
      ? {}
      : { organizationId: req.organizationId, role: 'manager' };
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch(err) { next(err); }
});

// ── Create Manager (owner only, scoped to their org) ─────────────────────────
router.post('/users', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners can create managers' });
    const { username, password, name, mobile } = req.body;
    if (!username || !password || !name) return res.status(400).json({ message: 'username, password and name required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: `Username "${username}" is already taken.` });
    let hostelId = req.body.hostelId || req.hostelId || null;
    if (!hostelId) {
      const hostel = await Hostel.findOne({ organizationId: req.organizationId, isActive: true }).sort({ createdAt: 1 });
      hostelId = hostel?._id || null;
    }
    const user = new User({
      username: username.toLowerCase().trim(), password, name, mobile,
      role: 'manager',
      organizationId: req.organizationId,
      hostelId,
      mustChangePassword: true,
    });
    await user.save();
    logger.info('Manager created', { username: user.username, org: req.organizationId, by: req.user.username });
    res.status(201).json({ message: `Manager "${name}" created. Username: ${username}. They will be prompted to set a new password on first login.`, user: { username: user.username, name: user.name, role: user.role, hostelId } });
  } catch(err) { next(err); }
});

// ── Toggle User (owner can only toggle managers in own org) ──────────────────
router.put('/users/:id/toggle', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role === 'owner') {
      if (user.organizationId?.toString() !== req.organizationId?.toString()) return res.status(403).json({ message: 'Access denied' });
      if (user.role !== 'manager') return res.status(400).json({ message: 'Cannot modify this account' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? 'enabled' : 'disabled'}`, isActive: user.isActive });
  } catch(err) { next(err); }
});

// ── User Activity ─────────────────────────────────────────────────────────────
router.get('/users/:id/activity', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name username role recentActivity lastLogin organizationId');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role === 'owner' && user.organizationId?.toString() !== req.organizationId?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(user);
  } catch(err) { next(err); }
});

// ── Delete Manager ────────────────────────────────────────────────────────────
router.delete('/users/:id', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role === 'owner') {
      if (user.organizationId?.toString() !== req.organizationId?.toString()) return res.status(403).json({ message: 'Access denied' });
      if (user.role !== 'manager') return res.status(400).json({ message: 'Cannot delete this account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Manager deleted' });
  } catch(err) { next(err); }
});

// ── Assign Hostel to Manager ──────────────────────────────────────────────────
router.put('/users/:id/hostel', authMiddleware, ownerOnly, async (req, res, next) => {
  try {
    const { hostelId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role === 'owner' && user.organizationId?.toString() !== req.organizationId?.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    // Validate hostel belongs to same org
    if (hostelId) {
      const hostel = await Hostel.findById(hostelId);
      if (!hostel || hostel.organizationId?.toString() !== req.organizationId?.toString()) {
        return res.status(400).json({ message: 'Invalid hostel' });
      }
    }
    const updated = await User.findByIdAndUpdate(req.params.id, { hostelId: hostelId || null }, { new: true }).select('-password');
    res.json(updated);
  } catch(err) { next(err); }
});

module.exports = router;

// ── Emergency Password Reset (no auth needed — secured by secret token) ───────
// Usage: POST /api/auth/emergency-reset
// Body: { secret: process.env.RESET_SECRET, username: "...", newPassword: "..." }
// Set RESET_SECRET in your .env to a long random string you keep private.
router.post('/emergency-reset', async (req, res, next) => {
  try {
    const { secret, username, newPassword } = req.body;
    const RESET_SECRET = process.env.RESET_SECRET;
    if (!RESET_SECRET) return res.status(503).json({ message: 'Emergency reset not configured. Add RESET_SECRET to your .env file.' });
    if (!secret || secret !== RESET_SECRET) return res.status(403).json({ message: 'Invalid reset secret.' });
    if (!username || !newPassword) return res.status(400).json({ message: 'username and newPassword required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: `No user found with username: ${username}` });

    user.password           = newPassword;
    user.mustChangePassword = true;
    user.loginAttempts      = 0;
    user.lockUntil          = undefined;
    await user.save();

    logger.warn(`Emergency password reset used for user: ${username}`);
    res.json({ message: `Password reset for "${user.name}" (${user.role}). They must change it on next login.` });
  } catch(err) { next(err); }
});
