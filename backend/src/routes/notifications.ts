import { timingSafeEqual } from 'crypto';
import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getVapidPublicKey } from '../lib/push.js';
import { logError } from '../lib/logger.js';

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_P256DH_LENGTH = 200;
const MAX_AUTH_LENGTH = 100;

function isHttpsEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isPushKey(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength && !/\s/.test(value)
  );
}

function secretEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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

    if (
      !isHttpsEndpoint(endpoint) ||
      !isPushKey(keys?.p256dh, MAX_P256DH_LENGTH) ||
      !isPushKey(keys?.auth, MAX_AUTH_LENGTH)
    ) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    const existing = await prisma.notificationSubscription.findUnique({
      where: { endpoint },
    });

    // Endpoint URLs show up in the owner's subscription list. Keys do not.
    // A different account may take the device only when it presents the same
    // keys the browser already stored — otherwise this would be a takeover.
    if (
      existing &&
      existing.userId !== req.userId &&
      (!secretEquals(existing.p256dh, keys.p256dh) || !secretEquals(existing.auth, keys.auth))
    ) {
      return res
        .status(409)
        .json({ message: 'This device is already registered to another account' });
    }

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
