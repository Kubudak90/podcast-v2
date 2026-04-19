import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

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
    socket.on('room:join', (roomSlug: string) => {
      socket.join(`room:${roomSlug}`);
      logger.debug({ username: socket.username, roomSlug }, 'User joined room channel');
    });

    // Leave a room channel
    socket.on('room:leave', (roomSlug: string) => {
      socket.leave(`room:${roomSlug}`);
      logger.debug({ username: socket.username, roomSlug }, 'User left room channel');
    });

    // Chat message
    socket.on('chat:send', async (data: { roomSlug: string; content: string }) => {
      if (!socket.userId || !socket.username) return;
      if (!data.content || data.content.trim().length === 0) return;
      if (data.content.length > 500) return; // Max 500 chars

      try {
        // Get room
        const room = await prisma.room.findUnique({
          where: { slug: data.roomSlug },
        });

        if (!room || room.status === 'ended') return;

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
  type: 'status_changed' | 'participant_joined' | 'participant_left' | 'participant_role_changed' | 'recording_started' | 'recording_stopped';
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
