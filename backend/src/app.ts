import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import recordingsRoutes from './routes/recordings.js';
import livekitRoutes from './routes/livekit.js';
import chatRoutes from './routes/chat.js';
import usersRoutes from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import blocksRoutes from './routes/blocks.js';
import adminRoutes from './routes/admin.js';
import legalRoutes from './routes/legal.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { logError } from './lib/logger.js';

export function createApp() {
  const app = express();

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Security headers (helmet) — applied before CORS so OPTIONS responses also carry them
  app.use(
    helmet({
      // The frontend is served separately (Vite dev / nginx in prod), so the API
      // doesn't render HTML. Disable CSP here and let the frontend host control it.
      contentSecurityPolicy: false,
      // Allow cross-origin embedding of recordings (presigned URLs / audio elements)
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // HSTS only meaningful over HTTPS — let proxy/CDN normally inject it,
      // but enable here for direct deploys.
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 15552000, includeSubDomains: true, preload: false }
        : false,
    })
  );

  // Middleware
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.disable('x-powered-by');

  // Apply rate limiting to all API routes (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', apiLimiter);
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/rooms', roomsRoutes);
  app.use('/api/recordings', recordingsRoutes);
  // Legal pages are public — mount before the catch-all chatRoutes (which applies
  // authMiddleware to the whole /api mount) so /api/legal/* stays unauthenticated.
  app.use('/api/legal', legalRoutes);
  // Per-room recordings (/api/rooms/:slug/recordings) is served by roomsRoutes.
  app.use('/api', chatRoutes); // For /api/rooms/:slug/chat path
  app.use('/api/livekit', livekitRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/blocks', blocksRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logError(err, { path: req.path, method: req.method });
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}
