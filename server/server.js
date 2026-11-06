const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Track online users
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('register-user', (username) => {
    connectedUsers[socket.id] = username;
    socket.username = username;
    
    // Broadcast updated list of unique usernames to everyone
    const userList = Object.values(connectedUsers);
    io.emit('update-online-users', userList);
  });

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('receive-message', data);
  });

  socket.on('send-chat-request', ({ targetUser, fromUser }) => {
    io.emit('receive-chat-request', { 
      targetUser, 
      fromUser, 
      roomId: `private-${[fromUser, targetUser].sort().join('-')}` 
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete connectedUsers[socket.id];
    io.emit('update-online-users', Object.values(connectedUsers));
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});