import React from 'react';

export default function Sidebar({ conversations, activePeer, onSelectPeer, searchQuery, setSearchQuery, onOpenInvite, onLogout }) {
    return (
        <div style={{ width: '360px', backgroundColor: '#121212', borderRight: '1px solid #262626', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Top Header */}
            <div style={{ padding: '24px 20px', borderBottom: '1px solid #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    P2P NEXUS
                </h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={onOpenInvite} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3797F0', display: 'flex', alignItems: 'center' }} title="Share Profile & Invite">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a8a8', display: 'flex', alignItems: 'center' }} title="Log Out">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '12px 16px' }}>
                <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#262626', border: 'none', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', outline: 'none', color: '#f5f5f5' }}
                />
            </div>

            {/* Conversations List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
        
                {conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((contact, index) => (
                    <div
                        key={`${contact.id}-${index}`}
                        onClick={() => onSelectPeer(contact)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 20px',
                            cursor: 'pointer',
                            backgroundColor: activePeer?.id === contact.id ? '#1a1a1a' : 'transparent',
                            borderBottom: '1px solid #1a1a1a',
                            transition: 'background-color 0.15s'
                        }}
                    >
                        <div style={{ width: '48px', height: '48px', backgroundColor: '#262626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f5f5f5' }}>{contact.name}</div>
                            <div style={{ fontSize: '12px', color: '#a8a8a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{contact.lastMsg}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}