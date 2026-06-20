import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import { listRoomListeners } from './livekit.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

let io: Server | null = null;

async function findActiveParticipant(roomSlug: string, userId: string) {
  const room = await prisma.room.findUnique({
    where: { slug: roomSlug },
    select: {
      id: true,
      slug: true,
      status: true,
      participants: {
        where: { userId, leftAt: null },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  });

  return { room, participant: room?.participants[0] };
}

// --- Presence tracking ---------------------------------------------------
// A participant may hold several sockets (multiple tabs/devices) and brief
// network blips trigger reconnects. We only mark someone "left" once their
// LAST socket has been gone for a short grace period — so transient drops and
// multi-tab use don't deflate participant counts, and we don't fight the
// reconnect flow (room:join requires an active participant row, leftAt = null).
const DISCONNECT_GRACE_MS = 30_000;
const roomPresence = new Map<string, Set<string>>(); // `${slug}::${userId}` -> socket ids
const pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>();

function presenceKey(roomSlug: string, userId: string): string {
  return `${roomSlug}::${userId}`;
}

function addPresence(roomSlug: string, userId: string, socketId: string): void {
  const key = presenceKey(roomSlug, userId);
  const sockets = roomPresence.get(key) ?? new Set<string>();
  sockets.add(socketId);
  roomPresence.set(key, sockets);

  // The user is (back) in the room — cancel any pending leave.
  const pending = pendingLeaves.get(key);
  if (pending) {
    clearTimeout(pending);
    pendingLeaves.delete(key);
  }
}

/** Removes a socket from presence; returns true if it was the user's last one. */
function removePresence(roomSlug: string, userId: string, socketId: string): boolean {
  const key = presenceKey(roomSlug, userId);
  const sockets = roomPresence.get(key);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    roomPresence.delete(key);
    return true;
  }
  return false;
}

function scheduleParticipantLeave(roomSlug: string, userId: string): void {
  const key = presenceKey(roomSlug, userId);
  if (pendingLeaves.has(key)) return;

  const timer = setTimeout(() => {
    pendingLeaves.delete(key);
    // Reconnected (or another socket present) during the grace window — keep them.
    if (roomPresence.has(key)) return;
    void markParticipantLeftIfActive(roomSlug, userId);
  }, DISCONNECT_GRACE_MS);

  // A pending cleanup shouldn't keep the process alive on shutdown.
  if (typeof timer.unref === 'function') timer.unref();
  pendingLeaves.set(key, timer);
}

/**
 * Marks a participant as left and emits `participant_left`, but only if their
 * row was still active. The `leftAt: null` guard makes this idempotent with the
 * HTTP `/leave` endpoint, so we never double-emit.
 */
export async function markParticipantLeftIfActive(roomSlug: string, userId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({
    where: { slug: roomSlug },
    select: { id: true, slug: true },
  });
  if (!room) return false;

  const result = await prisma.roomParticipant.updateMany({
    where: { roomId: room.id, userId, leftAt: null },
    data: { leftAt: new Date() },
  });

  if (result.count > 0) {
    emitParticipantLeft(room.slug, userId);
    return true;
  }
  return false;
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };

      // Verify user still exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.debug({ userId: socket.userId, username: socket.username }, 'User connected via socket');

    // Join a room channel
    socket.on('room:join', async (roomSlug: string) => {
      if (!socket.userId || typeof roomSlug !== 'string' || !roomSlug) return;

      try {
        const { room, participant } = await findActiveParticipant(roomSlug, socket.userId);
        if (!room || room.status === 'ended' || !participant) return;

        socket.join(`room:${roomSlug}`);
        addPresence(roomSlug, socket.userId, socket.id);
        void broadcastListenerCount(roomSlug);
        logger.debug({ username: socket.username, roomSlug }, 'User joined room channel');
      } catch (error) {
        logger.error({ error, userId: socket.userId, roomSlug }, 'Failed to join room channel');
      }
    });

    // Leave a room channel
    socket.on('room:leave', (roomSlug: string) => {
      socket.leave(`room:${roomSlug}`);
      if (socket.userId) {
        // Explicit leave; the HTTP /leave endpoint owns marking leftAt.
        removePresence(roomSlug, socket.userId, socket.id);
        void broadcastListenerCount(roomSlug);
      }
      logger.debug({ username: socket.username, roomSlug }, 'User left room channel');
    });

    // Chat message
    socket.on('chat:send', async (data: { roomSlug: string; content: string }) => {
      if (!socket.userId || !socket.username) return;
      if (!data.content || data.content.trim().length === 0) return;
      if (data.content.length > 500) return; // Max 500 chars

      try {
        const { room, participant } = await findActiveParticipant(data.roomSlug, socket.userId);

        if (!room || room.status === 'ended' || !participant) return;

        // Save message to database
        const message = await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            userId: socket.userId,
            content: data.content.trim(),
          },
        });

        // Broadcast to room
        io?.to(`room:${data.roomSlug}`).emit('chat:message', {
          id: message.id,
          userId: socket.userId,
          username: socket.username,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        });

        logger.debug({ username: socket.username, roomSlug: data.roomSlug }, 'Chat message sent');
      } catch (error) {
        logger.error({ error, userId: socket.userId }, 'Failed to send chat message');
      }
    });

    socket.on('speaker:request', async (data: { roomSlug: string }) => {
      if (!socket.userId || !socket.username || !data.roomSlug) return;

      try {
        const { room, participant } = await findActiveParticipant(data.roomSlug, socket.userId);

        if (!room || room.status === 'ended' || !participant || participant.role !== 'listener') return;

        await prisma.speakerRequest.upsert({
          where: {
            roomId_userId: {
              roomId: room.id,
              userId: socket.userId,
            },
          },
          update: {
            status: 'pending',
            requestedAt: new Date(),
            resolvedAt: null,
          },
          create: {
            roomId: room.id,
            userId: socket.userId,
          },
        });

        emitSpeakerRequested(room.slug, {
          userId: socket.userId,
          username: participant.user.username,
          avatarUrl: participant.user.avatarUrl,
          requestedAt: new Date().toISOString(),
        });

        logger.debug({ username: socket.username, roomSlug: data.roomSlug }, 'Speaker request sent');
      } catch (error) {
        logger.error({ error, userId: socket.userId }, 'Failed to send speaker request');
      }
    });

    socket.on('speaker:reject', async (data: { roomSlug: string; userId: string }) => {
      if (!socket.userId || !data.roomSlug || !data.userId) return;

      try {
        const room = await prisma.room.findUnique({
          where: { slug: data.roomSlug },
          select: { id: true, hostId: true, slug: true, status: true },
        });

        if (!room || room.status === 'ended' || room.hostId !== socket.userId) return;

        await prisma.speakerRequest.updateMany({
          where: {
            roomId: room.id,
            userId: data.userId,
            status: 'pending',
          },
          data: {
            status: 'rejected',
            resolvedAt: new Date(),
          },
        });

        emitSpeakerRequestResolved(room.slug, data.userId, false);

        logger.debug({ username: socket.username, roomSlug: data.roomSlug, targetUserId: data.userId }, 'Speaker request rejected');
      } catch (error) {
        logger.error({ error, userId: socket.userId }, 'Failed to reject speaker request');
      }
    });

    socket.on('speaker:unmute_request', async (data: { roomSlug: string }) => {
      if (!socket.userId || !socket.username || !data?.roomSlug) return;
      try {
        const { room, participant } = await findActiveParticipant(data.roomSlug, socket.userId);
        if (!room || room.status === 'ended' || !participant || participant.role === 'listener') return;
        emitSpeakerUnmuteRequested(room.slug, {
          userId: socket.userId,
          username: participant.user.username,
          avatarUrl: participant.user.avatarUrl,
          requestedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error, userId: socket.userId }, 'Failed to send unmute request');
      }
    });

    // `disconnecting` fires while socket.rooms is still populated, so we can see
    // which room channels this socket belonged to. If it was the user's last
    // socket in a room, schedule a grace-period leave (cancelled on reconnect).
    socket.on('disconnecting', () => {
      if (!socket.userId) return;
      const userId = socket.userId;
      for (const channel of socket.rooms) {
        if (!channel.startsWith('room:')) continue;
        const roomSlug = channel.slice('room:'.length);
        if (removePresence(roomSlug, userId, socket.id)) {
          scheduleParticipantLeave(roomSlug, userId);
          void broadcastListenerCount(roomSlug);
        }
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ username: socket.username }, 'User disconnected from socket');
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Event emitters for room updates
export function emitRoomUpdate(roomSlug: string, data: {
  type:
    | 'status_changed'
    | 'participant_joined'
    | 'participant_left'
    | 'participant_role_changed'
    | 'participant_muted'
    | 'participant_removed'
    | 'recording_started'
    | 'recording_stopped'
    | 'speaker_requested'
    | 'speaker_request_resolved'
    | 'speaker_unmute_requested'
    | 'speaker_unmute_resolved'
    | 'listener_count';
  payload: Record<string, unknown>;
}) {
  if (!io) return;
  io.to(`room:${roomSlug}`).emit('room:update', data);
}

export function emitParticipantJoined(roomSlug: string, participant: {
  userId: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
}) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_joined',
    payload: participant,
  });
}

export function emitParticipantLeft(roomSlug: string, userId: string) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_left',
    payload: { userId },
  });
}

export function emitRoomStatusChanged(roomSlug: string, status: string, isRecording?: boolean) {
  emitRoomUpdate(roomSlug, {
    type: 'status_changed',
    payload: { status, isRecording },
  });
}

export function emitParticipantRoleChanged(roomSlug: string, userId: string, role: string) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_role_changed',
    payload: { userId, role },
  });
}

export function emitSpeakerRequested(roomSlug: string, request: {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  requestedAt: string;
}) {
  emitRoomUpdate(roomSlug, {
    type: 'speaker_requested',
    payload: request,
  });
}

export function emitSpeakerRequestResolved(roomSlug: string, userId: string, accepted: boolean) {
  emitRoomUpdate(roomSlug, {
    type: 'speaker_request_resolved',
    payload: { userId, accepted },
  });
}

export function emitParticipantMuted(roomSlug: string, userId: string, mutedByHost: boolean) {
  emitRoomUpdate(roomSlug, { type: 'participant_muted', payload: { userId, mutedByHost } });
}

export function emitParticipantRemoved(roomSlug: string, userId: string) {
  emitRoomUpdate(roomSlug, { type: 'participant_removed', payload: { userId } });
}

export function emitSpeakerUnmuteRequested(roomSlug: string, request: {
  userId: string; username: string; avatarUrl?: string | null; requestedAt: string;
}) {
  emitRoomUpdate(roomSlug, { type: 'speaker_unmute_requested', payload: request });
}

export function emitSpeakerUnmuteResolved(roomSlug: string, userId: string) {
  emitRoomUpdate(roomSlug, { type: 'speaker_unmute_resolved', payload: { userId } });
}

export function emitListenerCount(roomSlug: string, count: number, sample: {
  userId: string; username: string; avatarUrl?: string | null;
}[]) {
  emitRoomUpdate(roomSlug, { type: 'listener_count', payload: { count, sample } });
}

export async function broadcastListenerCount(roomSlug: string): Promise<void> {
  try {
    const { count, sampleIdentities } = await listRoomListeners(roomSlug);
    const users = sampleIdentities.length
      ? await prisma.user.findMany({
          where: { username: { in: sampleIdentities } },
          select: { id: true, username: true, avatarUrl: true },
        })
      : [];
    const sample = users.map((u) => ({ userId: u.id, username: u.username, avatarUrl: u.avatarUrl }));
    emitListenerCount(roomSlug, count, sample);
  } catch (error) {
    logger.error({ error, roomSlug }, 'Failed to broadcast listener count');
  }
}
