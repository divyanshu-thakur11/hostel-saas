const express      = require('express');
const router       = express.Router();
const Organization = require('../models/Organization');
const { authMiddleware, ownerOnly, tenantGuard } = require('../middleware/auth');

router.use(authMiddleware, tenantGuard, ownerOnly);

// Get settings
router.get('/', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId).select('-razorpayKeySecret').lean();
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.json(org);
  } catch(err) { next(err); }
});

// Update UPI Gateway keys
router.put('/razorpay', async (req, res, next) => {
  try {
    const { upiGatewayApiKey, upiRecipientVpa } = req.body;
    if (!upiGatewayApiKey || !upiRecipientVpa) return res.status(400).json({ message: 'Both API Key and UPI ID are required' });
    if (!upiRecipientVpa.includes('@')) return res.status(400).json({ message: 'Invalid UPI ID (should contain @, e.g. hostel@upi)' });
    await Organization.findByIdAndUpdate(req.organizationId, {
      upiGatewayApiKey:  upiGatewayApiKey.trim(),
      upiRecipientVpa:   upiRecipientVpa.trim().toLowerCase(),
      paymentEnabled:    true,
    });
    res.json({ message: 'UPI payment settings saved. Online payments enabled.' });
  } catch(err) { next(err); }
});

// Disable payments
router.put('/razorpay/disable', async (req, res, next) => {
  try {
    await Organization.findByIdAndUpdate(req.organizationId, { paymentEnabled: false });
    res.json({ message: 'Online payments disabled' });
  } catch(err) { next(err); }
});

// Get onboarding status
router.get('/onboarding', async (req, res, next) => {
  try {
    const Hostel = require('../models/Hostel');
    const Room   = require('../models/Room');
    const Member = require('../models/Member');
    const org    = await Organization.findById(req.organizationId).lean();
    const hostelCount  = await Hostel.countDocuments({ organizationId: req.organizationId, isActive: true });
    const roomCount    = await Room.countDocuments({ organizationId: req.organizationId });
    const memberCount  = await Member.countDocuments({ organizationId: req.organizationId, isActive: true });
    res.json({
      steps: [
        { id: 'hostel',  label: 'Add your hostel',      done: hostelCount > 0,  icon: '🏠' },
        { id: 'rooms',   label: 'Set up rooms',          done: roomCount > 0,    icon: '🚪' },
        { id: 'members', label: 'Add first member',      done: memberCount > 0,  icon: '👥' },
        { id: 'payment', label: 'Enable online payments', done: org?.paymentEnabled || false, icon: '💳', optional: true },
      ],
      allDone: hostelCount > 0 && roomCount > 0 && memberCount > 0,
    });
  } catch(err) { next(err); }
});

module.exports = router;
