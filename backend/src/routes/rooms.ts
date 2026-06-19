import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { roomCreateLimiter } from '../middleware/rateLimit.js';
import { createRoomSchema, changeRoleSchema, joinRoomSchema, roomListQuerySchema } from '../lib/validation.js';
import { startRoomRecording, stopRoomRecording } from '../lib/livekit.js';
import { emitParticipantJoined, emitParticipantLeft, emitRoomStatusChanged, emitParticipantRoleChanged, emitRoomUpdate } from '../lib/socket.js';
import { logRecording, logError } from '../lib/logger.js';
import { notifyFollowersOfLive } from '../lib/push.js';

const router = Router();

// GET /api/rooms - List public rooms
router.get('/', validateQuery(roomListQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    // Build where clause
    const where: {
      isPublic: boolean;
      status: { in: string[] } | string;
      title?: { contains: string; mode: 'insensitive' };
    } = {
      isPublic: true,
      status: status && ['live', 'waiting'].includes(status)
        ? status
        : { in: ['live', 'waiting'] },
    };

    // Add search filter
    if (search && search.trim()) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    // Use _count with where clause to avoid N+1 query problem
    const [rooms, totalCount] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          host: {
            select: { id: true, username: true, avatarUrl: true },
          },
          _count: {
            select: {
              participants: {
                where: { leftAt: null }, // Only count active participants
              },
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // 'live' before 'waiting'
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.room.count({ where }),
    ]);

    // Map rooms to response format (no additional queries needed)
    const roomsWithActiveCount = rooms.map((room: typeof rooms[number]) => ({
      id: room.id,
      slug: room.slug,
      title: room.title,
      status: room.status,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      host: room.host,
      participantCount: room._count.participants,
      maxSpeakers: room.maxSpeakers,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString() || null,
    }));

    res.json({
      rooms: roomsWithActiveCount,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    logError(error as Error, { action: 'list_public_rooms' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Apply auth middleware to room actions that require a user session
router.use(authMiddleware);

// POST /api/rooms - Create room
router.post('/', roomCreateLimiter, validate(createRoomSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, isPublic = true, maxSpeakers = 10, password } = req.body;

    const slug = nanoid(8);

    const room = await prisma.room.create({
      data: {
        slug,
        title,
        hostId: req.userId!,
        isPublic,
        maxSpeakers,
        password: password ? await bcrypt.hash(password, 10) : null,
      },
    });

    // Add host as participant
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: req.userId!,
        role: 'host',
      },
    });

    res.status(201).json({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostId: room.hostId,
      status: room.status,
      maxSpeakers: room.maxSpeakers,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'create_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rooms/:slug - Get room details
router.get('/:slug', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const activeParticipant = await prisma.roomParticipant.findFirst({
      where: {
        roomId: room.id,
        userId: req.userId!,
        leftAt: null,
      },
      select: { id: true },
    });

    if ((room.password || !room.isPublic) && room.hostId !== req.userId && !activeParticipant) {
      return res.status(403).json({
        message: 'Join this room before viewing details',
        requiresPassword: !!room.password,
        hasPassword: !!room.password,
      });
    }

    const host = await prisma.user.findUnique({
      where: { id: room.hostId },
      select: { id: true, username: true, avatarUrl: true },
    });

    const participants = await prisma.roomParticipant.findMany({
      where: { roomId: room.id, leftAt: null },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostId: room.hostId,
      host,
      status: room.status,
      maxSpeakers: room.maxSpeakers,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
      participants: participants.map((p: typeof participants[number]) => ({
        id: p.id,
        roomId: p.roomId,
        roomSlug: room.slug,
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        role: p.role,
        joinedAt: p.joinedAt.toISOString(),
      })),
    });
  } catch (error) {
    logError(error as Error, { action: 'get_room' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/join - Join room
router.post('/:slug/join', validate(joinRoomSchema), async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'Room has ended' });
    }

    // Check password for private rooms (skip if host)
    if (room.password && room.hostId !== req.userId) {
      if (!password || !(await bcrypt.compare(password, room.password))) {
        return res.status(403).json({ message: 'Invalid password', requiresPassword: true });
      }
    }

    // Check if already a participant
    const existingParticipant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: req.userId!,
        },
      },
    });

    if (existingParticipant && !existingParticipant.leftAt) {
      return res.json({
        room: {
          id: room.id,
          slug: room.slug,
          title: room.title,
          hostId: room.hostId,
          status: room.status,
          maxSpeakers: room.maxSpeakers,
          isPublic: room.isPublic,
          createdAt: room.createdAt.toISOString(),
          startedAt: room.startedAt?.toISOString(),
          endedAt: room.endedAt?.toISOString(),
        },
        participant: {
          role: existingParticipant.role,
        },
      });
    }

    // Use transaction to prevent race condition when counting speakers
    const participant = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Count current speakers
      const speakerCount = await tx.roomParticipant.count({
        where: {
          roomId: room.id,
          role: { in: ['host', 'speaker'] },
          leftAt: null,
        },
      });

      // Determine role
      const role = speakerCount < room.maxSpeakers ? 'speaker' : 'listener';

      // Create or update participant
      if (existingParticipant) {
        return tx.roomParticipant.update({
          where: { id: existingParticipant.id },
          data: { leftAt: null, role },
        });
      } else {
        return tx.roomParticipant.create({
          data: {
            roomId: room.id,
            userId: req.userId!,
            role,
          },
        });
      }
    });

    // Emit socket event for new participant
    emitParticipantJoined(room.slug, {
      userId: req.userId!,
      username: req.user!.username,
      role: participant.role,
      avatarUrl: req.user!.avatarUrl,
    });

    res.json({
      room: {
        id: room.id,
        slug: room.slug,
        title: room.title,
        hostId: room.hostId,
        status: room.status,
        maxSpeakers: room.maxSpeakers,
        isPublic: room.isPublic,
        createdAt: room.createdAt.toISOString(),
        startedAt: room.startedAt?.toISOString(),
        endedAt: room.endedAt?.toISOString(),
      },
      participant: {
        role: participant.role,
      },
    });
  } catch (error) {
    logError(error as Error, { action: 'join_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/leave - Leave room
router.post('/:slug/leave', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    await prisma.roomParticipant.updateMany({
      where: {
        roomId: room.id,
        userId: req.userId!,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Emit socket event for participant leaving
    emitParticipantLeft(room.slug, req.userId!);

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    logError(error as Error, { action: 'leave_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/start - Start room (host only)
router.post('/:slug/start', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can start the room' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ message: 'Room is not in waiting state' });
    }

    // Create timestamp for consistent filepath
    const startedAt = new Date();
    const timestamp = startedAt.getTime();

    // Start recording via LiveKit Egress (uploads directly to S3)
    let egressId: string | null = null;
    let recordingFileUrl: string | null = null;
    try {
      const result = await startRoomRecording(room.slug, timestamp);
      egressId = result.egressId;
      recordingFileUrl = result.fileUrl;
      logRecording('start', room.slug, egressId);
    } catch (egressError) {
      logRecording('error', room.slug, undefined, (egressError as Error).message);
      // Notify users that recording failed
      emitRoomUpdate(room.slug, {
        type: 'recording_stopped',
        payload: { error: 'Kayit baslatilamadi' },
      });
      // Continue without recording - don't block the room start
    }

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        status: 'live',
        startedAt,
        egressId,
        recordingFileUrl,
      },
    });

    // Emit socket event for room status change
    emitRoomStatusChanged(room.slug, 'live', !!egressId);

    // Notify followers that host is live (fire and forget)
    notifyFollowersOfLive(req.userId!, req.user!.username, room.title, room.slug).catch((error) => {
      logError(error as Error, { action: 'notify_followers_live', userId: req.userId, roomSlug: room.slug });
    });

    res.json({
      id: updatedRoom.id,
      slug: updatedRoom.slug,
      title: updatedRoom.title,
      hostId: updatedRoom.hostId,
      status: updatedRoom.status,
      maxSpeakers: updatedRoom.maxSpeakers,
      isPublic: updatedRoom.isPublic,
      isRecording: !!egressId,
      createdAt: updatedRoom.createdAt.toISOString(),
      startedAt: updatedRoom.startedAt?.toISOString(),
      endedAt: updatedRoom.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'start_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/end - End room (host only)
router.post('/:slug/end', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can end the room' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'Room has already ended' });
    }

    // Stop recording if active and prepare recording data
    let recordingData: { roomId: string; fileUrl: string; durationSeconds: number | null; format: string } | null = null;
    if (room.egressId) {
      try {
        await stopRoomRecording(room.egressId);
        logRecording('stop', room.slug, room.egressId);

        // Calculate duration
        const durationSeconds = room.startedAt
          ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000)
          : null;

        // Use the S3 URL stored at recording start time
        if (room.recordingFileUrl) {
          recordingData = {
            roomId: room.id,
            fileUrl: room.recordingFileUrl,
            durationSeconds,
            // Room composite egress writes an MP4 container (see startRoomRecording).
            format: 'mp4',
          };
        }
      } catch (egressError) {
        logRecording('error', room.slug, room.egressId, (egressError as Error).message);
        emitRoomUpdate(room.slug, {
          type: 'recording_stopped',
          payload: { error: 'Failed to stop recording' },
        });
        // Continue ending the room even if recording stop fails
      }
    }

    // End room, mark all participants as left, and create recording - all in a transaction
    const updatedRoom = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create recording entry if we have recording data
      if (recordingData) {
        await tx.recording.create({
          data: recordingData,
        });
      }

      // Update room status
      const updated = await tx.room.update({
        where: { id: room.id },
        data: {
          status: 'ended',
          endedAt: new Date(),
          egressId: null,
          recordingFileUrl: null,
        },
      });

      // Mark all participants as left
      await tx.roomParticipant.updateMany({
        where: {
          roomId: room.id,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      });

      return updated;
    });

    // Emit socket event for room ended
    emitRoomStatusChanged(room.slug, 'ended');

    res.json({
      id: updatedRoom.id,
      slug: updatedRoom.slug,
      title: updatedRoom.title,
      hostId: updatedRoom.hostId,
      status: updatedRoom.status,
      maxSpeakers: updatedRoom.maxSpeakers,
      isPublic: updatedRoom.isPublic,
      createdAt: updatedRoom.createdAt.toISOString(),
      startedAt: updatedRoom.startedAt?.toISOString(),
      endedAt: updatedRoom.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'end_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rooms/:slug/speaker-requests - Pending speaker requests (host only)
router.get('/:slug/speaker-requests', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
      select: { id: true, hostId: true },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can view speaker requests' });
    }

    const requests = await prisma.speakerRequest.findMany({
      where: {
        roomId: room.id,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });

    res.json({
      requests: requests.map((request) => ({
        userId: request.user.id,
        username: request.user.username,
        avatarUrl: request.user.avatarUrl,
        requestedAt: request.requestedAt.toISOString(),
      })),
    });
  } catch (error) {
    logError(error as Error, { action: 'list_speaker_requests', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/rooms/:slug/role - Change role
router.patch('/:slug/role', validate(changeRoleSchema), async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;
    const { userId, role } = req.body;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can change roles' });
    }

    if (role === 'speaker') {
      const speakerCount = await prisma.roomParticipant.count({
        where: {
          roomId: room.id,
          role: { in: ['host', 'speaker'] },
          leftAt: null,
          userId: { not: userId },
        },
      });

      if (speakerCount >= room.maxSpeakers) {
        return res.status(400).json({ message: 'Maximum speaker count reached' });
      }
    }

    const result = await prisma.roomParticipant.updateMany({
      where: {
        roomId: room.id,
        userId,
        leftAt: null,
      },
      data: { role },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: 'Active participant not found' });
    }

    await prisma.speakerRequest.updateMany({
      where: {
        roomId: room.id,
        userId,
        status: 'pending',
      },
      data: {
        status: role === 'speaker' ? 'accepted' : 'rejected',
        resolvedAt: new Date(),
      },
    });

    // Emit socket event for role change
    emitParticipantRoleChanged(room.slug, userId as string, role as string);

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    logError(error as Error, { action: 'change_role', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rooms/:slug/recordings - Get recordings for a room (host or participant only)
router.get('/:slug/recordings', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const participant = await prisma.roomParticipant.findFirst({
      where: {
        roomId: room.id,
        userId: req.userId!,
      },
    });

    if (room.hostId !== req.userId && !participant) {
      return res.status(403).json({ message: 'You do not have permission to view these recordings' });
    }

    const recordings = await prisma.recording.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      recordings.map((r: typeof recordings[number]) => ({
        id: r.id,
        roomId: r.roomId,
        fileUrl: r.fileUrl,
        durationSeconds: r.durationSeconds || 0,
        fileSizeBytes: Number(r.fileSizeBytes) || 0,
        format: r.format,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    logError(error as Error, { action: 'get_recordings', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
