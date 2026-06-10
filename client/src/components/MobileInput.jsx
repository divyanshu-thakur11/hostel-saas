import React from 'react';

// Strictly enforces 10-digit Indian mobile number
export default function MobileInput({ value, onChange, label, required, placeholder, name, error }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(raw);
  };
  const isValid  = !value || /^\d{10}$/.test(value);
  const showErr  = value && !isValid;

  return (
    <div className="form-group">
      {label && <label>{label}{required && ' *'}</label>}
      <input
        type="tel"
        name={name}
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder || '10-digit mobile number'}
        maxLength={10}
        inputMode="numeric"
        pattern="[0-9]{10}"
        style={{ borderColor: showErr || error ? 'var(--danger)' : undefined }}
      />
      {(showErr || error) && (
        <span style={{ fontSize:'0.72rem', color:'var(--danger)', marginTop:2 }}>
          {error || 'Must be exactly 10 digits'}
        </span>
      )}
      {value && isValid && (
        <span style={{ fontSize:'0.72rem', color:'var(--success)', marginTop:2 }}>✓ Valid</span>
      )}
    </div>
  );
}
