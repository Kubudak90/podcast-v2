import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { blockSchema } from '../lib/validation.js';
import { logError } from '../lib/logger.js';

const router = Router();

router.post('/', authMiddleware, validate(blockSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { blockedId } = req.body;
    if (blockedId === req.userId) return res.status(400).json({ message: 'Cannot block yourself' });
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId!, blockedId } },
      create: { blockerId: req.userId!, blockedId },
      update: {},
    });
    res.status(201).json({ message: 'Blocked' });
  } catch (error) {
    logError(error as Error, { action: 'create_block', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:blockedId', authMiddleware, async (req: AuthRequest<{ blockedId: string }>, res: Response) => {
  try {
    await prisma.block.deleteMany({ where: { blockerId: req.userId!, blockedId: req.params.blockedId } });
    res.json({ message: 'Unblocked' });
  } catch (error) {
    logError(error as Error, { action: 'delete_block', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.block.findMany({ where: { blockerId: req.userId! }, select: { blockedId: true } });
    res.json({ blockedIds: rows.map((r) => r.blockedId) });
  } catch (error) {
    logError(error as Error, { action: 'list_blocks', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
