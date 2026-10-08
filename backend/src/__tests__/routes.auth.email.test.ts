import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.js';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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

vi.mock('../lib/livekit.js', () => ({
  createLiveKitToken: vi.fn(),
  startRoomRecording: vi.fn(),
  stopRoomRecording: vi.fn(),
  setParticipantCanPublish: vi.fn(),
  removeRoomParticipant: vi.fn(),
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn(),
  deleteStoredFile: vi.fn(),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
  emitRoomUpdate: vi.fn(),
  emitParticipantMuted: vi.fn(),
  emitParticipantRemoved: vi.fn(),
  emitSpeakerUnmuteResolved: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

const users = prisma.user as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe('auth email case', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a lowercase email when the signup address has capitals', async () => {
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValue(null);
    users.create.mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      email: 'ada@mail.com',
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/auth/register').send({
      username: 'ada',
      email: 'Ada@Mail.com',
      password: 'pass1234',
    });

    expect(response.status).toBe(201);
    expect(users.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'ada@mail.com' }),
    });
  });

  it('rejects signup when the same address already exists in a different case', async () => {
    users.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    users.findFirst.mockResolvedValue({ id: 'legacy', email: 'Ada@Mail.com' });

    const response = await request(app).post('/api/auth/register').send({
      username: 'ada',
      email: 'ada@mail.com',
      password: 'pass1234',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email already in use');
  });

  it('logs in when the typed address differs only by case', async () => {
    const password = 'pass1234';
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      email: 'Ada@Mail.com',
      password: await bcrypt.hash(password, 12),
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'ADA@mail.com',
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe('ada');
    expect(response.body.token).toBeDefined();
  });

  it('saves a profile email in lowercase and blocks another account with the same address', async () => {
    const token = generateToken('user-1', 'ada');
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValue({ id: 'other', email: 'Ada@Mail.com' });

    const taken = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ada@mail.com' });

    expect(taken.status).toBe(400);
    expect(taken.body.message).toBe('Email already in use');

    users.findFirst.mockResolvedValue(null);
    users.update.mockResolvedValue({
      id: 'user-1',
      username: 'ada',
      email: 'ada@mail.com',
      avatarUrl: null,
      bio: null,
      createdAt: new Date(),
    });

    const saved = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'Ada@Mail.com' });

    expect(saved.status).toBe(200);
    expect(users.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'ada@mail.com' },
    });
  });
});
