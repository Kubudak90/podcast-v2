import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    block: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  block: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

describe('Blocks Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('user-1', 'u');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/blocks', () => {
    it('blocks another user -> 201 and upserts', async () => {
      mockPrisma.block.upsert.mockResolvedValue({ blockerId: 'user-1', blockedId: 'user-2' });
      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${token}`)
        .send({ blockedId: 'user-2' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Blocked');
      expect(mockPrisma.block.upsert).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 'user-1', blockedId: 'user-2' } },
        create: { blockerId: 'user-1', blockedId: 'user-2' },
        update: {},
      });
    });

    it('rejects blocking yourself -> 400', async () => {
      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${token}`)
        .send({ blockedId: 'user-1' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cannot block yourself');
      expect(mockPrisma.block.upsert).not.toHaveBeenCalled();
    });

    it('rejects a missing blockedId -> 400', async () => {
      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('requires auth -> 401', async () => {
      const res = await request(app).post('/api/blocks').send({ blockedId: 'user-2' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/blocks/:blockedId', () => {
    it('unblocks a user -> 200', async () => {
      mockPrisma.block.deleteMany.mockResolvedValue({ count: 1 });
      const res = await request(app)
        .delete('/api/blocks/user-2')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Unblocked');
      expect(mockPrisma.block.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
    });
  });

  describe('GET /api/blocks', () => {
    it('lists the blocked ids -> { blockedIds }', async () => {
      mockPrisma.block.findMany.mockResolvedValue([{ blockedId: 'user-2' }, { blockedId: 'user-3' }]);
      const res = await request(app)
        .get('/api/blocks')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ blockedIds: ['user-2', 'user-3'] });
      expect(mockPrisma.block.findMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-1' },
        select: { blockedId: true },
      });
    });
  });
});
