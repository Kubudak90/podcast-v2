import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportSchema } from '../lib/validation.js';
import { notifyModeration } from '../lib/notify.js';
import { logError } from '../lib/logger.js';

const router = Router();
const AUTO_HIDE_THRESHOLD = 3;

// POST /api/reports - report a piece of UGC or a user
router.post('/', authMiddleware, validate(reportSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason, note } = req.body;
    await prisma.report.create({
      data: { reporterId: req.userId!, targetType, targetId, reason, note: note ?? null },
    });

    if (targetType === 'recording') {
      const count = await prisma.report.count({ where: { targetType: 'recording', targetId, status: 'pending' } });
      if (count >= AUTO_HIDE_THRESHOLD) {
        await prisma.recording.update({ where: { id: targetId }, data: { isHidden: true } });
      }
    }

    notifyModeration(`Report: ${targetType} ${targetId} — ${reason}${note ? ` — ${note}` : ''}`);
    res.status(201).json({ message: 'Report received' });
  } catch (error) {
    logError(error as Error, { action: 'create_report', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
