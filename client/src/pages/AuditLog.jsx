import React, { useEffect, useState } from 'react';
import { auditAPI } from '../utils/api';

const ACTION_COLOR = {
  CREATE_MEMBER: 'var(--success)', UPDATE_MEMBER: 'var(--accent)', DELETE_MEMBER: 'var(--danger)', VACATE_MEMBER: 'var(--info)',
  CREATE_RECEIPT: 'var(--success)', DELETE_RECEIPT: 'var(--danger)',
  RESTORE_MEMBER: 'var(--info)',
};

export default function AuditLog() {
  const [data, setData] = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ entity: '', action: '', user: '' });
  const [page, setPage] = useState(1);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await auditAPI.getAll({ page: p, limit: 50, ...filters });
      setData(res.data);
    } catch(e) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(page); }, [page, filters]);

  const F = (k) => ({ value: filters[k], onChange: e => { setFilters(p => ({ ...p, [k]: e.target.value })); setPage(1); } });
  const selectStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', color: 'var(--text)', outline: 'none', fontSize: '0.85rem' };

  return (
    <div>
      <div className="page-header">
        <div><h2>📋 Audit Log</h2><p>{data.total} entries</p></div>
        <button className="btn btn-secondary" onClick={() => load(page)}>🔄 Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={selectStyle} {...F('entity')}>
          <option value="">All Entities</option>
          <option value="member">Members</option>
          <option value="receipt">Receipts</option>
          <option value="room">Rooms</option>
        </select>
        <select style={selectStyle} {...F('action')}>
          <option value="">All Actions</option>
          <option value="CREATE_MEMBER">Create Member</option>
          <option value="UPDATE_MEMBER">Update Member</option>
          <option value="DELETE_MEMBER">Delete Member</option>
          <option value="VACATE_MEMBER">Vacate Member</option>
          <option value="CREATE_RECEIPT">Create Receipt</option>
          <option value="DELETE_RECEIPT">Delete Receipt</option>
        </select>
        <input {...F('user')} placeholder="Filter by user..." style={{ ...selectStyle, minWidth: 180 }} />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>⏳ Loading...</div>
        ) : data.data.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div><p>No audit logs yet</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Time</th><th>Action</th><th>Description</th><th>Performed By</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {data.data.map(log => (
                    <tr key={log._id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, fontFamily: 'Rajdhani', letterSpacing: 0.5, background: 'var(--bg3)', color: ACTION_COLOR[log.action] || 'var(--text2)', border: `1px solid ${ACTION_COLOR[log.action] || 'var(--border)'}20` }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text2)', fontSize: '0.85rem', maxWidth: 340 }}>{log.description}</td>
                      <td style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.85rem' }}>
                        {log.performedBy?.name || log.performedBy?.username || '—'}
                        {log.performedBy?.username && log.performedBy?.name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>@{log.performedBy.username}</div>
                        )}
                      </td>
                      <td>
                        {log.performedBy?.role && (
                          <span className={`badge ${log.performedBy.role === 'owner' ? 'badge-yellow' : 'badge-blue'}`}>{log.performedBy.role}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <button className="btn btn-secondary btn-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ color: 'var(--text3)', fontSize: '0.82rem', alignSelf: 'center' }}>Page {page} of {data.pages}</span>
                <button className="btn btn-secondary btn-xs" disabled={page === data.pages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
