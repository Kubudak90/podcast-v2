import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, adminGuard, AuthRequest } from '../middleware/auth.js';
import { logError } from '../lib/logger.js';

const router = Router();
router.use(authMiddleware, adminGuard);

router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const reports = await prisma.report.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
  } catch (error) {
    logError(error as Error, { action: 'admin_list_reports' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/reports/:id/resolve', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const action = req.body?.action === 'hide' ? 'hide' : 'dismiss';
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (action === 'hide' && report.targetType === 'recording') {
      await prisma.recording.update({ where: { id: report.targetId }, data: { isHidden: true } }).catch(() => {});
    }
    await prisma.report.update({ where: { id: report.id }, data: { status: action === 'hide' ? 'resolved' : 'dismissed' } });
    res.json({ message: 'Resolved' });
  } catch (error) {
    logError(error as Error, { action: 'admin_resolve_report' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/users/:id/ban', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try { await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: true } }); res.json({ message: 'Banned' }); }
  catch (error) { logError(error as Error, { action: 'admin_ban' }); res.status(500).json({ message: 'Internal server error' }); }
});
router.post('/users/:id/unban', async (req: AuthRequest<{ id: string }>, res: Response) => {
  try { await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: false } }); res.json({ message: 'Unbanned' }); }
  catch (error) { logError(error as Error, { action: 'admin_unban' }); res.status(500).json({ message: 'Internal server error' }); }
});

export default router;
