import React, { useEffect, useState } from 'react';
import { hostelAPI, authAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const EMPTY = { name: '', address: '', city: 'Indore', mobile: '', totalRooms: 20 };

export default function Hostels({ onHostelChange }) {
  const [hostels, setHostels] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeHostelId, setActiveHostelId] = useState(localStorage.getItem('hm_hostel_id') || '');
  const toast = useToast();

  const load = async () => {
    const [hRes, uRes] = await Promise.all([hostelAPI.getAll(), authAPI.getUsers()]);
    setHostels(hRes.data || []);
    setManagers((uRes.data || []).filter(u => u.role === 'manager'));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (h) => { setEditTarget(h); setForm({ name: h.name, address: h.address, city: h.city || 'Indore', mobile: h.mobile || '', totalRooms: h.totalRooms || 20 }); setShowModal(true); };

  const save = async () => {
    if (!form.name || !form.address) { toast('Name and address required', 'error'); return; }
    if (form.totalRooms < 1 || form.totalRooms > 500) { toast('Rooms must be between 1 and 500', 'error'); return; }
    setLoading(true);
    try {
      if (editTarget) {
        await hostelAPI.update(editTarget._id, form);
        toast('Hostel updated');
      } else {
        const res = await hostelAPI.create(form);
        toast('Hostel created');
        // Auto-set if first hostel
        if (hostels.length === 0) {
          localStorage.setItem('hm_hostel_id', res.data._id);
          setActiveHostelId(res.data._id);
          onHostelChange && onHostelChange(res.data);
        }
      }
      setShowModal(false);
      load();
    } catch(e) { toast(e.response?.data?.message || 'Error saving hostel', 'error'); }
    finally { setLoading(false); }
  };

  const deleteHostel = async (id, name) => {
    if (!window.confirm(`Remove hostel "${name}"? Data is kept but hostel will be hidden.`)) return;
    try { await hostelAPI.delete(id); toast('Hostel removed'); load(); }
    catch(e) { toast('Error removing hostel', 'error'); }
  };

  const switchActive = (hostel) => {
    localStorage.setItem('hm_hostel_id', hostel._id);
    setActiveHostelId(hostel._id);
    onHostelChange && onHostelChange(hostel);
    toast(`Switched to ${hostel.name}`);
  };

  const assignManager = async (managerId, hostelId) => {
    try {
      await authAPI.assignManagerHostel(managerId, hostelId || null);
      toast('Manager assignment updated');
      load();
    } catch(e) { toast('Error assigning manager', 'error'); }
  };

  const F = (k) => ({ value: form[k] ?? '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div>
      <div className="page-header">
        <div><h2>🏠 Hostels</h2><p>{hostels.length} hostel{hostels.length !== 1 ? 's' : ''}</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Hostel</button>
      </div>

      {hostels.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-icon">🏠</div><p>No hostels yet. Add your first hostel.</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hostels.map(h => {
            const isActive = h._id === activeHostelId;
            const assigned = managers.filter(m => m.hostelId === h._id);
            return (
              <div key={h._id} className="card" style={{ border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)', position: 'relative' }}>
                {isActive && (
                  <div style={{ position: 'absolute', top: 12, right: 14, background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.4)', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
                    ✓ ACTIVE
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 10, background: isActive ? 'rgba(240,165,0,0.12)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>🏠</div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 80 }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{h.name}</div>
                    <div style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: 2 }}>{h.address}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>🚪 {h.totalRooms || 20} rooms</span>
                      {h.mobile && <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>📱 {h.mobile}</span>}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>👨‍💼 {assigned.length} manager{assigned.length !== 1 ? 's' : ''}</span>
                    </div>
                    {assigned.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {assigned.map(m => (
                          <span key={m._id} style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 20, color: 'var(--info)' }}>
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {!isActive && (
                    <button className="btn btn-primary btn-xs" onClick={() => switchActive(h)}>✓ Set Active</button>
                  )}
                  <button className="btn btn-secondary btn-xs" onClick={() => openEdit(h)}>✏️ Edit</button>
                  <button className="btn btn-danger btn-xs" onClick={() => deleteHostel(h._id, h.name)}>Remove</button>
                </div>

                {/* Manager assignment */}
                {managers.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 8, fontFamily: 'Rajdhani', textTransform: 'uppercase', letterSpacing: 1 }}>Assign Managers</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {managers.map(m => {
                        const isHere = m.hostelId === h._id;
                        return (
                          <button key={m._id} onClick={() => assignManager(m._id, isHere ? null : h._id)} style={{
                            fontSize: '0.76rem', padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                            border: `1px solid ${isHere ? 'rgba(46,204,113,0.4)' : 'var(--border)'}`,
                            background: isHere ? 'rgba(46,204,113,0.1)' : 'var(--bg3)',
                            color: isHere ? 'var(--success)' : 'var(--text3)',
                            fontWeight: isHere ? 600 : 400,
                          }}>
                            {isHere ? '✓ ' : ''}{m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editTarget ? 'Edit Hostel' : 'Add New Hostel'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full"><label>Hostel Name *</label><input {...F('name')} placeholder="e.g. Shiv Kripa Boys Hostel" /></div>
                <div className="form-group full"><label>Full Address *</label><input {...F('address')} placeholder="Full address" /></div>
                <div className="form-group"><label>City</label><input {...F('city')} placeholder="City" /></div>
                <div className="form-group"><label>Contact Mobile</label><input {...F('mobile')} placeholder="Mobile number" /></div>
                <div className="form-group full">
                  <label>Total Number of Rooms</label>
                  <input type="number" min="1" max="500" value={form.totalRooms} onChange={e => setForm(p => ({ ...p, totalRooms: parseInt(e.target.value) || 1 }))} />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text3)', marginTop: 4 }}>
                    💡 You can increase or decrease rooms anytime. Currently set to {form.totalRooms} room{form.totalRooms !== 1 ? 's' : ''}.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Hostel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
