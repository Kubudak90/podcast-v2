import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    recording: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/cover.jpg'),
  isLocalRecordingUrl: vi.fn().mockReturnValue(false),
  getLocalRecordingPath: vi.fn(),
  createLocalRecordingAccessUrl: vi.fn(),
  verifyLocalRecordingAccessToken: vi.fn(),
  uploadImage: vi.fn(),
  deleteStoredFile: vi.fn(),
  buildCoverImageUrl: vi.fn(),
  audioExtForMime: vi.fn(),
  UPLOADS_DIR: '/tmp/uploads',
  storeUploadedAudio: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { getPresignedDownloadUrl } from '../lib/storage.js';

describe('GET /api/recordings/:id/cover', () => {
  const app = createApp();
  const findUnique = prisma.recording.findUnique as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for a hidden recording and does not sign the object', async () => {
    findUnique.mockResolvedValue({
      coverImageKey: 'https://s3.example/podchat/covers/rec-1.jpg',
      isHidden: true,
    });

    const res = await request(app).get('/api/recordings/rec-1/cover');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('No cover image');
    expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('still redirects a visible cover to the presigned object', async () => {
    findUnique.mockResolvedValue({
      coverImageKey: 'https://s3.example/podchat/covers/rec-1.jpg',
      isHidden: false,
    });

    const res = await request(app).get('/api/recordings/rec-1/cover');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/cover.jpg');
  });
});
