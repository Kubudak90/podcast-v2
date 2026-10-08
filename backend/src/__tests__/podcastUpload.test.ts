import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';
import { podcastDurationSeconds, podcastTitleFromUpload } from '../lib/podcastUpload.js';

describe('podcastTitleFromUpload', () => {
  it('keeps an explicit title and collapses whitespace', () => {
    expect(podcastTitleFromUpload('  Hello   world \n', 'ignored.mp3')).toBe('Hello world');
  });

  it('caps an explicit title at 100 characters', () => {
    const long = 'a'.repeat(150);
    expect(podcastTitleFromUpload(long, 'short.mp3')).toHaveLength(100);
  });

  it('uses the file stem when the title is blank, dropping directories', () => {
    expect(podcastTitleFromUpload('   ', 'C:\\Users\\ada\\My Talk.mp3')).toBe('My Talk');
    expect(podcastTitleFromUpload(undefined, '../../secret.mp3')).toBe('secret');
  });

  it('strips control and bidi characters from the file name', () => {
    expect(podcastTitleFromUpload('', 'notes\u202E\n.mp3')).toBe('notes');
  });

  it('falls back when neither title nor file stem is usable', () => {
    expect(podcastTitleFromUpload('', '.mp3')).toBe('Adsız podcast');
    expect(podcastTitleFromUpload(null, '')).toBe('Adsız podcast');
  });
});

describe('podcastDurationSeconds', () => {
  it('floors a positive duration', () => {
    expect(podcastDurationSeconds('120.9')).toBe(120);
    expect(podcastDurationSeconds(90)).toBe(90);
  });

  it('drops missing, zero, negative, and non-numeric values', () => {
    expect(podcastDurationSeconds(undefined)).toBeNull();
    expect(podcastDurationSeconds('')).toBeNull();
    expect(podcastDurationSeconds(0)).toBeNull();
    expect(podcastDurationSeconds(-5)).toBeNull();
    expect(podcastDurationSeconds('nope')).toBeNull();
  });

  it('drops values that do not fit a 32-bit integer', () => {
    expect(podcastDurationSeconds(1e20)).toBeNull();
    expect(podcastDurationSeconds('2147483648')).toBeNull();
    expect(podcastDurationSeconds(2_147_483_647)).toBe(2_147_483_647);
  });
});

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
  getPresignedDownloadUrl: vi.fn(),
  isLocalRecordingUrl: vi.fn().mockReturnValue(false),
  getLocalRecordingPath: vi.fn(),
  createLocalRecordingAccessUrl: vi.fn(),
  verifyLocalRecordingAccessToken: vi.fn(),
  uploadFile: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  isS3Configured: vi.fn().mockReturnValue(false),
  uploadImage: vi.fn(),
  deleteStoredFile: vi.fn().mockResolvedValue(undefined),
  buildCoverImageUrl: vi.fn(),
  audioExtForMime: vi.fn((m: string) => (m === 'audio/mpeg' ? 'mp3' : null)),
  UPLOADS_DIR: '/tmp/podchat-upload-title-test',
  storeUploadedAudio: vi.fn().mockResolvedValue('local:///tmp/podchat-upload-title-test/abc.mp3'),
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
import { deleteStoredFile, storeUploadedAudio } from '../lib/storage.js';

describe('POST /api/recordings/upload metadata', () => {
  const app = createApp();
  const token = generateToken('user-123', 'testuser');
  const audio = Buffer.from([0x49, 0x44, 0x33, 0x04]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storeUploadedAudio).mockResolvedValue(
      'local:///tmp/podchat-upload-title-test/abc.mp3',
    );
    vi.mocked(deleteStoredFile).mockResolvedValue(undefined);
  });

  it('stores a basename title and drops a duration that would overflow', async () => {
    vi.mocked(prisma.recording.create).mockResolvedValue({
      id: 'rec-up-1',
      ownerId: 'user-123',
      title: 'My Talk',
      isPublic: false,
      shareSlug: null,
      durationSeconds: null,
      createdAt: new Date('2024-02-01'),
    } as never);

    const res = await request(app)
      .post('/api/recordings/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', '   ')
      .field('durationSeconds', '1e20')
      .attach('audio', audio, {
        filename: 'C:\\Users\\ada\\My Talk.mp3',
        contentType: 'audio/mpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeUndefined();
    const data = vi.mocked(prisma.recording.create).mock.calls[0][0].data;
    expect(data.title).toBe('My Talk');
    expect(data.durationSeconds).toBeNull();
    expect(deleteStoredFile).not.toHaveBeenCalled();
  });

  it('deletes the stored audio when the recording row cannot be saved', async () => {
    vi.mocked(prisma.recording.create).mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/recordings/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Keep me')
      .attach('audio', audio, { filename: 'pod.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Internal server error' });
    expect(deleteStoredFile).toHaveBeenCalledWith('local:///tmp/podchat-upload-title-test/abc.mp3');
  });
});
