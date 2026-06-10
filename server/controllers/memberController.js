const Member        = require('../models/Member');
const ArchivedMember= require('../models/ArchivedMember');
const Hostel        = require('../models/Hostel');
const Room          = require('../models/Room');
const audit         = require('../services/audit');
const notify        = require('../services/notifications');
const validate      = require('../utils/validate');
const mongoose      = require('mongoose');
const { getHostelId } = require('../utils/tenantHelper');

exports.list = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;
    const { search, room, active } = req.query;
    const base = hostelId
      ? { organizationId: req.organizationId, hostelId }
      : { organizationId: req.organizationId };
    if (room) base.roomNumber = parseInt(room);
    if (active === 'true') { base.isActive = true; }
    const query = search ? {
      ...base,
      $or: [
        { name:         { $regex: search, $options: 'i' } },
        { mobileNo:     { $regex: search } },
        { memberId:     { $regex: search, $options: 'i' } },
        { aadharNumber: { $regex: search } },
        { fathersName:  { $regex: search, $options: 'i' } },
        ...(!isNaN(parseInt(search)) ? [{ roomNumber: parseInt(search) }] : []),
      ],
    } : base;
    const [data, total] = await Promise.all([
      Member.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Member.countDocuments(query),
    ]);
    res.json({ data, total, page, pages: Math.ceil(total / limit), limit });
  } catch(err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const member = await Member.findOne({ _id: req.params.id, organizationId: req.organizationId }).lean();
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch(err) { next(err); }
};

exports.getByRoom = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const members  = await Member.find({ organizationId: req.organizationId, hostelId, roomNumber: parseInt(req.params.roomNumber), isActive: true }).lean();
    res.json(members);
  } catch(err) { next(err); }
};

exports.nextId = async (req, res, next) => {
  try {
    const hostelId   = await getHostelId(req);
    const year       = new Date().getFullYear();
    const shortYear  = `${String(year).slice(2)}-${String(year+1).slice(2)}`;
    const last       = await Member.findOne({ organizationId: req.organizationId, hostelId, registrationYear: shortYear }).sort({ memberIdNumber: -1 });
    const nextNum    = last ? (last.memberIdNumber || 0) + 1 : 1;
    res.json({ nextNumber: nextNum, memberId: `SS/${shortYear}/${String(nextNum).padStart(3,'0')}`, year: shortYear });
  } catch(err) { next(err); }
};

exports.create = async (req, res, next) => {
  let session = null;
  try { session = await mongoose.startSession(); session.startTransaction(); } catch(e) { session = null; }
  try {
    const hostelId = await getHostelId(req);
    if (!hostelId) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(400).json({ message: 'No hostel assigned. Contact owner.' });
    }

    const { name, mobileNo, aadharNumber, fathersName, fathersMobileNo, permanentAddress, fathersOccupation, roomNumber, forceSave } = req.body;
    const errors = validate.collect([
      validate.required(name,              'Name'),
      validate.required(mobileNo,          'Mobile number'),
      validate.required(aadharNumber,      'Aadhar number'),
      validate.required(fathersName,       "Father's name"),
      validate.required(fathersMobileNo,   "Father's mobile"),
      validate.required(permanentAddress,  'Permanent address'),
      validate.required(fathersOccupation, "Father's occupation"),
      validate.mobile(mobileNo,            'Mobile number'),
      validate.mobile(fathersMobileNo,     "Father's mobile"),
      validate.aadhar(aadharNumber),
    ]);
    if (errors.length) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(400).json({ message: errors[0], errors });
    }

    // Duplicate detection (skip if forceSave=true)
    if (!forceSave) {
      const lev = (a, b) => {
        const m = a.length, n = b.length;
        const dp = Array.from({ length: m+1 }, (_,i) => Array.from({ length: n+1 }, (_,j) => i===0 ? j : j===0 ? i : 0));
        for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
          dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
        return dp[m][n];
      };
      const existing     = await Member.find({ organizationId: req.organizationId, hostelId, isActive: { $ne: false } }).select('name mobileNo _id').lean();
      const nameLower    = (name||'').toLowerCase();
      const mobileFirst8 = (mobileNo||'').replace(/\D/g,'').slice(0,8);
      const dup = existing.find(m => {
        const dist = lev(nameLower, (m.name||'').toLowerCase());
        const mobileMatch = mobileFirst8 && (m.mobileNo||'').replace(/\D/g,'').slice(0,8) === mobileFirst8;
        return dist <= 3 && mobileMatch;
      });
      if (dup) {
        if (session) await session.abortTransaction().catch(()=>{});
        return res.status(409).json({ duplicate: true, existingMember: dup });
      }
    }

    if (roomNumber) {
      const hostel   = await Hostel.findById(hostelId);
      const totalRooms = hostel?.totalRooms || 9999;
      if (parseInt(roomNumber) < 1 || parseInt(roomNumber) > totalRooms) {
        if (session) await session.abortTransaction().catch(()=>{});
        return res.status(400).json({ message: `Room ${roomNumber} does not exist in this hostel.` });
      }
      const occupants = await Member.countDocuments({ organizationId: req.organizationId, hostelId, roomNumber: parseInt(roomNumber), isActive: true });
      const roomDoc   = await Room.findOne({ organizationId: req.organizationId, hostelId, roomNumber: parseInt(roomNumber) }).catch(()=>null);
      const maxCap    = roomDoc?.maxCapacity || 999;
      if (maxCap < 999 && occupants >= maxCap) {
        if (session) await session.abortTransaction().catch(()=>{});
        return res.status(409).json({ message: `Room ${roomNumber} is full (${occupants}/${maxCap} members).` });
      }
    }

    // Build the member data — always inject organizationId
    const data = {
      ...req.body,
      hostelId,
      organizationId: req.organizationId,
    };
    if (data.memberIdNumber) {
      const year      = new Date().getFullYear();
      const shortYear = `${String(year).slice(2)}-${String(year+1).slice(2)}`;
      data.memberId         = `SS/${shortYear}/${String(data.memberIdNumber).padStart(3,'0')}`;
      data.registrationYear = shortYear;
    }

    const saved = await Member.create(data);
    await audit.log({ hostelId, organizationId: req.organizationId, action: 'CREATE_MEMBER', entity: 'member', entityId: saved._id, description: `Added ${saved.name}${saved.roomNumber ? ` to Room ${saved.roomNumber}` : ''}`, user: req.user });
    await notify.create({ hostelId, organizationId: req.organizationId, type: 'new_member', title: `New member: ${saved.name}`, message: `${saved.name} added${saved.roomNumber ? ` to Room ${saved.roomNumber}` : ''}`, memberId: saved._id, memberName: saved.name, roomNumber: saved.roomNumber, priority: 'low' });
    if (session) await session.commitTransaction().catch(()=>{});
    res.status(201).json(saved);
  } catch(err) {
    if (session) await session.abortTransaction().catch(()=>{});
    next(err);
  } finally {
    if (session) session.endSession().catch(()=>{});
  }
};

exports.update = async (req, res, next) => {
  let session = null;
  try { session = await mongoose.startSession(); session.startTransaction(); } catch(e) { session = null; }
  try {
    const existing = await Member.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!existing) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(404).json({ message: 'Member not found' });
    }
    const { mobileNo, aadharNumber, fathersMobileNo } = req.body;
    const errors = validate.collect([
      mobileNo       ? validate.mobile(mobileNo,       'Mobile number')  : null,
      fathersMobileNo? validate.mobile(fathersMobileNo,"Father's mobile"): null,
      aadharNumber   ? validate.aadhar(aadharNumber)                     : null,
    ]);
    if (errors.length) {
      if (session) await session.abortTransaction().catch(()=>{});
      return res.status(400).json({ message: errors[0], errors });
    }
    // Never allow changing organizationId or hostelId via update
    const updateData = { ...req.body };
    delete updateData.organizationId;
    delete updateData.hostelId;
    delete updateData._id;
    Object.assign(existing, updateData);
    await existing.save();
    await audit.log({ hostelId: existing.hostelId, organizationId: req.organizationId, action: 'UPDATE_MEMBER', entity: 'member', entityId: existing._id, description: `Updated ${existing.name}`, user: req.user });
    if (session) await session.commitTransaction().catch(()=>{});
    res.json(existing);
  } catch(err) {
    if (session) await session.abortTransaction().catch(()=>{});
    next(err);
  } finally {
    if (session) session.endSession().catch(()=>{});
  }
};

exports.remove = async (req, res, next) => {
  try {
    const member = await Member.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.isActive = false;
    member.roomNumber = null;
    await member.save();
    await audit.log({ hostelId: member.hostelId, organizationId: req.organizationId, action: 'REMOVE_MEMBER', entity: 'member', entityId: member._id, description: `Removed ${member.name}`, user: req.user });
    res.json({ message: 'Member removed' });
  } catch(err) { next(err); }
};

exports.archive = async (req, res, next) => {
  try {
    const member = await Member.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    const memberData = member.toObject();
    delete memberData._id;
    const archivedMember = new ArchivedMember({
      ...memberData,
      organizationId: req.organizationId,
      originalMemberId: member._id,
      archivedAt: new Date(),
      archiveReason: req.body.reason || 'Left hostel',
    });
    await archivedMember.save();
    await Member.findByIdAndDelete(member._id);
    await audit.log({ hostelId: member.hostelId, organizationId: req.organizationId, action: 'ARCHIVE_MEMBER', entity: 'member', entityId: member._id, description: `Archived ${member.name}`, user: req.user });
    res.json({ message: 'Member archived', archived: archivedMember });
  } catch(err) { next(err); }
};

exports.listArchived = async (req, res, next) => {
  try {
    const hostelId = await getHostelId(req);
    const archived = await ArchivedMember.find({ organizationId: req.organizationId, hostelId }).sort({ archivedAt: -1 }).lean();
    res.json(archived);
  } catch(err) { next(err); }
};

exports.restore = async (req, res, next) => {
  try {
    const archived = await ArchivedMember.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!archived) return res.status(404).json({ message: 'Archived member not found' });
    const memberData = archived.toObject();
    delete memberData._id;
    delete memberData.originalMemberId;
    delete memberData.archivedAt;
    delete memberData.archiveReason;
    memberData.isActive = true;
    memberData.organizationId = req.organizationId;
    const restored = await Member.create(memberData);
    await ArchivedMember.findByIdAndDelete(archived._id);
    res.json({ message: 'Member restored', member: restored });
  } catch(err) { next(err); }
};
// Compatibility aliases required by routes
exports.restoreArchived = exports.restore;

// Missing route handlers
exports.deleteArchived = async (req, res, next) => {
  try {
    const archived = await ArchivedMember.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!archived) {
      return res.status(404).json({ message: 'Archived member not found' });
    }

    res.json({ message: 'Archived member deleted permanently' });
  } catch (err) {
    next(err);
  }
};

exports.vacate = async (req, res, next) => {
  try {
    const member = await Member.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    member.roomNumber = null;
    await member.save();

    res.json({
      message: 'Member vacated successfully',
      member
    });
  } catch (err) {
    next(err);
  }
};
