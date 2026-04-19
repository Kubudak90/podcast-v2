import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    notificationSubscription: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/push.js', () => ({
  getVapidPublicKey: vi.fn(),
  notifyNewFollower: vi.fn().mockResolvedValue(1),
  notifyFollowersOfLive: vi.fn().mockResolvedValue(5),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
}));

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
  startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'mock-egress-id' }),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download'),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { getVapidPublicKey } from '../lib/push.js';

type MockedPrisma = typeof prisma & {
  notificationSubscription: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

describe('Notifications Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const mockGetVapidPublicKey = getVapidPublicKey as ReturnType<typeof vi.fn>;
  const testToken = generateToken('user-123', 'testuser');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications/vapid-key', () => {
    it('should return VAPID public key when configured', async () => {
      mockGetVapidPublicKey.mockReturnValue('test-vapid-public-key');

      const response = await request(app)
        .get('/api/notifications/vapid-key')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.publicKey).toBe('test-vapid-public-key');
    });

    it('should return 503 when VAPID not configured', async () => {
      mockGetVapidPublicKey.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/notifications/vapid-key')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Push notifications not configured');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/vapid-key');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/notifications/subscribe', () => {
    it('should subscribe to push notifications', async () => {
      mockPrisma.notificationSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-123',
        endpoint: 'https://push.example.com/abc',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      });

      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          endpoint: 'https://push.example.com/abc',
          keys: {
            p256dh: 'test-p256dh',
            auth: 'test-auth',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Subscribed to push notifications');
      expect(mockPrisma.notificationSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example.com/abc' },
        update: {
          userId: 'user-123',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
        create: {
          userId: 'user-123',
          endpoint: 'https://push.example.com/abc',
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      });
    });

    it('should return 400 for invalid subscription data', async () => {
      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          endpoint: 'https://push.example.com/abc',
          // missing keys
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid subscription data');
    });

    it('should return 400 when endpoint is missing', async () => {
      const response = await request(app)
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          keys: {
            p256dh: 'test-p256dh',
            auth: 'test-auth',
          },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/notifications/subscribe', () => {
    it('should unsubscribe from push notifications', async () => {
      mockPrisma.notificationSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          endpoint: 'https://push.example.com/abc',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Unsubscribed from push notifications');
      expect(mockPrisma.notificationSubscription.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          endpoint: 'https://push.example.com/abc',
        },
      });
    });

    it('should return 400 when endpoint is missing', async () => {
      const response = await request(app)
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Endpoint is required');
    });
  });

  describe('GET /api/notifications/subscriptions', () => {
    it('should return user subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/abc',
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'sub-2',
          endpoint: 'https://push.example.com/def',
          createdAt: new Date('2024-01-10'),
        },
      ]);

      const response = await request(app)
        .get('/api/notifications/subscriptions')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 'sub-1',
        endpoint: 'https://push.example.com/abc',
      });
    });
  });
});
