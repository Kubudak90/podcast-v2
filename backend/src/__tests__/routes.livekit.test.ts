import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    roomParticipant: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn().mockResolvedValue({
    token: 'lk-token',
    expiresAt: '2026-10-06T19:00:00.000Z',
  }),
  getLiveKitUrl: vi.fn().mockReturnValue('wss://livekit.example'),
  startRoomRecording: vi.fn(),
  stopRoomRecording: vi.fn(),
  setParticipantCanPublish: vi.fn(),
  removeRoomParticipant: vi.fn(),
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn(),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { createLiveKitToken } from '../lib/livekit.js';

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  room: { findUnique: ReturnType<typeof vi.fn> };
  roomParticipant: { findFirst: ReturnType<typeof vi.fn> };
};

const mockCreateToken = createLiveKitToken as unknown as ReturnType<typeof vi.fn>;

describe('POST /api/livekit/token', () => {
  const app = createApp();
  const token = generateToken('user-123', 'ada');

  const room = {
    id: 'room-1',
    slug: 'oda1',
    status: 'live',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ isBanned: false });
    mockPrisma.room.findUnique.mockResolvedValue(room);
  });

  it('lets a speaker publish', async () => {
    mockPrisma.roomParticipant.findFirst.mockResolvedValue({
      role: 'speaker',
      mutedByHost: false,
    });

    const response = await request(app)
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomSlug: 'oda1' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe('lk-token');
    expect(mockCreateToken).toHaveBeenCalledWith('oda1', 'ada', true);
  });

  it('keeps a host-muted speaker from publishing when the token refreshes', async () => {
    mockPrisma.roomParticipant.findFirst.mockResolvedValue({
      role: 'speaker',
      mutedByHost: true,
    });

    const response = await request(app)
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomSlug: 'oda1' });

    expect(response.status).toBe(200);
    expect(mockCreateToken).toHaveBeenCalledWith('oda1', 'ada', false);
  });

  it('does not let a listener publish', async () => {
    mockPrisma.roomParticipant.findFirst.mockResolvedValue({
      role: 'listener',
      mutedByHost: false,
    });

    const response = await request(app)
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomSlug: 'oda1' });

    expect(response.status).toBe(200);
    expect(mockCreateToken).toHaveBeenCalledWith('oda1', 'ada', false);
  });

  it('refuses a suspended account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isBanned: true });

    const response = await request(app)
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomSlug: 'oda1' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Account suspended');
    expect(mockCreateToken).not.toHaveBeenCalled();
  });

  it('refuses someone who is not in the room', async () => {
    mockPrisma.roomParticipant.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomSlug: 'oda1' });

    expect(response.status).toBe(403);
    expect(mockCreateToken).not.toHaveBeenCalled();
  });
});
