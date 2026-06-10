const Notification = require('../models/Notification');
const Member = require('../models/Member');

async function create({ hostelId, organizationId, type, title, message, memberId, memberName, roomNumber, priority = 'medium', dueDate, amount }) {
  try {
    return await Notification.create({ hostelId, organizationId, type, title, message, memberId, memberName, roomNumber, priority, dueDate, amount });
  } catch(e) {
    console.error('[NOTIFICATION ERROR]', e.message);
  }
}

// Called on a schedule or on demand — scans members for dues/expiry
async function generateAutoNotifications(hostelId) {
  try {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const query = hostelId ? { hostelId, isActive: true, roomNumber: { $ne: null } } : { isActive: true, roomNumber: { $ne: null } };
    const members = await Member.find(query);

    for (const m of members) {
      // Overdue: leaving date already passed
      if (m.roomLeavingDate && m.roomLeavingDate < now) {
        const exists = await Notification.findOne({ memberId: m._id, type: 'overdue', createdAt: { $gte: new Date(now - 24*60*60*1000) } });
        if (!exists) {
          await create({
            hostelId: m.hostelId,
            type: 'overdue',
            title: `⚠️ Overdue: ${m.name}`,
            message: `${m.name} (Room ${m.roomNumber}) was due to leave on ${m.roomLeavingDate.toLocaleDateString('en-IN')}. Please collect final dues.`,
            memberId: m._id, memberName: m.name, roomNumber: m.roomNumber, priority: 'high', dueDate: m.roomLeavingDate,
          });
        }
      }
      // Expiry alert: leaving within 7 days
      else if (m.roomLeavingDate && m.roomLeavingDate <= in7days && m.roomLeavingDate >= now) {
        const exists = await Notification.findOne({ memberId: m._id, type: 'expiry_alert', createdAt: { $gte: new Date(now - 24*60*60*1000) } });
        if (!exists) {
          const days = Math.ceil((m.roomLeavingDate - now) / (24*60*60*1000));
          await create({
            hostelId: m.hostelId,
            type: 'expiry_alert',
            title: `🔔 Expiring in ${days} day(s): ${m.name}`,
            message: `${m.name} (Room ${m.roomNumber})'s stay expires in ${days} day(s) on ${m.roomLeavingDate.toLocaleDateString('en-IN')}.`,
            memberId: m._id, memberName: m.name, roomNumber: m.roomNumber, priority: days <= 2 ? 'high' : 'medium', dueDate: m.roomLeavingDate,
          });
        }
      }
    }
  } catch(e) {
    console.error('[AUTO NOTIFY ERROR]', e.message);
  }
}

module.exports = { create, generateAutoNotifications };
