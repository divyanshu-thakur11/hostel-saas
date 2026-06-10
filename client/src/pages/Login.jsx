import React, { useState } from 'react';
import { authAPI } from '../utils/api';

export default function Login({ onLogin }) {
  const [role, setRole] = useState('owner');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const switchRole = (r) => { setRole(r); setError(''); setForm({ username: '', password: '' }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      const { user, requirePasswordChange } = res.data;
      if (role === 'superadmin' && user.role !== 'superadmin') { setError('This account does not have platform admin access.'); setLoading(false); return; }
      if (role === 'owner' && user.role !== 'owner') { setError('This account does not have owner access.'); setLoading(false); return; }
      if (role === 'manager' && user.role !== 'manager') { setError('This is an owner account. Please use Owner login.'); setLoading(false); return; }
      // Token is now in HttpOnly cookie — no localStorage needed
      localStorage.setItem('hm_user', JSON.stringify(user));
      onLogin(user, requirePasswordChange);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  const isOwner = role === 'owner';
  const isSuperAdmin = role === 'superadmin';
  const accent = isSuperAdmin ? 'var(--danger)' : isOwner ? 'var(--accent)' : 'var(--info)';
  const accentBorder = isSuperAdmin ? 'rgba(231,76,60,0.35)' : isOwner ? 'rgba(240,165,0,0.35)' : 'rgba(52,152,219,0.35)';
  const accentBg = isSuperAdmin ? 'rgba(231,76,60,0.08)' : isOwner ? 'rgba(240,165,0,0.08)' : 'rgba(52,152,219,0.08)';

  return (
    <>
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: '2.4rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: 3 }}>
            🏠 HOSTEL MANAGER
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: 6 }}>
            Management System
          </div>
        </div>

        {/* Role Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 16, gap: 4 }}>
          {[{ key: 'superadmin', icon: '⚡', label: 'Platform' }, { key: 'owner', icon: '👑', label: 'Owner' }, { key: 'manager', icon: '👨‍💼', label: 'Manager' }].map(r => (
            <button key={r.key} onClick={() => switchRole(r.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: 1,
              transition: 'all 0.18s',
              background: role === r.key ? (r.key === 'owner' ? 'rgba(240,165,0,0.15)' : 'rgba(52,152,219,0.15)') : 'transparent',
              color: role === r.key ? (r.key === 'owner' ? 'var(--accent)' : 'var(--info)') : 'var(--text3)',
              boxShadow: role === r.key ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
            }}>
              <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>{r.label}
            </button>
          ))}
        </div>

        {/* Login Card */}
        <div style={{ background: 'var(--bg2)', border: `1px solid ${accentBorder}`, borderRadius: 12, padding: '24px 24px', transition: 'border-color 0.2s' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 20, marginBottom: 20, background: accentBg, border: `1px solid ${accentBorder}` }}>
            <span>{isOwner ? '👑' : '👨‍💼'}</span>
            <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: '0.82rem', color: accent, letterSpacing: 1 }}>
              {isSuperAdmin ? 'PLATFORM ADMIN' : isOwner ? 'OWNER LOGIN' : 'MANAGER LOGIN'}
            </span>
          </div>

          {error && (
            <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: '0.83rem' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Username</label>
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder={isOwner ? 'Enter owner username' : 'Enter manager username'}
                autoComplete="username" autoFocus required />
            </div>
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Enter password" autoComplete="current-password" required
                  style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '1rem', padding: 0,
                }}>{showPw ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 18 }}>
              <button type="button" onClick={() => setShowForgot(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                fontSize: '0.76rem', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3,
              }}>Forgot password?</button>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', border: 'none', borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: accent, color: isOwner ? '#111' : 'white',
              fontFamily: 'Rajdhani', fontWeight: 700, fontSize: '1rem', letterSpacing: 1,
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
            }}>
              {loading ? '⏳ Signing in...' : `Sign in as ${isOwner ? 'Owner' : 'Manager'}`}
            </button>
          </form>

          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text3)', textAlign: 'center' }}>
            {isOwner
              ? <>Contact your system administrator for login credentials</>
              : <>Contact your owner for login credentials</>}
          </div>
        </div>

        {/* Quick switch hint */}
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.76rem', color: 'var(--text3)' }}>
          {isOwner
            ? <>Logging in as staff?{' '}<button onClick={() => switchRole('manager')} style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, padding: 0 }}>Switch to Manager →</button></>
            : <>Are you the owner?{' '}<button onClick={() => switchRole('owner')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, padding: 0 }}>Switch to Owner →</button></>}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowForgot(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 26px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1.6rem', marginBottom: 12, textAlign: 'center' }}>🔑</div>
            <h3 style={{ fontFamily: 'Rajdhani', fontSize: '1.25rem', marginBottom: 6, color: 'var(--text)', textAlign: 'center' }}>Forgot Password?</h3>

            {role === 'manager' && (
              <div style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: 'var(--text2)' }}>
                👨‍💼 <strong>Manager?</strong> Ask your hostel owner to reset your password from the <strong>Managers</strong> page — they can do it in one click.
              </div>
            )}

            {role === 'owner' && (
              <div style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: '0.82rem', color: 'var(--text2)' }}>
                👑 <strong>Hostel Owner?</strong> Ask the platform admin (super admin) to reset your password from the <strong>Super Admin → Organizations → Reset PW</strong> panel.
              </div>
            )}

            {(role === 'superadmin' || role === 'owner') && (
              <>
                <p style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: 14 }}>
                  {role === 'superadmin' ? 'To reset the super admin password, use the emergency reset API:' : 'If the platform admin is also unavailable, use the emergency reset API:'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {[
                    { step: '1', title: 'Open your server .env file', desc: 'Find RESET_SECRET — this is your emergency key. Keep it private.' },
                    { step: '2', title: 'Send a POST request', desc: 'Use curl, Postman, or any API client to call the reset endpoint.' },
                    { step: '3', title: 'Login with new password', desc: 'You will be forced to change it again on first login.' },
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{s.step}</div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.title}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text3)' }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text2)', lineHeight: 1.7, overflowX: 'auto' }}>
                  <div style={{ color: 'var(--text3)', marginBottom: 4 }}># curl example:</div>
                  <div style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>
                    curl -X POST http://localhost:5000/api/auth/emergency-reset \<br/>
                    &nbsp;&nbsp;-H "Content-Type: application/json" \<br/>
                    &nbsp;&nbsp;-d {'\''}&#123;"secret":"YOUR_RESET_SECRET","username":"your_username","newPassword":"newpass123"&#125;{'\''}
                  </div>
                </div>
              </>
            )}

            <button onClick={() => setShowForgot(false)} style={{
              width: '100%', padding: '10px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer',
              fontFamily: 'Rajdhani', fontWeight: 600, fontSize: '0.9rem',
            }}>Close</button>
          </div>
        </div>
      )}
    </div>
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <a href="/member-portal" style={{ color: 'var(--text3)', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg2)' }}>
        🏠 Resident? &nbsp;<strong style={{ color: 'var(--accent)' }}>Open Member Portal →</strong>
      </a>
    </div>
    </>
  );
}
