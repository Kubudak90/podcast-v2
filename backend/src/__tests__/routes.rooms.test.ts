import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

// Mock modules - factories must not reference external variables
vi.mock('../lib/prisma.js', () => {
  const roomParticipantMock = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
  const recordingMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const speakerRequestMock = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };
  const roomMock = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userFollow: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      room: roomMock,
      roomParticipant: roomParticipantMock,
      recording: recordingMock,
      speakerRequest: speakerRequestMock,
      chatMessage: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      // Transaction mock that passes through to the real mock functions
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        // Create a tx object that mirrors prisma structure
        const tx = {
          room: roomMock,
          roomParticipant: roomParticipantMock,
          recording: recordingMock,
          speakerRequest: speakerRequestMock,
        };
        return callback(tx);
      }),
    },
  };
});

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
  startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'mock-egress-id', filepath: 'recordings/test.mp3', fileUrl: 'https://s3.example.com/podchat-recordings/recordings/test.mp3' }),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
  setParticipantCanPublish: vi.fn(),
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download'),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
  emitRoomUpdate: vi.fn(),
}));

// Import after mocks are defined
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { setParticipantCanPublish } from '../lib/livekit.js';

// Type helper for mocked prisma
type MockFn = ReturnType<typeof vi.fn>;
type MockedPrisma = {
  user: { findUnique: MockFn; findFirst: MockFn; create: MockFn; update: MockFn };
  userFollow: { findMany: MockFn };
  room: { findUnique: MockFn; create: MockFn; update: MockFn };
  roomParticipant: { findUnique: MockFn; findFirst: MockFn; findMany: MockFn; create: MockFn; update: MockFn; updateMany: MockFn; count: MockFn };
  speakerRequest: { findMany: MockFn; updateMany: MockFn };
  $transaction: MockFn;
};

describe('Room Routes', () => {
  const app = createApp();
  const validToken = generateToken('user-123', 'testuser');
  const mockPrisma = prisma as unknown as MockedPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/rooms', () => {
    it('should create a new public room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: true,
        password: null,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.create.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.create.mockResolvedValue({
        id: 'participant-123',
        roomId: 'room-123',
        userId: 'user-123',
        role: 'host',
      });

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Test Room' });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Room');
      expect(response.body.isPublic).toBe(true);
      expect(response.body.hasPassword).toBe(false);
    });

    it('should create a private room with password', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Private Room',
        hostId: 'user-123',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: false,
        password: 'secret123',
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.create.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.create.mockResolvedValue({
        id: 'participant-123',
        roomId: 'room-123',
        userId: 'user-123',
        role: 'host',
      });

      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Private Room',
          isPublic: false,
          password: 'secret123',
        });

      expect(response.status).toBe(201);
      expect(response.body.isPublic).toBe(false);
      expect(response.body.hasPassword).toBe(true);
    });

    it('should reject empty title', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: '' });

      expect(response.status).toBe(400);
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Test Room', password: '123' });

      expect(response.status).toBe(400);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .send({ title: 'Test Room' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/rooms/:slug', () => {
    it('should return room details', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: true,
        password: null,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      const mockHost = {
        id: 'user-123',
        username: 'testuser',
        avatarUrl: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.user.findUnique.mockResolvedValue(mockHost);
      mockPrisma.roomParticipant.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/rooms/abc12345')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.slug).toBe('abc12345');
      expect(response.body.title).toBe('Test Room');
    });

    it('should return 404 for non-existent room', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/rooms/nonexistent')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
    });

    it('should hide private room details from non-participants', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Private Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: false,
        password: 'hashed-password',
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/rooms/abc12345')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.requiresPassword).toBe(true);
    });
  });

  describe('POST /api/rooms/:slug/join', () => {
    it('should join a public room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: true,
        password: null,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.roomParticipant.count.mockResolvedValue(1);
      mockPrisma.roomParticipant.create.mockResolvedValue({
        id: 'participant-123',
        roomId: 'room-123',
        userId: 'user-123',
        role: 'speaker',
      });

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.room.slug).toBe('abc12345');
      expect(response.body.participant.role).toBe('speaker');
    });

    it('should require password for private room', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Private Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: false,
        password: hashedPassword,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.requiresPassword).toBe(true);
    });

    it('should join private room with correct password', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Private Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: false,
        password: hashedPassword,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.roomParticipant.count.mockResolvedValue(1);
      mockPrisma.roomParticipant.create.mockResolvedValue({
        id: 'participant-123',
        roomId: 'room-123',
        userId: 'user-123',
        role: 'speaker',
      });

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ password: 'secret123' });

      expect(response.status).toBe(200);
    });

    it('should reject wrong password', async () => {
      const hashedPassword = await bcrypt.hash('secret123', 10);
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Private Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: false,
        password: hashedPassword,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(403);
    });

    it('should not allow joining ended room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'host-456',
        status: 'ended',
        maxSpeakers: 10,
        isPublic: true,
        password: null,
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Room has ended');
    });

    it('should assign listener role when max speakers reached', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'host-456',
        status: 'waiting',
        maxSpeakers: 2,
        isPublic: true,
        password: null,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.roomParticipant.count.mockResolvedValue(2);
      mockPrisma.roomParticipant.create.mockResolvedValue({
        id: 'participant-123',
        roomId: 'room-123',
        userId: 'user-123',
        role: 'listener',
      });

      const response = await request(app)
        .post('/api/rooms/abc12345/join')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.participant.role).toBe('listener');
    });
  });

  describe('POST /api/rooms/:slug/leave', () => {
    it('should allow user to leave room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'host-456',
        status: 'live',
        createdAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/rooms/abc12345/leave')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Left room successfully');
    });
  });

  describe('POST /api/rooms/:slug/start', () => {
    it('should allow host to start room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'waiting',
        maxSpeakers: 10,
        isPublic: true,
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.room.update.mockResolvedValue({
        ...mockRoom,
        status: 'live',
        startedAt: new Date(),
        egressId: 'mock-egress-id',
      });

      const response = await request(app)
        .post('/api/rooms/abc12345/start')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('live');
    });

    it('should reject non-host from starting room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'other-user',
        status: 'waiting',
        createdAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/start')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the host can start the room');
    });

    it('should reject starting already live room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'live',
        createdAt: new Date(),
        startedAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/start')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Room is not in waiting state');
    });
  });

  describe('POST /api/rooms/:slug/end', () => {
    it('should allow host to end room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'live',
        maxSpeakers: 10,
        isPublic: true,
        egressId: 'mock-egress-id',
        recordingFileUrl: 'https://s3.example.com/podchat-recordings/recordings/abc12345-123456.mp3',
        createdAt: new Date(),
        startedAt: new Date(),
        endedAt: null,
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      // Mock interactive transaction for end room
      const updatedRoom = { ...mockRoom, status: 'ended', endedAt: new Date(), egressId: null };
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => {
        // Create a transaction context with the same mock functions
        const txMock = {
          recording: { create: vi.fn().mockResolvedValue({}) },
          room: { update: vi.fn().mockResolvedValue(updatedRoom) },
          roomParticipant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        };
        return await callback(txMock as unknown as typeof mockPrisma);
      });

      const response = await request(app)
        .post('/api/rooms/abc12345/end')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ended');
    });

    it('should reject non-host from ending room', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'other-user',
        status: 'live',
        createdAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const response = await request(app)
        .post('/api/rooms/abc12345/end')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the host can end the room');
    });
  });

  describe('PATCH /api/rooms/:slug/role', () => {
    it('should allow host to change user role', async () => {
      const mockRoom = {
        id: 'room-123',
        slug: 'abc12345',
        title: 'Test Room',
        hostId: 'user-123',
        status: 'live',
        createdAt: new Date(),
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.roomParticipant.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.speakerRequest.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .patch('/api/rooms/abc12345/role')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          role: 'listener',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Role updated successfully');
      expect(mockPrisma.speakerRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roomId: 'room-123',
            status: 'pending',
          }),
          data: expect.objectContaining({
            status: 'rejected',
          }),
        })
      );
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .patch('/api/rooms/abc12345/role')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          role: 'admin',
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid UUID', async () => {
      const response = await request(app)
        .patch('/api/rooms/abc12345/role')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          userId: 'not-a-uuid',
          role: 'speaker',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/rooms/:slug/speaker-requests', () => {
    it('should allow host to list pending speaker requests', async () => {
      const mockRoom = {
        id: 'room-123',
        hostId: 'user-123',
      };

      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
      mockPrisma.speakerRequest.findMany.mockResolvedValue([
        {
          user: {
            id: 'user-2',
            username: 'listener',
            avatarUrl: null,
          },
          requestedAt: new Date('2026-04-25T09:00:00.000Z'),
        },
      ]);

      const response = await request(app)
        .get('/api/rooms/abc12345/speaker-requests')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].username).toBe('listener');
    });

    it('should reject non-host from listing speaker requests', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: 'room-123',
        hostId: 'other-user',
      });

      const response = await request(app)
        .get('/api/rooms/abc12345/speaker-requests')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/rooms/:slug/role livekit propagation', () => {
    it('grants publish on promote to speaker', async () => {
      (prisma.room.findUnique as any).mockResolvedValue({ id: 'r1', slug: 'abc', hostId: 'user-123', maxSpeakers: 10 });
      (prisma.roomParticipant.count as any).mockResolvedValue(1);
      (prisma.roomParticipant.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.speakerRequest.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.user.findUnique as any).mockResolvedValue({ username: 'alice' });

      const res = await request(app)
        .patch('/api/rooms/abc/role')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ userId: '550e8400-e29b-41d4-a716-446655440001', role: 'speaker' });

      expect(res.status).toBe(200);
      expect(setParticipantCanPublish).toHaveBeenCalledWith('abc', 'alice', true);
    });
  });
});
