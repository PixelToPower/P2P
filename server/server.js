const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 12 * 1024 * 1024
});

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use('/api/auth', authRoutes);

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[Server] Connected to MongoDB.'))
    .catch(error => console.error('[Server] MongoDB connection failed:', error.message));
} else {
  console.error('[Server] MONGO_URI is not configured; authentication is unavailable.');
}

// Track online users mapping: socket.id -> { socketId, userId, username, avatar, previousUsernames }
const onlineUsers = new Map();
const previousUsernamesById = new Map();
const connectionsByUserId = new Map();
const privacyByUserId = new Map();
const roomUserIds = new Map();
const roomMessages = new Map();
const supportedReactions = new Set(['❤️', '😂', '😮', '😢', '🙏', '👍']);

const getConnectionCount = (userId) => connectionsByUserId.get(userId)?.size || 0;
const getConnectionCounts = () => Object.fromEntries(
  Array.from(connectionsByUserId, ([userId, connections]) => [userId, connections.size])
);

const addConnection = (firstUserId, secondUserId) => {
  if (!firstUserId || !secondUserId || firstUserId === secondUserId) return;
  const firstConnections = connectionsByUserId.get(firstUserId) || new Set();
  const secondConnections = connectionsByUserId.get(secondUserId) || new Set();
  firstConnections.add(secondUserId);
  secondConnections.add(firstUserId);
  connectionsByUserId.set(firstUserId, firstConnections);
  connectionsByUserId.set(secondUserId, secondConnections);
};

const normalizePrivacy = (privacy = {}) => ({
  messageAccess: ['everyone', 'connections', 'nobody'].includes(privacy.messageAccess)
    ? privacy.messageAccess
    : 'everyone',
  showOnlineStatus: privacy.showOnlineStatus !== false,
  showLastSeen: privacy.showLastSeen !== false,
  readReceipts: privacy.readReceipts !== false
});

const getPreviousUsernames = (userId, previousUser, username) => {
  const previousUsernames = previousUsernamesById.get(userId) || [];
  if (previousUser?.username && previousUser.username !== username && !previousUsernames.includes(previousUser.username)) {
    previousUsernames.push(previousUser.username);
  }
  previousUsernamesById.set(userId, previousUsernames);
  return previousUsernames;
};

const broadcastMessage = (socket, data) => {
  if (!data || typeof data.roomId !== 'string' || typeof data.text !== 'string') {
    console.warn('[Server] Ignored invalid message payload.');
    return;
  }

  if (data.roomId !== 'room-global') {
    const participants = roomUserIds.get(data.roomId) || new Set();
    const deniedRecipientId = Array.from(participants).find(recipientId => {
      if (recipientId === socket.userId) return false;
      const messageAccess = privacyByUserId.get(recipientId)?.messageAccess || 'everyone';
      if (messageAccess === 'nobody') return true;
      return messageAccess === 'connections'
        && !connectionsByUserId.get(recipientId)?.has(socket.userId);
    });
    if (deniedRecipientId) {
      const messageAccess = privacyByUserId.get(deniedRecipientId)?.messageAccess;
      socket.emit('message_rejected', {
        roomId: data.roomId,
        messageId: data.id,
        error: messageAccess === 'nobody'
          ? 'This user is not accepting direct messages.'
          : 'This user only accepts messages from their connections.'
      });
      return;
    }
  }

  const messages = roomMessages.get(data.roomId) || [];
  if (data.id && messages.some(message => message.id === data.id)) return;
  const message = {
    ...data,
    senderId: socket.userId || data.senderId,
    senderSocketId: socket.id,
    senderAvatar: onlineUsers.get(socket.id)?.avatar || data.senderAvatar || '',
    sentAt: Date.now()
  };
  messages.push(message);
  roomMessages.set(data.roomId, messages);
  io.to(data.roomId).emit('receive_message', message);
};

const getRoomMessage = (socket, roomId, messageId, acknowledge) => {
  if (typeof roomId !== 'string' || typeof messageId !== 'string' || !socket.rooms.has(roomId)) {
    acknowledge?.({ ok: false, error: 'Message or chat not found.' });
    return null;
  }

  const messages = roomMessages.get(roomId) || [];
  const index = messages.findIndex(message => message.id === messageId);
  if (index < 0) {
    acknowledge?.({ ok: false, error: 'Message not found.' });
    return null;
  }

  return { messages, index, message: messages[index] };
};

const isMessageOwner = (socket, message) =>
  message.senderId
    ? message.senderId === socket.userId
    : message.senderSocketId === socket.id;

io.on('connection', (socket) => {
  console.log(`[Server] User connected: ${socket.id}`);

  socket.join('room-global');

  const broadcastUserList = () => {
    const userList = Array.from(onlineUsers.values()).map(user => ({
      ...user,
      connectionsCount: getConnectionCount(user.userId)
    }));
    for (const clientSocket of io.sockets.sockets.values()) {
      clientSocket.emit('update-online-users', userList.filter(user =>
        user.userId === clientSocket.userId || user.privacy?.showOnlineStatus !== false
      ));
    }
    io.emit('connection-counts-updated', getConnectionCounts());
  };

  socket.on('register-user', (userData) => {
    const userId = userData?.userId || socket.id;
    const username = userData?.username || `User-${socket.id.substring(0, 4)}`;
    const avatar = userData?.avatar || '';
    const previousUser = onlineUsers.get(socket.id);
    const previousUsernames = getPreviousUsernames(userId, previousUser, username);
    const privacy = normalizePrivacy(userData?.privacy);

    socket.userId = userId;
    socket.username = username;
    privacyByUserId.set(userId, privacy);
    
    onlineUsers.set(socket.id, { socketId: socket.id, userId, username, avatar, previousUsernames, privacy });
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      const participants = roomUserIds.get(roomId) || new Set();
      participants.add(userId);
      roomUserIds.set(roomId, participants);
    }
    if (Array.isArray(userData?.connections)) {
      userData.connections.forEach(connectedUserId => addConnection(userId, connectedUserId));
    }
    console.log(`[Server] Registered user: ${username} (${socket.id})`);
    broadcastUserList();
  });

  socket.on('join-room', (roomId) => {
    if (typeof roomId !== 'string' || !roomId) return;
    socket.join(roomId);
    if (socket.userId) {
      const participants = roomUserIds.get(roomId) || new Set();
      participants.add(socket.userId);
      roomUserIds.set(roomId, participants);
    }
    socket.emit('room-history', {
      roomId,
      messages: roomMessages.get(roomId) || []
    });
  });

  socket.on('send_connection_request', ({ targetSocketId, targetUserId, targetUsername, senderId, senderName, senderAvatar }) => {
    let recipientSocketId = targetSocketId;

    if (!recipientSocketId || !onlineUsers.has(recipientSocketId)) {
      for (let [sId, uData] of onlineUsers.entries()) {
        if (sId !== socket.id && (uData.userId === targetUserId || uData.username === targetUsername)) {
          recipientSocketId = sId;
          break;
        }
      }
    }

    console.log(`[Server] Connection request from ${senderName} (${socket.id}) -> Target Socket: ${recipientSocketId}`);

    if (recipientSocketId && onlineUsers.has(recipientSocketId)) {
      io.to(recipientSocketId).emit('receive_connection_request', {
        senderSocketId: socket.id,
        senderId,
        senderName,
        senderAvatar,
        senderConnectionsCount: getConnectionCount(socket.userId || senderId)
      });
    }
  });

  socket.on('respond_connection_request', ({ senderSocketId, responderId, responderName, responderAvatar, response }) => {
    const responderUserId = socket.userId || responderId;
    const senderUserId = onlineUsers.get(senderSocketId)?.userId;
    if (response === 'accept') addConnection(senderUserId, responderUserId);

    if (senderSocketId) {
      io.to(senderSocketId).emit('connection_response_received', {
        responderId,
        responderName,
        responderAvatar,
        senderConnectionsCount: getConnectionCount(senderUserId),
        responderConnectionsCount: getConnectionCount(responderUserId),
        response
      });
    }
    if (response === 'accept') broadcastUserList();
  });

  socket.on('send_message', (data) => broadcastMessage(socket, data));
  socket.on('send-message', (data) => broadcastMessage(socket, data));

  socket.on('edit_message', (data = {}, acknowledge) => {
    const { roomId, messageId, text } = data || {};
    if (typeof text !== 'string' || !text.trim()) {
      acknowledge?.({ ok: false, error: 'Message cannot be empty.' });
      return;
    }

    const target = getRoomMessage(socket, roomId, messageId, acknowledge);
    if (!target) return;
    if (!isMessageOwner(socket, target.message)) {
      acknowledge?.({ ok: false, error: 'You can only edit your own messages.' });
      return;
    }

    const message = {
      ...target.message,
      text: text.trim(),
      edited: true,
      editedAt: Date.now()
    };
    target.messages[target.index] = message;
    io.to(roomId).emit('message_edited', { roomId, message });
    acknowledge?.({ ok: true });
  });

  socket.on('delete_message', (data = {}, acknowledge) => {
    const { roomId, messageId } = data || {};
    const target = getRoomMessage(socket, roomId, messageId, acknowledge);
    if (!target) return;
    if (!isMessageOwner(socket, target.message)) {
      acknowledge?.({ ok: false, error: 'You can only delete your own messages.' });
      return;
    }

    target.messages.splice(target.index, 1);
    roomMessages.set(roomId, target.messages);
    io.to(roomId).emit('message_deleted', { roomId, messageId });
    acknowledge?.({ ok: true });
  });

  socket.on('delete_chat', (data = {}, acknowledge) => {
    const { roomId } = data || {};
    if (typeof roomId !== 'string' || roomId === 'room-global') {
      acknowledge?.({ ok: false, error: 'This chat cannot be deleted.' });
      return;
    }
    const participants = roomUserIds.get(roomId) || new Set();
    if (socket.userId && !participants.has(socket.userId)) {
      acknowledge?.({ ok: false, error: 'You are not a participant in this chat.' });
      return;
    }
    roomMessages.delete(roomId);
    io.to(roomId).emit('chat_deleted', { roomId });
    acknowledge?.({ ok: true });
  });

  socket.on('react_to_message', (data = {}, acknowledge) => {
    const { roomId, messageId, reaction, reactorId, reactorName, reactorAvatar } = data || {};
    if (!supportedReactions.has(reaction)) {
      acknowledge?.({ ok: false, error: 'Reaction is not supported.' });
      return;
    }

    const target = getRoomMessage(socket, roomId, messageId, acknowledge);
    if (!target) return;

    const userId = socket.userId || reactorId;
    if (!userId) {
      acknowledge?.({ ok: false, error: 'Unable to identify reaction sender.' });
      return;
    }
    const reactions = { ...(target.message.reactions || {}) };
    for (const [emoji, users] of Object.entries(reactions)) {
      reactions[emoji] = (users || []).filter(user => user.userId !== userId);
      if (!reactions[emoji].length) delete reactions[emoji];
    }
    if (target.message.reactions?.[reaction]?.some(user => user.userId === userId)) {
      target.message.reactions = reactions;
    } else {
      reactions[reaction] = [
        ...(reactions[reaction] || []),
        {
          userId,
          username: reactorName || socket.username || 'Unknown user',
          avatar: reactorAvatar || onlineUsers.get(socket.id)?.avatar || ''
        }
      ];
    }

    const message = { ...target.message, reactions };
    target.messages[target.index] = message;
    io.to(roomId).emit('message_reaction_updated', { roomId, message });
    acknowledge?.({ ok: true });
  });

  socket.on('mark_seen', ({ roomId, readerName }) => {
    if (privacyByUserId.get(socket.userId)?.readReceipts === false) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.emit('message_seen_broadcast', { roomId, readerName, seenTime: timestamp });
  });

  socket.on('message_seen', ({ roomId, readerName }) => {
    if (privacyByUserId.get(socket.userId)?.readReceipts === false) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    io.emit('message_seen_broadcast', { roomId, readerName, seenTime: timestamp });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    broadcastUserList();
    console.log(`[Server] User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});