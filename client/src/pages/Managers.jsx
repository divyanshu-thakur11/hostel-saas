import React, { useEffect, useState } from 'react';
import { authAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';

const EMPTY = { username: '', password: '', name: '', mobile: '' };

export default function Managers() {
  const [managers, setManagers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showActivity, setShowActivity] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  // Change own password
  const [showPassChange, setShowPassChange] = useState(false);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Owner reset another user's password
  const [resetTarget, setResetTarget] = useState(null); // user object
  const [resetForm, setResetForm] = useState({ newPassword: '', confirm: '' });
  const [showResetPw, setShowResetPw] = useState(false);

  const toast = useToast();
  const user = JSON.parse(localStorage.getItem('hm_user') || '{}');
  const isOwner = user.role === 'owner';

  const load = () => authAPI.getUsers().then(r => setManagers(r.data || [])).catch(() => {});
  useEffect(() => { if (isOwner) load(); }, []);

  const createManager = async () => {
    if (!form.username || !form.password || !form.name) { toast('Username, password and name required', 'error'); return; }
    if (form.password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await authAPI.createManager(form);
      toast('Manager account created');
      setShowModal(false); setForm(EMPTY); load();
    } catch(e) { toast(e.response?.data?.message || 'Error creating manager', 'error'); }
    finally { setLoading(false); }
  };

  const toggleActive = async (id, name, isActive) => {
    if (!window.confirm(`${isActive ? 'Disable' : 'Enable'} ${name}?`)) return;
    try {
      await authAPI.toggleUser(id);
      toast(`${name} ${isActive ? 'disabled' : 'enabled'}`);
      load();
    } catch(e) { toast('Error updating user', 'error'); }
  };

  const deleteManager = async (id, name) => {
    if (!window.confirm(`Permanently delete manager ${name}?`)) return;
    try {
      await authAPI.deleteUser(id);
      toast(`${name} deleted`);
      load();
    } catch(e) { toast('Error deleting manager', 'error'); }
  };

  const viewActivity = async (id) => {
    setShowActivity(id);
    try {
      const res = await authAPI.getUserActivity(id);
      setActivityData(res.data);
    } catch(e) { toast('Error loading activity', 'error'); }
  };

  // Change own password
  const changePassword = async () => {
    if (!passForm.currentPassword || !passForm.newPassword) { toast('All fields required', 'error'); return; }
    if (passForm.newPassword !== passForm.confirm) { toast('New passwords do not match', 'error'); return; }
    if (passForm.newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    try {
      await authAPI.changePassword({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword });
      toast('Password changed successfully');
      setShowPassChange(false);
      setPassForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch(e) { toast(e.response?.data?.message || 'Error changing password', 'error'); }
  };

  // Owner reset any user's password
  const openResetFor = (targetUser) => {
    setResetTarget(targetUser);
    setResetForm({ newPassword: '', confirm: '' });
    setShowResetPw(true);
  };

  const doResetPassword = async () => {
    if (!resetForm.newPassword) { toast('Enter a new password', 'error'); return; }
    if (resetForm.newPassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (resetForm.newPassword !== resetForm.confirm) { toast('Passwords do not match', 'error'); return; }
    try {
      await authAPI.resetUserPassword(resetTarget._id, { newPassword: resetForm.newPassword });
      toast(`Password reset for ${resetTarget.name}`);
      setShowResetPw(false);
      setResetTarget(null);
    } catch(e) { toast(e.response?.data?.message || 'Error resetting password', 'error'); }
  };

  const F = (k) => ({ value: form[k] || '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });
  const PF = (k) => ({ value: passForm[k] || '', onChange: e => setPassForm(p => ({ ...p, [k]: e.target.value })) });
  const RF = (k) => ({ value: resetForm[k] || '', onChange: e => setResetForm(p => ({ ...p, [k]: e.target.value })) });

  const pwInput = (field, placeholder, show, setShow, bind) => (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} {...bind(field)} placeholder={placeholder} style={{ paddingRight: 38 }} />
      <button type="button" onClick={() => setShow(s => !s)} style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '0.95rem', padding: 0,
      }}>{show ? '🙈' : '👁️'}</button>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isOwner ? 'Manager Accounts' : 'My Account'}</h2>
          <p>{isOwner ? `${managers.filter(m => m.role === 'manager').length} managers` : 'Manage your account settings'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowPassChange(true)}>🔑 Change My Password</button>
          {isOwner && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Manager</button>}
        </div>
      </div>

      {/* Current user card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: user.role === 'owner' ? 'rgba(240,165,0,0.15)' : 'rgba(52,152,219,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
            {user.role === 'owner' ? '👑' : '👨‍💼'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>{user.name}</div>
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>
              @{user.username} · <span style={{ color: user.role === 'owner' ? 'var(--accent)' : 'var(--info)', fontWeight: 600, textTransform: 'uppercase' }}>{user.role}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-xs" onClick={() => setShowPassChange(true)}>🔑 Change Password</button>
        </div>
      </div>

      {/* Owner section: all users with reset password */}
      {isOwner && (
        <>
          {/* Owner's own row with reset */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Rajdhani', marginBottom: 14, fontSize: '1rem', color: 'var(--accent)' }}>👑 Owner Account</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{managers.find(m => m.role === 'owner')?.name || user.name}</div>
                <div style={{ color: 'var(--text3)', fontSize: '0.8rem' }}>@{managers.find(m => m.role === 'owner')?.username || user.username}</div>
              </div>
              <button className="btn btn-secondary btn-xs" onClick={() => {
                const ownerUser = managers.find(m => m.role === 'owner');
                if (ownerUser) openResetFor(ownerUser);
              }}>🔑 Reset Password</button>
            </div>
          </div>

          {/* Manager accounts table */}
          <div className="card">
            <h3 style={{ fontFamily: 'Rajdhani', marginBottom: 16, fontSize: '1rem', color: 'var(--info)' }}>👨‍💼 Manager Accounts</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Username</th><th>Mobile</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {managers.filter(m => m.role === 'manager').length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">👨‍💼</div><p>No managers yet. Add one above.</p></div></td></tr>
                  ) : managers.filter(m => m.role === 'manager').map(m => (
                    <tr key={m._id}>
                      <td style={{ color: 'var(--text)', fontWeight: 500 }}>{m.name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>@{m.username}</td>
                      <td>{m.mobile || '—'}</td>
                      <td>
                        <span className={`badge ${m.isActive ? 'badge-green' : 'badge-red'}`}>
                          {m.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>
                        {m.lastLogin ? new Date(m.lastLogin).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-xs" onClick={() => openResetFor(m)}>🔑 Reset PW</button>
                          <button className="btn btn-secondary btn-xs" onClick={() => viewActivity(m._id)}>📋 Activity</button>
                          <button className={`btn btn-xs ${m.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(m._id, m.name, m.isActive)}>
                            {m.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteManager(m._id, m.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Manager Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>Add Manager Account</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Full Name *</label><input {...F('name')} placeholder="Manager name" /></div>
                <div className="form-group"><label>Username *</label><input {...F('username')} placeholder="login username" /></div>
                <div className="form-group"><label>Password *</label><input type="password" {...F('password')} placeholder="Min 6 characters" /></div>
                <div className="form-group"><label>Mobile</label><input {...F('mobile')} placeholder="10-digit mobile" /></div>
              </div>
              <div style={{ marginTop: 14, padding: '10px', background: 'var(--bg3)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text3)' }}>
                ℹ️ Manager can: add/edit members, create receipts, add electric readings. Cannot: manage salary, delete data, or view other accounts.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createManager} disabled={loading}>{loading ? 'Creating...' : 'Create Manager'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Modal */}
      {showActivity && activityData && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowActivity(null)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>📋 Activity Log — {activityData.name}</h3>
              <button className="close-btn" onClick={() => setShowActivity(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text3)' }}>
                Last login: {activityData.lastLogin ? new Date(activityData.lastLogin).toLocaleString('en-IN') : 'Never'}
              </div>
              {(!activityData.recentActivity || activityData.recentActivity.length === 0) ? (
                <div className="empty-state"><div className="empty-icon">📋</div><p>No activity recorded yet</p></div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {activityData.recentActivity.map((a, i) => (
                    <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          background: a.method === 'DELETE' ? 'rgba(231,76,60,0.15)' : a.method === 'PUT' ? 'rgba(243,156,18,0.15)' : 'rgba(46,204,113,0.15)',
                          color: a.method === 'DELETE' ? 'var(--danger)' : a.method === 'PUT' ? 'var(--accent)' : 'var(--success)',
                        }}>{a.method}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontFamily: 'monospace' }}>{a.path}</div>
                        {a.details && <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>{a.details}</div>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', flexShrink: 0 }}>
                        {new Date(a.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowActivity(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Own Password Modal */}
      {showPassChange && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPassChange(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>🔑 Change My Password</h3>
              <button className="close-btn" onClick={() => setShowPassChange(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.78rem', color: 'var(--text3)' }}>
                You are changing the password for: <strong style={{ color: 'var(--text2)' }}>@{user.username}</strong>
              </div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Current Password</label>
                  {pwInput('currentPassword', 'Your current password', showCurPw, setShowCurPw, PF)}
                </div>
                <div className="form-group full">
                  <label>New Password</label>
                  {pwInput('newPassword', 'Min 6 characters', showNewPw, setShowNewPw, PF)}
                </div>
                <div className="form-group full">
                  <label>Confirm New Password</label>
                  <input type="password" {...PF('confirm')} placeholder="Repeat new password" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPassChange(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={changePassword}>Change Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Reset Password Modal */}
      {showResetPw && resetTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowResetPw(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🔑 Reset Password</h3>
              <button className="close-btn" onClick={() => setShowResetPw(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
                <div style={{ fontSize: '1.8rem' }}>{resetTarget.role === 'owner' ? '👑' : '👨‍💼'}</div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{resetTarget.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                    @{resetTarget.username} · <span style={{ color: resetTarget.role === 'owner' ? 'var(--accent)' : 'var(--info)', textTransform: 'uppercase', fontWeight: 600 }}>{resetTarget.role}</span>
                  </div>
                </div>
              </div>
              <div style={{ background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)', borderRadius: 7, padding: '10px 13px', marginBottom: 16, fontSize: '0.78rem', color: 'var(--text2)' }}>
                ⚠️ As owner, you can set a new password without knowing the current one. Make sure to tell <strong>{resetTarget.name}</strong> their new password.
              </div>
              <div className="form-grid">
                <div className="form-group full">
                  <label>New Password for {resetTarget.name}</label>
                  {pwInput('newPassword', 'Min 6 characters', showNewPw, setShowNewPw, RF)}
                </div>
                <div className="form-group full">
                  <label>Confirm New Password</label>
                  <input type="password" {...RF('confirm')} placeholder="Repeat new password" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetPw(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doResetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
