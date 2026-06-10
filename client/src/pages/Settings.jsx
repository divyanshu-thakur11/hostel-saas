import React, { useState, useEffect } from 'react';
import api, { membersAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const settingsAPI = {
  get:              () => api.get('/settings'),
  saveRazorpay:     (d) => api.put('/settings/razorpay', d),
  disablePayments:  () => api.put('/settings/razorpay/disable'),
  getOnboarding:    () => api.get('/settings/onboarding'),
  activatePortal:   (d) => api.post('/member-portal/activate', d),
  getPortalStatus:  (id) => api.get(`/member-portal/status/${id}`),
};

function UPIPaymentSection({ org, onSaved }) {
  const [form, setForm] = useState({ upiGatewayApiKey: '', upiRecipientVpa: '' });
  const [saving, setSaving] = useState(false);
  const [show, setShow]     = useState(false);
  const [error, setError]   = useState('');
  const toast = useToast();

  const save = async () => {
    setError(''); setSaving(true);
    try {
      await settingsAPI.saveRazorpay({ upiGatewayApiKey: form.upiGatewayApiKey.trim(), upiRecipientVpa: form.upiRecipientVpa.trim() });
      toast('UPI payment settings saved! Online payments enabled.', 'success');
      onSaved();
    } catch(e) { setError(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const disable = async () => {
    if (!window.confirm('Disable online payments?')) return;
    try { await settingsAPI.disablePayments(); toast('Online payments disabled', 'success'); onSaved(); }
    catch(e) { toast('Failed', 'error'); }
  };

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <h3 style={{ fontFamily:'Rajdhani', fontWeight:700, fontSize:'1rem', color:'var(--text)', margin:0 }}>💸 Online Payments (UPIGateway.dev)</h3>
          <p style={{ color:'var(--text3)', fontSize:'0.75rem', marginTop:4 }}>0% fee UPI — money goes directly to your bank account</p>
        </div>
        <span style={{ fontSize:'0.7rem', padding:'3px 10px', borderRadius:12, fontFamily:'Rajdhani', fontWeight:700,
          background: org?.paymentEnabled ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
          color: org?.paymentEnabled ? 'var(--success)' : 'var(--danger)',
          border: org?.paymentEnabled ? '1px solid rgba(39,174,96,0.25)' : '1px solid rgba(231,76,60,0.25)',
        }}>{org?.paymentEnabled ? '✅ ACTIVE' : '⛔ OFF'}</span>
      </div>

      {!org?.paymentEnabled ? (
        <>
          <div style={{ background:'rgba(39,174,96,0.06)', border:'1px solid rgba(39,174,96,0.2)', borderRadius:8, padding:'12px 14px', marginBottom:14, fontSize:'0.8rem', color:'var(--text2)', lineHeight:1.8 }}>
            <strong style={{ color:'var(--success)' }}>✅ Zero platform fees — 100% of rent goes to you</strong><br/>
            <strong>How to set up:</strong><br/>
            1. Go to <a href="https://upigateway.dev" target="_blank" rel="noreferrer" style={{ color:'var(--info)' }}>upigateway.dev</a> → Sign up for a free account<br/>
            2. Dashboard → API Keys → Copy your API key<br/>
            3. Enter your UPI ID (e.g. <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>yourname@upi</code> or <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>mobile@paytm</code>)<br/>
            4. Save — members can now pay directly from the resident portal
          </div>
          {error && <div style={{ color:'var(--danger)', fontSize:'0.78rem', marginBottom:10 }}>⚠️ {error}</div>}
          <div className="form-group">
            <label style={{ fontSize:'0.75rem' }}>UPIGateway.dev API Key</label>
            <div style={{ position:'relative' }}>
              <input type={show?'text':'password'} value={form.upiGatewayApiKey} onChange={e => setForm(p=>({...p,upiGatewayApiKey:e.target.value}))} placeholder="Your API key from upigateway.dev" style={{ paddingRight:40 }} />
              <button type="button" onClick={() => setShow(s=>!s)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>{show?'🙈':'👁️'}</button>
            </div>
          </div>
          <div className="form-group">
            <label style={{ fontSize:'0.75rem' }}>Your UPI ID (money will be received here)</label>
            <input value={form.upiRecipientVpa} onChange={e => setForm(p=>({...p,upiRecipientVpa:e.target.value}))} placeholder="e.g. hostelname@upi or 9876543210@paytm" />
          </div>
          <button onClick={save} disabled={saving||!form.upiGatewayApiKey||!form.upiRecipientVpa} style={{ padding:'9px 20px', borderRadius:8, border:'none', background:'var(--success)', color:'white', fontFamily:'Rajdhani', fontWeight:700, cursor:'pointer', opacity:saving?0.7:1 }}>
            {saving ? '⏳ Saving...' : '✅ Enable UPI Payments'}
          </button>
        </>
      ) : (
        <div>
          <p style={{ color:'var(--text2)', fontSize:'0.82rem', marginBottom:8 }}>✅ UPI payments active. Recipients: <code style={{ fontSize:'0.78rem', background:'var(--bg3)', padding:'2px 6px', borderRadius:4 }}>{org?.upiRecipientVpa}</code></p>
          <p style={{ color:'var(--text3)', fontSize:'0.75rem', marginBottom:14 }}>Members pay via any UPI app (PhonePe, GPay, Paytm) → money lands directly in your bank → receipt auto-generated.</p>
          <button onClick={disable} style={{ padding:'7px 16px', borderRadius:7, border:'1px solid rgba(231,76,60,0.3)', background:'rgba(231,76,60,0.06)', color:'var(--danger)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem' }}>
            ⛔ Disable Payments
          </button>
        </div>
      )}
    </div>
  );
}

function MemberPortalSection() {
  const [search, setSearch]     = useState('');
  const [members, setMembers]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [pin, setPin]           = useState('');
  const [status, setStatus]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const toast = useToast();

  const searchMembers = async () => {
    if (!search) return;
    try {
      const res = await membersAPI.getAll({ search, limit: 10 });
      setMembers(res.data?.data || []);
    } catch(e) {}
  };

  const selectMember = async (m) => {
    setSelected(m); setMembers([]); setSearch(m.name); setPin(''); setMsg(''); setError('');
    try {
      const res = await settingsAPI.getPortalStatus(m._id);
      setStatus(res.data);
    } catch(e) {}
  };

  const activate = async () => {
    if (!selected || !pin) return setError('Select a member and enter a PIN');
    if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4-6 digits only');
    setLoading(true); setError(''); setMsg('');
    try {
      const res = await settingsAPI.activatePortal({ memberId: selected._id, pin });
      setMsg(res.data.message);
      toast('Portal activated!', 'success');
      setStatus({ activated: true, isActive: true });
    } catch(e) { setError(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
      <h3 style={{ fontFamily:'Rajdhani', fontWeight:700, fontSize:'1rem', color:'var(--text)', margin:0, marginBottom:6 }}>📱 Member Self-Service Portal</h3>
      <p style={{ color:'var(--text3)', fontSize:'0.75rem', marginBottom:16, lineHeight:1.6 }}>
        Give residents a PIN to log into <strong>/member-portal</strong> and view their receipts, dues, and pay online. Share login: <strong>Mobile + PIN</strong>.
      </p>

      <div style={{ position:'relative', marginBottom:12 }}>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label style={{ fontSize:'0.75rem' }}>Search & Select Member</label>
          <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} onKeyUp={e => e.key==='Enter' && searchMembers()} placeholder="Type name or mobile..." />
        </div>
        <button onClick={searchMembers} style={{ position:'absolute', right:8, bottom:8, padding:'4px 10px', borderRadius:5, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.75rem', cursor:'pointer' }}>Search</button>
        {members.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, zIndex:10, maxHeight:200, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
            {members.map(m => (
              <button key={m._id} onClick={() => selectMember(m)} style={{ width:'100%', textAlign:'left', padding:'10px 14px', border:'none', background:'none', cursor:'pointer', borderBottom:'1px solid var(--border)', color:'var(--text)' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{m.name}</div>
                <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>Room {m.roomNumber} · {m.mobileNo}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ background:'var(--bg3)', borderRadius:9, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ fontWeight:600, color:'var(--text)', fontSize:'0.88rem' }}>{selected.name}</div>
          <div style={{ color:'var(--text3)', fontSize:'0.72rem' }}>Room {selected.roomNumber} · {selected.mobileNo}</div>
          {status && (
            <div style={{ marginTop:6, fontSize:'0.72rem', color: status.isActive?'var(--success)':'var(--text3)' }}>
              {status.activated ? (status.isActive ? '✅ Portal active' : '⛔ Portal disabled') : '⭕ Portal not yet activated'}
              {status.lastLogin && ` · Last login: ${new Date(status.lastLogin).toLocaleDateString('en-IN')}`}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ color:'var(--danger)', fontSize:'0.78rem', marginBottom:8 }}>⚠️ {error}</div>}
      {msg   && <div style={{ color:'var(--success)', fontSize:'0.78rem', marginBottom:8, lineHeight:1.6 }}>✅ {msg}</div>}

      <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
        <div className="form-group" style={{ flex:1, marginBottom:0 }}>
          <label style={{ fontSize:'0.75rem' }}>Set PIN (4–6 digits)</label>
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="e.g. 1234" />
        </div>
        <button onClick={activate} disabled={loading||!selected||!pin} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:700, cursor:'pointer', opacity:loading||!selected||!pin?0.5:1, whiteSpace:'nowrap', marginBottom:0 }}>
          {loading ? '⏳' : (status?.activated ? '🔄 Update PIN' : '✅ Activate')}
        </button>
      </div>
      <p style={{ color:'var(--text3)', fontSize:'0.72rem', marginTop:10 }}>
        💡 Share with member: Go to <strong>[your-site]/member-portal</strong> → Enter mobile + PIN
      </p>
    </div>
  );
}

export default function Settings() {
  const [org, setOrg]           = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [orgRes, obRes] = await Promise.all([settingsAPI.get(), settingsAPI.getOnboarding()]);
      setOrg(orgRes.data);
      setOnboarding(obRes.data);
    } catch(e) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding:24, color:'var(--text3)' }}>Loading...</div>;

  return (
    <div style={{ padding:'20px', maxWidth:640 }}>
      <h2 style={{ fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.3rem', color:'var(--text)', marginBottom:6 }}>⚙️ Settings</h2>
      <p style={{ color:'var(--text3)', fontSize:'0.8rem', marginBottom:20 }}>{org?.name}</p>

      {/* Setup progress */}
      {onboarding && !onboarding.allDone && (
        <div style={{ background:'rgba(240,165,0,0.06)', border:'1px solid rgba(240,165,0,0.2)', borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontFamily:'Rajdhani', fontWeight:700, color:'var(--accent)', fontSize:'0.9rem', marginBottom:10 }}>🚀 Setup Progress</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {onboarding.steps.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:'0.82rem', color: s.done?'var(--success)':'var(--text2)' }}>
                <span>{s.done ? '✅' : s.optional ? '⭕' : '🔲'}</span>
                <span>{s.icon} {s.label}</span>
                {s.optional && !s.done && <span style={{ fontSize:'0.68rem', color:'var(--text3)' }}>(optional)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <UPIPaymentSection org={org} onSaved={load} />
      <MemberPortalSection />
    </div>
  );
}
