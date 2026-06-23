import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    report: {
      create: vi.fn(),
      count: vi.fn(),
    },
    recording: {
      update: vi.fn(),
    },
  },
}));

vi.mock('../lib/notify.js', () => ({
  notifyModeration: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  report: {
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  recording: {
    update: ReturnType<typeof vi.fn>;
  };
};

describe('Reports Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('user-1', 'u');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/reports', () => {
    it('creates a report -> 201', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep1' });
      mockPrisma.report.count.mockResolvedValue(1);
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(201);
      expect(mockPrisma.recording.update).not.toHaveBeenCalled();
    });
    it('auto-hides a recording at the 3rd report', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep3' });
      mockPrisma.report.count.mockResolvedValue(3);
      mockPrisma.recording.update.mockResolvedValue({ id: 'rec1', isHidden: true });
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(201);
      expect(mockPrisma.recording.update).toHaveBeenCalledWith({ where: { id: 'rec1' }, data: { isHidden: true } });
    });
    it('rejects an invalid reason -> 400', async () => {
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'nope' });
      expect(res.status).toBe(400);
    });
    it('requires auth -> 401', async () => {
      const res = await request(app).post('/api/reports').send({ targetType: 'user', targetId: 'u1', reason: 'spam' });
      expect(res.status).toBe(401);
    });
  });
});
