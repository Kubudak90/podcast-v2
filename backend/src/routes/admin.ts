import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, adminGuard, AuthRequest } from '../middleware/auth.js';
import { stopRoomRecording } from '../lib/livekit.js';
import { emitRoomStatusChanged } from '../lib/socket.js';
import { logError } from '../lib/logger.js';

const router = Router();
router.use(authMiddleware, adminGuard);

const REPORT_STATUSES = new Set(['pending', 'resolved', 'dismissed']);

type HideResult = 'applied' | 'missing' | 'forbidden';

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2025'
  );
}

function recordingFormat(fileUrl: string): string {
  const lower = fileUrl.toLowerCase();
  if (lower.includes('.mp3')) return 'mp3';
  if (lower.includes('.m4a')) return 'm4a';
  if (lower.includes('.aac')) return 'aac';
  return 'mp4';
}

// Hide the reported object. A missing row is not a success: the report stays open
// so the admin can dismiss it instead of closing a case that did nothing.
async function applyHide(
  report: { targetType: string; targetId: string },
  actorId: string,
): Promise<HideResult> {
  switch (report.targetType) {
    case 'recording': {
      const result = await prisma.recording.updateMany({
        where: { id: report.targetId },
        data: { isHidden: true },
      });
      return result.count > 0 ? 'applied' : 'missing';
    }
    case 'user': {
      if (report.targetId === actorId) return 'forbidden';
      const target = await prisma.user.findUnique({
        where: { id: report.targetId },
        select: { id: true, isAdmin: true },
      });
      if (!target) return 'missing';
      if (target.isAdmin) return 'forbidden';
      await prisma.user.update({ where: { id: target.id }, data: { isBanned: true } });
      return 'applied';
    }
    case 'message': {
      const result = await prisma.chatMessage.deleteMany({ where: { id: report.targetId } });
      return result.count > 0 ? 'applied' : 'missing';
    }
    case 'room': {
      const room = await prisma.room.findUnique({ where: { id: report.targetId } });
      if (!room) return 'missing';
      if (room.egressId) {
        try {
          await stopRoomRecording(room.egressId);
        } catch (error) {
          logError(error as Error, { action: 'admin_stop_recording', roomId: room.id });
        }
      }
      if (room.status === 'ended') {
        if (room.isPublic) {
          await prisma.room.update({ where: { id: room.id }, data: { isPublic: false } });
        }
        return 'applied';
      }
      const durationSeconds = room.startedAt
        ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000)
        : null;
      await prisma.$transaction(async (tx) => {
        if (room.recordingFileUrl) {
          await tx.recording.create({
            data: {
              roomId: room.id,
              ownerId: room.hostId,
              fileUrl: room.recordingFileUrl,
              durationSeconds,
              format: recordingFormat(room.recordingFileUrl),
            },
          });
        }
        await tx.room.update({
          where: { id: room.id },
          data: {
            status: 'ended',
            endedAt: new Date(),
            isPublic: false,
            egressId: null,
            recordingFileUrl: null,
          },
        });
        await tx.roomParticipant.updateMany({
          where: { roomId: room.id, leftAt: null },
          data: { leftAt: new Date() },
        });
      });
      emitRoomStatusChanged(room.slug, 'ended', false);
      return 'applied';
    }
    default:
      return 'missing';
  }
}

router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    if (!REPORT_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const reports = await prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (error) {
    logError(error as Error, { action: 'admin_list_reports' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/reports/:id/resolve', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const rawAction = req.body?.action;
    const action =
      rawAction === undefined || rawAction === 'dismiss'
        ? 'dismiss'
        : rawAction === 'hide'
          ? 'hide'
          : null;
    if (!action) return res.status(400).json({ message: 'Invalid action' });

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (action === 'hide') {
      const result = await applyHide(report, req.userId!);
      if (result === 'missing') return res.status(404).json({ message: 'Target not found' });
      if (result === 'forbidden')
        return res.status(400).json({ message: 'Cannot suspend an admin' });
      await prisma.report.update({ where: { id: report.id }, data: { status: 'resolved' } });
      await prisma.report.updateMany({
        where: { targetType: report.targetType, targetId: report.targetId, status: 'pending' },
        data: { status: 'resolved' },
      });
      return res.json({ message: 'Resolved' });
    }

    await prisma.report.update({ where: { id: report.id }, data: { status: 'dismissed' } });
    res.json({ message: 'Resolved' });
  } catch (error) {
    logError(error as Error, { action: 'admin_resolve_report' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/users/:id/ban', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: 'Cannot suspend an admin' });
    }
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, isAdmin: true },
    });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ message: 'Cannot suspend an admin' });
    await prisma.user.update({ where: { id: target.id }, data: { isBanned: true } });
    res.json({ message: 'Banned' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ message: 'User not found' });
    logError(error as Error, { action: 'admin_ban' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/users/:id/unban', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ message: 'User not found' });
    await prisma.user.update({ where: { id: target.id }, data: { isBanned: false } });
    res.json({ message: 'Unbanned' });
  } catch (error) {
    if (isNotFound(error)) return res.status(404).json({ message: 'User not found' });
    logError(error as Error, { action: 'admin_unban' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
