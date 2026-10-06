import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { createLiveKitToken, getLiveKitUrl } from '../lib/livekit.js';
import { authMiddleware, banGuard, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getLiveKitTokenSchema } from '../lib/validation.js';
import { logError } from '../lib/logger.js';

const router = Router();

router.use(authMiddleware);

// POST /api/livekit/token - Get LiveKit token for a room
router.post(
  '/token',
  banGuard,
  validate(getLiveKitTokenSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { roomSlug } = req.body;

      // Get room and check participant
      const room = await prisma.room.findUnique({
        where: { slug: roomSlug },
      });

      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      // Check if user is a participant
      const participant = await prisma.roomParticipant.findFirst({
        where: {
          roomId: room.id,
          userId: req.userId!,
          leftAt: null,
        },
      });

      if (!participant) {
        return res.status(403).json({ message: 'You are not a participant in this room' });
      }

      // Host mute must survive token refresh. LiveKit applies the grant on the
      // new JWT, so a speaker token would otherwise turn the mic back on.
      const canPublish =
        (participant.role === 'host' || participant.role === 'speaker') && !participant.mutedByHost;

      // Create token (short-lived; client refreshes before expiry)
      const { token, expiresAt } = await createLiveKitToken(
        room.slug,
        req.user!.username,
        canPublish,
      );

      res.json({
        token,
        url: getLiveKitUrl(),
        expiresAt,
      });
    } catch (error) {
      logError(error as Error, { action: 'get_livekit_token' });
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

export default router;
