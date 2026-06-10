import React from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Search by name, room, mobile…', style }) {
  return (
    <div style={{ position:'relative', flex:1, minWidth:200, ...style }}>
      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:'0.9rem', pointerEvents:'none' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:'100%', paddingLeft:32, paddingRight: value ? 32 : 12, paddingTop:8, paddingBottom:8, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text)', outline:'none', fontSize:'0.85rem', boxSizing:'border-box' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'1rem', lineHeight:1, padding:0 }}>×</button>
      )}
    </div>
  );
}
