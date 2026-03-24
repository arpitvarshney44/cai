const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./index');
const User = require('../models/User');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [config.clientUrl, config.adminUrl],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('name email avatar role');

      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.isBlocked) {
        return next(new Error('Account blocked'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`Socket connected: ${socket.user.name} (${userId})`);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Handle joining a conversation room
    socket.on('joinConversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`${socket.user.name} joined conversation:${conversationId}`);
    });

    // Handle leaving a conversation room
    socket.on('leaveConversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`${socket.user.name} left conversation:${conversationId}`);
    });

    // Handle typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('userTyping', {
        conversationId,
        userId,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Handle user going online/offline
    socket.on('setOnline', () => {
      socket.broadcast.emit('userOnline', { userId });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name} (${userId})`);
      socket.broadcast.emit('userOffline', { userId });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.user.name}:`, error.message);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
