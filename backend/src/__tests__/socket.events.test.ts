import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the socket.io Server and JWT before importing
const mockTo = vi.fn();
const mockEmit = vi.fn();
mockTo.mockReturnValue({ emit: mockEmit });

vi.mock('socket.io', () => {
  return {
    Server: class MockServer {
      use = vi.fn();
      on = vi.fn();
      to = mockTo;
    },
  };
});

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    room: { findUnique: vi.fn() },
    chatMessage: { create: vi.fn() },
    roomParticipant: { updateMany: vi.fn() },
  },
}));

vi.mock('../lib/livekit.js', () => ({
  listRoomListeners: vi.fn().mockResolvedValue({ count: 2, sampleIdentities: ['alice', 'bob'] }),
}));

import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import {
  initializeSocket,
  getIO,
  emitRoomUpdate,
  emitParticipantJoined,
  emitParticipantLeft,
  emitRoomStatusChanged,
  emitParticipantRoleChanged,
  emitSpeakerRequested,
  emitSpeakerRequestResolved,
  markParticipantLeftIfActive,
  emitParticipantMuted,
  emitParticipantRemoved,
  emitSpeakerUnmuteRequested,
  emitSpeakerUnmuteResolved,
  emitListenerCount,
  broadcastListenerCount,
} from '../lib/socket.js';
import { prisma } from '../lib/prisma.js';

type PacketNext = (err?: Error) => void;
type PacketGuard = (packet: unknown, next: PacketNext) => Promise<void> | void;

function handshakeMiddleware(): (
  socket: { handshake: { auth: { token?: string } }; userId?: string; username?: string },
  next: (err?: Error) => void,
) => Promise<void> {
  const use = (getIO() as unknown as { use: { mock: { calls: unknown[][] } } }).use;
  const middleware = use.mock.calls[0]?.[0];
  if (typeof middleware !== 'function') {
    throw new Error('socket handshake middleware was not registered');
  }
  return middleware as (
    socket: { handshake: { auth: { token?: string } }; userId?: string; username?: string },
    next: (err?: Error) => void,
  ) => Promise<void>;
}

function suspensionGuard(): {
  guard: PacketGuard;
  socket: { userId?: string; disconnect: ReturnType<typeof vi.fn> };
} {
  const on = (getIO() as unknown as { on: { mock: { calls: unknown[][] } } }).on;
  const connection = on.mock.calls.find((call) => call[0] === 'connection')?.[1];
  if (typeof connection !== 'function') {
    throw new Error('socket connection handler was not registered');
  }

  const packetGuards: PacketGuard[] = [];
  const socket = {
    userId: 'user-1' as string | undefined,
    username: 'ada',
    disconnect: vi.fn(),
    on: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    rooms: new Set<string>(),
    use(fn: PacketGuard) {
      packetGuards.push(fn);
    },
  };
  connection(socket);
  const guard = packetGuards[0];
  if (!guard) throw new Error('suspension guard was not registered');
  return { guard, socket };
}

describe('suspended account socket access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeSocket({} as HttpServer);
  });

  it('refuses the handshake when the account is suspended', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', username: 'ada' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      isBanned: true,
    } as never);

    const socket = { handshake: { auth: { token: 'jwt' } } };
    const next = vi.fn();
    await handshakeMiddleware()(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('Account suspended');
    expect(socket).not.toHaveProperty('userId');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, username: true, isBanned: true },
    });
  });

  it('accepts the handshake for an active account', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', username: 'stale' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      isBanned: false,
    } as never);

    const socket: { handshake: { auth: { token: string } }; userId?: string; username?: string } = {
      handshake: { auth: { token: 'jwt' } },
    };
    const next = vi.fn();
    await handshakeMiddleware()(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.userId).toBe('user-1');
    expect(socket.username).toBe('ada');
  });

  it('still rejects a missing account', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 'gone', username: 'ada' } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const next = vi.fn();
    await handshakeMiddleware()({ handshake: { auth: { token: 'jwt' } } }, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('User not found');
  });

  it('drops an open socket when a later event sees a suspension', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isBanned: true } as never);
    const { guard, socket } = suspensionGuard();
    const next = vi.fn();

    await guard(['chat:send', { roomSlug: 'room', content: 'hello' }], next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('Account suspended');
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('lets an active account through and skips the lookup while disconnecting', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isBanned: false } as never);
    const { guard, socket } = suspensionGuard();
    const next = vi.fn();

    await guard(['room:join', 'room'], next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.disconnect).not.toHaveBeenCalled();

    next.mockClear();
    vi.mocked(prisma.user.findUnique).mockClear();
    await guard(['disconnecting'], next);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('keeps the socket open when the suspension lookup fails', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('db down'));
    const { guard, socket } = suspensionGuard();
    const next = vi.fn();

    await guard(['chat:send', { content: 'hi' }], next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});

describe('Socket Event Emitters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Initialize socket.io
    const mockServer = {} as HttpServer;
    initializeSocket(mockServer);
  });

  describe('emitRoomUpdate', () => {
    it('should emit to the correct room channel', () => {
      emitRoomUpdate('test-room', {
        type: 'status_changed',
        payload: { status: 'live' },
      });

      expect(mockTo).toHaveBeenCalledWith('room:test-room');
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'status_changed',
        payload: { status: 'live' },
      });
    });

    it('should emit recording_stopped events', () => {
      emitRoomUpdate('test-room', {
        type: 'recording_stopped',
        payload: { error: 'Kayit baslatilamadi' },
      });

      expect(mockTo).toHaveBeenCalledWith('room:test-room');
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'recording_stopped',
        payload: { error: 'Kayit baslatilamadi' },
      });
    });
  });

  describe('emitParticipantJoined', () => {
    it('should emit participant_joined event with user data', () => {
      emitParticipantJoined('room-abc', {
        userId: 'user-1',
        username: 'testuser',
        role: 'speaker',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(mockTo).toHaveBeenCalledWith('room:room-abc');
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_joined',
        payload: {
          userId: 'user-1',
          username: 'testuser',
          role: 'speaker',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
    });
  });

  describe('emitParticipantLeft', () => {
    it('should emit participant_left event with userId', () => {
      emitParticipantLeft('room-abc', 'user-1');

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_left',
        payload: { userId: 'user-1' },
      });
    });
  });

  describe('emitRoomStatusChanged', () => {
    it('should emit status_changed with status', () => {
      emitRoomStatusChanged('room-abc', 'live');

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'status_changed',
        payload: { status: 'live', isRecording: undefined },
      });
    });

    it('should emit status_changed with recording flag', () => {
      emitRoomStatusChanged('room-abc', 'live', true);

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'status_changed',
        payload: { status: 'live', isRecording: true },
      });
    });

    it('should emit ended status', () => {
      emitRoomStatusChanged('room-abc', 'ended');

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'status_changed',
        payload: { status: 'ended', isRecording: undefined },
      });
    });
  });

  describe('emitParticipantRoleChanged', () => {
    it('should emit participant_role_changed event', () => {
      emitParticipantRoleChanged('room-abc', 'user-1', 'listener');

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_role_changed',
        payload: { userId: 'user-1', role: 'listener' },
      });
    });

    it('should emit role change to speaker', () => {
      emitParticipantRoleChanged('room-abc', 'user-1', 'speaker');

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_role_changed',
        payload: { userId: 'user-1', role: 'speaker' },
      });
    });
  });

  describe('speaker request events', () => {
    it('should emit speaker_requested event', () => {
      emitSpeakerRequested('room-abc', {
        userId: 'user-2',
        username: 'listener',
        avatarUrl: null,
        requestedAt: '2026-04-25T09:00:00.000Z',
      });

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'speaker_requested',
        payload: {
          userId: 'user-2',
          username: 'listener',
          avatarUrl: null,
          requestedAt: '2026-04-25T09:00:00.000Z',
        },
      });
    });

    it('should emit speaker_request_resolved event', () => {
      emitSpeakerRequestResolved('room-abc', 'user-2', false);

      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'speaker_request_resolved',
        payload: { userId: 'user-2', accepted: false },
      });
    });
  });

  describe('new moderation emitters', () => {
    it('emitParticipantMuted emits room:update participant_muted', () => {
      emitParticipantMuted('test-room', 'u1', true);
      expect(mockTo).toHaveBeenCalledWith('room:test-room');
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_muted',
        payload: { userId: 'u1', mutedByHost: true },
      });
    });

    it('emitListenerCount emits room:update listener_count', () => {
      emitListenerCount('test-room', 3, [{ userId: 'u1', username: 'a', avatarUrl: null }]);
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'listener_count',
        payload: { count: 3, sample: [{ userId: 'u1', username: 'a', avatarUrl: null }] },
      });
    });
  });

  describe('broadcastListenerCount', () => {
    it('emits listener_count with count + resolved sample', async () => {
      (prisma.user.findMany as any).mockResolvedValue([
        { username: 'alice', id: 'a', avatarUrl: null },
        { username: 'bob', id: 'b', avatarUrl: 'x' },
      ]);
      await broadcastListenerCount('test-room');
      expect(mockEmit).toHaveBeenCalledWith('room:update', expect.objectContaining({ type: 'listener_count' }));
    });
  });

  describe('markParticipantLeftIfActive', () => {
    const mockedPrisma = prisma as unknown as {
      room: { findUnique: ReturnType<typeof vi.fn> };
      roomParticipant: { updateMany: ReturnType<typeof vi.fn> };
    };

    it('marks an active participant left and emits participant_left', async () => {
      mockedPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', slug: 'my-room' });
      mockedPrisma.roomParticipant.updateMany.mockResolvedValue({ count: 1 });

      const result = await markParticipantLeftIfActive('my-room', 'user-1');

      expect(result).toBe(true);
      expect(mockTo).toHaveBeenCalledWith('room:my-room');
      expect(mockEmit).toHaveBeenCalledWith('room:update', {
        type: 'participant_left',
        payload: { userId: 'user-1' },
      });
    });

    it('does not emit when the participant was already gone (idempotent with HTTP /leave)', async () => {
      mockedPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', slug: 'my-room' });
      mockedPrisma.roomParticipant.updateMany.mockResolvedValue({ count: 0 });

      const result = await markParticipantLeftIfActive('my-room', 'user-1');

      expect(result).toBe(false);
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('returns false when the room does not exist', async () => {
      mockedPrisma.room.findUnique.mockResolvedValue(null);

      const result = await markParticipantLeftIfActive('missing', 'user-1');

      expect(result).toBe(false);
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
