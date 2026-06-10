const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'hostel_super_secret_change_in_production';
const COOKIE_NAME = 'hm_token';

const authMiddleware = (req, res, next) => {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Inject organizationId — critical for tenant isolation
    // superadmin has no organizationId (can see all)
    // owners and managers are scoped to their org
    req.organizationId = decoded.organizationId || null;

    if (decoded.role === 'owner') {
      const headerHostelId = req.headers['x-hostel-id'];
      req.hostelId = headerHostelId || decoded.hostelId || null;
    } else if (decoded.role === 'superadmin') {
      req.hostelId = null; // superadmin doesn't operate within a hostel
    } else {
      req.hostelId = decoded.hostelId || null;
    }

    next();
  } catch(err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Session expired. Please log in again.' });
    return res.status(401).json({ message: 'Invalid token. Please log in again.' });
  }
};

// Only super admin can use this
const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') return res.status(403).json({ message: 'Super admin access only' });
  next();
};

// Owner or superadmin
const ownerOnly = (req, res, next) => {
  if (!req.user || !['owner', 'superadmin'].includes(req.user.role)) return res.status(403).json({ message: 'Owner access only' });
  next();
};

// Ensure tenant is active & not expired (run after authMiddleware for owner/manager routes)
const tenantGuard = async (req, res, next) => {
  if (!req.user || req.user.role === 'superadmin') return next();
  try {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(req.organizationId);
    if (!org) return res.status(403).json({ message: 'Organization not found' });
    if (!org.isActive) return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    if (org.planExpiresAt && org.planExpiresAt < new Date()) return res.status(403).json({ message: 'Subscription expired. Please contact support.' });
    req.organization = org;
    next();
  } catch(err) { next(err); }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
  next();
};

module.exports = { JWT_SECRET, COOKIE_NAME, authMiddleware, superAdminOnly, ownerOnly, tenantGuard, allowRoles };
