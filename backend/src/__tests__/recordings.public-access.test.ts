import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
    recording: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    roomParticipant: { findFirst: vi.fn() },
    block: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download/file.mp3'),
  isLocalRecordingUrl: vi.fn().mockReturnValue(false),
  getLocalRecordingPath: vi.fn(),
  createLocalRecordingAccessUrl: vi.fn(),
  verifyLocalRecordingAccessToken: vi.fn(),
  uploadFile: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  isS3Configured: vi.fn().mockReturnValue(false),
  uploadImage: vi.fn(),
  deleteStoredFile: vi.fn(),
  buildCoverImageUrl: vi.fn(() => null),
  audioExtForMime: vi.fn(),
  UPLOADS_DIR: '/tmp/podchat-public-access-test',
  storeUploadedAudio: vi.fn(),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
}));

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn(),
  startRoomRecording: vi.fn(),
  stopRoomRecording: vi.fn(),
}));

vi.mock('../lib/push.js', () => ({
  getVapidPublicKey: vi.fn(),
  notifyNewFollower: vi.fn(),
  notifyFollowersOfLive: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abc123xyz0'),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { getPresignedDownloadUrl } from '../lib/storage.js';

const mockPrisma = prisma as unknown as {
  recording: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  block: { findMany: ReturnType<typeof vi.fn> };
};

const publicRecording = {
  id: 'rec-1',
  ownerId: 'owner-9',
  isPublic: true,
  isHidden: false,
  shareSlug: 'abc123xyz0',
  fileUrl: 'https://storage.example.com/recordings/file.mp3',
  title: 'Public',
  description: null,
  durationSeconds: 60,
  playCount: 1,
  createdAt: new Date('2024-01-15'),
  coverImageKey: null,
  room: null,
  owner: { id: 'owner-9', username: 'host', avatarUrl: null },
};

describe('public recording access', () => {
  const app = createApp();
  const viewerToken = generateToken('user-123', 'viewer');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.block.findMany.mockResolvedValue([]);
    vi.mocked(getPresignedDownloadUrl).mockResolvedValue('https://example.com/download/file.mp3');
  });

  describe('GET /api/recordings/public/:shareSlug/download', () => {
    it('returns a URL for a visible public recording', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue(publicRecording);

      const response = await request(app).get('/api/recordings/public/abc123xyz0/download');

      expect(response.status).toBe(200);
      expect(response.body.url).toBe('https://example.com/download/file.mp3');
    });

    it('returns 404 for a moderated recording and does not sign a URL', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue({ ...publicRecording, isHidden: true });

      const response = await request(app).get('/api/recordings/public/abc123xyz0/download');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Recording not found');
      expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('returns 404 when the viewer has blocked the owner', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue(publicRecording);
      mockPrisma.block.findMany.mockResolvedValue([{ blockerId: 'user-123', blockedId: 'owner-9' }]);

      const response = await request(app)
        .get('/api/recordings/public/abc123xyz0/download')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(404);
      expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('returns 404 when the file is not on disk yet', async () => {
      mockPrisma.recording.findUnique.mockResolvedValue(publicRecording);
      const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
      vi.mocked(getPresignedDownloadUrl).mockRejectedValue(missing);

      const response = await request(app).get('/api/recordings/public/abc123xyz0/download');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Recording file not available yet');
    });
  });

  describe('GET /api/recordings/feed query bounds', () => {
    beforeEach(() => {
      mockPrisma.recording.findMany.mockResolvedValue([]);
      mockPrisma.recording.count.mockResolvedValue(0);
    });

    it('replaces a negative limit with the default page size', async () => {
      await request(app).get('/api/recordings/feed?limit=-1');

      expect(mockPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('replaces a negative offset with zero', async () => {
      await request(app).get('/api/recordings/feed?offset=-5&limit=10');

      expect(mockPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 0 }),
      );
    });

    it('still caps an oversized limit at 50', async () => {
      await request(app).get('/api/recordings/feed?limit=100');

      expect(mockPrisma.recording.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });
});
