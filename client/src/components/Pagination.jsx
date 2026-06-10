import React from 'react';

export default function Pagination({ page, pages, total, limit, onPage }) {
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  const window = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) window.push(i);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0 0', flexWrap:'wrap', gap:8 }}>
      <span style={{ fontSize:'0.76rem', color:'var(--text3)' }}>
        Showing {from}–{to} of {total}
      </span>
      <div style={{ display:'flex', gap:4 }}>
        <PBtn disabled={page===1}       onClick={() => onPage(1)}>«</PBtn>
        <PBtn disabled={page===1}       onClick={() => onPage(page-1)}>‹</PBtn>
        {window[0] > 1 && <span style={{padding:'4px 8px',color:'var(--text3)'}}>…</span>}
        {window.map(p => (
          <PBtn key={p} active={p===page} onClick={() => onPage(p)}>{p}</PBtn>
        ))}
        {window[window.length-1] < pages && <span style={{padding:'4px 8px',color:'var(--text3)'}}>…</span>}
        <PBtn disabled={page===pages}   onClick={() => onPage(page+1)}>›</PBtn>
        <PBtn disabled={page===pages}   onClick={() => onPage(pages)}>»</PBtn>
      </div>
    </div>
  );
}

function PBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth:32, height:32, padding:'0 6px',
      borderRadius:6, border:`1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'rgba(240,165,0,0.15)' : 'var(--bg3)',
      color: active ? 'var(--accent)' : disabled ? 'var(--text3)' : 'var(--text2)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize:'0.8rem', fontWeight: active ? 700 : 400,
      transition:'all 0.15s',
    }}>{children}</button>
  );
}
