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
const chatHistory = new Map(); // "user1-user2" -> [{from, message, timestamp}]

// Sort usernames alphabetically to create consistent key
function getChatKey(user1, user2) {
  return [user1, user2].sort().join('-');
}

// Save message to history
function saveMessageToHistory(user1, user2, from, message) {
  const key = getChatKey(user1, user2);
  if (!chatHistory.has(key)) {
    chatHistory.set(key, []);
  }
  chatHistory.get(key).push({
    from,
    message,
    timestamp: Date.now()
  });
}

// Get chat history between two users
function getChatHistory(user1, user2) {
  const key = getChatKey(user1, user2);
  return chatHistory.get(key) || [];
}

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
  socket.on('typing', ({ to }) => {
    const targetSocketId = socketsByUser.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('user typing', socket.username);
    }
  });

  socket.on('stop typing', ({ to }) => {
    const targetSocketId = socketsByUser.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('stop typing');
    }
  });

  // 💬 Chat message (public)
  socket.on('chat message', (msg) => {
    const username = socket.username || 'Anonymous';
    const formattedMsg = `${username}: ${msg}`;
    io.emit('chat message', formattedMsg);
  });

  // 🔐 Private message with history
  socket.on('private message', ({ to, message }) => {
    const targetSocketId = socketsByUser.get(to);
    if (!targetSocketId) return;

    const from = socket.username || 'Unknown';
    
    // Save to history
    saveMessageToHistory(from, to, from, message);

    // Send to recipient
    io.to(targetSocketId).emit('private message', {
      from,
      message,
      timestamp: Date.now()
    });
    
    // Also send back to sender so they see it
    socket.emit('private message', {
      from: 'You',
      message,
      to,
      timestamp: Date.now()
    });
  });

  // 📜 Get chat history with a user
  socket.on('get chat history', ({ with: otherUser }) => {
    const username = socket.username;
    if (!username) return;
    
    const history = getChatHistory(username, otherUser);
    socket.emit('chat history', {
      with: otherUser,
      messages: history
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
