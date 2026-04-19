import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logError } from '../lib/logger.js';

const router = Router();

router.use(authMiddleware);

// GET /api/rooms/:slug/chat - Get chat messages for a room
router.get('/rooms/:slug/chat', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    // Reverse to chronological order (fetched desc to get latest N)
    res.json(
      messages.reverse().map((m: typeof messages[number]) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    logError(error as Error, { action: 'get_chat_messages' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
