import { describe, it, expect, vi } from 'vitest';
import { generateToken } from '../middleware/auth.js';

// Mock Prisma to avoid database connection
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    roomParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    recording: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock LiveKit
vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
  startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'mock-egress-id' }),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download'),
}));

// Mock socket
vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
}));

describe('Auth Utilities', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken('user-123', 'testuser');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken('user-123', 'user1');
      const token2 = generateToken('user-456', 'user2');

      expect(token1).not.toBe(token2);
    });
  });
});

describe('App Integration Tests', () => {
  it('should be able to import createApp', async () => {
    const { createApp } = await import('../app.js');
    expect(createApp).toBeDefined();
    expect(typeof createApp).toBe('function');
  });
});
