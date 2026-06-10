import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api/member-portal', withCredentials: true });

function PinInput({ value, onChange, label, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label style={{ fontSize: '0.78rem' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder || '4–6 digit PIN'}
          style={{ paddingRight: 40 }}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:'0.95rem', padding:0 }}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/login', { mobile: mobile.trim(), pin });
      onLogin(res.data.member);
    } catch(err) { setError(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:'3rem', marginBottom:8 }}>🏠</div>
          <h1 style={{ fontFamily:'Rajdhani', fontSize:'1.6rem', fontWeight:800, color:'var(--accent)', letterSpacing:2, margin:0 }}>RESIDENT PORTAL</h1>
          <p style={{ color:'var(--text3)', fontSize:'0.82rem', marginTop:6 }}>View your rent, receipts & pay online</p>
        </div>

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:24 }}>
          {error && (
            <div style={{ background:'rgba(231,76,60,0.08)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:8, padding:10, marginBottom:16, color:'var(--danger)', fontSize:'0.82rem' }}>
              ⚠️ {error}
            </div>
          )}
          <form onSubmit={submit}>
            <div className="form-group">
              <label style={{ fontSize:'0.78rem' }}>Mobile Number</label>
              <input type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g,''))} placeholder="10-digit mobile" required />
            </div>
            <PinInput label="Your PIN" value={pin} onChange={setPin} />
            <button type="submit" disabled={loading || !mobile || !pin} style={{ width:'100%', padding:'11px', borderRadius:9, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, fontSize:'1rem', cursor: loading?'not-allowed':'pointer', marginTop:8, opacity: loading?0.7:1, letterSpacing:1 }}>
              {loading ? '⏳ Logging in...' : '→ LOGIN'}
            </button>
          </form>
          <p style={{ textAlign:'center', fontSize:'0.72rem', color:'var(--text3)', marginTop:14 }}>
            Contact your hostel manager to get your login PIN.
          </p>
        </div>
        <div style={{ textAlign:'center', marginTop:16 }}>
          <a href="/" style={{ color:'var(--text3)', fontSize:'0.75rem', textDecoration:'none' }}>← Staff login</a>
        </div>
      </div>
    </div>
  );
}

function DuesBadge({ dues }) {
  if (!dues) return null;
  const color = dues.totalBalance > 0 ? 'var(--danger)' : dues.thisMonthPaid ? 'var(--success)' : 'var(--accent)';
  const icon  = dues.totalBalance > 0 ? '⚠️' : dues.thisMonthPaid ? '✅' : '🔔';
  const label = dues.totalBalance > 0 ? `₹${dues.totalBalance.toLocaleString('en-IN')} balance due`
               : dues.thisMonthPaid ? `${dues.thisMonthLabel} paid`
               : `${dues.thisMonthLabel} not paid`;
  return (
    <div style={{ background:`${color}11`, border:`1px solid ${color}33`, borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:'1.4rem' }}>{icon}</span>
      <div>
        <div style={{ fontWeight:700, color, fontSize:'0.88rem' }}>{label}</div>
        <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>Monthly rent: ₹{(dues.monthlyRent||0).toLocaleString('en-IN')}</div>
      </div>
    </div>
  );
}

function PaymentModal({ member, dues, onClose, onPaid }) {
  const [amount, setAmount]   = useState(dues?.monthlyRent || '');
  const [type, setType]       = useState('rent');
  const [month, setMonth]     = useState(() => new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [step, setStep]       = useState('form');   // form | qr | polling | success | failed
  const [orderData, setOrderData] = useState(null);
  const pollRef = React.useRef(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  React.useEffect(() => () => stopPolling(), []);

  const startPolling = (paymentOrderId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/payments/status/${paymentOrderId}`);
        if (res.data.status === 'paid') {
          stopPolling(); setStep('success');
          setTimeout(() => { onPaid(); onClose(); }, 2500);
        } else if (res.data.status === 'failed' || res.data.status === 'expired') {
          stopPolling(); setStep('failed');
        }
      } catch(e) {}
      if (attempts >= 60) { stopPolling(); } // stop after 5 mins
    }, 5000); // poll every 5s
  };

  const createOrder = async () => {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/payments/create-order', { amount: parseFloat(amount), paymentType: type, month });
      setOrderData(res.data);
      setStep('qr');
      startPolling(res.data.paymentOrderId);
    } catch(e) {
      setError(e.response?.data?.message || 'Could not initiate payment');
    }
    setLoading(false);
  };

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:24, width:'100%', maxWidth:380 }}>

        {step === 'success' && (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:12 }}>✅</div>
            <h3 style={{ fontFamily:'Rajdhani', color:'var(--success)', fontSize:'1.3rem' }}>Payment Confirmed!</h3>
            <p style={{ color:'var(--text3)', fontSize:'0.82rem' }}>Receipt auto-generated. Redirecting...</p>
          </div>
        )}

        {step === 'failed' && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>❌</div>
            <h3 style={{ fontFamily:'Rajdhani', color:'var(--danger)', fontSize:'1.1rem' }}>Payment Failed or Expired</h3>
            <p style={{ color:'var(--text3)', fontSize:'0.8rem', marginBottom:16 }}>Please try again or pay in cash and ask for a receipt.</p>
            <button onClick={() => setStep('form')} style={{ padding:'8px 20px', borderRadius:7, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:700, cursor:'pointer' }}>Try Again</button>
          </div>
        )}

        {step === 'qr' && orderData && (
          <div style={{ textAlign:'center' }}>
            <h3 style={{ fontFamily:'Rajdhani', fontSize:'1rem', marginBottom:4 }}>💸 Pay ₹{parseFloat(amount).toLocaleString('en-IN')} via UPI</h3>
            <p style={{ color:'var(--text3)', fontSize:'0.75rem', marginBottom:14 }}>Scan the QR code or tap the button to open your UPI app</p>

            {/* QR Code */}
            {orderData.qrCodeUrl ? (
              <img src={orderData.qrCodeUrl} alt="UPI QR Code" style={{ width:200, height:200, borderRadius:10, border:'2px solid var(--border)', marginBottom:14 }} />
            ) : (
              <div style={{ width:200, height:200, borderRadius:10, border:'2px dashed var(--border)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', background:'var(--bg3)' }}>
                <div style={{ fontSize:'2.5rem' }}>📱</div>
                <div style={{ fontSize:'0.7rem', color:'var(--text3)', marginTop:6 }}>Open UPI app & pay to:</div>
                <div style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--accent)', marginTop:4 }}>{orderData.recipientVpa}</div>
              </div>
            )}

            {/* UPI deep link button (mobile) */}
            {isMobile && (orderData.upiDeepLink || orderData.fallbackUpiLink) && (
              <a href={orderData.upiDeepLink || orderData.fallbackUpiLink}
                style={{ display:'block', width:'100%', padding:'12px', borderRadius:9, textDecoration:'none', background:'#00a86b', color:'white', fontFamily:'Rajdhani', fontWeight:800, fontSize:'1rem', marginBottom:12, letterSpacing:1 }}>
                📱 Open UPI App to Pay
              </a>
            )}

            <div style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 14px', marginBottom:14, textAlign:'left' }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginBottom:4 }}>Payment details:</div>
              <div style={{ fontSize:'0.82rem', color:'var(--text)' }}>UPI ID: <strong>{orderData.recipientVpa}</strong></div>
              <div style={{ fontSize:'0.82rem', color:'var(--text)' }}>Amount: <strong>₹{parseFloat(amount).toLocaleString('en-IN')}</strong></div>
              <div style={{ fontSize:'0.78rem', color:'var(--text3)', marginTop:4 }}>Note: {orderData.txnNote}</div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text3)', fontSize:'0.75rem', marginBottom:14 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--success)', animation:'pulse 1.5s infinite' }} />
              Waiting for payment confirmation...
            </div>

            <button onClick={onClose} style={{ width:'100%', padding:'8px', borderRadius:7, border:'1px solid var(--border)', background:'none', color:'var(--text3)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.82rem' }}>
              Cancel
            </button>
          </div>
        )}

        {step === 'form' && (
          <>
            <h3 style={{ fontFamily:'Rajdhani', fontSize:'1.1rem', marginBottom:18, color:'var(--text)' }}>💸 Pay via UPI</h3>
            {error && <div style={{ background:'rgba(231,76,60,0.08)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:7, padding:10, marginBottom:12, color:'var(--danger)', fontSize:'0.82rem' }}>⚠️ {error}</div>}
            <div className="form-group">
              <label style={{ fontSize:'0.78rem' }}>Payment Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="rent">Rent</option>
                <option value="advance">Advance</option>
                <option value="electric">Electric</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize:'0.78rem' }}>Month</label>
              <input value={month} onChange={e => setMonth(e.target.value)} placeholder="e.g. June 2025" />
            </div>
            <div className="form-group">
              <label style={{ fontSize:'0.78rem' }}>Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} placeholder="Enter amount" />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              <button onClick={onClose} style={{ flex:1, padding:'9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600 }}>Cancel</button>
              <button onClick={createOrder} disabled={loading || !amount} style={{ flex:2, padding:'9px', borderRadius:7, border:'none', background:'#00a86b', color:'white', fontFamily:'Rajdhani', fontWeight:800, cursor: loading?'not-allowed':'pointer', opacity: loading?0.7:1 }}>
                {loading ? '⏳ Generating...' : `Pay ₹${parseFloat(amount||0).toLocaleString('en-IN')} via UPI`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ member, dues, receipts, payments, onLogout, onRefresh }) {
  const [showPay, setShowPay]     = useState(false);
  const [showPin, setShowPin]     = useState(false);
  const [pinForm, setPinForm]     = useState({ cur:'', newp:'', confirm:'' });
  const [pinError, setPinError]   = useState('');
  const [pinMsg, setPinMsg]       = useState('');
  const [tab, setTab]             = useState('home');

  const changePin = async () => {
    setPinError(''); setPinMsg('');
    if (pinForm.newp !== pinForm.confirm) return setPinError('PINs do not match');
    if (!/^\d{4,6}$/.test(pinForm.newp)) return setPinError('PIN must be 4-6 digits');
    try {
      await api.post('/change-pin', { currentPin: pinForm.cur, newPin: pinForm.newp });
      setPinMsg('PIN changed successfully!');
      setPinForm({ cur:'', newp:'', confirm:'' });
    } catch(e) { setPinError(e.response?.data?.message || 'Failed'); }
  };

  const joined = member.roomJoinDate ? new Date(member.roomJoinDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', maxWidth:480, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <div style={{ fontFamily:'Rajdhani', fontWeight:800, color:'var(--accent)', fontSize:'1.1rem', letterSpacing:2 }}>🏠 RESIDENT PORTAL</div>
          <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>{member.hostelName}</div>
        </div>
        <button onClick={onLogout} style={{ padding:'5px 12px', borderRadius:7, border:'1px solid rgba(231,76,60,0.3)', background:'rgba(231,76,60,0.08)', color:'var(--danger)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.75rem' }}>Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex' }}>
        {[['home','🏠','Home'],['receipts','🧾','Receipts'],['payments','💳','Payments'],['profile','👤','Profile']].map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:'10px 0', border:'none', borderBottom:`2px solid ${tab===id?'var(--accent)':'transparent'}`, background:'transparent', color: tab===id?'var(--accent)':'var(--text3)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:tab===id?700:500, fontSize:'0.7rem', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:'1rem' }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, padding:16, overflowY:'auto' }}>
        {/* HOME TAB */}
        {tab === 'home' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Member card */}
            <div style={{ background:'linear-gradient(135deg, rgba(240,165,0,0.1), rgba(240,165,0,0.03))', border:'1px solid rgba(240,165,0,0.2)', borderRadius:12, padding:16 }}>
              <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text)', fontFamily:'Rajdhani' }}>{member.name}</div>
              <div style={{ color:'var(--text3)', fontSize:'0.75rem', marginTop:2 }}>ID: {member.memberId} · Room {member.roomNumber}</div>
              <div style={{ color:'var(--text3)', fontSize:'0.75rem' }}>Joined: {joined}</div>
              <div style={{ marginTop:10, display:'flex', gap:8 }}>
                <div style={{ flex:1, background:'var(--bg3)', borderRadius:8, padding:'10px', textAlign:'center' }}>
                  <div style={{ fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.2rem', color:'var(--accent)' }}>₹{(member.rent||0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize:'0.65rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>Monthly Rent</div>
                </div>
                <div style={{ flex:1, background:'var(--bg3)', borderRadius:8, padding:'10px', textAlign:'center' }}>
                  <div style={{ fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.2rem', color:'var(--info)' }}>₹{(dues?.totalPaid||0).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize:'0.65rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>Total Paid</div>
                </div>
              </div>
            </div>

            {/* Status */}
            <DuesBadge dues={dues} />

            {/* Pay button */}
            <button onClick={() => setShowPay(true)} style={{ width:'100%', padding:'14px', borderRadius:10, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.05rem', cursor:'pointer', letterSpacing:1 }}>
              💳 PAY RENT ONLINE
            </button>

            {/* Recent receipt */}
            {receipts?.[0] && (
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--text3)', fontFamily:'Rajdhani', fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:'uppercase' }}>Last Payment</div>
                <ReceiptCard r={receipts[0]} />
              </div>
            )}
          </div>
        )}

        {/* RECEIPTS TAB */}
        {tab === 'receipts' && (
          <div>
            <div style={{ fontSize:'0.72rem', color:'var(--text3)', fontFamily:'Rajdhani', fontWeight:700, letterSpacing:1, marginBottom:12, textTransform:'uppercase' }}>All Receipts ({receipts?.length || 0})</div>
            {!receipts?.length ? (
              <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>No receipts yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {receipts.map(r => <ReceiptCard key={r._id} r={r} />)}
              </div>
            )}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text3)', fontFamily:'Rajdhani', fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>Online Payments ({payments?.length || 0})</div>
              <button onClick={() => setShowPay(true)} style={{ padding:'6px 14px', borderRadius:7, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.78rem', cursor:'pointer' }}>+ Pay Now</button>
            </div>
            {!payments?.length ? (
              <div style={{ textAlign:'center', color:'var(--text3)', padding:40, fontSize:'0.85rem' }}>No online payments yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {payments.map(p => (
                  <div key={p._id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:9, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, color:'var(--text)', fontSize:'0.85rem' }}>₹{p.amount.toLocaleString('en-IN')} — {p.paymentType}</div>
                      <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>{p.month} · {new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
                    </div>
                    <span style={{ fontSize:'0.72rem', padding:'3px 9px', borderRadius:12, fontFamily:'Rajdhani', fontWeight:700,
                      background: p.status==='paid'?'rgba(39,174,96,0.1)':p.status==='failed'?'rgba(231,76,60,0.1)':'rgba(240,165,0,0.1)',
                      color: p.status==='paid'?'var(--success)':p.status==='failed'?'var(--danger)':'var(--accent)',
                      border: p.status==='paid'?'1px solid rgba(39,174,96,0.25)':p.status==='failed'?'1px solid rgba(231,76,60,0.25)':'1px solid rgba(240,165,0,0.25)',
                    }}>{p.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <div style={{ fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.85rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Your Details</div>
              {[
                ['Name', member.name],
                ['Mobile', member.mobileNo],
                ['Room', member.roomNumber],
                ['Member ID', member.memberId],
                ['Hostel', member.hostelName],
                ['Address', member.hostelAddress],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'0.82rem' }}>
                  <span style={{ color:'var(--text3)' }}>{k}</span>
                  <span style={{ color:'var(--text)', fontWeight:500, textAlign:'right', maxWidth:'60%' }}>{v || '—'}</span>
                </div>
              ))}
            </div>

            {/* Change PIN */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
              <button onClick={() => setShowPin(s => !s)} style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.9rem', color:'var(--text)', display:'flex', justifyContent:'space-between' }}>
                🔑 Change PIN <span style={{ color:'var(--text3)' }}>{showPin ? '▲' : '▼'}</span>
              </button>
              {showPin && (
                <div style={{ marginTop:14 }}>
                  {pinError && <div style={{ color:'var(--danger)', fontSize:'0.78rem', marginBottom:8 }}>⚠️ {pinError}</div>}
                  {pinMsg   && <div style={{ color:'var(--success)', fontSize:'0.78rem', marginBottom:8 }}>✅ {pinMsg}</div>}
                  <PinInput label="Current PIN" value={pinForm.cur} onChange={v => setPinForm(p=>({...p,cur:v}))} />
                  <PinInput label="New PIN" value={pinForm.newp} onChange={v => setPinForm(p=>({...p,newp:v}))} />
                  <PinInput label="Confirm New PIN" value={pinForm.confirm} onChange={v => setPinForm(p=>({...p,confirm:v}))} />
                  <button onClick={changePin} style={{ width:'100%', padding:'9px', borderRadius:7, border:'none', background:'var(--info)', color:'white', fontFamily:'Rajdhani', fontWeight:700, cursor:'pointer', marginTop:4 }}>
                    Update PIN
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPay && <PaymentModal member={member} dues={dues} onClose={() => setShowPay(false)} onPaid={() => { setShowPay(false); onRefresh(); }} />}
    </div>
  );
}

function ReceiptCard({ r }) {
  const date = new Date(r.receiptDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  const typeColors = { rent:'var(--accent)', advance:'var(--info)', electric:'#f39c12', final:'var(--success)', other:'var(--text3)' };
  const color = typeColors[r.packageName] || 'var(--text3)';
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:9, padding:'12px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:700, color:'var(--text)', fontSize:'0.88rem' }}>₹{(r.amountPaid||r.totalAmount||0).toLocaleString('en-IN')}</div>
          <div style={{ color:'var(--text3)', fontSize:'0.72rem', marginTop:2 }}>{r.billNumber || '—'} · {date}</div>
          {r.month && <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>{r.month}</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:12, background:`${color}15`, color, border:`1px solid ${color}30`, fontFamily:'Rajdhani', fontWeight:700, textTransform:'uppercase' }}>{r.packageName}</span>
          <span style={{ fontSize:'0.65rem', color:'var(--text3)' }}>{r.modeOfPayment==='online' ? '🌐 Online' : '💵 Cash'}</span>
        </div>
      </div>
      {r.isPartPayment && r.balanceDue > 0 && (
        <div style={{ marginTop:6, fontSize:'0.72rem', color:'var(--danger)' }}>Balance due: ₹{r.balanceDue.toLocaleString('en-IN')}</div>
      )}
    </div>
  );
}

export default function MemberPortal() {
  const [member,   setMember]   = useState(null);
  const [dues,     setDues]     = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [checking, setChecking] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [meRes, duesRes, rcptRes, payRes] = await Promise.all([
        api.get('/me'),
        api.get('/dues'),
        api.get('/receipts'),
        api.get('/payments'),
      ]);
      setMember(meRes.data);
      setDues(duesRes.data);
      setReceipts(rcptRes.data);
      setPayments(payRes.data);
    } catch(e) {
      if (e.response?.status === 401) setMember(null);
    }
  }, []);

  // Check if already logged in
  useEffect(() => {
    api.get('/me')
      .then(r => { setMember(r.data); loadData(); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [loadData]);

  const handleLogin = (m) => { setMember(m); loadData(); };

  const handleLogout = async () => {
    await api.post('/logout').catch(() => {});
    setMember(null); setDues(null); setReceipts([]); setPayments([]);
  };

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--text3)', fontFamily:'Rajdhani', fontSize:'1rem' }}>Loading...</div>
    </div>
  );

  // If a staff member somehow navigates to /member-portal, they see the member login — not their own data.
  // The hm_member_token cookie is separate from hm_token, so there's no auth bleed.
  if (!member) return <LoginScreen onLogin={handleLogin} />;

  return <Dashboard member={member} dues={dues} receipts={receipts} payments={payments} onLogout={handleLogout} onRefresh={loadData} />;
}
