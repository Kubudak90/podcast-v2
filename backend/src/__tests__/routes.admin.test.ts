import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/livekit.js', () => ({
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
}));

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    report: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    recording: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      deleteMany: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    roomParticipant: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import('../lib/prisma.js');
      return fn(prisma);
    }),
  },
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { stopRoomRecording } from '../lib/livekit.js';

type MockedPrisma = typeof prisma & {
  report: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  recording: {
    updateMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  chatMessage: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  room: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  roomParticipant: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

describe('Admin Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const token = generateToken('admin-1', 'admin');
  const mockStopRecording = stopRoomRecording as ReturnType<typeof vi.fn>;

  function asAdminLookingUpUsers() {
    mockPrisma.user.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      const id = args?.where?.id;
      if (id === 'admin-1') return { id, isAdmin: true };
      if (!id || id === 'missing') return null;
      return { id, isAdmin: false };
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires auth -> 401', async () => {
    const res = await request(app).get('/api/admin/reports');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin user -> 403', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isAdmin: false });
    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
  });

  describe('as an admin', () => {
    beforeEach(() => {
      asAdminLookingUpUsers();
      mockPrisma.report.updateMany.mockResolvedValue({ count: 1 });
    });

    it('GET /reports -> 200 with a list', async () => {
      const createdAt = new Date('2026-06-23T10:00:00.000Z');
      mockPrisma.report.findMany.mockResolvedValue([
        {
          id: 'rep1',
          targetType: 'recording',
          targetId: 'rec1',
          reason: 'spam',
          status: 'pending',
          createdAt,
        },
      ]);
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${token}`);
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

    it('GET /reports rejects an unknown status', async () => {
      const res = await request(app)
        .get('/api/admin/reports?status=nope')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
    });

    it('POST /reports/:id/resolve {action:hide} hides a recording and closes sibling reports', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        targetType: 'recording',
        targetId: 'rec1',
      });
      mockPrisma.recording.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep1', status: 'resolved' });
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(mockPrisma.recording.updateMany).toHaveBeenCalledWith({
        where: { id: 'rec1' },
        data: { isHidden: true },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'rep1' },
        data: { status: 'resolved' },
      });
      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
        where: { targetType: 'recording', targetId: 'rec1', status: 'pending' },
        data: { status: 'resolved' },
      });
    });

    it('POST /reports/:id/resolve {action:hide} leaves the report open when the recording is gone', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        targetType: 'recording',
        targetId: 'rec1',
      });
      mockPrisma.recording.updateMany.mockResolvedValue({ count: 0 });
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(404);
      expect(mockPrisma.report.update).not.toHaveBeenCalled();
    });

    it('POST /reports/:id/resolve {action:hide} suspends a reported user', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep2',
        targetType: 'user',
        targetId: 'u9',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u9', isBanned: true });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep2', status: 'resolved' });
      const res = await request(app)
        .post('/api/admin/reports/rep2/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u9' },
        data: { isBanned: true },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'rep2' },
        data: { status: 'resolved' },
      });
    });

    it('POST /reports/:id/resolve {action:hide} does not suspend an admin', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep2',
        targetType: 'user',
        targetId: 'admin-2',
      });
      mockPrisma.user.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
        if (args.where.id === 'admin-1') return { id: 'admin-1', isAdmin: true };
        if (args.where.id === 'admin-2') return { id: 'admin-2', isAdmin: true };
        return null;
      });
      const res = await request(app)
        .post('/api/admin/reports/rep2/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.report.update).not.toHaveBeenCalled();
    });

    it('POST /reports/:id/resolve {action:hide} deletes a reported message', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep3',
        targetType: 'message',
        targetId: 'msg1',
      });
      mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep3', status: 'resolved' });
      const res = await request(app)
        .post('/api/admin/reports/rep3/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });
      expect(res.status).toBe(200);
      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { id: 'msg1' } });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'rep3' },
        data: { status: 'resolved' },
      });
    });

    it('POST /reports/:id/resolve {action:hide} ends a live room and keeps the recording', async () => {
      const startedAt = new Date('2026-06-23T10:00:00.000Z');
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep4',
        targetType: 'room',
        targetId: 'room1',
      });
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room1',
        slug: 'abc',
        hostId: 'host-1',
        status: 'live',
        isPublic: true,
        egressId: 'eg-1',
        recordingFileUrl: 'local:///recordings/abc.mp3',
        startedAt,
      });
      mockPrisma.recording.create.mockResolvedValue({ id: 'rec-new' });
      mockPrisma.room.update.mockResolvedValue({ id: 'room1', status: 'ended' });
      mockPrisma.roomParticipant.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep4', status: 'resolved' });

      const res = await request(app)
        .post('/api/admin/reports/rep4/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'hide' });

      expect(res.status).toBe(200);
      expect(mockStopRecording).toHaveBeenCalledWith('eg-1');
      expect(mockPrisma.recording.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room1',
          ownerId: 'host-1',
          fileUrl: 'local:///recordings/abc.mp3',
          durationSeconds: expect.any(Number),
          format: 'mp3',
        },
      });
      expect(mockPrisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room1' },
        data: {
          status: 'ended',
          endedAt: expect.any(Date),
          isPublic: false,
          egressId: null,
          recordingFileUrl: null,
        },
      });
      expect(mockPrisma.roomParticipant.updateMany).toHaveBeenCalledWith({
        where: { roomId: 'room1', leftAt: null },
        data: { leftAt: expect.any(Date) },
      });
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'rep4' },
        data: { status: 'resolved' },
      });
    });

    it('POST /reports/:id/resolve {action:dismiss} dismisses without hiding', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'rep1',
        targetType: 'recording',
        targetId: 'rec1',
      });
      mockPrisma.report.update.mockResolvedValue({ id: 'rep1', status: 'dismissed' });
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'dismiss' });
      expect(res.status).toBe(200);
      expect(mockPrisma.recording.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'rep1' },
        data: { status: 'dismissed' },
      });
      expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
    });

    it('POST /reports/:id/resolve rejects an unknown action', async () => {
      const res = await request(app)
        .post('/api/admin/reports/rep1/resolve')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'destroy' });
      expect(res.status).toBe(400);
      expect(mockPrisma.report.findUnique).not.toHaveBeenCalled();
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
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u9' },
        data: { isBanned: true },
      });
    });

    it('POST /users/:id/ban refuses to suspend the acting admin', async () => {
      const res = await request(app)
        .post('/api/admin/users/admin-1/ban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('POST /users/:id/ban -> 404 when the user is missing', async () => {
      const res = await request(app)
        .post('/api/admin/users/missing/ban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('POST /users/:id/unban sets isBanned false', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u9', isBanned: false });
      const res = await request(app)
        .post('/api/admin/users/u9/unban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u9' },
        data: { isBanned: false },
      });
    });

    it('POST /users/:id/unban -> 404 when the user is missing', async () => {
      const res = await request(app)
        .post('/api/admin/users/missing/unban')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
