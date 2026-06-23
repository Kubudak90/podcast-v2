import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    report: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    recording: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  report: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  recording: {
    update: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('Admin Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('admin-1', 'admin');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires auth -> 401', async () => {
    const res = await request(app).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin user -> 403', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    const res = await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });

  describe('as an admin', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: true });
    });

    it('GET /reports -> 200 with a list', async () => {
      const createdAt = new Date('2026-06-23T10:00:00.000Z');
      mockPrisma.report.findMany.mockResolvedValue([
        { id: 'rep1', targetType: 'recording', targetId: 'rec1', reason: 'spam', status: 'pending', createdAt },
      ]);
      const res = await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(res.body.reports).toHaveLength(1);
      expect(res.body.reports[0].createdAt).toBe('2026-06-23T10:00:00.000Z');
    });

    it('GET /reports?status=resolved passes the status through', async () => {
      mockPrisma.report.findMany.mockResolvedValue([]);
      const res = await request(app)
        .get('/api/admin/reports?status=resolved')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: { status: 'resolved' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('POST /reports/:id/resolve {action:hide} hides a recording target and resolves', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'rep1', targetType: 'recording', targetId: 'rec1' });
      mockPrisma.recording.update.mockResolvedValue({ id: 'rec1', isHidden: true });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep1', status: 'resolved' });
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(mockPrisma.recording.update).toHaveBeenCalledWith({ where: { id: 'rec1' }, data: { isHidden: true } });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({ where: { id: 'rep1' }, data: { status: 'resolved' } });
    });

    it('POST /reports/:id/resolve {action:hide} does NOT hide a non-recording target', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'rep2', targetType: 'user', targetId: 'u9' });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep2', status: 'resolved' });
      const res = await request(app)
        .post('/api/admin/reports/rep2/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(mockPrisma.recording.update).not.toHaveBeenCalled();
      expect(mockPrisma.report.update).toHaveBeenCalledWith({ where: { id: 'rep2' }, data: { status: 'resolved' } });
    });

    it('POST /reports/:id/resolve {action:dismiss} dismisses without hiding', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'rep1', targetType: 'recording', targetId: 'rec1' });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep1', status: 'dismissed' });
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'dismiss' });
      expect(res.status).toBe(200);
      expect(mockPrisma.recording.update).not.toHaveBeenCalled();
      expect(mockPrisma.report.update).toHaveBeenCalledWith({ where: { id: 'rep1' }, data: { status: 'dismissed' } });
    });

    it('POST /reports/:id/resolve -> 404 when the report is missing', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/admin/reports/nope/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(404);
    });

    it('POST /users/:id/ban sets isBanned true', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u9', isBanned: true });
      const res = await request(app)
        .post('/api/admin/users/u9/ban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u9' }, data: { isBanned: true } });
    });

    it('POST /users/:id/unban sets isBanned false', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u9', isBanned: false });
      const res = await request(app)
        .post('/api/admin/users/u9/unban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'u9' }, data: { isBanned: false } });
    });
  });
});
