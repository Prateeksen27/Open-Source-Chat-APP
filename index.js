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
  console.log('Connected:', socket.id);

  socket.on('join', (username) => {
    usersBySocket.set(socket.id, username);
    socketsByUser.set(username, socket.id);
    socket.username = username;

    socket.broadcast.emit(
      'user connected',
      `${username} joined the chat`
    );

    io.emit('online users', Array.from(socketsByUser.keys()));
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  // 🔐 PRIVATE MESSAGE
  socket.on('private message', ({ to, message }) => {
    const targetSocketId = socketsByUser.get(to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('private message', {
      from: socket.username,
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
        `${username} left the chat`
      );

      io.emit('online users', Array.from(socketsByUser.keys()));
    }

    console.log('Disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
