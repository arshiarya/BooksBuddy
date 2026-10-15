const http = require('http');
const app = require('./app');
const env = require('./config/env');

const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`[BooksBuddy Server] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  console.log(`[BooksBuddy Server] Health check available at http://localhost:${env.PORT}/health`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n[BooksBuddy Server] Received ${signal}. Closing HTTP server...`);
  server.close(() => {
    console.log('[BooksBuddy Server] HTTP server closed gracefully.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
