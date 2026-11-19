import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Auth from './components/Auth';
import MessageBubble from './components/MessageBubble';
import InAppDialog from './components/InAppDialog';
import { API_URL, apiUrl } from './config/api';

const mergeMessages = (currentMessages, history) => {
  const messagesById = new Map();
  [...currentMessages, ...history].forEach((message, index) => {
    messagesById.set(message.id || `message-${index}`, message);
  });
  return Array.from(messagesById.values()).sort(
    (first, second) => (first.sentAt || 0) - (second.sentAt || 0)
  );
};

const createDirectRoomId = (firstUserId, secondUserId) =>
  `room-${[firstUserId, secondUserId].sort().join('-')}`;

const defaultSettings = {
  messageSound: false,
  inAppNotifications: true,
  allowMessagesFrom: 'everyone',
  showOnlineStatus: true,
  showLastSeen: true,
  readReceipts: true,
  theme: 'dark',
  fontSize: 'medium'
};

const loadSettings = (userId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(`p2p_settings_${userId}`) || '{}');
    const settings = { ...defaultSettings, ...saved };
    return {
      ...settings,
      messageSound: Boolean(settings.messageSound),
      inAppNotifications: settings.inAppNotifications !== false,
      allowMessagesFrom: ['everyone', 'connections', 'nobody'].includes(settings.allowMessagesFrom)
        ? settings.allowMessagesFrom
        : defaultSettings.allowMessagesFrom,
      showOnlineStatus: settings.showOnlineStatus !== false,
      showLastSeen: settings.showLastSeen !== false,
      readReceipts: settings.readReceipts !== false,
      theme: ['dark', 'light'].includes(settings.theme) ? settings.theme : defaultSettings.theme,
      fontSize: ['small', 'medium', 'large'].includes(settings.fontSize)
        ? settings.fontSize
        : defaultSettings.fontSize
    };
  } catch (error) {
    console.error(error);
    return { ...defaultSettings };
  }
};

const getPrivacySettings = settings => ({
  messageAccess: settings.allowMessagesFrom,
  showOnlineStatus: settings.showOnlineStatus,
  showLastSeen: settings.showLastSeen,
  readReceipts: settings.readReceipts
});

const getHiddenMessageKey = (roomId, messageId) => `${roomId}:${messageId}`;

const filterHiddenMessages = (messages, roomId, hiddenMessageIds) =>
  messages.filter(message =>
    !message.id || !hiddenMessageIds.has(getHiddenMessageKey(roomId, message.id))
  );

const formatLastActive = (timestamp, now) => {
  if (!timestamp) return 'Offline';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Active yesterday' : `Active ${days}d ago`;
};

const applyPeerProfile = (conversation, peer) => {
  const previousUsernames = new Set(peer.previousUsernames || []);
  if (conversation.name !== peer.username) previousUsernames.add(conversation.name);
  return {
    ...conversation,
    name: peer.username,
    peerUserId: peer.userId,
    avatar: peer.avatar || '',
    connectionsCount: peer.connectionsCount || 0,
    privacy: peer.privacy || conversation.privacy || {},
    bio: `Secure 1-on-1 session with ${peer.username}`,
    ...(Array.isArray(conversation.messages) && {
      messages: conversation.messages.map(message => ({
        ...message,
        ...(previousUsernames.has(message.sender) && { sender: peer.username }),
        ...(message.replyTo && previousUsernames.has(message.replyTo.sender) && {
          replyTo: { ...message.replyTo, sender: peer.username }
        })
      }))
    })
  };
};

const refreshPeerProfile = (conversation, users) => {
  if (conversation?.type !== 'direct') return conversation;

  const matchingUsers = users.filter(user =>
    conversation.peerUserId
      ? user.userId === conversation.peerUserId
      : user.username === conversation.name || user.previousUsernames?.includes(conversation.name)
  );
  return matchingUsers.length === 1
    ? applyPeerProfile(conversation, matchingUsers[0])
    : conversation;
};

const refreshPeerProfiles = (conversations, users, currentUserId) => {
  const refreshedConversations = conversations.map(conversation =>
    refreshPeerProfile(conversation, users)
  );
  const unlinkedChats = refreshedConversations.filter(
    conversation => conversation.type === 'direct' && !conversation.peerUserId
  );
  const otherUsers = new Map(
    users
      .filter(user => user.userId && user.userId !== currentUserId)
      .map(user => [user.userId, user])
  );

  if (unlinkedChats.length !== 1 || otherUsers.size !== 1) return refreshedConversations;

  const [peer] = otherUsers.values();
  const legacyChat = unlinkedChats[0];
  return refreshedConversations.map(conversation =>
    conversation.id === legacyChat.id
      ? applyPeerProfile(conversation, peer)
      : conversation
  );
};

const updateConversationMessage = (conversation, updatedMessage) => {
  const currentMessages = conversation.messages || [];
  const messageExists = currentMessages.some(message => message.id === updatedMessage.id);
  if (!messageExists) return conversation;

  const messages = currentMessages.map(message =>
    message.id === updatedMessage.id ? { ...message, ...updatedMessage } : message
  );
  const lastMessage = messages[messages.length - 1];
  return {
    ...conversation,
    messages,
    ...(lastMessage?.id === updatedMessage.id ? { lastMsg: lastMessage.text, time: lastMessage.time } : {})
  };
};

const removeConversationMessage = (conversation, messageId) => {
  const currentMessages = conversation.messages || [];
  const messages = currentMessages.filter(message => message.id !== messageId);
  if (messages.length === currentMessages.length) return conversation;

  const lastMessage = messages[messages.length - 1];
  return {
    ...conversation,
    messages,
    lastMsg: lastMessage?.text || '',
    time: lastMessage?.time || conversation.time
  };
};

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem('user_uuid') || `user-${Math.random().toString(36).substring(2, 9)}`);
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('username') || `User-${Math.random().toString(36).substring(2, 5)}`);
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('user_avatar') || '');
  const [isLoggedOut, setIsLoggedOut] = useState(() => localStorage.getItem('p2p_logged_out') === 'true');
  const [settings, setSettings] = useState(() => loadSettings(localStorage.getItem('user_uuid') || 'guest'));
  const settingsRef = useRef(settings);
  const settingsOwnerRef = useRef(localStorage.getItem('user_uuid') || 'guest');
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('p2p_hidden_messages') || '[]');
    } catch (error) {
      console.error(error);
      return [];
    }
  });
  const hiddenMessageIdsRef = useRef(new Set(hiddenMessageIds));
  const [lastSeenByUserId, setLastSeenByUserId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('p2p_last_seen') || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      console.error(error);
      return {};
    }
  });
  const [lobbyRosterByUserId, setLobbyRosterByUserId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('p2p_lobby_roster') || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      console.error(error);
      return {};
    }
  });
  const [clockNow, setClockNow] = useState(Date.now());

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [accountEmail, setAccountEmail] = useState(() => localStorage.getItem('user_email') || '');
  const [profileToView, setProfileToView] = useState(null);
  const [tempUsername, setTempUsername] = useState(currentUser);
  const [tempAvatar, setTempAvatar] = useState(userAvatar);

  const [onlinePeers, setOnlinePeers] = useState([]);
  const onlinePeersRef = useRef([]);
  const [pendingPeers, setPendingPeers] = useState([]); 
  const [connectionRequests, setConnectionRequests] = useState([]); 
  const [sentConnectionRequests, setSentConnectionRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeMenuChatId, setActiveMenuChatId] = useState(null);

  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('p2p_conversations');
    if (saved) {
      try {
        const hiddenIds = new Set(JSON.parse(localStorage.getItem('p2p_hidden_messages') || '[]'));
        return JSON.parse(saved).map(conversation => ({
          ...conversation,
          messages: filterHiddenMessages(conversation.messages || [], conversation.id, hiddenIds)
        }));
      } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'room-global',
        name: 'Global P2P Lobby',
        type: 'global',
        lastMsg: 'Welcome to P2P Nexus!',
        time: 'Now',
        bio: 'Official decentralized public channel for all connected peers.',
        unreadCount: 0,
        messages: [
          { id: 'sys-1', sender: 'System', text: 'Connected to signaling server.', time: 'Now', seen: true }
        ]
      }
    ];
  });

  const [activePeer, setActivePeer] = useState(() => conversations[0] || null);
  const conversationsRef = useRef(conversations);
  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [dialog, setDialog] = useState(null);
  const [dialogInput, setDialogInput] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  const messagesEndRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);

  const activePeerRef = useRef(activePeer);
  useEffect(() => { activePeerRef.current = activePeer; }, [activePeer]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const userAvatarRef = useRef(userAvatar);
  useEffect(() => { userAvatarRef.current = userAvatar; }, [userAvatar]);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);

  const getAudioContext = () => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor();
    return audioContextRef.current;
  };

  const playMessageSound = () => {
    try {
      const context = getAudioContext();
      if (!context) return;
      const play = () => {
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        oscillator.frequency.value = 740;
        volume.gain.setValueAtTime(0.08, context.currentTime);
        volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
        oscillator.connect(volume);
        volume.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.18);
      };
      if (context.state === 'suspended') {
        context.resume().then(play).catch(error => console.error('Unable to play message sound.', error));
      } else {
        play();
      }
    } catch (error) {
      console.error('Unable to play message sound.', error);
    }
  };

  useEffect(() => {
    if (isLoggedOut) return;
    localStorage.setItem('user_uuid', userId);
    localStorage.setItem('username', currentUser);
    localStorage.setItem('user_avatar', userAvatar);
  }, [isLoggedOut, userId, currentUser, userAvatar]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePeer?.messages]);

  useEffect(() => {
    conversationsRef.current = conversations;
    if (!isLoggedOut) {
      localStorage.setItem('p2p_conversations', JSON.stringify(conversations));
    }
  }, [conversations, isLoggedOut]);

  useEffect(() => {
    hiddenMessageIdsRef.current = new Set(hiddenMessageIds);
    if (!isLoggedOut) {
      localStorage.setItem('p2p_hidden_messages', JSON.stringify(hiddenMessageIds));
    }
  }, [hiddenMessageIds, isLoggedOut]);

  useEffect(() => {
    if (!isLoggedOut) {
      localStorage.setItem('p2p_last_seen', JSON.stringify(lastSeenByUserId));
    }
  }, [lastSeenByUserId, isLoggedOut]);

  useEffect(() => {
    if (!isLoggedOut) {
      localStorage.setItem('p2p_lobby_roster', JSON.stringify(lobbyRosterByUserId));
    }
  }, [lobbyRosterByUserId, isLoggedOut]);

  useEffect(() => {
    settingsRef.current = settings;
    if (isLoggedOut) return;
    if (settingsOwnerRef.current !== userId) {
      settingsOwnerRef.current = userId;
      const userSettings = loadSettings(userId);
      settingsRef.current = userSettings;
      setSettings(userSettings);
      return;
    }
    localStorage.setItem(`p2p_settings_${userId}`, JSON.stringify(settings));
  }, [settings, userId, isLoggedOut]);

  useEffect(() => {
    const socket = socketRef.current;
    if (isLoggedOut || !socket?.connected) return;
    socket.emit('register-user', {
      username: currentUser,
      userId,
      avatar: userAvatar,
      privacy: getPrivacySettings(settings),
      connections: conversationsRef.current
        .filter(conversation => conversation.type === 'direct' && conversation.peerUserId)
        .map(conversation => conversation.peerUserId)
    });
  }, [currentUser, userAvatar, settings, userId, isLoggedOut]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- STABLE SOCKET CONNECTION & LISTENERS ---
  useEffect(() => {
    if (isLoggedOut) return;
    if (socketRef.current) return;

    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    socketRef.current = newSocket;

    const registerUserOnSocket = () => {
      newSocket.emit('register-user', { 
        username: currentUserRef.current, 
        userId: userIdRef.current, 
        avatar: userAvatarRef.current,
        privacy: getPrivacySettings(settingsRef.current),
        connections: conversationsRef.current
          .filter(conversation => conversation.type === 'direct' && conversation.peerUserId)
          .map(conversation => conversation.peerUserId)
      });
      newSocket.emit('join-room', 'room-global');
    };

    newSocket.on('connect', () => {
      registerUserOnSocket();
    });

    newSocket.on('update-online-users', (users) => {
      const peersByUserId = new Map();
      users.forEach(peer => {
        if (peer.userId && peer.userId !== userIdRef.current) {
          peersByUserId.set(peer.userId, peer);
        }
      });
      const filtered = Array.from(peersByUserId.values());
      const onlineUserIds = new Set(filtered.map(peer => peer.userId));
      const wentOffline = onlinePeersRef.current.filter(peer => !onlineUserIds.has(peer.userId));
      const lastSeenAt = wentOffline.length ? Date.now() : null;
      if (wentOffline.length) {
        setLastSeenByUserId(previous => ({
          ...previous,
          ...Object.fromEntries(wentOffline.map(peer => [
            peer.userId,
            peer.privacy?.showLastSeen === false ? null : lastSeenAt
          ]))
        }));
      }
      onlinePeersRef.current = filtered;
      setOnlinePeers(filtered);
      setLobbyRosterByUserId(previous => ({
        ...previous,
        ...Object.fromEntries(filtered.map(peer => [peer.userId, {
          userId: peer.userId,
          username: peer.username,
          avatar: peer.avatar || '',
          privacy: peer.privacy || {},
          bio: `Secure P2P user ${peer.username}`,
          connectionsCount: peer.connectionsCount || 0
        }]))
      }));
      setProfileToView(previous => {
        if (!previous?.userId) return previous;
        const isCurrentUser = previous.userId === userIdRef.current;
        const isOnline = isCurrentUser || onlineUserIds.has(previous.userId);
        const offlinePeer = wentOffline.find(peer => peer.userId === previous.userId);
        return {
          ...previous,
          isOnline,
          ...(offlinePeer && {
            lastSeenAt: offlinePeer.privacy?.showLastSeen === false ? null : lastSeenAt
          })
        };
      });
      const refreshedConversations = refreshPeerProfiles(
        conversationsRef.current,
        filtered,
        userIdRef.current
      );
      conversationsRef.current = refreshedConversations;
      setConversations(refreshedConversations);
      setActivePeer(prev => {
        if (!prev) return prev;
        const savedConversation = refreshedConversations.find(conversation => conversation.id === prev.id);
        const updatedPeer = savedConversation?.peerUserId
          ? { ...prev, peerUserId: savedConversation.peerUserId }
          : prev;
        return refreshPeerProfile(updatedPeer, filtered);
      });
    });

    newSocket.on('connection-counts-updated', (connectionCounts) => {
      const updateCount = conversation => {
        const count = connectionCounts?.[conversation.peerUserId];
        return typeof count === 'number'
          ? { ...conversation, connectionsCount: count }
          : conversation;
      };
      setConversations(prev => prev.map(updateCount));
      setActivePeer(prev => prev?.peerUserId ? updateCount(prev) : prev);
      setLobbyRosterByUserId(prev => Object.fromEntries(
        Object.entries(prev).map(([userId, member]) => [
          userId,
          typeof connectionCounts?.[userId] === 'number'
            ? { ...member, connectionsCount: connectionCounts[userId] }
            : member
        ])
      ));
      setProfileToView(prev => {
        const count = connectionCounts?.[prev?.userId];
        return prev && typeof count === 'number'
          ? { ...prev, connectionsCount: count }
          : prev;
      });
    });

    newSocket.on('room-history', ({ roomId, messages }) => {
      const history = filterHiddenMessages(
        Array.isArray(messages) ? messages : [],
        roomId,
        hiddenMessageIdsRef.current
      );
      const lastMessage = history[history.length - 1];

      setConversations(prev => prev.map(conversation => {
        if (conversation.id !== roomId) return conversation;
        return {
          ...conversation,
          ...(lastMessage ? { lastMsg: lastMessage.text, time: lastMessage.time } : {}),
          messages: mergeMessages(conversation.messages || [], history)
        };
      }));

      setActivePeer(prev => {
        if (!prev || prev.id !== roomId) return prev;
        return {
          ...prev,
          ...(lastMessage ? { lastMsg: lastMessage.text, time: lastMessage.time } : {}),
          messages: mergeMessages(prev.messages || [], history)
        };
      });
    });

    newSocket.on('receive_connection_request', (reqData) => {
      setConnectionRequests(prev => {
        if (prev.some(r => reqData.senderId
          ? r.senderId === reqData.senderId
          : r.senderSocketId === reqData.senderSocketId)) return prev;
        return [...prev, reqData];
      });
      if (settingsRef.current.inAppNotifications) setShowNotifications(true);
    });

    newSocket.on('connection_response_received', ({ responderId, responderName, response, responderAvatar, responderConnectionsCount }) => {
      if (response === 'accept') {
        setPendingPeers(prev => prev.filter(p => p !== responderId));
        setSentConnectionRequests(prev => prev.filter(request => request.peerUserId !== responderId));

        const peerName = responderName || responderId;
        const roomId = createDirectRoomId(userIdRef.current, responderId);
        const newRoom = {
          id: roomId,
          name: peerName,
          peerUserId: responderId,
          avatar: responderAvatar || '',
          connectionsCount: responderConnectionsCount || 0,
          type: 'direct',
          lastMsg: 'Private chat session active.',
          time: 'Now',
          bio: `Secure 1-on-1 session with ${peerName}`,
          unreadCount: 0,
          messages: [{ id: `sys-${Date.now()}`, sender: 'System', text: `Private chat established with ${peerName}.`, time: 'Now', seen: true }]
        };

        setConversations(prev => {
          if (prev.some(c => c.id === roomId)) return prev;
          return [...prev, newRoom];
        });
        setActivePeer(newRoom);
        setMobileView('chat');
        setShowMobileInfo(false);
        newSocket.emit('join-room', roomId);
      } else {
        setPendingPeers(prev => prev.filter(p => p !== responderId));
        setSentConnectionRequests(prev => prev.filter(request => request.peerUserId !== responderId));
      }
    });

    newSocket.on('receive_message', (data) => {
      if (data.senderSocketId === newSocket.id) return;
      if (hiddenMessageIdsRef.current.has(getHiddenMessageKey(data.roomId, data.id))) return;

      const currentActive = activePeerRef.current;
      const isActiveChat = currentActive && currentActive.id === data.roomId;
      const isVisible = document.visibilityState === 'visible';
      if (settingsRef.current.messageSound && (!isActiveChat || !isVisible)) playMessageSound();
      if (settingsRef.current.inAppNotifications && (!isActiveChat || !isVisible)) {
        setToastMessage(`${data.sender}: ${data.text}`);
        setTimeout(() => setToastMessage(''), 3500);
      }

      setConversations(prev => {
        const roomExists = prev.some(c => c.id === data.roomId);
        if (!roomExists) {
          return [...prev, {
            id: data.roomId,
            name: data.roomId === 'room-global' ? 'Global P2P Lobby' : data.sender,
            type: data.roomId === 'room-global' ? 'global' : 'direct',
            lastMsg: data.text,
            time: data.time,
            unreadCount: isActiveChat && isVisible ? 0 : 1,
            messages: [data]
          }];
        }

        return prev.map(c => {
          if (c.id === data.roomId) {
            if (c.messages.some(m => m.id === data.id)) return c;
            return { 
              ...c, 
              lastMsg: data.text, 
              time: data.time, 
              unreadCount: isActiveChat && isVisible ? 0 : (c.unreadCount || 0) + 1,
              messages: [...c.messages, { ...data, seen: isActiveChat && isVisible }] 
            };
          }
          return c;
        });
      });

      setActivePeer(prev => {
        if (prev && prev.id === data.roomId) {
          if (prev.messages.some(m => m.id === data.id)) return prev;
          return { 
            ...prev, 
            lastMsg: data.text, 
            time: data.time, 
            messages: [...prev.messages, { ...data, seen: isActiveChat && isVisible }] 
          };
        }
        return prev;
      });

      if (isActiveChat && isVisible && settingsRef.current.readReceipts) {
        newSocket.emit('mark_seen', { roomId: data.roomId, readerName: currentUserRef.current });
      }
    });

    newSocket.on('message_rejected', ({ roomId, messageId, error }) => {
      updateRoomConversation(roomId, conversation =>
        removeConversationMessage(conversation, messageId)
      );
      setToastMessage(error || 'This user does not accept messages from you.');
      setTimeout(() => setToastMessage(''), 4000);
    });

    const updateRoomConversation = (roomId, updateConversation) => {
      setConversations(prev => prev.map(conversation =>
        conversation.id === roomId ? updateConversation(conversation) : conversation
      ));
      setActivePeer(prev =>
        prev?.id === roomId ? updateConversation(prev) : prev
      );
    };

    newSocket.on('message_edited', ({ roomId, message }) => {
      updateRoomConversation(roomId, conversation =>
        updateConversationMessage(conversation, message)
      );
    });

    newSocket.on('message_reaction_updated', ({ roomId, message }) => {
      updateRoomConversation(roomId, conversation =>
        updateConversationMessage(conversation, message)
      );
    });

    newSocket.on('message_deleted', ({ roomId, messageId }) => {
      updateRoomConversation(roomId, conversation =>
        removeConversationMessage(conversation, messageId)
      );
      setReplyingTo(prev => prev?.id === messageId ? null : prev);
    });

    newSocket.on('chat_deleted', ({ roomId }) => {
      setConversations(prev => prev.filter(conversation => conversation.id !== roomId));
      setActivePeer(prev => prev?.id === roomId ? null : prev);
      setMobileView(prev => prev === 'chat' ? 'list' : prev);
      setToastMessage('This chat was deleted for everyone.');
      setTimeout(() => setToastMessage(''), 3000);
    });

    newSocket.on('message_seen_broadcast', ({ roomId, readerName, seenTime }) => {
      setConversations(prev =>
        prev.map(c => {
          if (c.id === roomId) {
            return {
              ...c,
              messages: c.messages.map(m => m.sender === currentUserRef.current ? { ...m, seen: true, seenTime } : m)
            };
          }
          return c;
        })
      );

      setActivePeer(prev => {
        if (prev && prev.id === roomId) {
          return {
            ...prev,
            messages: prev.messages.map(m => m.sender === currentUserRef.current ? { ...m, seen: true, seenTime } : m)
          };
        }
        return prev;
      });
    });

    if (newSocket.connected) {
      registerUserOnSocket();
    }

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      if (socketRef.current === newSocket) socketRef.current = null;
    };
  }, [isLoggedOut]);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!tempUsername.trim()) return;

    setCurrentUser(tempUsername.trim());
    setUserAvatar(tempAvatar.trim());
    setShowProfileModal(false);

    setToastMessage("✨ Profile updated successfully!");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const updateSetting = (name, value) => {
    if (name === 'messageSound' && value) {
      try {
        const context = getAudioContext();
        if (!context) {
          setToastMessage('Message sounds are not supported by this browser.');
          setTimeout(() => setToastMessage(''), 3000);
          return;
        }
        if (context.state === 'suspended') {
          context.resume().catch(error => console.error('Unable to enable message sounds.', error));
        }
      } catch (error) {
        console.error('Unable to enable message sounds.', error);
        setToastMessage('Unable to enable message sounds.');
        setTimeout(() => setToastMessage(''), 3000);
        return;
      }
    }
    setSettings(previous => ({ ...previous, [name]: value }));
  };

  const handleAuthenticatedLogin = (token, user) => {
    if (!token || !user?.id || !user?.username) {
      setToastMessage('The login response was missing account details.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user_uuid', user.id);
    localStorage.setItem('username', user.username);
    localStorage.setItem('user_email', user.email || '');
    localStorage.removeItem('p2p_logged_out');
    settingsOwnerRef.current = user.id;
    const userSettings = loadSettings(user.id);
    settingsRef.current = userSettings;
    setSettings(userSettings);
    setUserId(user.id);
    setCurrentUser(user.username);
    setAccountEmail(user.email || '');
    setUserAvatar('');
    setIsLoggedOut(false);
  };

  const handleLogout = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    [
      'token',
      'user_uuid',
      'username',
      'user_email',
      'user_avatar',
      'p2p_conversations',
      'p2p_hidden_messages',
      'p2p_last_seen',
      'p2p_lobby_roster'
    ].forEach(key => localStorage.removeItem(key));
    localStorage.setItem('p2p_logged_out', 'true');

    const lobby = {
      id: 'room-global',
      name: 'Global P2P Lobby',
      type: 'global',
      lastMsg: 'Welcome to P2P Nexus!',
      time: 'Now',
      bio: 'Official decentralized public channel for all connected peers.',
      unreadCount: 0,
      messages: [
        { id: 'sys-1', sender: 'System', text: 'Connected to signaling server.', time: 'Now', seen: true }
      ]
    };
    setUserId('');
    setCurrentUser('');
    setUserAvatar('');
    setAccountEmail('');
    setConversations([lobby]);
    conversationsRef.current = [lobby];
    setActivePeer(lobby);
    setHiddenMessageIds([]);
    hiddenMessageIdsRef.current.clear();
    setLastSeenByUserId({});
    setLobbyRosterByUserId({});
    setOnlinePeers([]);
    onlinePeersRef.current = [];
    setPendingPeers([]);
    setConnectionRequests([]);
    setSentConnectionRequests([]);
    setDialog(null);
    setProfileToView(null);
    setShowProfileModal(false);
    setShowInviteModal(false);
    setIsLoggedOut(true);
    setShowSettingsModal(false);
    setMobileView('list');
    setShowMobileInfo(false);
  };

  const handleAvatarFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setTempAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSendConnectionRequest = (peer) => {
    if (!socketRef.current) return;
    const peerName = peer.username;
    const peerSocketId = peer.socketId;
    const peerUserId = peer.userId;
    if (!peerUserId || peerUserId === userId) return;
    if (pendingPeers.includes(peerUserId) || conversations.some(
      conversation => conversation.type === 'direct' && conversation.peerUserId === peerUserId
    )) return;

    setPendingPeers(prev => [...prev, peerUserId]);
    setSentConnectionRequests(prev => {
      if (prev.some(request => request.peerUserId === peerUserId)) return prev;
      return [...prev, {
        peerUserId,
        peerName,
        peerAvatar: peer.avatar || '',
        status: 'Pending'
      }];
    });

    const roomId = createDirectRoomId(userId, peerUserId);
    socketRef.current.emit('join-room', roomId);

    socketRef.current.emit('send_connection_request', {
      targetSocketId: peerSocketId,
      targetUserId: peerUserId,
      targetUsername: peerName,
      senderId: userId,
      senderName: currentUser,
      senderAvatar: userAvatar
    });
  };

  const handleAcceptRequest = (req) => {
    if (!socketRef.current) return;
    setConnectionRequests(prev => prev.filter(r => r.senderSocketId !== req.senderSocketId));
    setShowNotifications(false);

    socketRef.current.emit('respond_connection_request', {
      senderSocketId: req.senderSocketId,
      responderId: userId,
      responderName: currentUser,
      responderAvatar: userAvatar,
      response: 'accept'
    });

    const roomId = createDirectRoomId(userId, req.senderId);
    const newRoom = {
      id: roomId,
      name: req.senderName,
      peerUserId: req.senderId,
      avatar: req.senderAvatar || '',
      connectionsCount: req.senderConnectionsCount || 0,
      type: 'direct',
      lastMsg: 'Private chat session active.',
      time: 'Now',
      bio: `Secure 1-on-1 session with ${req.senderName}`,
      unreadCount: 0,
      messages: [{ id: `sys-${Date.now()}`, sender: 'System', text: `Private chat established with ${req.senderName}.`, time: 'Now', seen: true }]
    };

    setConversations(prev => {
      if (prev.some(c => c.id === roomId)) return prev;
      return [...prev, newRoom];
    });
    setActivePeer(newRoom);
    setMobileView('chat');
    setShowMobileInfo(false);
    socketRef.current.emit('join-room', roomId);
    setToastMessage("Request accepted.");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleDeclineRequest = (req) => {
    if (!socketRef.current) return;
    setConnectionRequests(prev => prev.filter(r => r.senderSocketId !== req.senderSocketId));

    socketRef.current.emit('respond_connection_request', {
      senderSocketId: req.senderSocketId,
      responderId: userId,
      responderName: currentUser,
      response: 'decline'
    });
    setToastMessage("Request declined.");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSelectPeer = (contact) => {
    const updatedContact = { ...contact, unreadCount: 0 };
    setActivePeer(updatedContact);
    setMobileView('chat');
    setShowMobileInfo(false);

    setConversations(prev =>
      prev.map(c => c.id === contact.id ? updatedContact : c)
    );

    if (socketRef.current) {
      socketRef.current.emit('join-room', contact.id);
      if (settings.readReceipts) {
        socketRef.current.emit('mark_seen', { roomId: contact.id, readerName: currentUser });
      }
    }
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();
    setActiveMenuChatId(null);
    setDialog({
      type: 'notice',
      title: 'Delete chat?',
      message: 'Choose whether to remove this chat only from your view or for everyone.',
      cancelLabel: 'Cancel',
      actions: [
        {
          label: 'Delete for me',
          onClick: () => {
            deleteChatForMe(chatId);
          }
        },
        {
          label: 'Delete for everyone',
          danger: true,
          onClick: () => {
            if (socketRef.current?.connected) {
              socketRef.current.emit('delete_chat', { roomId: chatId });
            }
            deleteChatForMe(chatId);
          }
        }
      ]
    });
  };

  const deleteChatForMe = (chatId) => {
        const chatToDelete = conversations.find(c => c.id === chatId);
        if (chatToDelete && chatToDelete.name) {
          setPendingPeers(prev => prev.filter(p => p !== chatToDelete.name));
        }
        const updated = conversations.filter(c => c.id !== chatId);
        setConversations(updated);
        if (activePeer?.id === chatId) setActivePeer(updated[0] || null);
        setToastMessage("🗑️ Chat deleted. Peer is now available in Online Lobby for reconnection.");
        setTimeout(() => setToastMessage(''), 3000);
        setDialog(null);
  };

  const clearGroupChatHistory = () => {
    setDialog({
      type: 'confirm',
      title: 'Clear group chat history?',
      message: 'This permanently removes all Global P2P Lobby messages from this device. It will not delete messages for other users.',
      confirmLabel: 'Clear history',
      onConfirm: () => {
        setConversations(previous => previous.map(conversation =>
          conversation.id === 'room-global'
            ? {
                ...conversation,
                lastMsg: 'Group chat history cleared.',
                time: 'Now',
                unreadCount: 0,
                messages: []
              }
            : conversation
        ));
        setActivePeer(previous =>
          previous?.id === 'room-global'
            ? { ...previous, lastMsg: 'Group chat history cleared.', time: 'Now', unreadCount: 0, messages: [] }
            : previous
        );
        setReplyingTo(null);
        setDialog(null);
        setToastMessage('Group chat history cleared from this device.');
        setTimeout(() => setToastMessage(''), 3000);
      }
    });
  };

  const emitMessageAction = (eventName, payload, onSuccess) => {
    if (!socketRef.current?.connected) {
      setToastMessage('Chat connection unavailable. Please reconnect and try again.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    socketRef.current.emit(eventName, payload, result => {
      if (result?.ok) {
        onSuccess?.();
      } else {
        setToastMessage(result?.error || 'Unable to update this message.');
        setTimeout(() => setToastMessage(''), 3000);
      }
    });
  };

  const handleReactToMessage = (messageId, reaction) => {
    if (!activePeer) return;
    const roomId = activePeer.id;
    const updatedMessage = (message) => {
      if (message.id !== messageId) return message;
      const reactions = { ...(message.reactions || {}) };
      Object.entries(reactions).forEach(([emoji, users]) => {
        reactions[emoji] = (users || []).filter(user => user.userId !== userId);
        if (!reactions[emoji].length) delete reactions[emoji];
      });
      const alreadyReacted = message.reactions?.[reaction]?.some(user => user.userId === userId);
      if (!alreadyReacted) {
        reactions[reaction] = [
          ...(reactions[reaction] || []),
          { userId, username: currentUser, avatar: userAvatar }
        ];
      }
      return { ...message, reactions };
    };
    setConversations(previous => previous.map(conversation =>
      conversation.id === roomId
        ? { ...conversation, messages: conversation.messages.map(updatedMessage) }
        : conversation
    ));
    setActivePeer(previous =>
      previous?.id === roomId
        ? { ...previous, messages: previous.messages.map(updatedMessage) }
        : previous
    );
    emitMessageAction('react_to_message', {
      roomId,
      messageId,
      reaction,
      reactorId: userId,
      reactorName: currentUser,
      reactorAvatar: userAvatar
    });
  };

  const handleEditMessage = (message) => {
    if (!activePeer) return;

    const roomId = activePeer.id;
    setDialogInput(message.text);
    setDialog({
      type: 'input',
      title: 'Edit message',
      message: 'Update the message text below.',
      inputPlaceholder: 'Message text',
      confirmLabel: 'Save changes',
      onConfirm: text => {
        if (!text.trim()) return;
        const updatedMessage = {
          ...message,
          text: text.trim(),
          edited: true,
          editedAt: Date.now()
        };
        setConversations(previous => previous.map(conversation =>
          conversation.id === roomId
            ? updateConversationMessage(conversation, updatedMessage)
            : conversation
        ));
        setActivePeer(previous =>
          previous?.id === roomId
            ? updateConversationMessage(previous, updatedMessage)
            : previous
        );
        emitMessageAction('edit_message', {
          roomId,
          messageId: message.id,
          text: text.trim()
        });
        setDialog(null);
      }
    });
  };

  const handleDeleteMessage = (message) => {
    if (!activePeer || !message.id) return;
    const roomId = activePeer.id;
    const isOwnMessage = message.senderId
      ? message.senderId === userId
      : message.senderSocketId
        ? message.senderSocketId === socketRef.current?.id
        : message.sender === currentUser;
    const deleteForMe = () => {
      const hiddenKey = getHiddenMessageKey(roomId, message.id);
      hiddenMessageIdsRef.current.add(hiddenKey);
      setHiddenMessageIds(prev => prev.includes(hiddenKey) ? prev : [...prev, hiddenKey]);
      setConversations(prev => prev.map(conversation =>
        conversation.id === roomId
          ? removeConversationMessage(conversation, message.id)
          : conversation
      ));
      setActivePeer(prev =>
        prev?.id === roomId ? removeConversationMessage(prev, message.id) : prev
      );
      setReplyingTo(prev => prev?.id === message.id ? null : prev);
      setToastMessage('Message deleted for you.');
      setTimeout(() => setToastMessage(''), 3000);
      setDialog(null);
    };
    setDialog({
      type: 'notice',
      title: 'Delete message?',
      message: 'Choose whether to remove this message only from your view or for everyone.',
      actions: [
        {
          label: 'Delete for me',
          onClick: deleteForMe
        },
        ...(isOwnMessage ? [{
          label: 'Delete for everyone',
          danger: true,
          onClick: () => {
            emitMessageAction('delete_message', { roomId, messageId: message.id });
            setDialog(null);
            deleteForMe();
          }
        }] : [])
      ]
    });
  };

  const appendMessageToChat = (message) => {
    setConversations(prev =>
      prev.map(conversation =>
        conversation.id === message.roomId
          ? {
              ...conversation,
              lastMsg: message.text || (message.attachment?.name || 'Sent an attachment'),
              time: message.time,
              messages: [...conversation.messages, message]
            }
          : conversation
      )
    );
    setActivePeer(prev =>
      prev?.id === message.roomId
        ? {
            ...prev,
            lastMsg: message.text || (message.attachment?.name || 'Sent an attachment'),
            time: message.time,
            messages: [...prev.messages, message]
          }
        : prev
    );
  };

  const sendAttachment = (file, kind = 'file') => {
    if (!file || !activePeer) return;
    if (file.size > 8 * 1024 * 1024) {
      setToastMessage('Please choose a file smaller than 8 MB.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setToastMessage('Unable to read that attachment.');
      setTimeout(() => setToastMessage(''), 3000);
    };
    reader.onload = () => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const message = {
        id: `msg-${Date.now()}-${Math.random()}`,
        roomId: activePeer.id,
        sender: currentUser,
        senderId: userId,
        senderAvatar: userAvatar,
        text: kind === 'voice' ? 'Voice note' : '',
        time: timeStr,
        seen: false,
        attachment: {
          kind,
          name: file.name || (kind === 'voice' ? 'Voice note.webm' : 'Photo'),
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl: reader.result
        },
        replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null
      };

      socketRef.current?.emit('send_message', message);
      appendMessageToChat(message);
      setReplyingTo(null);
      setShowAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAttachmentChange = (event, kind) => {
    const file = event.target.files?.[0];
    if (file) sendAttachment(file, kind);
    event.target.value = '';
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setToastMessage('Voice recording is not supported by this browser.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      voiceStreamRef.current = stream;

      recorder.ondataavailable = event => {
        if (event.data.size) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        voiceStreamRef.current = null;
        if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
        setIsRecordingVoice(false);
        setVoiceSeconds(0);

        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        sendAttachment(new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type }), 'voice');
      };

      recorder.start();
      setIsRecordingVoice(true);
      setVoiceSeconds(0);
      setShowAttachmentMenu(false);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds(previous => previous + 1), 1000);
    } catch (error) {
      console.error('Unable to start voice recording.', error);
      setToastMessage('Microphone access is required to record a voice note.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
  };

  const openCamera = async (facingMode = cameraFacingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setToastMessage('Camera access is not supported by this browser.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    setShowAttachmentMenu(false);
    setShowCamera(true);
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
    } catch (error) {
      console.error('Unable to open camera.', error);
      setShowCamera(false);
      setToastMessage('Camera permission is required to capture a photo.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const switchCamera = () => {
    const nextFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacingMode);
    openCamera(nextFacingMode);
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      setToastMessage('Camera is still starting. Please try again.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        setToastMessage('Unable to capture the photo.');
        setTimeout(() => setToastMessage(''), 3000);
        return;
      }
      closeCamera();
      sendAttachment(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }), 'photo');
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activePeer) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      roomId: activePeer.id,
      sender: currentUser,
      senderId: userId,
      senderAvatar: userAvatar,
      text: messageInput,
      time: timeStr,
      seen: false,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null
    };

    if (socketRef.current) {
      socketRef.current.emit('send_message', newMessage);
    }

    setConversations(prev =>
      prev.map(c => {
        if (c.id === activePeer.id) {
          return { ...c, lastMsg: newMessage.text, time: timeStr, messages: [...c.messages, newMessage] };
        }
        return c;
      })
    );

    setActivePeer(prev => prev ? ({
      ...prev,
      lastMsg: newMessage.text,
      time: timeStr,
      messages: [...prev.messages, newMessage]
    }) : null);

    setMessageInput('');
    setReplyingTo(null);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}join?ref=${encodeURIComponent(currentUser)}`);
    setToastMessage("📋 Invite link copied!");
    setTimeout(() => setToastMessage(''), 3000);
  };

  const connectedContacts = conversations.filter(conversation =>
    conversation.type === 'direct' && conversation.peerUserId
  );
  const directConnectionsCount = new Set(connectedContacts.map(contact => contact.peerUserId)).size;
  const onlineUserIds = new Set(onlinePeers.map(peer => peer.userId));
  const activeLobbyMembers = [
    {
      userId,
      username: currentUser,
      avatar: userAvatar,
      connectionsCount: directConnectionsCount,
      isOnline: true,
      isCurrentUser: true
    },
    ...onlinePeers.map(peer => ({ ...peer, isOnline: true }))
  ];
  const knownLobbyMembers = new Map(Object.entries(lobbyRosterByUserId));
  connectedContacts.forEach(contact => {
    const previous = knownLobbyMembers.get(contact.peerUserId);
    knownLobbyMembers.set(contact.peerUserId, {
      ...previous,
      userId: contact.peerUserId,
      username: previous?.username || contact.name,
      avatar: previous?.avatar || contact.avatar || '',
      bio: previous?.bio || contact.bio,
      connectionsCount: previous?.connectionsCount ?? contact.connectionsCount ?? 0
    });
  });
  const offlineLobbyMembers = Array.from(knownLobbyMembers.values())
    .filter(member => member.userId !== userId && !onlineUserIds.has(member.userId))
    .map(member => ({
      ...member,
      lastSeenAt: member.privacy?.showLastSeen === false
        ? null
        : lastSeenByUserId[member.userId] || null,
      isOnline: false
    }));

  const openUserProfile = (profile) => {
    const profileUserId = profile.userId || profile.peerUserId || '';
    setProfileToView({
      userId: profileUserId,
      username: profile.username || profile.name || currentUser,
      avatar: profile.avatar || '',
      bio: profile.bio || '',
      connectionsCount: profile.connectionsCount ?? directConnectionsCount,
      privacy: profile.privacy || {},
      lastSeenAt: profile.privacy?.showLastSeen === false
        ? null
        : profile.lastSeenAt || lastSeenByUserId[profileUserId] || null,
      isOnline: profile.isOnline ?? Boolean(onlineUserIds.has(profileUserId))
    });
  };

  const renderSettingToggle = (settingName, label, description) => (
    <label key={settingName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '10px 0', cursor: 'pointer' }}>
      <span>
        <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#f5f5f5' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '11px', color: '#a8a8a8', marginTop: '3px' }}>{description}</span>
      </span>
      <input
        type="checkbox"
        checked={settings[settingName]}
        onChange={event => updateSetting(settingName, event.target.checked)}
        style={{ width: '18px', height: '18px', accentColor: '#3797F0', flexShrink: 0 }}
      />
    </label>
  );

  if (isLoggedOut) {
    return <Auth initialLogin setToken={handleAuthenticatedLogin} />;
  }

  return (
    <div className={`p2p-app-shell p2p-theme-${settings.theme} p2p-font-${settings.fontSize}${mobileView === 'chat' ? ' p2p-mobile-chat-active' : ''}${showMobileInfo ? ' p2p-show-mobile-info' : ''}`} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', backgroundColor: '#000000', fontFamily: 'system-ui, sans-serif', color: '#f5f5f5' }}>
      
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#3797F0', color: '#fff', padding: '10px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 'bold', zIndex: 6000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          {toastMessage}
        </div>
      )}

      {dialog && (
        <InAppDialog
          {...dialog}
          value={dialogInput}
          onChange={setDialogInput}
          onCancel={() => setDialog(null)}
        />
      )}

      {showCamera && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 5200, backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          role="dialog"
          aria-modal="true"
          aria-label="Camera"
        >
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
          />
          <canvas ref={cameraCanvasRef} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={closeCamera}
            aria-label="Close camera"
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: '16px', width: '42px', height: '42px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
          <button
            type="button"
            onClick={switchCamera}
            aria-label="Switch camera"
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: '16px', width: '42px', height: '42px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            ↻
          </button>
          <div style={{ position: 'absolute', bottom: 'max(28px, env(safe-area-inset-bottom))', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={capturePhoto}
              aria-label="Capture photo"
              style={{ width: '76px', height: '76px', borderRadius: '50%', border: '5px solid #fff', backgroundColor: 'rgba(255,255,255,0.3)', boxShadow: '0 0 0 3px rgba(0,0,0,0.45)', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {attachmentViewer && (
        <div
          onClick={() => setAttachmentViewer(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Attachment preview ${attachmentViewer.name || ''}`}
          style={{ position: 'fixed', inset: 0, zIndex: 5300, backgroundColor: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <button
            type="button"
            onClick={() => setAttachmentViewer(null)}
            aria-label="Close attachment"
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: '16px', width: '42px', height: '42px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '20px', cursor: 'pointer', zIndex: 2 }}
          >
            ✕
          </button>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              const link = document.createElement('a');
              link.href = attachmentViewer.dataUrl;
              link.download = attachmentViewer.name || 'P2P attachment';
              document.body.appendChild(link);
              link.click();
              link.remove();
            }}
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: '16px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', padding: '10px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', zIndex: 2 }}
          >
            Download
          </button>
          <div onClick={event => event.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(attachmentViewer.kind === 'photo' || (attachmentViewer.type || '').startsWith('image/')) && (
              <img src={attachmentViewer.dataUrl} alt={attachmentViewer.name || 'Attachment'} style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: '10px' }} />
            )}
            {((attachmentViewer.kind === 'voice') || (attachmentViewer.type || '').startsWith('audio/')) && (
              <audio controls autoPlay src={attachmentViewer.dataUrl} style={{ width: 'min(620px, 85vw)' }} />
            )}
            {!(attachmentViewer.kind === 'photo') && !(attachmentViewer.kind === 'voice') && !(attachmentViewer.type || '').startsWith('image/') && !(attachmentViewer.type || '').startsWith('audio/') && (
              <iframe title={attachmentViewer.name || 'File preview'} src={attachmentViewer.dataUrl} style={{ width: 'min(900px, 92vw)', height: '82vh', border: '1px solid #333', borderRadius: '10px', backgroundColor: '#fff' }} />
            )}
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
          <div className="p2p-modal-card" style={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '24px', padding: '36px', width: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.9)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f5f5f5' }}>Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '72px', height: '72px', backgroundColor: '#262626', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {tempAvatar ? (
                    <img src={tempAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '24px' }}>👤</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a8a8a8', marginBottom: '6px' }}>Upload Avatar File</label>
                  <input type="file" accept="image/*" onChange={handleAvatarFileUpload} style={{ fontSize: '12px', color: '#fff' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a8a8a8', marginBottom: '6px' }}>Or Avatar Image URL</label>
                <input 
                  type="text" 
                  value={tempAvatar}
                  onChange={(e) => setTempAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  style={{ width: '100%', backgroundColor: '#262626', border: '1px solid #333', borderRadius: '10px', padding: '10px', fontSize: '13px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a8a8a8', marginBottom: '6px' }}>Username</label>
                <input 
                  type="text" 
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  placeholder="Your username"
                  style={{ width: '100%', backgroundColor: '#262626', border: '1px solid #333', borderRadius: '10px', padding: '10px', fontSize: '13px', color: '#fff', outline: 'none' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#737373', marginBottom: '4px' }}>Unique User ID (Read-only)</label>
                <input type="text" value={userId} disabled style={{ width: '100%', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#737373' }} />
              </div>

              <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, #3797F0 0%, #833AB4 100%)', border: 'none', borderRadius: '14px', padding: '14px', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                Save Profile ✨
              </button>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="p2p-settings-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="p2p-settings-card p2p-modal-card" role="dialog" aria-modal="true" aria-label="App settings" onClick={event => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#f5f5f5' }}>Settings</h2>
                <span style={{ fontSize: '11px', color: '#a8a8a8' }}>Manage your account and preferences</span>
              </div>
              <button type="button" onClick={() => setShowSettingsModal(false)} aria-label="Close settings" style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>

            <section className="p2p-settings-section">
              <h3>Account &amp; profile</h3>
              <div className="p2p-settings-account">
                <div>
                  <strong>{currentUser}</strong>
                  <span>{accountEmail || 'Guest profile'}</span>
                </div>
                <button type="button" onClick={() => { setShowSettingsModal(false); setShowProfileModal(true); }}>Edit profile</button>
              </div>
              <button
                type="button"
                className="p2p-logout-button"
                onClick={() => setDialog({
                  type: 'confirm',
                  title: 'Log out?',
                  message: 'You will return to sign-in. Your saved profile stays available, but this device’s chat history will be cleared.',
                  confirmLabel: 'Log out',
                  onConfirm: handleLogout
                })}
              >
                Log out
              </button>
            </section>

            <section className="p2p-settings-section">
              <h3>Notifications</h3>
              {renderSettingToggle('inAppNotifications', 'In-app message alerts', 'Show an alert when a message arrives in another chat.')}
              {renderSettingToggle('messageSound', 'Message sound', 'Play a short sound for incoming messages.')}
            </section>

            <section className="p2p-settings-section">
              <h3>Privacy</h3>
              <label className="p2p-settings-select-row">
                <span><strong>Who can message you?</strong><small>Controls direct messages; lobby messages are unaffected.</small></span>
                <select value={settings.allowMessagesFrom} onChange={event => updateSetting('allowMessagesFrom', event.target.value)}>
                  <option value="everyone">Everyone</option>
                  <option value="connections">Accepted connections</option>
                  <option value="nobody">Nobody</option>
                </select>
              </label>
              {renderSettingToggle('showOnlineStatus', 'Show online status', 'Let other users see when you are online.')}
              {renderSettingToggle('showLastSeen', 'Show last active', 'Let other users see when you were last active.')}
              {renderSettingToggle('readReceipts', 'Send read receipts', 'Let people know when you have read their messages.')}
            </section>

            <section className="p2p-settings-section">
              <h3>Chat &amp; appearance</h3>
              <label className="p2p-settings-select-row">
                <span><strong>Theme</strong><small>Choose the app color theme.</small></span>
                <select value={settings.theme} onChange={event => updateSetting('theme', event.target.value)}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label className="p2p-settings-select-row">
                <span><strong>Font size</strong><small>Adjust message text size.</small></span>
                <select value={settings.fontSize} onChange={event => updateSetting('fontSize', event.target.value)}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </section>
          </div>
        </div>
      )}

      {/* 1. SIDEBAR */}
      <div className="p2p-sidebar" style={{ width: '360px', backgroundColor: '#121212', borderRight: '1px solid #262626', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)} title="Edit Profile">
            <div style={{ width: '38px', height: '38px', backgroundColor: '#262626', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '16px' }}>👤</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#f5f5f5' }}>{currentUser}</div>
              <div style={{ fontSize: '10px', color: '#31a24c' }}>● Online</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', display: 'flex', alignItems: 'center', fontSize: '18px' }} 
                title="Notifications"
              >
                ♡
              </button>
              {(connectionRequests.length + sentConnectionRequests.length) > 0 && (
                <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }}></span>
              )}
            </div>

            <button onClick={() => setShowInviteModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3797F0', fontSize: '16px' }} title="Invite">🔗</button>
            <button onClick={() => setShowSettingsModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a8a8', fontSize: '16px' }} title="Settings">⚙️</button>
          </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div style={{ position: 'absolute', top: '75px', left: '16px', right: '16px', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '16px', padding: '16px', zIndex: 3000, boxShadow: '0 15px 35px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' }}>Notifications Inbox</h4>
              <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>
            
            {sentConnectionRequests.length > 0 && (
              <div style={{ marginBottom: connectionRequests.length > 0 ? '12px' : '0' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>Sent requests</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sentConnectionRequests.map((request) => (
                    <div key={`sent-${request.peerUserId}`} style={{ backgroundColor: '#262626', padding: '10px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', backgroundColor: '#333', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {request.peerAvatar ? <img src={request.peerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#fff' }}>
                          <strong>{request.peerName}</strong>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connectionRequests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {connectionRequests.map((req, idx) => (
                  <div key={`req-${idx}`} style={{ backgroundColor: '#262626', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', backgroundColor: '#333', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {req.senderAvatar ? <img src={req.senderAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#fff' }}><strong style={{ color: '#3797F0' }}>{req.senderName}</strong> wants to connect</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleAcceptRequest(req)} style={{ backgroundColor: '#31a24c', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Accept</button>
                      <button onClick={() => handleDeclineRequest(req)} style={{ backgroundColor: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {connectionRequests.length === 0 && sentConnectionRequests.length === 0 && (
              <div style={{ fontSize: '12px', color: '#737373', textAlign: 'center', padding: '16px 0' }}>No pending connection requests.</div>
            )}
          </div>
        )}

        {/* Online Peers */}
        <div style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #262626', padding: '14px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#3797F0', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Online Peers in Lobby ({onlinePeers.length})</div>
          {onlinePeers.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#737373' }}>No other peers online. Open another browser tab to test!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
              {onlinePeers.map((peer, idx) => {
                const peerName = peer.username;
                const peerAvatar = peer.avatar;
                const isConnected = conversations.some(c =>
                  c.type === 'direct' && (
                    c.peerUserId === peer.userId || c.name === peerName
                  )
                );
                const isPending = pendingPeers.includes(peer.userId);
                
                return (
                  <div key={`peer-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#262626', padding: '8px 12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', backgroundColor: '#333', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {peerAvatar ? <img src={peerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{peerName}</span>
                    </div>
                    {isConnected ? (
                      <span style={{ fontSize: '11px', color: '#31a24c', fontWeight: 'bold', padding: '4px 10px', backgroundColor: 'rgba(49,162,76,0.1)', borderRadius: '6px' }}>Connected</span>
                    ) : isPending ? (
                      <span style={{ fontSize: '11px', color: '#737373', padding: '4px 10px' }}>Request sent</span>
                    ) : (
                      <button onClick={() => handleSendConnectionRequest(peer)} style={{ backgroundColor: '#3797F0', border: 'none', borderRadius: '6px', color: '#fff', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Connect</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
          {conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((contact, cIndex) => {
            const hasUnread = contact.unreadCount > 0;
            return (
              <div 
                key={`contact-${contact.id}-${cIndex}`}
                onClick={() => handleSelectPeer(contact)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', backgroundColor: activePeer?.id === contact.id ? '#1a1a1a' : 'transparent', borderBottom: '1px solid #1a1a1a', position: 'relative' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, overflow: 'hidden' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: '#262626', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                    {contact.avatar ? <img src={contact.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#f5f5f5' }}>{contact.name}</div>
                      
                      {hasUnread && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
                          <span style={{ backgroundColor: '#3797F0', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', minWidth: '16px', textAlign: 'center' }}>
                            {contact.unreadCount > 5 ? '5+' : contact.unreadCount}
                          </span>
                          <span style={{ width: '7px', height: '7px', backgroundColor: '#3797F0', borderRadius: '50%', display: 'inline-block' }}></span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#a8a8a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{contact.lastMsg}</div>
                  </div>
                </div>
                
                {contact.type === 'global' ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenuChatId(activeMenuChatId === contact.id ? null : contact.id); }}
                      style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', padding: '8px', fontSize: '16px', fontWeight: 'bold' }}
                      title="Lobby options"
                    >
                      ⋮
                    </button>
                    {activeMenuChatId === contact.id && (
                      <div style={{ position: 'absolute', right: 0, top: '30px', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '10px', padding: '6px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.8)', minWidth: '180px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveMenuChatId(null); clearGroupChatHistory(); }}
                          style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}
                        >
                          Clear Chat History
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenuChatId(activeMenuChatId === contact.id ? null : contact.id); }} 
                      style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', padding: '8px', fontSize: '16px', fontWeight: 'bold' }} 
                      title="Options"
                    >
                      ⋮
                    </button>

                    {activeMenuChatId === contact.id && (
                      <div style={{ position: 'absolute', right: 0, top: '30px', backgroundColor: '#1a1a1a', border: '1px solid #262626', borderRadius: '10px', padding: '6px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.8)', minWidth: '110px' }}>
                        <button 
                          onClick={(e) => handleDeleteChat(e, contact.id)} 
                          style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}
                        >
                          Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CHAT WINDOW */}
      <div className="p2p-chat-window" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#000000', borderRight: '1px solid #262626' }}>
        <div className="p2p-chat-header" style={{ height: '70px', borderBottom: '1px solid #262626', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121212' }}>
          <button type="button" className="p2p-mobile-back" onClick={() => {
              setShowMobileInfo(false);
              setMobileView('list');
            }} aria-label="Back to chats">‹</button>
          <button type="button" className="p2p-chat-header-profile" onClick={() => setShowMobileInfo(true)}>
            <div style={{ width: '36px', height: '36px', backgroundColor: '#262626', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activePeer?.avatar ? <img src={activePeer.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '💬'}
            </div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#f5f5f5' }}>{activePeer?.name || 'Select a chat'}</h4>
          </button>
          <span style={{ fontSize: '12px', color: '#31a24c', fontWeight: '600' }}>● Connected</span>
        </div>

        <div className="p2p-chat-messages" style={{ flex: 1, padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(activePeer?.messages || []).map((msg, index, messages) => (
            <MessageBubble
              key={`${msg.id || 'msg'}-${index}`}
              msg={msg}
              prevMsg={messages[index - 1]}
              nextMsg={messages[index + 1]}
              currentUser={currentUser}
              currentUserAvatar={userAvatar}
              peerAvatar={activePeer?.avatar}
              currentUserId={userId}
              currentSocketId={socketRef.current?.id}
              onReaction={handleReactToMessage}
              onReply={setReplyingTo}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onViewAttachment={setAttachmentViewer}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {replyingTo && (
          <div style={{ padding: '10px 24px', backgroundColor: '#121212', borderTop: '1px solid #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#a8a8a8', borderLeft: '3px solid #3797F0', paddingLeft: '10px' }}>
              Replying to <strong style={{ color: '#f5f5f5' }}>{replyingTo.sender}</strong>: {replyingTo.text}
            </div>
            <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        <div className="p2p-chat-composer" style={{ position: 'relative', padding: '20px 28px', borderTop: '1px solid #262626', backgroundColor: '#121212' }}>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => handleAttachmentChange(event, 'photo')} />
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={event => handleAttachmentChange(event, 'file')} />
          {isRecordingVoice && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '8px 12px', backgroundColor: '#262626', borderRadius: '12px', color: '#f5f5f5', fontSize: '12px' }}>
              <span style={{ color: '#ef4444', fontWeight: '700' }}>● Recording {voiceSeconds}s</span>
              <button type="button" onClick={stopVoiceRecording} style={{ border: 0, borderRadius: '16px', backgroundColor: '#3797F0', color: '#fff', padding: '7px 12px', cursor: 'pointer', fontWeight: '700' }}>Send voice note</button>
            </div>
          )}
          {showAttachmentMenu && !isRecordingVoice && (
            <div className="p2p-attachment-menu" style={{ position: 'absolute', bottom: '78px', left: '28px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: '8px', width: '260px', padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.55)', zIndex: 40 }}>
              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ border: 0, borderRadius: '12px', backgroundColor: '#262626', color: '#fff', padding: '12px 8px', cursor: 'pointer' }}>🖼️<span style={{ display: 'block', marginTop: '5px', fontSize: '11px' }}>Photo</span></button>
              <button type="button" onClick={() => openCamera()} style={{ border: 0, borderRadius: '12px', backgroundColor: '#262626', color: '#fff', padding: '12px 8px', cursor: 'pointer' }}>📷<span style={{ display: 'block', marginTop: '5px', fontSize: '11px' }}>Capture</span></button>
              <button type="button" onClick={startVoiceRecording} style={{ border: 0, borderRadius: '12px', backgroundColor: '#262626', color: '#fff', padding: '12px 8px', cursor: 'pointer' }}>🎙️<span style={{ display: 'block', marginTop: '5px', fontSize: '11px' }}>Voice note</span></button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ border: 0, borderRadius: '12px', backgroundColor: '#262626', color: '#fff', padding: '12px 8px', cursor: 'pointer' }}>📎<span style={{ display: 'block', marginTop: '5px', fontSize: '11px' }}>File</span></button>
            </div>
          )}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#262626', borderRadius: '24px', padding: '4px 8px 4px 16px' }}>
            <button type="button" onClick={() => setShowAttachmentMenu(previous => !previous)} aria-label="Add attachment" title="Photo, file, voice note or camera" style={{ width: '34px', height: '34px', flexShrink: 0, border: 'none', borderRadius: '50%', background: 'linear-gradient(135deg, #3797F0, #833AB4)', color: '#fff', fontSize: '18px', lineHeight: 1, cursor: 'pointer', marginRight: '6px' }}>+</button>
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Message..." 
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', padding: '10px 0', fontSize: '14px', outline: 'none', color: '#f5f5f5' }}
            />
            <button type="submit" style={{ background: 'none', border: 'none', color: '#0095f6', fontWeight: '600', fontSize: '14px', cursor: 'pointer', padding: '8px 16px' }}>Send</button>
          </form>
        </div>
      </div>

      {/* 3. PROFILE PANEL */}
      <div className="p2p-profile-panel" style={{ width: '320px', backgroundColor: '#121212', display: 'flex', flexDirection: 'column', padding: '36px 28px', overflowY: 'auto', flexShrink: 0, borderLeft: '1px solid #262626' }}>
        <button type="button" className="p2p-mobile-info-close" onClick={() => setShowMobileInfo(false)} aria-label="Close profile panel">✕</button>
        {activePeer?.type === 'global' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #3797F0 0%, #833AB4 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', fontSize: '36px' }}>🌐</div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#f5f5f5' }}>Global P2P Lobby</h3>
              <span style={{ fontSize: '12px', color: '#a8a8a8' }}>Group members</span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: '700', color: '#31a24c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Active now · {activeLobbyMembers.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {activeLobbyMembers.map(member => (
                <button
                  type="button"
                  key={member.userId}
                  onClick={() => openUserProfile(member)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', borderRadius: '10px', padding: '8px', textAlign: 'left', cursor: 'pointer', color: '#f5f5f5' }}
                >
                  <span style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {member.avatar ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.username}{member.isCurrentUser ? ' (you)' : ''}
                    </span>
                    <span style={{ fontSize: '10px', color: '#31a24c' }}>● Active</span>
                  </span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', fontWeight: '700', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Offline · {offlineLobbyMembers.length}
            </div>
            {offlineLobbyMembers.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {offlineLobbyMembers.map(member => (
                  <button
                    type="button"
                    key={member.userId}
                    onClick={() => openUserProfile(member)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', borderRadius: '10px', padding: '8px', textAlign: 'left', cursor: 'pointer', color: '#f5f5f5' }}
                  >
                    <span style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.65 }}>
                      {member.avatar ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.username}</span>
                      <span style={{ fontSize: '10px', color: '#737373' }}>
                        {formatLastActive(member.lastSeenAt, clockNow)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#737373', padding: '4px 8px' }}>No offline contacts.</div>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => activePeer && openUserProfile(activePeer)}
              style={{ width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginBottom: '24px' }}
              title="View profile"
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: '#262626', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                  {activePeer?.avatar ? <img src={activePeer.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '32px' }}>👤</span>}
                </div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: '#f5f5f5' }}>{activePeer?.name || 'Select a chat'}</h3>
                <span style={{ fontSize: '12px', color: '#a8a8a8' }}>Click to view profile</span>
              </div>
            </button>
            <div style={{ backgroundColor: '#000000', border: '1px solid #262626', borderRadius: '14px', padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#3797ef' }}>{activePeer?.connectionsCount || 0}</div>
              <div style={{ fontSize: '11px', color: '#a8a8a8', marginTop: '2px' }}>Connected people</div>
            </div>
            <div style={{ fontSize: '12px', color: '#f5f5f5', lineHeight: '1.5', backgroundColor: '#1a1a1a', padding: '16px', borderRadius: '14px', border: '1px solid #262626' }}>
              <strong style={{ display: 'block', color: '#a8a8a8', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' }}>About Node</strong>
              {activePeer?.bio}
            </div>
          </>
        )}
      </div>

      {/* SHARE MODAL */}
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="p2p-modal-card" style={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '24px', padding: '36px', width: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f5f5f5' }}>Share Profile</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#a8a8a8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ background: '#1a1a1a', border: '1px solid #262626', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>{currentUser}</h4>
              <span style={{ fontSize: '12px', color: '#31a24c' }}>● Verified P2P Node</span>
            </div>
            <button onClick={copyInviteLink} style={{ width: '100%', background: 'linear-gradient(135deg, #3797F0 0%, #833AB4 100%)', border: 'none', borderRadius: '14px', padding: '14px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
              Copy P2P Invite Link 🔗
            </button>
          </div>
        </div>
      )}

      {profileToView && (
        <div
          onClick={() => setProfileToView(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 5000 }}
        >
          <div
            className="p2p-user-profile-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${profileToView.username} profile`}
            onClick={event => event.stopPropagation()}
            style={{ width: '100%', maxWidth: '380px', backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '20px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setProfileToView(null)} aria-label="Close profile" style={{ background: 'none', border: 'none', color: '#a8a8a8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ textAlign: 'center', padding: '4px 12px 20px' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '32px' }}>
                {profileToView.avatar ? <img src={profileToView.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', color: '#f5f5f5' }}>{profileToView.username}</h2>
              <span style={{ fontSize: '12px', color: profileToView.isOnline ? '#31a24c' : '#737373' }}>
                {profileToView.isOnline ? '● Active now' : `○ ${formatLastActive(profileToView.lastSeenAt, clockNow)}`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#000', border: '1px solid #262626', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#3797ef' }}>{profileToView.connectionsCount}</div>
                <div style={{ fontSize: '11px', color: '#a8a8a8', marginTop: '3px' }}>Connected to</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#d4d4d4', lineHeight: '1.5', backgroundColor: '#1a1a1a', padding: '14px', borderRadius: '12px', minHeight: '42px' }}>
              {profileToView.bio || 'No profile bio available.'}
            </div>
            {profileToView.userId && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: '#737373', textAlign: 'center', wordBreak: 'break-all' }}>
                User ID: {profileToView.userId}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}