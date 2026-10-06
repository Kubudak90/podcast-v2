import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    report: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    recording: {
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  recording: {
    updateMany: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

describe('Reports Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('user-1', 'u');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ isBanned: false });
    mockPrisma.report.findFirst.mockResolvedValue(null);
  });

  describe('POST /api/reports', () => {
    it('creates a report -> 201', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep1' });
      mockPrisma.report.findMany.mockResolvedValue([{ reporterId: 'user-1' }]);
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(201);
      expect(mockPrisma.recording.updateMany).not.toHaveBeenCalled();
    });
    it('auto-hides a recording at the 3rd distinct reporter', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep3' });
      mockPrisma.report.findMany.mockResolvedValue([
        { reporterId: 'user-1' },
        { reporterId: 'user-2' },
        { reporterId: 'user-3' },
      ]);
      mockPrisma.recording.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(201);
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: { targetType: 'recording', targetId: 'rec1', status: 'pending' },
        select: { reporterId: true },
        distinct: ['reporterId'],
      });
      expect(mockPrisma.recording.updateMany).toHaveBeenCalledWith({ where: { id: 'rec1' }, data: { isHidden: true } });
    });
    it('does not auto-hide when fewer than 3 distinct reporters', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep2' });
      mockPrisma.report.findMany.mockResolvedValue([
        { reporterId: 'user-1' },
        { reporterId: 'user-2' },
      ]);
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(201);
      expect(mockPrisma.recording.updateMany).not.toHaveBeenCalled();
    });
    it('rejects a second pending report from the same user -> 409', async () => {
      mockPrisma.report.findFirst.mockResolvedValue({ id: 'rep-existing' });
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'hate' });
      expect(res.status).toBe(409);
      expect(mockPrisma.report.create).not.toHaveBeenCalled();
      expect(mockPrisma.recording.updateMany).not.toHaveBeenCalled();
    });
    it('rejects a self-report -> 400', async () => {
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'user', targetId: 'user-1', reason: 'spam' });
      expect(res.status).toBe(400);
      expect(mockPrisma.report.create).not.toHaveBeenCalled();
    });
    it('still accepts the report when the recording row is missing', async () => {
      mockPrisma.report.create.mockResolvedValue({ id: 'rep3' });
      mockPrisma.report.findMany.mockResolvedValue([
        { reporterId: 'user-1' },
        { reporterId: 'user-2' },
        { reporterId: 'user-3' },
      ]);
      mockPrisma.recording.updateMany.mockResolvedValue({ count: 0 });
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'missing', reason: 'spam' });
      expect(res.status).toBe(201);
    });
    it('rejects a banned account -> 403', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isBanned: true });
      const res = await request(app).post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'recording', targetId: 'rec1', reason: 'spam' });
      expect(res.status).toBe(403);
      expect(mockPrisma.report.create).not.toHaveBeenCalled();
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
