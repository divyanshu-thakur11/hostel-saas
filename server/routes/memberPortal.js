/**
 * Member Self-Service Portal routes
 * Auth: separate JWT in cookie (hm_member_token), scoped to member only.
 *
 * Payment: UPIGateway.dev — zero-fee UPI, P2P to owner's bank.
 * API docs: https://upigateway.dev/docs
 *
 * Flow:
 *   1. POST /payments/create-order  → call UPIGateway API → get UPI deep link + QR
 *   2. Member pays via any UPI app
 *   3. UPIGateway sends webhook to POST /payments/webhook/:orgId
 *   4. Webhook verified with HMAC → receipt auto-created → PaymentOrder marked paid
 *   5. Member polls GET /payments/status/:orderId to get live status
 */
const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const axios        = require('axios');
const MemberAuth   = require('../models/MemberAuth');
const Member       = require('../models/Member');
const Receipt      = require('../models/Receipt');
const PaymentOrder = require('../models/PaymentOrder');
const Hostel       = require('../models/Hostel');
const Organization = require('../models/Organization');
const { JWT_SECRET } = require('../middleware/auth');
const logger       = require('../utils/logger');

const MEMBER_COOKIE    = 'hm_member_token';
const UPIGATEWAY_BASE  = 'https://api.upigateway.dev/v1';
const COOKIE_OPTS      = { httpOnly: true, secure: process.env.NODE_ENV==='production', sameSite:'lax', maxAge: 8*60*60*1000, path:'/' };

// ── Middleware: member auth ───────────────────────────────────────────────────
function memberAuth(req, res, next) {
  const token = req.cookies?.[MEMBER_COOKIE];
  if (!token) return res.status(401).json({ message: 'Not logged in' });
  try {
    req.member = jwt.verify(token, JWT_SECRET + '_member');
    next();
  } catch(e) { res.status(401).json({ message: 'Session expired, please log in again' }); }
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { mobile, pin } = req.body;
    if (!mobile || !pin) return res.status(400).json({ message: 'Mobile and PIN required' });

    const auth = await MemberAuth.findOne({ mobile: mobile.trim() });
    if (!auth || !auth.isActive) return res.status(401).json({ message: 'Invalid mobile or account not activated' });
    if (auth.isLocked) return res.status(423).json({ message: 'Too many attempts. Try again in 15 minutes.' });

    const valid = await auth.comparePin(pin);
    if (!valid) {
      auth.loginAttempts = (auth.loginAttempts || 0) + 1;
      if (auth.loginAttempts >= 5) auth.lockUntil = new Date(Date.now() + 15*60*1000);
      await auth.save();
      return res.status(401).json({ message: `Incorrect PIN. ${Math.max(0, 5 - auth.loginAttempts)} attempt(s) remaining.` });
    }

    const org = await Organization.findById(auth.organizationId);
    if (!org || !org.isActive) return res.status(403).json({ message: 'Hostel account is currently suspended.' });

    auth.loginAttempts = 0; auth.lockUntil = undefined; auth.lastLogin = new Date();
    await auth.save();

    const member = await Member.findById(auth.memberId).lean();
    if (!member || !member.isActive) return res.status(403).json({ message: 'Your membership is inactive. Contact hostel management.' });

    const hostel = await Hostel.findById(auth.hostelId).select('name address').lean();

    const token = jwt.sign(
      { memberId: auth.memberId.toString(), organizationId: auth.organizationId.toString(), hostelId: auth.hostelId.toString(), mobile: auth.mobile },
      JWT_SECRET + '_member', { expiresIn: '8h' }
    );
    res.cookie(MEMBER_COOKIE, token, COOKIE_OPTS);
    res.json({ member: { ...member, hostelName: hostel?.name, hostelAddress: hostel?.address } });
  } catch(err) { next(err); }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(MEMBER_COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
  res.json({ message: 'Logged out' });
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/me', memberAuth, async (req, res, next) => {
  try {
    const member = await Member.findById(req.member.memberId).lean();
    if (!member) return res.status(404).json({ message: 'Profile not found' });
    const hostel = await Hostel.findById(req.member.hostelId).select('name address mobile').lean();
    res.json({ ...member, hostelName: hostel?.name, hostelAddress: hostel?.address, hostelMobile: hostel?.mobile });
  } catch(err) { next(err); }
});

// ── Receipts ──────────────────────────────────────────────────────────────────
router.get('/receipts', memberAuth, async (req, res, next) => {
  try {
    const member = await Member.findById(req.member.memberId).lean();
    if (!member) return res.status(404).json({ message: 'Not found' });
    const receipts = await Receipt.find({
      organizationId: req.member.organizationId,
      hostelId:       req.member.hostelId,
      roomNumber:     member.roomNumber,
    }).sort({ receiptDate: -1 }).limit(50).lean();
    res.json(receipts);
  } catch(err) { next(err); }
});

// ── Dues summary ──────────────────────────────────────────────────────────────
router.get('/dues', memberAuth, async (req, res, next) => {
  try {
    const member = await Member.findById(req.member.memberId).lean();
    if (!member) return res.status(404).json({ message: 'Not found' });
    const receipts = await Receipt.find({
      organizationId: req.member.organizationId,
      hostelId:       req.member.hostelId,
      roomNumber:     member.roomNumber,
    }).sort({ receiptDate: -1 }).lean();

    const totalPaid   = receipts.reduce((s,r) => s + (r.amountPaid || r.totalAmount || 0), 0);
    const totalBalance= receipts.reduce((s,r) => s + (r.balanceDue || 0), 0);
    const lastPayment = receipts[0] || null;
    const now         = new Date();
    const thisMonthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const thisMonthPaid  = receipts.some(r =>
      r.packageName === 'rent' && r.receiptDate &&
      new Date(r.receiptDate).getMonth() === now.getMonth() &&
      new Date(r.receiptDate).getFullYear() === now.getFullYear()
    );
    res.json({ totalPaid, totalBalance, lastPayment, monthlyRent: member.rent||0, thisMonthPaid, thisMonthLabel, receiptCount: receipts.length });
  } catch(err) { next(err); }
});

// ── List payment orders ───────────────────────────────────────────────────────
router.get('/payments', memberAuth, async (req, res, next) => {
  try {
    const orders = await PaymentOrder.find({ memberId: req.member.memberId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json(orders);
  } catch(err) { next(err); }
});

// ── Create UPI payment order ──────────────────────────────────────────────────
// Returns: UPI deep link (upi://pay?...) + QR code URL for member to scan/click
router.post('/payments/create-order', memberAuth, async (req, res, next) => {
  try {
    const { amount, paymentType, description, month } = req.body;
    if (!amount || parseFloat(amount) < 1) return res.status(400).json({ message: 'Valid amount required' });

    const member = await Member.findById(req.member.memberId).lean();
    if (!member) return res.status(404).json({ message: 'Member not found' });

    const org = await Organization.findById(req.member.organizationId);
    if (!org?.paymentEnabled || !org?.upiGatewayApiKey || !org?.upiRecipientVpa) {
      return res.status(400).json({ message: 'Online payments not enabled for this hostel. Please pay in cash and ask for a receipt.' });
    }

    const hostel = await Hostel.findById(req.member.hostelId).select('name').lean();
    const txnNote = `Room ${member.roomNumber} - ${paymentType || 'rent'} - ${month || ''}`.trim();
    const amountINR = parseFloat(amount).toFixed(2);

    // Call UPIGateway.dev to create an order
    // POST https://api.upigateway.dev/v1/orders
    const orderRef = `HM-${Date.now()}-${member.roomNumber}`;
    let gatewayOrder;
    try {
      const response = await axios.post(`${UPIGATEWAY_BASE}/orders`, {
        amount:       amountINR,
        currency:     'INR',
        vpa:          org.upiRecipientVpa,         // owner's UPI ID
        description:  txnNote,
        reference_id: orderRef,
        customer: {
          name:   member.name,
          mobile: member.mobileNo,
        },
        webhook_url: `${process.env.APP_URL || 'http://localhost:5000'}/api/member-portal/payments/webhook/${org._id}`,
      }, {
        headers: {
          'Authorization': `Bearer ${org.upiGatewayApiKey}`,
          'Content-Type':  'application/json',
        },
        timeout: 10000,
      });
      gatewayOrder = response.data;
    } catch(e) {
      logger.error('UPIGateway order creation failed', e?.response?.data || e.message);
      return res.status(502).json({ message: 'Payment gateway error. Please try again or pay in cash.' });
    }

    // Save our local PaymentOrder
    const paymentOrder = await PaymentOrder.create({
      organizationId:     req.member.organizationId,
      hostelId:           req.member.hostelId,
      memberId:           req.member.memberId,
      memberName:         member.name,
      memberMobile:       member.mobileNo,
      roomNumber:         member.roomNumber,
      upiGatewayOrderId:  gatewayOrder.id || gatewayOrder.order_id || orderRef,
      amount:             parseFloat(amount),
      paymentType:        paymentType || 'rent',
      description:        description || txnNote,
      month:              month || '',
      status:             'created',
    });

    res.json({
      paymentOrderId: paymentOrder._id,
      gatewayOrderId: paymentOrder.upiGatewayOrderId,
      amount:         parseFloat(amount),
      upiDeepLink:    gatewayOrder.upi_link || gatewayOrder.payment_link,
      qrCodeUrl:      gatewayOrder.qr_code  || gatewayOrder.qr_image_url,
      upiString:      gatewayOrder.upi_string,
      recipientVpa:   org.upiRecipientVpa,
      hostelName:     hostel?.name,
      txnNote,
      // Fallback: build standard UPI deep link if gateway doesn't return one
      fallbackUpiLink: `upi://pay?pa=${encodeURIComponent(org.upiRecipientVpa)}&pn=${encodeURIComponent(hostel?.name||'Hostel')}&am=${amountINR}&cu=INR&tn=${encodeURIComponent(txnNote)}`,
    });
  } catch(err) { next(err); }
});

// ── Poll payment status ───────────────────────────────────────────────────────
router.get('/payments/status/:orderId', memberAuth, async (req, res, next) => {
  try {
    const order = await PaymentOrder.findById(req.params.orderId).lean();
    if (!order || order.memberId.toString() !== req.member.memberId) return res.status(404).json({ message: 'Order not found' });

    // If already marked paid or failed in DB, return that
    if (['paid','failed','expired'].includes(order.status)) return res.json({ status: order.status, paidAt: order.paidAt, receiptId: order.receiptId });

    // Otherwise poll UPIGateway for live status
    if (order.upiGatewayOrderId) {
      const org = await Organization.findById(req.member.organizationId);
      try {
        const resp = await axios.get(`${UPIGATEWAY_BASE}/orders/${order.upiGatewayOrderId}`, {
          headers: { 'Authorization': `Bearer ${org.upiGatewayApiKey}` },
          timeout: 5000,
        });
        const gStatus = resp.data?.status?.toLowerCase();
        if (gStatus === 'paid' || gStatus === 'success') {
          // Mark paid and auto-create receipt
          const receipt = await autoCreateReceipt(order, resp.data?.transaction_id || resp.data?.utr);
          await PaymentOrder.findByIdAndUpdate(order._id, {
            status: 'paid', paidAt: new Date(),
            upiGatewayTxnId: resp.data?.transaction_id || resp.data?.utr || '',
            upiPayerVpa: resp.data?.payer_vpa || '',
            receiptId: receipt._id,
          });
          return res.json({ status: 'paid', paidAt: new Date(), receiptId: receipt._id });
        }
        if (gStatus === 'expired' || gStatus === 'failed') {
          await PaymentOrder.findByIdAndUpdate(order._id, { status: gStatus });
          return res.json({ status: gStatus });
        }
      } catch(e) { /* gateway polling failed — return current DB status */ }
    }
    res.json({ status: order.status });
  } catch(err) { next(err); }
});

// ── UPIGateway Webhook (called server-to-server by UPIGateway) ────────────────
// URL pattern: /api/member-portal/payments/webhook/:orgId
// UPIGateway sends HMAC-SHA256 signature in X-UPIGateway-Signature header
router.post('/payments/webhook/:orgId', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).send('Not found');

    // Verify webhook signature
    const signature = req.headers['x-upigateway-signature'] || req.headers['x-signature'];
    if (signature && org.upiGatewayApiKey) {
      const payload  = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', org.upiGatewayApiKey).update(payload).digest('hex');
      if (signature !== expected) {
        logger.warn('UPIGateway webhook signature mismatch', { orgId: req.params.orgId });
        return res.status(400).send('Invalid signature');
      }
    }

    const event = req.body;
    logger.info('UPIGateway webhook received', { event: event?.event || event?.status, orgId: req.params.orgId });

    const isPaid = ['payment.success','paid','success'].includes((event?.event || event?.status || '').toLowerCase());
    if (!isPaid) return res.status(200).send('ok'); // Acknowledge non-payment events

    const gatewayOrderId = event.order_id || event.id;
    const txnId          = event.transaction_id || event.utr || event.txn_id || '';
    const payerVpa       = event.payer_vpa || '';

    const order = await PaymentOrder.findOne({ upiGatewayOrderId: gatewayOrderId, organizationId: org._id });
    if (!order) { logger.warn('No PaymentOrder found for gateway order', { gatewayOrderId }); return res.status(200).send('ok'); }
    if (order.status === 'paid') return res.status(200).send('already processed');

    const receipt = await autoCreateReceipt(order, txnId);
    await PaymentOrder.findByIdAndUpdate(order._id, {
      status: 'paid', paidAt: new Date(), upiGatewayTxnId: txnId, upiPayerVpa: payerVpa,
      receiptId: receipt._id, webhookRaw: event,
    });
    logger.info('Payment confirmed via webhook', { orderId: order._id, txnId, amount: order.amount });
    res.status(200).send('ok');
  } catch(err) { logger.error('Webhook error', err); res.status(500).send('error'); }
});

// ── Helper: auto-create receipt after confirmed payment ───────────────────────
async function autoCreateReceipt(order, txnId) {
  const lastReceipt = await Receipt.findOne({ organizationId: order.organizationId, hostelId: order.hostelId }).sort({ billSerial: -1 }).lean();
  const newSerial   = (lastReceipt?.billSerial || 0) + 1;
  const year        = new Date().getFullYear();
  const member      = await Member.findById(order.memberId).lean();

  return Receipt.create({
    organizationId: order.organizationId,
    hostelId:       order.hostelId,
    roomNumber:     order.roomNumber,
    memberId:       member?.memberId,
    memberName:     order.memberName,
    memberMobile:   order.memberMobile,
    members:        member ? [{ name: member.name, memberId: member.memberId, mobileNo: member.mobileNo }] : [],
    packageName:    order.paymentType,
    paymentType:    order.paymentType,
    totalAmount:    order.amount,
    amountPaid:     order.amount,
    balanceDue:     0,
    modeOfPayment:  'online',
    billSerial:     newSerial,
    billYear:       String(year),
    billNumber:     `UPI-${year}-${String(newSerial).padStart(4,'0')}`,
    month:          order.month,
    notes:          `Online UPI payment. Txn Ref: ${txnId || 'N/A'}`,
    isPaid:         true,
    receiptDate:    new Date(),
  });
}

// ── Owner: activate portal for member ────────────────────────────────────────
router.post('/activate', async (req, res, next) => {
  const { authMiddleware, tenantGuard } = require('../middleware/auth');
  authMiddleware(req, res, async () => {
    tenantGuard(req, res, async () => {
      try {
        const { memberId, pin } = req.body;
        if (!memberId || !pin) return res.status(400).json({ message: 'memberId and pin required' });
        if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ message: 'PIN must be 4-6 digits' });
        const member = await Member.findOne({ _id: memberId, organizationId: req.organizationId });
        if (!member) return res.status(404).json({ message: 'Member not found' });
        if (!member.mobileNo) return res.status(400).json({ message: 'Member has no mobile number set' });
        await MemberAuth.findOneAndUpdate(
          { memberId: member._id },
          { memberId: member._id, organizationId: req.organizationId, hostelId: member.hostelId, mobile: member.mobileNo, pin, isActive: true, loginAttempts: 0, lockUntil: undefined },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ message: `Portal activated for ${member.name}. Login: mobile ${member.mobileNo} + PIN you just set.` });
      } catch(err) { next(err); }
    });
  });
});

// ── Check portal status for member ───────────────────────────────────────────
router.get('/status/:memberId', async (req, res, next) => {
  const { authMiddleware, tenantGuard } = require('../middleware/auth');
  authMiddleware(req, res, async () => {
    tenantGuard(req, res, async () => {
      try {
        const auth = await MemberAuth.findOne({ memberId: req.params.memberId, organizationId: req.organizationId }).select('-pin').lean();
        res.json({ activated: !!auth, isActive: auth?.isActive || false, lastLogin: auth?.lastLogin || null });
      } catch(err) { next(err); }
    });
  });
});

// ── Change PIN ────────────────────────────────────────────────────────────────
router.post('/change-pin', memberAuth, async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) return res.status(400).json({ message: 'Both PINs required' });
    if (!/^\d{4,6}$/.test(newPin)) return res.status(400).json({ message: 'New PIN must be 4-6 digits' });
    const auth = await MemberAuth.findOne({ memberId: req.member.memberId });
    if (!auth) return res.status(404).json({ message: 'Auth not found' });
    const valid = await auth.comparePin(currentPin);
    if (!valid) return res.status(400).json({ message: 'Current PIN incorrect' });
    auth.pin = newPin;
    await auth.save();
    res.json({ message: 'PIN changed successfully' });
  } catch(err) { next(err); }
});

module.exports = router;
