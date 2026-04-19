import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey } from '../lib/push.js';
import { logError } from '../lib/logger.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/notifications/vapid-key - Get VAPID public key
router.get('/vapid-key', (req: AuthRequest, res: Response) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ message: 'Push notifications not configured' });
  }
  res.json({ publicKey });
});

// POST /api/notifications/subscribe - Subscribe to push notifications
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    // Upsert subscription (update if endpoint exists, create if not)
    await prisma.notificationSubscription.upsert({
      where: { endpoint },
      update: {
        userId: req.userId!,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      create: {
        userId: req.userId!,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    res.json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    logError(error as Error, { action: 'subscribe_push', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/notifications/subscribe - Unsubscribe from push notifications
router.delete('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' });
    }

    await prisma.notificationSubscription.deleteMany({
      where: {
        userId: req.userId!,
        endpoint,
      },
    });

    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    logError(error as Error, { action: 'unsubscribe_push', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/notifications/subscriptions - Get user's subscriptions
router.get('/subscriptions', async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await prisma.notificationSubscription.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
      },
    });

    res.json(subscriptions);
  } catch (error) {
    logError(error as Error, { action: 'get_subscriptions', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
