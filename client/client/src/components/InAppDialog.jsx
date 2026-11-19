import React from 'react';

export default function InAppDialog({
  type = 'notice',
  title,
  message,
  value = '',
  onChange,
  inputType = 'text',
  inputPlaceholder = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  actions = null,
  variant = 'dark'
}) {
  const isLight = variant === 'light';
  const textColor = isLight ? '#1e1b4b' : '#f5f5f5';
  const mutedColor = isLight ? '#64748b' : '#a8a8a8';
  const panelColor = isLight ? '#ffffff' : '#121212';
  const inputColor = isLight ? '#1e293b' : '#f5f5f5';
  const inputBackground = isLight ? '#f8fafc' : '#262626';
  const buttonBackground = isLight
    ? 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)'
    : 'linear-gradient(135deg, #3797F0 0%, #833AB4 100%)';

  const handleSubmit = event => {
    event.preventDefault();
    onConfirm?.(value);
  };

  return (
    <div
      className="p2p-dialog-overlay"
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 7000 }}
    >
      <form
        className="p2p-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="in-app-dialog-title"
        onSubmit={handleSubmit}
        onClick={event => event.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', backgroundColor: panelColor, border: `1px solid ${isLight ? '#e2e8f0' : '#262626'}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.65)' }}
      >
        <h2 id="in-app-dialog-title" style={{ margin: '0 0 10px', fontSize: '18px', color: textColor }}>{title}</h2>
        <p style={{ margin: '0 0 20px', fontSize: '13px', lineHeight: '1.5', color: mutedColor }}>{message}</p>

        {type === 'input' && (
          <input
            autoFocus
            required
            type={inputType}
            value={value}
            onChange={event => onChange?.(event.target.value)}
            placeholder={inputPlaceholder}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '20px', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${isLight ? '#cbd5e1' : '#333'}`, backgroundColor: inputBackground, color: inputColor, fontSize: '13px', outline: 'none' }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {type !== 'notice' && !Array.isArray(actions) && (
            <button
              type="button"
              onClick={onCancel}
              style={{ border: `1px solid ${isLight ? '#cbd5e1' : '#333'}`, borderRadius: '10px', padding: '9px 14px', background: 'transparent', color: mutedColor, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              {cancelLabel}
            </button>
          )}
          {Array.isArray(actions) && actions.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                action.onClick?.();
              }}
              style={{
                border: action.danger ? '1px solid #ef4444' : 'none',
                borderRadius: '10px',
                padding: '9px 14px',
                background: action.danger ? 'transparent' : buttonBackground,
                color: action.danger ? '#ef4444' : '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {action.label}
            </button>
          ))}
          {Array.isArray(actions) && <button type="button" onClick={onCancel} style={{ border: '1px solid #333', borderRadius: '10px', padding: '9px 14px', background: 'transparent', color: mutedColor, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>}
          {!Array.isArray(actions) && (
          <button
            type="submit"
            style={{ border: 'none', borderRadius: '10px', padding: '9px 16px', background: buttonBackground, color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            {confirmLabel}
          </button>
          )}
        </div>
      </form>
    </div>
  );
}
