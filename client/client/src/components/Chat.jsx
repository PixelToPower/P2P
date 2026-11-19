import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ProfilePanel from './ProfilePanel';

export default function Chat({ setToken }) {
  const [currentUser] = useState(() => localStorage.getItem('username') || 'User');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([currentUser]);

  // Clean dynamic state arrays primed for WebRTC & Socket data
  const [conversations, setConversations] = useState([
    {
      id: 'room-global',
      name: 'Global P2P Lobby',
      type: 'global',
      lastMsg: 'Welcome to P2P Nexus!',
      time: 'Now',
      bio: 'Official decentralized public channel for all connected peers.',
      messages: [
        { id: 'sys-1', sender: 'System', text: 'Connected to signaling server.', time: 'Now', reaction: null, replyTo: null }
      ]
    }
  ]);

  const [activePeer, setActivePeer] = useState(conversations[0]);
  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.emit('register-user', currentUser);
    newSocket.emit('join-room', activePeer.id);

    newSocket.on('update-online-users', (users) => {
      setOnlineUsers(Array.from(new Set([...users, currentUser])));
    });

    newSocket.on('receive_message', (data) => {
      setConversations(prev =>
        prev.map(c => {
          if (c.id === data.roomId) {
            if (c.messages.some(m => m.id === data.id)) return c;
            return {
              ...c,
              lastMsg: data.text,
              time: data.time,
              messages: [...c.messages, data]
            };
          }
          return c;
        })
      );
    });

    return () => newSocket.disconnect();
  }, [currentUser, activePeer.id]);

  const handleSelectPeer = (contact) => {
    setActivePeer(contact);
    if (socket) socket.emit('join-room', contact.id);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      roomId: activePeer.id,
      sender: currentUser,
      text: messageInput,
      time: timeStr,
      reaction: null,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null
    };

    if (socket) {
      socket.emit('send-message', newMessage);
    }

    setConversations(prev =>
      prev.map(c => {
        if (c.id === activePeer.id) {
          return {
            ...c,
            lastMsg: newMessage.text,
            time: timeStr,
            messages: [...c.messages, newMessage]
          };
        }
        return c;
      })
    );

    setMessageInput('');
    setReplyingTo(null);
  };

  const handleReaction = (msgId, emoji) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activePeer.id) {
          return {
            ...c,
            messages: c.messages.map(m => m.id === msgId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m)
          };
        }
        return c;
      })
    );
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', backgroundColor: '#000000', fontFamily: 'system-ui, sans-serif', color: '#f5f5f5' }}>
      
      <Sidebar 
        conversations={conversations}
        activePeer={activePeer}
        onSelectPeer={handleSelectPeer}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenInvite={() => setShowInviteModal(true)}
        onLogout={() => { localStorage.clear(); setToken(null); }}
      />

      <ChatWindow 
        activePeer={activePeer}
        messages={activePeer.messages}
        currentUser={currentUser}
        currentSocketId={socket?.id}
        messageInput={messageInput}
        setMessageInput={setMessageInput}
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        onReaction={handleReaction}
        isConnected={isConnected}
      />

      <ProfilePanel 
        activePeer={activePeer}
        onlineCount={onlineUsers.length}
        currentUser={currentUser}
      />

    </div>
  );
}