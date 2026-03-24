const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config');
const { initializeSocket } = require('./config/socket');

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Create HTTP server (needed for Socket.io)
  const server = http.createServer(app);

  // Initialize Socket.io and attach to Express app for controller access
  const io = initializeSocket(server);
  app.set('io', io);

  server.listen(config.port, () => {
    console.log(`Server running in ${config.env} mode on port ${config.port}`);
    console.log(`API: http://localhost:${config.port}/api/v1/health`);
    console.log(`Socket.io: ws://localhost:${config.port}`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
