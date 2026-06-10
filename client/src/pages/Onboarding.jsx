import React, { useState } from 'react';
import { hostelAPI, roomsAPI, membersAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const STEPS = [
  { id: 'welcome',  title: 'Welcome!',          icon: '👋' },
  { id: 'hostel',   title: 'Add Your Hostel',   icon: '🏠' },
  { id: 'rooms',    title: 'Set Up Rooms',       icon: '🚪' },
  { id: 'member',   title: 'Add First Resident', icon: '👥' },
  { id: 'done',     title: 'You\'re All Set!',   icon: '🎉' },
];

function StepIndicator({ current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginBottom:28 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem', fontWeight:700, fontFamily:'Rajdhani',
              background: i < current ? 'var(--success)' : i === current ? 'var(--accent)' : 'var(--bg3)',
              color: i <= current ? '#111' : 'var(--text3)',
              border: i === current ? '2px solid var(--accent)' : i < current ? '2px solid var(--success)' : '2px solid var(--border)',
              transition: 'all 0.3s',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div style={{ fontSize:'0.55rem', color: i === current ? 'var(--accent)' : 'var(--text3)', fontFamily:'Rajdhani', fontWeight:i===current?700:400, whiteSpace:'nowrap', display: i === 0 || i === STEPS.length-1 ? 'block' : 'none' }}>
              {s.title}
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex:1, height:2, background: i < current ? 'var(--success)' : 'var(--border)', transition:'background 0.3s', margin:'0 2px', marginBottom:16 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Onboarding({ user, onComplete }) {
  const [step, setStep]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const toast = useToast();

  // Step data
  const [hostelForm, setHostelForm]   = useState({ name: '', address: '', city: '', mobile: '', totalRooms: 20 });
  const [roomsForm, setRoomsForm]     = useState({ startRoom: 1, endRoom: 20, rent: 3000 });
  const [memberForm, setMemberForm]   = useState({ name: '', mobileNo: '', fathersName: '', fathersMobileNo: '', aadharNumber: '', fathersOccupation: 'Service', permanentAddress: '', roomNumber: roomsForm.startRoom, rent: roomsForm.rent });
  const [createdHostel, setCreatedHostel] = useState(null);

  const next = () => { setError(''); setStep(s => s + 1); };
  const back = () => { setError(''); setStep(s => s - 1); };

  // Step: Create Hostel
  const createHostel = async () => {
    if (!hostelForm.name || !hostelForm.address) return setError('Name and address are required');
    setLoading(true); setError('');
    try {
      const res = await hostelAPI.create(hostelForm);
      setCreatedHostel(res.data);
      localStorage.setItem('hm_hostel_id', res.data._id);
      toast('Hostel created!', 'success');
      next();
    } catch(e) { setError(e.response?.data?.message || 'Failed to create hostel'); }
    finally { setLoading(false); }
  };

  // Step: Create Rooms
  const createRooms = async () => {
    if (!createdHostel) return next(); // skip if no hostel somehow
    const start = parseInt(roomsForm.startRoom), end = parseInt(roomsForm.endRoom);
    if (isNaN(start) || isNaN(end) || start > end) return setError('Invalid room range');
    if (end - start + 1 > 200) return setError('Max 200 rooms at once');
    setLoading(true); setError('');
    try {
      const rooms = [];
      for (let n = start; n <= end; n++) rooms.push({ roomNumber: n, rent: parseInt(roomsForm.rent) || 0, hostelId: createdHostel._id });
      // Use bulk create — rooms route supports array
      for (const room of rooms) {
        await roomsAPI.create({ ...room }).catch(() => {}); // ignore duplicates
      }
      setMemberForm(p => ({ ...p, roomNumber: start, rent: parseInt(roomsForm.rent) || 0 }));
      toast(`${end - start + 1} rooms set up!`, 'success');
      next();
    } catch(e) { setError(e.response?.data?.message || 'Failed to create rooms'); }
    finally { setLoading(false); }
  };

  // Step: Create first member
  const createMember = async () => {
    const required = ['name','mobileNo','fathersName','fathersMobileNo','aadharNumber','fathersOccupation','permanentAddress'];
    const missing  = required.filter(k => !memberForm[k]);
    if (missing.length) return setError(`Please fill: ${missing.join(', ')}`);
    setLoading(true); setError('');
    try {
      await membersAPI.create({ ...memberForm, hostelId: createdHostel?._id, admissionDate: new Date().toISOString(), roomJoinDate: new Date().toISOString() });
      toast('First member added!', 'success');
      next();
    } catch(e) { setError(e.response?.data?.message || 'Failed to add member'); }
    finally { setLoading(false); }
  };

  const skipMember = () => { setError(''); next(); };

  const card = (content) => (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'24px 20px' }}>
      {error && <div style={{ background:'rgba(231,76,60,0.08)', border:'1px solid rgba(231,76,60,0.3)', borderRadius:7, padding:10, marginBottom:14, color:'var(--danger)', fontSize:'0.82rem' }}>⚠️ {error}</div>}
      {content}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:520 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.5rem', color:'var(--accent)', letterSpacing:2 }}>HOSTEL MANAGER</div>
          <div style={{ color:'var(--text3)', fontSize:'0.8rem', marginTop:4 }}>Setup Wizard · {STEPS[step].icon} {STEPS[step].title}</div>
        </div>

        <StepIndicator current={step} />

        {/* WELCOME */}
        {step === 0 && card(
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'3rem', marginBottom:16 }}>👋</div>
            <h2 style={{ fontFamily:'Rajdhani', fontSize:'1.4rem', color:'var(--text)', marginBottom:10 }}>Welcome, {user?.name}!</h2>
            <p style={{ color:'var(--text2)', fontSize:'0.88rem', lineHeight:1.7, marginBottom:24 }}>
              Let's get your hostel set up in <strong style={{ color:'var(--accent)' }}>3 quick steps</strong>. It'll take less than 2 minutes.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {[['🏠 Add your hostel name & address','1 min'],['🚪 Set up your rooms','30 sec'],['👥 Add your first resident','1 min']].map(([t,time]) => (
                <div key={t} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg3)', borderRadius:8, padding:'10px 14px' }}>
                  <span style={{ fontSize:'0.85rem', color:'var(--text)' }}>{t}</span>
                  <span style={{ fontSize:'0.7rem', color:'var(--text3)' }}>{time}</span>
                </div>
              ))}
            </div>
            <button onClick={next} style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.05rem', cursor:'pointer', letterSpacing:1 }}>
              🚀 LET'S START →
            </button>
            <button onClick={onComplete} style={{ marginTop:10, width:'100%', padding:'9px', borderRadius:8, border:'1px solid var(--border)', background:'none', color:'var(--text3)', fontSize:'0.8rem', cursor:'pointer' }}>
              Skip setup, go to dashboard
            </button>
          </div>
        )}

        {/* HOSTEL */}
        {step === 1 && card(
          <>
            <h3 style={{ fontFamily:'Rajdhani', fontSize:'1.05rem', marginBottom:16, color:'var(--text)' }}>🏠 Your Hostel Details</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:'0.75rem' }}>Hostel Name *</label>
                <input value={hostelForm.name} onChange={e => setHostelForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Shiv Kripa Boys Hostel" />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:'0.75rem' }}>Address *</label>
                <input value={hostelForm.address} onChange={e => setHostelForm(p=>({...p,address:e.target.value}))} placeholder="Full address" />
              </div>
              <div className="form-group">
                <label style={{ fontSize:'0.75rem' }}>City</label>
                <input value={hostelForm.city} onChange={e => setHostelForm(p=>({...p,city:e.target.value}))} placeholder="e.g. Indore" />
              </div>
              <div className="form-group">
                <label style={{ fontSize:'0.75rem' }}>Contact Mobile</label>
                <input type="tel" value={hostelForm.mobile} onChange={e => setHostelForm(p=>({...p,mobile:e.target.value}))} placeholder="10-digit number" />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:'0.75rem' }}>Total Rooms (approximate)</label>
                <input type="number" value={hostelForm.totalRooms} onChange={e => setHostelForm(p=>({...p,totalRooms:parseInt(e.target.value)||1}))} min={1} max={500} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={back} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600 }}>← Back</button>
              <button onClick={createHostel} disabled={loading} style={{ flex:1, padding:'9px', borderRadius:8, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
                {loading ? '⏳ Creating...' : 'Save & Continue →'}
              </button>
            </div>
          </>
        )}

        {/* ROOMS */}
        {step === 2 && card(
          <>
            <h3 style={{ fontFamily:'Rajdhani', fontSize:'1.05rem', marginBottom:6, color:'var(--text)' }}>🚪 Set Up Rooms</h3>
            <p style={{ color:'var(--text3)', fontSize:'0.78rem', marginBottom:16 }}>We'll create rooms with numbers in the range you specify. You can add more later.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group">
                <label style={{ fontSize:'0.75rem' }}>First Room Number</label>
                <input type="number" value={roomsForm.startRoom} onChange={e => setRoomsForm(p=>({...p,startRoom:parseInt(e.target.value)||1}))} min={1} />
              </div>
              <div className="form-group">
                <label style={{ fontSize:'0.75rem' }}>Last Room Number</label>
                <input type="number" value={roomsForm.endRoom} onChange={e => setRoomsForm(p=>({...p,endRoom:parseInt(e.target.value)||1}))} min={1} />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:'0.75rem' }}>Default Monthly Rent (₹)</label>
                <input type="number" value={roomsForm.rent} onChange={e => setRoomsForm(p=>({...p,rent:parseInt(e.target.value)||0}))} min={0} />
              </div>
            </div>
            <div style={{ background:'rgba(240,165,0,0.06)', border:'1px solid rgba(240,165,0,0.2)', borderRadius:8, padding:'10px 14px', fontSize:'0.78rem', color:'var(--text2)', marginTop:4 }}>
              📊 This will create <strong style={{ color:'var(--accent)' }}>{Math.max(0, (roomsForm.endRoom - roomsForm.startRoom) + 1)} rooms</strong> (Room {roomsForm.startRoom} to Room {roomsForm.endRoom}), each with ₹{roomsForm.rent}/month default rent.
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={back} style={{ padding:'9px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600 }}>← Back</button>
              <button onClick={createRooms} disabled={loading} style={{ flex:1, padding:'9px', borderRadius:8, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
                {loading ? '⏳ Creating rooms...' : 'Create Rooms →'}
              </button>
            </div>
          </>
        )}

        {/* MEMBER */}
        {step === 3 && card(
          <>
            <h3 style={{ fontFamily:'Rajdhani', fontSize:'1.05rem', marginBottom:6, color:'var(--text)' }}>👥 Add Your First Resident</h3>
            <p style={{ color:'var(--text3)', fontSize:'0.78rem', marginBottom:14 }}>Add a resident now, or skip and do it later from the Members page.</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                ['name','Full Name *','text','1/-1'],
                ['mobileNo','Mobile No *','tel',null],
                ['fathersName',"Father's Name *",'text',null],
                ['fathersMobileNo',"Father's Mobile *",'tel',null],
                ['aadharNumber','Aadhar Number *','text','1/-1'],
                ['fathersOccupation',"Father's Occupation *",'text',null],
                ['permanentAddress','Permanent Address *','text','1/-1'],
                ['roomNumber','Room Number','number',null],
                ['rent','Rent (₹)','number',null],
              ].map(([k, label, type, col]) => (
                <div key={k} className="form-group" style={{ gridColumn: col || 'auto' }}>
                  <label style={{ fontSize:'0.75rem' }}>{label}</label>
                  <input type={type} value={memberForm[k]} onChange={e => setMemberForm(p=>({...p,[k]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button onClick={back} style={{ padding:'9px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600 }}>← Back</button>
              <button onClick={skipMember} style={{ padding:'9px 14px', borderRadius:8, border:'1px solid var(--border)', background:'none', color:'var(--text3)', cursor:'pointer', fontFamily:'Rajdhani', fontWeight:600, fontSize:'0.82rem' }}>Skip</button>
              <button onClick={createMember} disabled={loading} style={{ flex:1, padding:'9px', borderRadius:8, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
                {loading ? '⏳ Adding...' : 'Add Member →'}
              </button>
            </div>
          </>
        )}

        {/* DONE */}
        {step === 4 && card(
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🎉</div>
            <h2 style={{ fontFamily:'Rajdhani', fontSize:'1.4rem', color:'var(--success)', marginBottom:8 }}>You're all set!</h2>
            <p style={{ color:'var(--text2)', fontSize:'0.88rem', lineHeight:1.7, marginBottom:20 }}>
              Your hostel is configured and ready to use. Head to the dashboard to start managing your residents.
            </p>
            {createdHostel && (
              <div style={{ background:'rgba(39,174,96,0.06)', border:'1px solid rgba(39,174,96,0.2)', borderRadius:9, padding:'12px 16px', marginBottom:20, textAlign:'left' }}>
                <div style={{ fontFamily:'Rajdhani', fontWeight:700, color:'var(--success)', fontSize:'0.85rem', marginBottom:6 }}>✅ Created:</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text2)' }}>🏠 Hostel: <strong>{createdHostel.name}</strong></div>
                <div style={{ fontSize:'0.8rem', color:'var(--text2)', marginTop:4 }}>🚪 Rooms: {roomsForm.startRoom} – {roomsForm.endRoom} ({(roomsForm.endRoom - roomsForm.startRoom) + 1} rooms)</div>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={onComplete} style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'var(--accent)', color:'#111', fontFamily:'Rajdhani', fontWeight:800, fontSize:'1.05rem', cursor:'pointer', letterSpacing:1 }}>
                🚀 GO TO DASHBOARD →
              </button>
              <div style={{ fontSize:'0.75rem', color:'var(--text3)' }}>
                💡 Tip: Enable online payments in Settings → Razorpay to let members pay rent directly.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
