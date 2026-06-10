import React from 'react';

// Strictly enforces 12-digit Aadhar number
export default function AadharInput({ value, onChange, label, required, error }) {
  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    onChange(raw);
  };
  const isValid = !value || /^\d{12}$/.test(value);
  const showErr = value && !isValid;

  // Format display: XXXX XXXX XXXX
  const formatted = (value || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

  return (
    <div className="form-group">
      {label && <label>{label}{required && ' *'}</label>}
      <input
        type="text"
        value={formatted}
        onChange={handleChange}
        placeholder="12-digit Aadhar number"
        maxLength={14}
        inputMode="numeric"
        style={{ borderColor: showErr || error ? 'var(--danger)' : undefined, letterSpacing: value ? '0.08em' : 'normal' }}
      />
      {(showErr || error) && (
        <span style={{ fontSize:'0.72rem', color:'var(--danger)', marginTop:2 }}>
          {error || 'Aadhar must be exactly 12 digits'}
        </span>
      )}
      {value && isValid && value.length === 12 && (
        <span style={{ fontSize:'0.72rem', color:'var(--success)', marginTop:2 }}>✓ Valid (12 digits)</span>
      )}
    </div>
  );
}
