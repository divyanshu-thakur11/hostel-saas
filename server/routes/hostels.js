const express  = require('express');
const router   = express.Router();
const Hostel   = require('../models/Hostel');
const { authMiddleware, ownerOnly, tenantGuard } = require('../middleware/auth');

router.use(authMiddleware, tenantGuard);

// List hostels — always scoped to organization
router.get('/', async (req, res, next) => {
  try {
    const query = req.user.role === 'superadmin'
      ? { isActive: true }
      : { organizationId: req.organizationId, isActive: true };
    const hostels = await Hostel.find(query).sort({ createdAt: 1 });
    res.json(hostels);
  } catch(err) { next(err); }
});

// Create hostel
router.post('/', ownerOnly, async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only hostel owners can create hostels' });
    const { name, address, city, mobile, totalRooms } = req.body;
    if (!name || !address) return res.status(400).json({ message: 'Name and address required' });
    const hostel = new Hostel({
      organizationId: req.organizationId,
      name, address, city, mobile,
      totalRooms: totalRooms || 20,
      createdBy: req.user.id,
    });
    await hostel.save();
    res.status(201).json(hostel);
  } catch(err) { next(err); }
});

// Update hostel — must belong to same org
router.put('/:id', ownerOnly, async (req, res, next) => {
  try {
    const hostel = await Hostel.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    const { name, address, city, mobile, totalRooms } = req.body;
    if (totalRooms && totalRooms < 1) return res.status(400).json({ message: 'Must have at least 1 room' });
    Object.assign(hostel, { name, address, city, mobile, totalRooms });
    await hostel.save();
    res.json(hostel);
  } catch(err) { next(err); }
});

// Delete hostel — must belong to same org
router.delete('/:id', ownerOnly, async (req, res, next) => {
  try {
    const hostel = await Hostel.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      { isActive: false }, { new: true }
    );
    if (!hostel) return res.status(404).json({ message: 'Hostel not found' });
    res.json({ message: 'Hostel removed' });
  } catch(err) { next(err); }
});

module.exports = router;
