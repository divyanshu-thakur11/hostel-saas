const AuditLog = require('../models/AuditLog');

async function log({ hostelId, organizationId, action, entity, entityId, description, user, meta, ip }) {
  try {
    await AuditLog.create({
      hostelId,
      organizationId,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      description,
      performedBy: user ? {
        userId: user.id || user._id,
        username: user.username,
        name: user.name,
        role: user.role,
      } : undefined,
      meta,
      ip,
    });
  } catch(e) {
    // Never throw from audit — it must not break main flow
    console.error('[AUDIT ERROR]', e.message);
  }
}

// patched for multi-tenant
module.exports = { log };
