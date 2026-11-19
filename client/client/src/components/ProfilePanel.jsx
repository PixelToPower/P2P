import React from 'react';

export default function ProfilePanel({ activePeer, onlineCount, currentUser }) {
  if (!activePeer) return null;

  return (
    <div style={{ width: '320px', backgroundColor: '#121212', display: 'flex', flexDirection: 'column', padding: '36px 28px', overflowY: 'auto', flexShrink: 0, borderLeft: '1px solid #262626' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: '80px', height: '80px', backgroundColor: '#262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', color: '#fff' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#f5f5f5', wordBreak: 'break-word' }}>{activePeer.name}</h3>
        <span style={{ fontSize: '12px', color: '#a8a8a8' }}>{activePeer.type === 'global' ? 'Public Network Channel' : 'Active P2P Node'}</span>
      </div>

      <div style={{ backgroundColor: '#000000', border: '1px solid #262626', borderRadius: '14px', padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#3797ef' }}>{onlineCount}</div>
        <div style={{ fontSize: '11px', color: '#a8a8a8', marginTop: '2px' }}>Active Online Peers</div>
      </div>

      <div style={{ fontSize: '12px', color: '#f5f5f5', lineHeight: '1.5', wordBreak: 'break-word', backgroundColor: '#1a1a1a', padding: '16px', borderRadius: '14px', border: '1px solid #262626' }}>
        <strong style={{ display: 'block', color: '#a8a8a8', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>About Node</strong>
        {activePeer.bio}
      </div>
    </div>
  );
}