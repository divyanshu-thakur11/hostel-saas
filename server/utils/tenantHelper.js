/**
 * Resolve hostelId for the current request, always within the org boundary.
 * Owners can switch hostel via x-hostel-id header (validated below).
 * Managers are always locked to their JWT hostelId.
 * SuperAdmin is platform-wide (returns null — queries must handle separately).
 */
const Hostel = require('../models/Hostel');

async function getHostelId(req) {
  if (req.user.role === 'superadmin') return null;

  if (req.user.role === 'owner') {
    const hId = req.hostelId;
    if (hId) {
      // Validate: hostel must belong to owner's org
      const hostel = await Hostel.findOne({ _id: hId, organizationId: req.organizationId });
      if (hostel) return hostel._id;
    }
    // Fall back to first hostel in org
    const first = await Hostel.findOne({ organizationId: req.organizationId, isActive: true }).sort({ createdAt: 1 });
    return first?._id || null;
  }

  // Manager: always use hostelId from JWT, never from header
  return req.user.hostelId || null;
}

/**
 * Build a base query with both organizationId and optionally hostelId.
 * This ensures every query is double-scoped (org + hostel).
 */
async function baseQuery(req, forceHostelId = false) {
  if (req.user.role === 'superadmin') return {};
  const hostelId = await getHostelId(req);
  const query = { organizationId: req.organizationId };
  if (hostelId || forceHostelId) query.hostelId = hostelId;
  return query;
}

module.exports = { getHostelId, baseQuery };
