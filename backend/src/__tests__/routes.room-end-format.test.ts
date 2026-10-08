import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/prisma.js', () => {
  const recordingMock = { create: vi.fn() };
  const roomMock = { findUnique: vi.fn(), update: vi.fn() };
  const roomParticipantMock = { updateMany: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      room: roomMock,
      roomParticipant: roomParticipantMock,
      recording: recordingMock,
      block: { findMany: vi.fn().mockResolvedValue([]) },
      userFollow: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          recording: recordingMock,
          room: roomMock,
          roomParticipant: roomParticipantMock,
        }),
      ),
    },
  };
});

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn(),
  startRoomRecording: vi.fn(),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
  setParticipantCanPublish: vi.fn(),
  removeRoomParticipant: vi.fn(),
}));

vi.mock('../lib/socket.js', () => ({
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
  emitRoomUpdate: vi.fn(),
  emitParticipantMuted: vi.fn(),
  emitParticipantRemoved: vi.fn(),
  emitSpeakerUnmuteResolved: vi.fn(),
}));

vi.mock('../lib/push.js', () => ({
  notifyFollowersOfLive: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('POST /api/rooms/:slug/end recording row', () => {
  const app = createApp();
  const token = generateToken('user-123', 'host');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores mp3 and a fitting duration for the egress file', async () => {
    const startedAt = new Date(Date.now() - 125_000);
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'room-1',
      slug: 'abc12345',
      hostId: 'user-123',
      status: 'live',
      egressId: 'eg-1',
      recordingFileUrl: 'local:///recordings/abc12345-1.mp3',
      startedAt,
    } as never);
    vi.mocked(prisma.room.update).mockResolvedValue({
      id: 'room-1',
      slug: 'abc12345',
      title: 'Talk',
      hostId: 'user-123',
      status: 'ended',
      maxSpeakers: 10,
      isPublic: true,
      createdAt: new Date(),
      startedAt,
      endedAt: new Date(),
    } as never);

    const response = await request(app)
      .post('/api/rooms/abc12345/end')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const data = vi.mocked(prisma.recording.create).mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      roomId: 'room-1',
      ownerId: 'user-123',
      fileUrl: 'local:///recordings/abc12345-1.mp3',
      format: 'mp3',
    });
    expect(data?.durationSeconds).toBeGreaterThanOrEqual(125);
    expect(data?.durationSeconds).toBeLessThanOrEqual(126);
  });

  it('stores null duration when the start clock is ahead of now', async () => {
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'room-1',
      slug: 'abc12345',
      hostId: 'user-123',
      status: 'live',
      egressId: 'eg-1',
      recordingFileUrl: 'https://cdn.example/recordings/abc.MP3?sig=1',
      startedAt: new Date(Date.now() + 60_000),
    } as never);
    vi.mocked(prisma.room.update).mockResolvedValue({
      id: 'room-1',
      slug: 'abc12345',
      title: 'Talk',
      hostId: 'user-123',
      status: 'ended',
      maxSpeakers: 10,
      isPublic: true,
      createdAt: new Date(),
      startedAt: new Date(),
      endedAt: new Date(),
    } as never);

    const response = await request(app)
      .post('/api/rooms/abc12345/end')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(prisma.recording.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: 'mp3',
        durationSeconds: null,
      }),
    });
  });
});
