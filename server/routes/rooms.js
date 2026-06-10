const express = require('express');
const router  = express.Router();
const Member  = require('../models/Member');
const Room    = require('../models/Room');
const Hostel  = require('../models/Hostel');
const { authMiddleware, tenantGuard } = require('../middleware/auth');
const { getHostelId } = require('../utils/tenantHelper');

router.use(authMiddleware, tenantGuard);

// GET all rooms
router.get('/', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });

    // Auto-create default rooms on first access if none exist
    const count = await Room.countDocuments({ organizationId: req.organizationId, hostelId });
    if (count === 0) {
      const hostel  = await Hostel.findById(hostelId);
      const total   = hostel?.totalRooms || 20;
      const toCreate= [];
      for (let i = 1; i <= total; i++) {
        toCreate.push({ organizationId: req.organizationId, hostelId, roomNumber: i, rent: 0, advance: 0, maxCapacity: 6 });
      }
      await Room.insertMany(toCreate, { ordered: false }).catch(() => {});
    }

    const [roomConfigs, allMembers] = await Promise.all([
      Room.find({ organizationId: req.organizationId, hostelId }).sort({ roomNumber: 1 }).lean(),
      Member.find({ organizationId: req.organizationId, hostelId, isActive: true }).lean(),
    ]);
    const rooms = roomConfigs.map(rc => {
      const members = allMembers.filter(m => m.roomNumber === rc.roomNumber);
      return {
        roomNumber:  rc.roomNumber,
        rent:        rc.rent,
        advance:     rc.advance,
        maxCapacity: rc.maxCapacity,
        notes:       rc.notes,
        memberCount: members.length,
        status:      members.length === 0 ? 'vacant' : members.length >= rc.maxCapacity ? 'full' : 'occupied',
        members:     members.map(m => ({
          _id: m._id, name: m.name, mobileNo: m.mobileNo,
          memberId: m.memberId, roomJoinDate: m.roomJoinDate,
          policeFormVerified: m.policeFormVerified,
        })),
        _id: rc._id,
      };
    });
    res.json(rooms);
  } catch(err) { next(err); }
});

// GET single room
router.get('/:roomNumber', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const roomNum = parseInt(req.params.roomNumber);
    let roomConfig = await Room.findOne({ organizationId: req.organizationId, hostelId, roomNumber: roomNum }).lean();
    if (!roomConfig) {
      roomConfig = await Room.create({ organizationId: req.organizationId, hostelId, roomNumber: roomNum, rent: 0, advance: 0, maxCapacity: 10 });
    }
    const members = await Member.find({ organizationId: req.organizationId, hostelId, roomNumber: roomNum, isActive: true }).lean();
    res.json({ ...roomConfig, memberCount: members.length, status: members.length === 0 ? 'vacant' : members.length >= roomConfig.maxCapacity ? 'full' : 'occupied', members });
  } catch(err) { next(err); }
});

// PUT update single room
router.put('/:roomNumber', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const roomNum = parseInt(req.params.roomNumber);
    const { rent, advance, maxCapacity, notes, reason } = req.body;
    const existing = await Room.findOne({ organizationId: req.organizationId, hostelId, roomNumber: roomNum });
    const updateOps = {
      $set: {
        organizationId: req.organizationId,
        hostelId,
        ...(rent        !== undefined && { rent:        parseFloat(rent)       || 0 }),
        ...(advance     !== undefined && { advance:     parseFloat(advance)    || 0 }),
        ...(maxCapacity !== undefined && { maxCapacity: parseInt(maxCapacity)  || 10 }),
        ...(notes       !== undefined && { notes }),
      }
    };
    if (rent !== undefined && existing && parseFloat(rent) !== existing.rent) {
      updateOps.$push = {
        rentHistory: { oldRent: existing.rent, newRent: parseFloat(rent)||0, changedOn: new Date(), changedBy: req.user?.name || req.user?.username || 'owner', reason: reason||'' }
      };
    }
    const updated = await Room.findOneAndUpdate(
      { organizationId: req.organizationId, hostelId, roomNumber: roomNum },
      updateOps,
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch(err) { next(err); }
});

// PUT bulk update
router.put('/', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const { rooms } = req.body;
    if (!Array.isArray(rooms)) return res.status(400).json({ message: 'rooms array required' });
    const ops = rooms.map(r => ({
      updateOne: {
        filter: { organizationId: req.organizationId, hostelId, roomNumber: r.roomNumber },
        update: { $set: { organizationId: req.organizationId, hostelId, rent: parseFloat(r.rent)||0, advance: parseFloat(r.advance)||0, maxCapacity: parseInt(r.maxCapacity)||10, notes: r.notes||'' } },
        upsert: true,
      }
    }));
    await Room.bulkWrite(ops);
    res.json({ message: 'All rooms updated' });
  } catch(err) { next(err); }
});

// POST create room
router.post('/', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const { roomNumber, rent, advance, maxCapacity, notes } = req.body;
    const num = parseInt(roomNumber);
    if (!num || num < 1) return res.status(400).json({ message: 'Valid room number required' });
    const exists = await Room.findOne({ organizationId: req.organizationId, hostelId, roomNumber: num });
    if (exists) return res.status(409).json({ message: `Room ${num} already exists` });
    const room = await Room.create({ organizationId: req.organizationId, hostelId, roomNumber: num, rent: parseFloat(rent)||0, advance: parseFloat(advance)||0, maxCapacity: parseInt(maxCapacity)||6, notes: notes||'' });
    res.status(201).json(room);
  } catch(err) { next(err); }
});

// DELETE room
router.delete('/:roomNumber', async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) return res.status(400).json({ message: 'No hostel assigned' });
    const roomNum      = parseInt(req.params.roomNumber);
    const activeMembers= await Member.countDocuments({ organizationId: req.organizationId, hostelId, roomNumber: roomNum, isActive: true });
    if (activeMembers > 0) return res.status(400).json({ message: `Room ${roomNum} has ${activeMembers} active member(s). Remove them first.` });
    await Room.findOneAndDelete({ organizationId: req.organizationId, hostelId, roomNumber: roomNum });
    res.json({ message: `Room ${roomNum} deleted` });
  } catch(err) { next(err); }
});

module.exports = router;
