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
    user: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
    chatMessage: { create: vi.fn() },
    roomParticipant: { updateMany: vi.fn() },
  },
}));

import { Server as HttpServer } from 'http';
import {
  initializeSocket,
  emitRoomUpdate,
  emitParticipantJoined,
  emitParticipantLeft,
  emitRoomStatusChanged,
  emitParticipantRoleChanged,
  emitSpeakerRequested,
  emitSpeakerRequestResolved,
  markParticipantLeftIfActive,
} from '../lib/socket.js';
import { prisma } from '../lib/prisma.js';

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
