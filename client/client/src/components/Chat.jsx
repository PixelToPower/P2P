import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function Chat({ setToken }) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'transfer'
  
  const [currentUser] = useState(() => {
    const saved = localStorage.getItem('username');
    if (saved) return saved;
    const randomUser = 'User_' + Math.floor(100 + Math.random() * 900);
    localStorage.setItem('username', randomUser);
    return randomUser;
  });

  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([currentUser]); // Start with self so list is never empty
  
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);

  const [selectedPeer, setSelectedPeer] = useState({ id: 'room-global', name: 'Global P2P Lobby', status: 'online', avatar: '🌐', isGroup: true });
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentRoom, setCurrentRoom] = useState('room-global');
  
  const fileInputRef = useRef(null);
  
  const [contacts, setContacts] = useState([
    { 
      id: 'room-global', 
      name: 'Global P2P Lobby', 
      status: 'online', 
      avatar: '🌐', 
      lastMsg: 'Welcome to decentralized chat!', 
      time: '10:00 AM',
      isGroup: true,
      members: [],
      messages: [
        { id: 1, sender: 'System', text: 'Connected to P2P Signaling Server. Click any online user on the right to send a 1-on-1 chat request!', time: '10:00 AM' }
      ]
    }
  ]);

  useEffect(() => {
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    newSocket.emit('register-user', currentUser);
    newSocket.emit('join-room', 'room-global');

    newSocket.on('update-online-users', (users) => {
      // Ensure current user is always included in the list
      const combined = Array.from(new Set([...users, currentUser]));
      setOnlineUsers(combined);
    });

    newSocket.on('receive-message', (data) => {
      setContacts(prevContacts =>
        prevContacts.map(c => {
          if (c.id === data.roomId) {
            return {
              ...c,
              lastMsg: `${data.sender}: ${data.text}`,
              time: data.time,
              messages: [...c.messages, data]
            };
          }
          return c;
        })
      );
    });

    newSocket.on('receive-chat-request', ({ targetUser, fromUser, roomId }) => {
      if (targetUser === currentUser) {
        setPendingRequests(prev => {
          if (prev.some(r => r.fromUser === fromUser)) return prev;
          return [...prev, { fromUser, roomId }];
        });
      }
    });

    return () => newSocket.close();
  }, [currentUser]);

  const handleSelectContact = (contact) => {
    setSelectedPeer(contact);
    setCurrentRoom(contact.id);
    if (socket) {
      socket.emit('join-room', contact.id);
    }
  };

  const handleSendDirectRequest = (targetUser) => {
    if (targetUser === currentUser) {
      alert("You cannot send a request to yourself!");
      return;
    }
    if (socket) {
      socket.emit('send-chat-request', { targetUser, fromUser: currentUser });
      alert(`Direct chat request sent to ${targetUser}!`);
      setSelectedMemberProfile(null);
    }
  };

  const handleAcceptRequest = (req) => {
    const privateRoomId = req.roomId;
    const newPrivateContact = {
      id: privateRoomId,
      name: req.fromUser,
      status: 'online',
      avatar: '👤',
      lastMsg: 'Private 1-on-1 session connected.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGroup: false,
      members: [currentUser, req.fromUser],
      messages: [
        { id: Date.now(), sender: 'System', text: `Private end-to-end chat started with ${req.fromUser}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]
    };

    setContacts(prev => [newPrivateContact, ...prev]);
    setPendingRequests(prev => prev.filter(r => r.fromUser !== req.fromUser));
    handleSelectContact(newPrivateContact);
  };

  const handleCreateGroup = () => {
    const groupName = prompt("Enter new P2P Group / Channel Name:");
    if (!groupName) return;

    const newGroupId = `group-${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      name: groupName,
      status: 'online',
      avatar: '🚀',
      lastMsg: `Group created`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGroup: true,
      members: onlineUsers,
      messages: [
        { id: Date.now(), sender: 'System', text: `Created P2P Channel: ${groupName}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]
    };

    setContacts(prev => [newGroup, ...prev]);
    handleSelectContact(newGroup);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!messageInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageData = {
      roomId: currentRoom,
      sender: currentUser,
      text: messageInput,
      time: timeStr
    };

    if (socket) {
      socket.emit('send-message', messageData);
    }

    setMessageInput('');
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeFormatted = sizeMB > 1000 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fileMessage = {
      roomId: currentRoom,
      sender: currentUser,
      type: 'p2p-file',
      fileName: file.name,
      fileSize: sizeFormatted,
      progress: 100,
      status: 'completed',
      time: timeStr,
      text: `Shared file: ${file.name}`
    };

    if (socket) {
      socket.emit('send-message', fileMessage);
    }

    e.target.value = null;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'transfer') {
      return matchesSearch && contact.isGroup === true;
    }
    return matchesSearch;
  });

  const activeContactData = contacts.find(c => c.id === selectedPeer.id) || contacts[0];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', backgroundColor: '#090d16', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#f8fafc', overflow: 'hidden', margin: 0, padding: 0, boxSizing: 'border-box' }}>
      
      <style>{`
        * { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; overflow: hidden; }
        .sidebar-item:hover { background-color: rgba(255, 255, 255, 0.04) !important; }
        .dropzone-hover:hover { border-color: #6366f1 !important; background-color: rgba(99, 102, 241, 0.08) !important; }
        .send-btn:active { transform: scale(0.94); }
        .action-btn:hover { filter: brightness(1.2); }
        .member-badge:hover { background-color: rgba(99, 102, 241, 0.3) !important; cursor: pointer !important; }
      `}</style>

      <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} />

      {/* 1. Leftmost Rail */}
      <div style={{ width: '70px', height: '100%', backgroundColor: '#0e1525', borderRight: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <button 
            onClick={() => setShowProfileModal(true)}
            className="action-btn"
            style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#ffffff', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)', border: 'none', cursor: 'pointer' }}
            title="Profile & Settings"
          >
            ⚡
          </button>
          <button 
            onClick={() => setActiveTab('chats')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '10px', borderRadius: '12px', color: activeTab === 'chats' ? '#818cf8' : '#64748b', backgroundColor: activeTab === 'chats' ? 'rgba(99, 102, 241, 0.15)' : 'transparent', transition: 'all 0.2s' }}
            title="Global Lobbies"
          >
            💬
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '10px', borderRadius: '12px', color: activeTab === 'transfer' ? '#f472b6' : '#64748b', backgroundColor: activeTab === 'transfer' ? 'rgba(236, 72, 153, 0.15)' : 'transparent', transition: 'all 0.2s' }}
            title="P2P Groups"
          >
            📁
          </button>
        </div>
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '10px', color: '#f87171' }}
          title="Log out"
        >
          🚪
        </button>
      </div>

      {/* 2. Secondary Sidebar */}
      <div style={{ width: '300px', height: '100%', backgroundColor: '#0f172a', borderRight: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.2px' }}>
            {activeTab === 'chats' ? 'Chats & DMs' : 'P2P Groups'}
          </h3>
          <button 
            onClick={handleCreateGroup}
            style={{ background: 'none', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#f472b6', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}
          >
            + New Group
          </button>
        </div>

        {pendingRequests.length > 0 && (
          <div style={{ padding: '12px', backgroundColor: 'rgba(236, 72, 153, 0.1)', borderBottom: '1px solid rgba(236, 72, 153, 0.2)' }}>
            <span style={{ fontSize: '11px', color: '#f472b6', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              📩 Pending Chat Requests ({pendingRequests.length})
            </span>
            {pendingRequests.map((req, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', padding: '8px 10px', borderRadius: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: '600' }}>{req.fromUser}</span>
                <button 
                  onClick={() => handleAcceptRequest(req)}
                  style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', border: 'none', borderRadius: '6px', color: '#fff', padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Start Talk 💬
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '12px 16px' }}>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..." 
            style={{ width: '100%', backgroundColor: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '9px 14px', fontSize: '12px', color: '#f8fafc', outline: 'none' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {filteredContacts.map((contact) => (
            <div 
              key={contact.id}
              className="sidebar-item"
              onClick={() => handleSelectContact(contact)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px', 
                borderRadius: '12px', 
                cursor: 'pointer',
                marginBottom: '4px',
                backgroundColor: selectedPeer.id === contact.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: selectedPeer.id === contact.id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ position: 'relative', fontSize: '24px', flexShrink: 0 }}>
                {contact.avatar}
                <span style={{ position: 'absolute', bottom: '0', right: '0', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: contact.status === 'online' ? '#4ade80' : '#64748b', border: '2px solid #0f172a' }}></span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc', letterSpacing: '-0.2px' }}>{contact.name}</span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>{contact.time}</span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {contact.lastMsg}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Main Chat Panel */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', position: 'relative', overflow: 'hidden' }}>
        
        <div style={{ height: '65px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{selectedPeer.avatar}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.2px' }}>{selectedPeer.name}</h4>
              <span style={{ fontSize: '11px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80' }}></span> Connected as <strong style={{ color: '#ec4899' }}>{currentUser}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => fileInputRef.current.click()}
              style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
              + Send Heavy File
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ alignSelf: 'center', backgroundColor: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '6px 16px', fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
            🔒 Room: {currentRoom}
          </div>

          {activeContactData.messages.map((msg, idx) => {
            const isMe = msg.sender === currentUser;
            const isSystem = msg.sender === 'System';

            if (isSystem) {
              return (
                <div key={idx} style={{ alignSelf: 'center', fontSize: '11px', color: '#64748b', backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px 12px', borderRadius: '10px' }}>
                  {msg.text}
                </div>
              );
            }

            return (
              <div 
                key={idx} 
                style={{ 
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '65%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                {!isMe && (
                  <span style={{ fontSize: '10px', color: '#f472b6', fontWeight: 'bold', marginBottom: '3px', padding: '0 4px' }}>
                    {msg.sender}
                  </span>
                )}

                {msg.type === 'p2p-file' ? (
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '14px', padding: '16px', width: '280px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '24px' }}>📄</div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.fileName}</div>
                        <div style={{ fontSize: '10px', color: '#818cf8', fontWeight: '500' }}>{msg.fileSize} • Direct P2P Stream</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: '600' }}>✓ Complete</span>
                      <button style={{ background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', fontWeight: '600', padding: '5px 12px', cursor: 'pointer' }}>
                        Download File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    backgroundColor: isMe ? '#4f46e5' : '#1e293b',
                    color: '#ffffff',
                    border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '10px 14px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '13.5px',
                    lineHeight: '1.45',
                    letterSpacing: '-0.1px',
                    boxShadow: isMe ? '0 4px 15px rgba(79, 70, 229, 0.3)' : '0 2px 8px rgba(0,0,0,0.2)'
                  }}>
                    {msg.text}
                  </div>
                )}
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', padding: '0 4px' }}>{msg.time}</span>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px 24px', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.06)', flexShrink: 0 }}>
          <div 
            className="dropzone-hover" 
            onClick={() => fileInputRef.current.click()}
            style={{ border: '2px dashed rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '10px', textAlign: 'center', marginBottom: '12px', backgroundColor: '#162032', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
              📁 Click to select file for <strong style={{ color: '#818cf8' }}>Unlimited Direct P2P Transfer</strong>
            </span>
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message as ${currentUser}...`}
              style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#f8fafc', outline: 'none' }}
            />
            <button 
              type="submit"
              className="send-btn"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)', border: 'none', borderRadius: '10px', padding: '0 22px', color: '#ffffff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)', transition: 'transform 0.1s ease' }}
            >
              Send
            </button>
          </form>
        </div>

      </div>

      {/* 4. Right Sidebar: Fully Interactive Clickable Live Users */}
      <div style={{ width: '280px', height: '100%', backgroundColor: '#0f172a', borderLeft: '1px solid rgba(255, 255, 255, 0.06)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>{selectedPeer.avatar}</div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#f8fafc', letterSpacing: '-0.2px' }}>{selectedPeer.name}</h4>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Room: {currentRoom}</span>
        </div>

        <div style={{ backgroundColor: '#162032', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <h5 style={{ margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#818cf8', letterSpacing: '0.5px', fontWeight: '700' }}>
            Live Online Users (Click to Request)
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {onlineUsers.map((user, i) => (
              <div 
                key={i} 
                className="member-badge"
                onClick={() => setSelectedMemberProfile(user)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  fontSize: '12px', 
                  backgroundColor: 'rgba(99,102,241,0.15)', 
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#f8fafc', 
                  padding: '10px 12px', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s' 
                }}
              >
                <span style={{ fontWeight: '600' }}>{user} {user === currentUser ? '(You)' : ''}</span>
                <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 'bold' }}>● Online</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member Profile Card Modal */}
      {selectedMemberProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '24px', width: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: '#f8fafc', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{selectedMemberProfile}</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px' }}>Active Peer Node</p>
            
            {selectedMemberProfile !== currentUser ? (
              <button 
                onClick={() => handleSendDirectRequest(selectedMemberProfile)}
                style={{ width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', border: 'none', borderRadius: '10px', padding: '12px', color: '#fff', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)', marginBottom: '10px' }}
              >
                + Send 1-on-1 Chat Request 🚀
              </button>
            ) : (
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>This is your account profile.</div>
            )}
            
            <button 
              onClick={() => setSelectedMemberProfile(null)}
              style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '30px', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>⚡ Profile & Settings</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '50%' }}>😎</div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{currentUser}</div>
                <div style={{ fontSize: '12px', color: '#4ade80' }}>Connected to P2P Mesh</div>
              </div>
            </div>
            <button 
              onClick={() => setShowProfileModal(false)}
              style={{ width: '100%', backgroundColor: '#4f46e5', border: 'none', borderRadius: '10px', padding: '10px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
            >
              Save & Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}