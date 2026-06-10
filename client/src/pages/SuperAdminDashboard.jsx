import React, { useState, useEffect, useCallback } from 'react';
import { superadminAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const PLAN_COLORS = { basic: '#3498db', pro: '#f0a500', enterprise: '#9b59b6' };

function AnalyticsCards({ stats }) {
  const cards = [
    { label: 'Total Organizations', value: stats.totalOrgs, icon: '🏢', color: '#3498db' },
    { label: 'Active Subscriptions', value: stats.activeOrgs, icon: '✅', color: '#27ae60' },
    { label: 'Suspended', value: stats.suspendedOrgs, icon: '⛔', color: '#e74c3c' },
    { label: 'Expired Plans', value: stats.expiredOrgs, icon: '⏰', color: '#f0a500' },
    { label: 'Total Hostels', value: stats.totalHostels, icon: '🏠', color: '#9b59b6' },
    { label: 'Active Members', value: stats.totalMembers, icon: '👥', color: '#1abc9c' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background:'var(--bg2)', border:`1px solid var(--border)`, borderRadius:10, padding:'16px 14px' }}>
          <div style={{ fontSize:'1.6rem', marginBottom:6 }}>{c.icon}</div>
          <div style={{ fontSize:'1.7rem', fontWeight:700, color:c.color, fontFamily:'Rajdhani' }}>{c.value ?? '—'}</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function CreateOrgModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ orgName:'', ownerName:'', email:'', mobile:'', plan:'basic', planDays:365, username:'', password:'', notes:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const res = await superadminAPI.createOrganization(form);
      toast(res.data.message, 'success');
      onCreated();
      onClose();
    } catch(e) { setError(e.response?.data?.message || 'Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:16 }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:24, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ fontFamily:'Rajdhani', fontSize:'1.15rem', marginBottom:18 }}>🏢 Create New Organization</h3>
        {error && <div style={{ background:'rgba(231,76,60,0.1)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:6, padding:10, marginBottom:12, color:'var(--danger)', fontSize:'0.82rem' }}>⚠️ {error}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            ['orgName','Organization Name','text',true],
            ['ownerName','Owner Full Name','text',true],
            ['email','Owner Email','email',false],
            ['mobile','Owner Mobile','text',false],
            ['username','Login Username','text',true],
            ['password','Login Password','password',true],
          ].map(([k,label,type,req]) => (
            <div key={k} className="form-group" style={{ marginBottom:0 }}>
              <label style={{ fontSize:'0.72rem' }}>{label}{req&&' *'}</label>
              <input type={type} value={form[k]} onChange={e=>set(k,e.target.value)} required={req} />
            </div>
          ))}
          <div className="form-group" style={{ marginBottom:0 }}>
            <label style={{ fontSize:'0.72rem' }}>Plan</label>
            <select value={form.plan} onChange={e=>set('plan',e.target.value)}>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label style={{ fontSize:'0.72rem' }}>Plan Duration (days)</label>
            <input type="number" value={form.planDays} onChange={e=>set('planDays',parseInt(e.target.value))} min={1} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop:10 }}>
          <label style={{ fontSize:'0.72rem' }}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2} style={{ resize:'vertical' }} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600 }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ flex:2, padding:'9px', borderRadius:7, border:'none', background:'var(--accent)', color:'#111', cursor:loading?'not-allowed':'pointer', fontFamily:'Rajdhani', fontWeight:700, opacity:loading?0.7:1 }}>
            {loading ? '⏳ Creating...' : '✅ Create Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgCard({ org, onRefresh }) {
  const [showActions, setShowActions] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extDays, setExtDays] = useState(30);
  const [resetPw, setResetPw] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const isExpired = org.planExpiresAt && new Date(org.planExpiresAt) < new Date();
  const daysLeft = org.planExpiresAt ? Math.ceil((new Date(org.planExpiresAt) - new Date()) / (1000*60*60*24)) : null;

  const suspend = async (s) => {
    const reason = s ? prompt('Reason for suspension (optional):') || '' : '';
    setLoading(true);
    try {
      const res = await superadminAPI.suspendOrganization(org._id, { suspend: s, reason });
      toast(res.data.message, s ? 'error' : 'success');
      onRefresh();
    } catch(e) { toast(e.response?.data?.message||'Failed','error'); }
    finally { setLoading(false); }
  };

  const extend = async () => {
    setLoading(true);
    try {
      const res = await superadminAPI.extendSubscription(org._id, { days: extDays });
      toast(res.data.message, 'success');
      setExtending(false); onRefresh();
    } catch(e) { toast(e.response?.data?.message||'Failed','error'); }
    finally { setLoading(false); }
  };

  const doResetPw = async () => {
    if (!resetPw || resetPw.length < 6) return toast('Password must be at least 6 chars', 'error');
    setLoading(true);
    try {
      const res = await superadminAPI.resetOwnerPassword(org._id, { newPassword: resetPw });
      toast(res.data.message, 'success');
      setResetPw(''); setShowActions(false);
    } catch(e) { toast(e.response?.data?.message||'Failed','error'); }
    finally { setLoading(false); }
  };

  const doDelete = async () => {
    if (!window.confirm(`Delete "${org.name}" and ALL its data? This cannot be undone.`)) return;
    try {
      const res = await superadminAPI.deleteOrganization(org._id);
      toast(res.data.message, 'success');
      onRefresh();
    } catch(e) { toast(e.response?.data?.message||'Failed','error'); }
  };

  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${!org.isActive?'rgba(231,76,60,0.4)':isExpired?'rgba(240,165,0,0.35)':'var(--border)'}`, borderRadius:10, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, color:'var(--text)', fontSize:'0.95rem', display:'flex', alignItems:'center', gap:8 }}>
            🏢 {org.name}
            <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:20, background:`${PLAN_COLORS[org.plan]}22`, color:PLAN_COLORS[org.plan], border:`1px solid ${PLAN_COLORS[org.plan]}44`, fontFamily:'Rajdhani', fontWeight:700, textTransform:'uppercase' }}>{org.plan}</span>
            {!org.isActive && <span style={{ fontSize:'0.65rem', padding:'2px 7px', borderRadius:20, background:'rgba(231,76,60,0.12)', color:'var(--danger)', border:'1px solid rgba(231,76,60,0.3)' }}>SUSPENDED</span>}
            {org.isActive && isExpired && <span style={{ fontSize:'0.65rem', padding:'2px 7px', borderRadius:20, background:'rgba(240,165,0,0.12)', color:'var(--accent)', border:'1px solid rgba(240,165,0,0.3)' }}>EXPIRED</span>}
          </div>
          <div style={{ color:'var(--text3)', fontSize:'0.75rem', marginTop:3 }}>Owner: {org.ownerName} · @{org.owner?.username || '—'}</div>
        </div>
        <button onClick={() => setShowActions(s=>!s)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:7, padding:'5px 11px', cursor:'pointer', color:'var(--text2)', fontSize:'0.78rem', fontFamily:'Rajdhani', fontWeight:600 }}>
          {showActions ? '▲ Less' : '▼ Actions'}
        </button>
      </div>

      <div style={{ display:'flex', gap:12, fontSize:'0.75rem', color:'var(--text3)', flexWrap:'wrap' }}>
        <span>🏠 {org.hostelCount} hostels</span>
        <span>👥 {org.memberCount} members</span>
        <span>📅 {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}d left` : `Expired ${Math.abs(daysLeft)}d ago`) : 'No expiry'}</span>
        {org.mobile && <span>📞 {org.mobile}</span>}
        {org.owner?.lastLogin && <span>🕐 Last login: {new Date(org.owner.lastLogin).toLocaleDateString()}</span>}
      </div>

      {showActions && (
        <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => suspend(!org.isActive)} disabled={loading} style={{ padding:'6px 14px', borderRadius:6, border:`1px solid ${org.isActive?'rgba(231,76,60,0.3)':'rgba(39,174,96,0.3)'}`, background:org.isActive?'rgba(231,76,60,0.08)':'rgba(39,174,96,0.08)', color:org.isActive?'var(--danger)':'var(--success)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem' }}>
              {org.isActive ? '⛔ Suspend' : '✅ Reactivate'}
            </button>
            <button onClick={() => setExtending(s=>!s)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(240,165,0,0.3)', background:'rgba(240,165,0,0.08)', color:'var(--accent)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem' }}>
              ⏱ Extend Plan
            </button>
            <button onClick={doDelete} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(231,76,60,0.3)', background:'rgba(231,76,60,0.06)', color:'var(--danger)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem' }}>
              🗑 Delete
            </button>
          </div>
          {extending && (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" value={extDays} onChange={e=>setExtDays(parseInt(e.target.value))} min={1} style={{ width:80, padding:'5px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:'0.82rem' }} />
              <span style={{ color:'var(--text3)', fontSize:'0.78rem' }}>days</span>
              <button onClick={extend} disabled={loading} style={{ padding:'5px 14px', borderRadius:6, border:'none', background:'var(--accent)', color:'#111', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.8rem' }}>Extend</button>
            </div>
          )}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="password" placeholder="New owner password (min 6 chars)" value={resetPw} onChange={e=>setResetPw(e.target.value)} style={{ flex:1, padding:'5px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:'0.82rem' }} />
            <button onClick={doResetPw} disabled={loading||!resetPw} style={{ padding:'5px 14px', borderRadius:6, border:'none', background:'var(--info)', color:'white', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.8rem', opacity:!resetPw?0.5:1 }}>Reset PW</button>
          </div>
          {org.notes && <div style={{ fontSize:'0.75rem', color:'var(--text3)', fontStyle:'italic' }}>📝 {org.notes}</div>}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminDashboard({ user, onLogout }) {
  const [orgs, setOrgs] = useState([]);
  const [stats, setStats] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, analyticsRes] = await Promise.all([
        superadminAPI.getOrganizations(),
        superadminAPI.getAnalytics(),
      ]);
      setOrgs(orgRes.data || []);
      setStats(analyticsRes.data || {});
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orgs.filter(o => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.ownerName.toLowerCase().includes(search.toLowerCase()) || o.owner?.username?.includes(search.toLowerCase());
    const isExpired = o.planExpiresAt && new Date(o.planExpiresAt) < new Date();
    if (filter === 'active') return matchSearch && o.isActive && !isExpired;
    if (filter === 'suspended') return matchSearch && !o.isActive;
    if (filter === 'expired') return matchSearch && o.isActive && isExpired;
    return matchSearch;
  });

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      {/* Topbar */}
      <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:'Rajdhani', fontSize:'1.4rem', fontWeight:700, color:'var(--accent)', letterSpacing:2 }}>⚡ HOSTEL SAAS</div>
          <span style={{ fontSize:'0.7rem', padding:'3px 9px', borderRadius:12, background:'rgba(231,76,60,0.12)', color:'var(--danger)', border:'1px solid rgba(231,76,60,0.25)', fontFamily:'Rajdhani', fontWeight:700, letterSpacing:1 }}>SUPER ADMIN</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'var(--text3)', fontSize:'0.8rem' }}>👑 {user?.name}</span>
          <button onClick={onLogout} style={{ padding:'6px 14px', borderRadius:7, border:'1px solid rgba(231,76,60,0.3)', background:'rgba(231,76,60,0.08)', color:'var(--danger)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem' }}>🚪 Logout</button>
        </div>
      </div>

      <div style={{ flex:1, padding:'20px 24px', maxWidth:1000, width:'100%', margin:'0 auto' }}>
        {/* Analytics */}
        <AnalyticsCards stats={stats} />

        {/* Header + Create */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ fontFamily:'Rajdhani', fontSize:'1.2rem', color:'var(--text)', margin:0 }}>Organizations ({filtered.length})</h2>
          <button onClick={() => setShowCreate(true)} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'var(--accent)', color:'#111', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:700, fontSize:'0.9rem' }}>
            + New Organization
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search organizations..." style={{ flex:1, minWidth:180, padding:'7px 12px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontSize:'0.83rem' }} />
          {['all','active','suspended','expired'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:7, fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.8rem', cursor:'pointer', border:`1px solid ${filter===f?'var(--accent)':'var(--border)'}`, background:filter===f?'rgba(240,165,0,0.1)':'var(--bg3)', color:filter===f?'var(--accent)':'var(--text2)', textTransform:'capitalize' }}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Loading organizations...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>
            {orgs.length === 0 ? 'No organizations yet. Create your first one!' : 'No organizations match your filter.'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {filtered.map(org => <OrgCard key={org._id} org={org} onRefresh={load} />)}
          </div>
        )}
      </div>

      {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
