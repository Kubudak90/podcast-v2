import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    room: { findUnique: vi.fn() },
    block: { findMany: vi.fn() },
    chatMessage: { findMany: vi.fn() },
  },
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  room: { findUnique: ReturnType<typeof vi.fn> };
  block: { findMany: ReturnType<typeof vi.fn> };
  chatMessage: { findMany: ReturnType<typeof vi.fn> };
};

describe('Chat Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('viewer', 'viewer');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.block.findMany.mockResolvedValue([]);
  });

  describe('GET /api/rooms/:slug/chat', () => {
    it('returns chronological messages', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1' });
      const createdAt = new Date('2026-10-05T12:00:00.000Z');
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'm1',
          userId: 'ok',
          content: 'merhaba',
          createdAt,
          user: { id: 'ok', username: 'ada', avatarUrl: null },
        },
      ]);

      const res = await request(app)
        .get('/api/rooms/oda/chat')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: 'm1',
          userId: 'ok',
          username: 'ada',
          avatarUrl: null,
          content: 'merhaba',
          createdAt: createdAt.toISOString(),
        },
      ]);
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { roomId: 'room-1' } }),
      );
    });

    it('excludes messages from blocked users in either direction', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1' });
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: 'someone', blockedId: 'viewer' },
        { blockerId: 'viewer', blockedId: 'bad-user' },
      ]);
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/rooms/oda/chat')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            roomId: 'room-1',
            userId: { notIn: expect.arrayContaining(['someone', 'bad-user']) },
          },
        }),
      );
    });

    it('returns 404 when the room does not exist', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/rooms/missing/chat')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('requires auth', async () => {
      const res = await request(app).get('/api/rooms/oda/chat');
      expect(res.status).toBe(401);
    });
  });
});
