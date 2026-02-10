const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const usersBySocket = new Map(); // socket.id -> username
const socketsByUser = new Map(); // username -> socket.id

io.on('connection', (socket) => {
  console.log('✨ User connected:', socket.id);

  socket.on('join', (username) => {
    usersBySocket.set(socket.id, username);
    socketsByUser.set(username, socket.id);
    socket.username = username;

    // Broadcast to others (not the new user)
    socket.broadcast.emit(
      'user connected',
      `🎉 ${username} joined the chat!`
    );

    // Send updated user list to everyone
    io.emit('online users', Array.from(socketsByUser.keys()));
  });

  // 📝 Typing indicator
  socket.on('typing', () => {
    socket.broadcast.emit('user typing', socket.username);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing');
  });

  // 💬 Chat message
  socket.on('chat message', (msg) => {
    const username = socket.username || 'Anonymous';
    const formattedMsg = `${username}: ${msg}`;
    io.emit('chat message', formattedMsg);
  });

  // 🔐 Private message - Send to recipient AND back to sender
  socket.on('private message', ({ to, message }) => {
    const targetSocketId = socketsByUser.get(to);
    if (!targetSocketId) return;

    const from = socket.username || 'Unknown';
    
    // Send to recipient
    io.to(targetSocketId).emit('private message', {
      from,
      message
    });
    
    // Also send back to sender so they see it
    socket.emit('private message', {
      from: 'You',
      message
    });
  });

  socket.on('disconnect', () => {
    const username = usersBySocket.get(socket.id);

    if (username) {
      usersBySocket.delete(socket.id);
      socketsByUser.delete(username);

      socket.broadcast.emit(
        'user disconnected',
        `👋 ${username} left the chat`
      );

      io.emit('online users', Array.from(socketsByUser.keys()));
    }

    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('✨ Chat Hub is ready for connections!');
});
