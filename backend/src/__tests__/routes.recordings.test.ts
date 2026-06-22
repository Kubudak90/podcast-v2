import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    recording: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    roomParticipant: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download/file.mp3'),
  isLocalRecordingUrl: vi.fn().mockReturnValue(false),
  getLocalRecordingPath: vi.fn().mockReturnValue('/tmp/recordings/file.mp4'),
  createLocalRecordingAccessUrl: vi.fn().mockReturnValue('http://localhost:3001/api/local-recordings/file.mp4?token=test'),
  verifyLocalRecordingAccessToken: vi.fn().mockReturnValue({ recordingId: 'rec-1', disposition: 'attachment' }),
  uploadFile: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  isS3Configured: vi.fn().mockReturnValue(false),
  uploadImage: vi.fn().mockResolvedValue('local:///recordings/covers/rec-1-newkey.jpg'),
  deleteStoredFile: vi.fn().mockResolvedValue(undefined),
  buildCoverImageUrl: vi.fn((id: string, key: string | null) => (key ? `https://livepodchat.com/api/recordings/${id}/cover?v=abc123abc123` : null)),
  audioExtForMime: vi.fn((m: string) => (({ 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac' } as Record<string, string>)[m] ?? null)),
  UPLOADS_DIR: '/tmp/podchat-b3-test-uploads',
  storeUploadedAudio: vi.fn().mockResolvedValue('local:///tmp/podchat-b3-test-uploads/abc.mp3'),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
}));

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
  startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'mock-egress-id' }),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/push.js', () => ({
  getVapidPublicKey: vi.fn().mockReturnValue('mock-vapid-key'),
  notifyNewFollower: vi.fn().mockResolvedValue(1),
  notifyFollowersOfLive: vi.fn().mockResolvedValue(5),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abc123xyz0'),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  room: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  recording: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  roomParticipant: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

describe('Recordings Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const testToken = generateToken('user-123', 'testuser');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/rooms/:slug/recordings', () => {
    it('should return recordings for a room participant', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', slug: 'my-room', hostId: 'someone-else' });
      mockPrisma.roomParticipant.findFirst.mockResolvedValue({ id: 'p-1', userId: 'user-123' });
      mockPrisma.recording.findMany.mockResolvedValue([
        { id: 'rec-1', roomId: 'room-1', fileUrl: 'local://rec.mp4', durationSeconds: 120, fileSizeBytes: 4096, format: 'mp4', createdAt: new Date('2024-01-15') },
      ]);

      const response = await request(app)
        .get('/api/rooms/my-room/recordings')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ id: 'rec-1', format: 'mp4', durationSeconds: 120 });
    });

    it('should 403 for a non-participant, non-host', async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', slug: 'my-room', hostId: 'someone-else' });
      mockPrisma.roomParticipant.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/rooms/my-room/recordings')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(403);
    });

    it('should 404 when the room does not exist', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/rooms/missing/recordings')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/recordings/:id', () => {
    it('should update recording title and description', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        title: null,
        description: null,
        isPublic: false,
        shareSlug: null,
        ownerId: 'user-123',
      });
      mockPrisma.recording.update.mockResolvedValue({
        id: 'rec-1',
        title: 'New Title',
        description: 'New Description',
        isPublic: false,
        shareSlug: null,
        durationSeconds: 300,
        createdAt: new Date('2024-01-15'),
        coverImageKey: 'local:///recordings/covers/rec-1.jpg',
      });

      const response = await request(app)
        .patch('/api/recordings/rec-1')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: 'New Title',
          description: 'New Description',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');
      expect(response.body.description).toBe('New Description');
      expect(response.body.coverImageUrl).toContain('/api/recordings/rec-1/cover');
    });

    it('should generate share slug when making public', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        title: 'Test',
        isPublic: false,
        shareSlug: null,
        ownerId: 'user-123',
      });
      mockPrisma.recording.update.mockResolvedValue({
        id: 'rec-1',
        title: 'Test',
        isPublic: true,
        shareSlug: 'abc123xyz0',
        durationSeconds: 300,
        createdAt: new Date('2024-01-15'),
      });

      const response = await request(app)
        .patch('/api/recordings/rec-1')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ isPublic: true });

      expect(response.status).toBe(200);
      expect(response.body.isPublic).toBe(true);
      expect(response.body.shareSlug).toBe('abc123xyz0');
    });

    it('should return 403 if not owner', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        ownerId: 'other-user',
      });

      const response = await request(app)
        .patch('/api/recordings/rec-1')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only the owner can update this recording');
    });

    it('returns 403 when requester is not the owner', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', ownerId: 'someone-else', shareSlug: null, isPublic: false });
      const response = await request(app).patch('/api/recordings/rec-1')
        .set('Authorization', `Bearer ${testToken}`).send({ title: 'X' });
      expect(response.status).toBe(403);
    });

    it('should return 404 if recording not found', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/recordings/nonexistent')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/recordings/public/:shareSlug', () => {
    it('should return public recording by share slug', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        title: 'Public Recording',
        description: 'A public recording',
        isPublic: true,
        shareSlug: 'abc123xyz0',
        durationSeconds: 600,
        playCount: 10,
        createdAt: new Date('2024-01-15'),
        coverImageKey: 'local:///recordings/covers/rec-1.jpg',
        room: {
          id: 'room-1',
          slug: 'test-room',
          title: 'Test Room',
          host: {
            id: 'user-456',
            username: 'hostuser',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        },
      });
      mockPrisma.recording.update.mockResolvedValue({});

      const response = await request(app)
        .get('/api/recordings/public/abc123xyz0');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'rec-1',
        title: 'Public Recording',
        playCount: 11, // Incremented
        host: {
          username: 'hostuser',
        },
      });
      expect(response.body.coverImageUrl).toContain('/api/recordings/rec-1/cover');
      expect(mockPrisma.recording.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { playCount: { increment: 1 } },
      });
    });

    it('should return 404 for non-public recording', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        isPublic: false,
        shareSlug: 'abc123xyz0',
      });

      const response = await request(app)
        .get('/api/recordings/public/abc123xyz0');

      expect(response.status).toBe(404);
    });

    it('should return 404 for nonexistent share slug', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/recordings/public/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/recordings/public/:shareSlug/download', () => {
    it('should return download URL for public recording', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        isPublic: true,
        shareSlug: 'abc123xyz0',
        fileUrl: 'https://storage.example.com/recordings/file.mp3',
      });

      const response = await request(app)
        .get('/api/recordings/public/abc123xyz0/download');

      expect(response.status).toBe(200);
      expect(response.body.url).toBe('https://example.com/download/file.mp3');
    });

    it('should return 404 for non-public recording', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-1',
        isPublic: false,
        shareSlug: 'abc123xyz0',
      });

      const response = await request(app)
        .get('/api/recordings/public/abc123xyz0/download');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/recordings/feed', () => {
    it('should return public recordings feed', async () => {
      mockPrisma.recording.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          title: 'Recording 1',
          description: 'Desc 1',
          shareSlug: 'slug1',
          durationSeconds: 300,
          playCount: 10,
          createdAt: new Date('2024-01-15'),
          coverImageKey: 'local:///recordings/covers/rec-1.jpg',
          room: {
            id: 'room-1',
            slug: 'room-slug-1',
            title: 'Room 1',
            host: {
              id: 'user-1',
              username: 'host1',
              avatarUrl: null,
            },
          },
        },
        {
          id: 'rec-2',
          title: null,
          description: null,
          shareSlug: 'slug2',
          durationSeconds: 600,
          playCount: 5,
          createdAt: new Date('2024-01-10'),
          room: {
            id: 'room-2',
            slug: 'room-slug-2',
            title: 'Room 2',
            host: {
              id: 'user-2',
              username: 'host2',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
        },
      ]);
      mockPrisma.recording.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/recordings/feed');

      expect(response.status).toBe(200);
      expect(response.body.recordings).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.recordings[0]).toMatchObject({
        id: 'rec-1',
        title: 'Recording 1',
        shareSlug: 'slug1',
      });
      // Recording without title should use room title
      expect(response.body.recordings[1].title).toBe('Room 2');
      // Cover URL is derived from coverImageKey; null key -> null
      expect(response.body.recordings[0].coverImageUrl).toContain('/api/recordings/rec-1/cover');
      expect(response.body.recordings[1].coverImageUrl).toBeNull();
    });

    it('serializes a room-less (uploaded) recording, deriving host from the owner', async () => {
      mockPrisma.recording.findMany.mockResolvedValue([
        {
          id: 'rec-up', title: 'Uploaded Pod', description: null, shareSlug: 'up1',
          durationSeconds: 100, playCount: 0, createdAt: new Date('2024-02-02'),
          coverImageKey: null, room: null,
          owner: { id: 'user-9', username: 'uploader', avatarUrl: null },
        },
      ]);
      mockPrisma.recording.count.mockResolvedValue(1);

      const res = await request(app).get('/api/recordings/feed');

      expect(res.status).toBe(200);
      expect(res.body.recordings[0].title).toBe('Uploaded Pod');
      expect(res.body.recordings[0].room).toBeNull();
      expect(res.body.recordings[0].host).toMatchObject({ id: 'user-9', username: 'uploader' });
    });

    it('should support pagination', async () => {
      mockPrisma.recording.findMany.mockResolvedValue([]);
      mockPrisma.recording.count.mockResolvedValue(50);

      const response = await request(app)
        .get('/api/recordings/feed?limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(20);
      expect(mockPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('should cap limit at 50', async () => {
      mockPrisma.recording.findMany.mockResolvedValue([]);
      mockPrisma.recording.count.mockResolvedValue(0);

      await request(app)
        .get('/api/recordings/feed?limit=100');

      expect(mockPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('cover image endpoints', () => {
    const OWNER = 'user-123'; // matches testToken's userId
    const ownerToken = generateToken(OWNER, 'testuser');
    const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // minimal JPEG bytes

    it('owner uploads a cover -> 200 with coverImageUrl', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', ownerId: OWNER, coverImageKey: null });
      mockPrisma.recording.update.mockResolvedValue({ id: 'rec-1', title: 'T', isPublic: false, shareSlug: null, coverImageKey: 'local:///recordings/covers/rec-1-newkey.jpg' });

      const res = await request(app)
        .post('/api/recordings/rec-1/cover')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('image', tinyJpeg, { filename: 'c.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.coverImageUrl).toContain('/api/recordings/rec-1/cover');
    });

    it('non-owner upload -> 403', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', ownerId: 'someone-else', coverImageKey: null });
      const res = await request(app)
        .post('/api/recordings/rec-1/cover')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('image', tinyJpeg, { filename: 'c.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(403);
    });

    it('unsupported MIME -> 400', async () => {
      const res = await request(app)
        .post('/api/recordings/rec-1/cover')
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('image', Buffer.from('hello'), { filename: 'c.txt', contentType: 'text/plain' });
      expect(res.status).toBe(400);
    });

    it('missing file -> 400', async () => {
      const res = await request(app)
        .post('/api/recordings/rec-1/cover')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
    });

    it('owner deletes cover -> 200 with coverImageUrl null', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ id: 'rec-1', ownerId: OWNER, coverImageKey: 'local:///recordings/covers/old.jpg' });
      mockPrisma.recording.update.mockResolvedValue({ id: 'rec-1', title: 'T', isPublic: false, shareSlug: null, coverImageKey: null });
      const res = await request(app)
        .delete('/api/recordings/rec-1/cover')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.coverImageUrl).toBeNull();
    });

    it('GET cover with no key -> 404', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ coverImageKey: null });
      const res = await request(app).get('/api/recordings/rec-1/cover');
      expect(res.status).toBe(404);
    });

    it('GET cover for an S3 key -> 302 redirect to presigned url', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ coverImageKey: 'https://s3.example/podchat/covers/rec-1.jpg' });
      const res = await request(app).get('/api/recordings/rec-1/cover');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://example.com/download/file.mp3');
    });
  });

  describe('POST /api/recordings/upload', () => {
    const UPLOADER = 'user-123'; // matches testToken's userId
    const uploaderToken = generateToken(UPLOADER, 'testuser');
    const tinyAudio = Buffer.from([0x49, 0x44, 0x33, 0x04]); // "ID3" mp3-ish header bytes

    it('uploads an audio file -> 201 draft recording owned by the uploader, roomId null', async () => {
      mockPrisma.recording.create.mockResolvedValue({
        id: 'rec-up-1', ownerId: UPLOADER, roomId: null, title: 'My Pod', isPublic: false,
        shareSlug: null, durationSeconds: 120, coverImageKey: null, format: 'mp3',
        createdAt: new Date('2024-02-01'),
      });

      const res = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('title', 'My Pod')
        .field('durationSeconds', '120')
        .attach('audio', tinyAudio, { filename: 'pod.mp3', contentType: 'audio/mpeg' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'rec-up-1', ownerId: UPLOADER, isPublic: false, title: 'My Pod' });
      const createArg = mockPrisma.recording.create.mock.calls[0][0].data;
      expect(createArg.roomId).toBeNull();
      expect(createArg.ownerId).toBe(UPLOADER);
      expect(createArg.format).toBe('mp3');
      expect(createArg.isPublic).toBe(false);
    });

    it('rejects an unsupported file type -> 400 and does not create a recording', async () => {
      const res = await request(app)
        .post('/api/recordings/upload')
        .set('Authorization', `Bearer ${uploaderToken}`)
        .field('title', 'x')
        .attach('audio', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(mockPrisma.recording.create).not.toHaveBeenCalled();
    });

    it('requires auth -> 401', async () => {
      const res = await request(app)
        .post('/api/recordings/upload')
        .attach('audio', tinyAudio, { filename: 'pod.mp3', contentType: 'audio/mpeg' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/recordings/:id/download (room-less upload auth)', () => {
    const OWNER = 'user-123'; // matches testToken

    it('owner of a room-less recording gets a download url -> 200', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-up', ownerId: OWNER, roomId: null, fileUrl: 'local:///recordings/uploads/x.mp3', room: null,
      });

      const res = await request(app)
        .get('/api/recordings/rec-up/download')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.url).toBe('string');
      // owner short-circuits before any participant lookup
      expect(mockPrisma.roomParticipant.findFirst).not.toHaveBeenCalled();
    });

    it('non-owner of a room-less recording is denied -> 403', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({
        id: 'rec-up', ownerId: 'someone-else', roomId: null, fileUrl: 'local:///recordings/uploads/x.mp3', room: null,
      });

      const res = await request(app)
        .get('/api/recordings/rec-up/download')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(403);
      // a null room means no participant query is even attempted
      expect(mockPrisma.roomParticipant.findFirst).not.toHaveBeenCalled();
    });
  });
});
