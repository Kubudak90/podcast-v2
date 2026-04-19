import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app.js';
import { initializeSocket } from './lib/socket.js';
import { logger } from './lib/logger.js';

const app = createApp();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io
initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server running');
});
