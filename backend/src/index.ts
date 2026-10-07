import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { installShutdownHandlers } from './lib/shutdown.js';
import { getIO, initializeSocket } from './lib/socket.js';
import { logger } from './lib/logger.js';

const app = createApp();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io
initializeSocket(httpServer);

// Docker stop sends SIGTERM. Drain HTTP, drop Socket.IO, then close Prisma.
// The timer is under Docker's 10s stop grace so we exit before SIGKILL.
installShutdownHandlers({
  targets: {
    closeHttp: () =>
      new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      }),
    closeSocket: () => getIO().close(),
    closeIdleConnections: () => {
      httpServer.closeIdleConnections();
    },
    closeAllConnections: () => {
      httpServer.closeAllConnections();
    },
    disconnectDb: () => prisma.$disconnect(),
  },
  log: {
    info: (obj, msg) => logger.info(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  },
  exit: (code) => {
    process.exit(code);
  },
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server running');
});
