import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules - factories must not reference external variables
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
  createLiveKitToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
  startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'mock-egress-id' }),
  stopRoomRecording: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download'),
  deleteStoredFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/socket.js', () => ({
  initializeSocket: vi.fn(),
  emitParticipantJoined: vi.fn(),
  emitParticipantLeft: vi.fn(),
  emitRoomStatusChanged: vi.fn(),
  emitParticipantRoleChanged: vi.fn(),
}));

// Import after mocks are defined
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

// Type helper for mocked prisma
type MockedPrisma = typeof prisma & {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  recording: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('Auth Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validRegisterBody = {
    username: 'newuser',
    email: 'test@example.com',
    password: 'pass1234',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'newuser',
        email: 'test@example.com',
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterBody);

      expect(response.status).toBe(201);
      expect(response.body.user.username).toBe('newuser');
      expect(response.body.token).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        username: 'newuser',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterBody);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Username already taken');
    });

    it('should reject invalid username format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterBody, username: 'a' });

      expect(response.status).toBe(400);
    });

    it('should reject username with special characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegisterBody, username: 'test@user!' });

      expect(response.status).toBe(400);
    });

    it('should reject registration without password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login existing user with correct password', async () => {
      const password = 'pass1234';
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash(password, 12);
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.token).toBeDefined();
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nope@example.com', password: 'pass1234' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('correctpass', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpass' });

      expect(response.status).toBe(401);
    });

    it('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Test bio',
        createdAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const token = generateToken('user-123', 'testuser');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('testuser');
      expect(response.body.bio).toBe('Test bio');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = generateToken('deleted-user', 'testuser');
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/auth/me', () => {
    const token = generateToken('user-123', 'testuser');

    it('DELETE /me deletes hosted rooms then the user', async () => {
      mockPrisma.recording.findMany.mockResolvedValue([]);
      const tx = { room: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }, user: { delete: vi.fn().mockResolvedValue({ id: 'user-123' }) } };
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
      const res = await request(app).delete('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(tx.room.deleteMany).toHaveBeenCalledWith({ where: { hostId: 'user-123' } });
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'updateduser',
        email: 'updated@example.com',
        avatarUrl: null,
        bio: 'Updated bio',
        createdAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const token = generateToken('user-123', 'testuser');
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'updateduser',
          email: 'updated@example.com',
          bio: 'Updated bio',
        });

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('updateduser');
      expect(response.body.bio).toBe('Updated bio');
    });

    it('should reject duplicate username', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'other-user',
        username: 'takenusername',
      });

      const token = generateToken('user-123', 'testuser');
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'takenusername' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Username already taken');
    });

    it('should reject bio longer than 200 characters', async () => {
      const token = generateToken('user-123', 'testuser');
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'a'.repeat(201) });

      expect(response.status).toBe(400);
    });

    it('should allow clearing fields with null', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: null,
        avatarUrl: null,
        bio: null,
        createdAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const token = generateToken('user-123', 'testuser');
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: null, bio: null });

      expect(response.status).toBe(200);
    });
  });
});
