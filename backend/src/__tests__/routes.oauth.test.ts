import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

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
}));

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { jwtVerify } from 'jose';

const app = createApp();
const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    avatarUrl: null,
    bio: null,
    createdAt,
    authProvider: 'email',
    isBanned: false,
    ...overrides,
  };
}

describe('OAuth account linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
  });

  it('does not link an account when Google has not verified the email', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'google-1',
        email: 'ada@example.com',
        email_verified: false,
      }),
    } as Response);

    const res = await request(app).post('/api/auth/google').send({ token: 'google-access' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Google email is not verified' });
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('links a verified Google email onto the existing account', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'google-1',
        email: 'ada@example.com',
        email_verified: true,
        picture: 'https://example.com/a.png',
      }),
    } as Response);
    mockPrisma.user.findFirst.mockResolvedValue(userRow());
    mockPrisma.user.update.mockResolvedValue(
      userRow({ authProvider: 'google', avatarUrl: 'https://example.com/a.png' }),
    );

    const res = await request(app).post('/api/auth/google').send({ token: 'google-access' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ada@example.com');
    expect(typeof res.body.token).toBe('string');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        authProvider: 'google',
        authProviderId: 'google-1',
        avatarUrl: 'https://example.com/a.png',
      },
    });
  });

  it('does not rewrite a suspended account when Google verifies the email', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'google-1',
        email: 'ada@example.com',
        email_verified: true,
      }),
    } as Response);
    mockPrisma.user.findFirst.mockResolvedValue(userRow({ isBanned: true }));

    const res = await request(app).post('/api/auth/google').send({ token: 'google-access' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Account suspended' });
    expect(res.body.token).toBeUndefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('creates a user from a verified Google profile', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: 'google-9',
        email: 'new@example.com',
        email_verified: true,
        name: 'New User',
      }),
    } as Response);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(
      userRow({
        id: 'user-9',
        username: 'New_User',
        email: 'new@example.com',
        authProvider: 'google',
      }),
    );

    const res = await request(app).post('/api/auth/google').send({ token: 'google-access' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        username: 'New_User',
        email: 'new@example.com',
        authProvider: 'google',
        authProviderId: 'google-9',
        avatarUrl: null,
      },
    });
  });

  it('does not link an account when Apple sends an unverified email', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: 'apple-1',
        email: 'ada@example.com',
        email_verified: 'false',
      },
      protectedHeader: { alg: 'RS256' },
    } as never);

    const res = await request(app).post('/api/auth/apple').send({ token: 'apple-identity' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Apple email is not verified' });
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('signs in a returning Apple user without an email claim', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: 'apple-1' },
      protectedHeader: { alg: 'RS256' },
    } as never);
    mockPrisma.user.findFirst.mockResolvedValue(userRow({ authProvider: 'apple' }));

    const res = await request(app).post('/api/auth/apple').send({ token: 'apple-identity' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ authProvider: 'apple', authProviderId: 'apple-1' }],
      },
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a suspended Apple account', async () => {
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: { sub: 'apple-1', email: 'ada@example.com', email_verified: true },
      protectedHeader: { alg: 'RS256' },
    } as never);
    mockPrisma.user.findFirst.mockResolvedValue(userRow({ authProvider: 'apple', isBanned: true }));

    const res = await request(app).post('/api/auth/apple').send({ token: 'apple-identity' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Account suspended' });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
