import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateToken } from '../middleware/auth.js';

// Mock modules
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    userFollow: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationSubscription: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    recording: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/push.js', () => ({
  notifyNewFollower: vi.fn().mockResolvedValue(1),
  getVapidPublicKey: vi.fn().mockReturnValue('mock-vapid-key'),
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

vi.mock('../lib/storage.js', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://example.com/download'),
}));

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

type MockedPrisma = typeof prisma & {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  userFollow: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  recording: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('Users Routes', () => {
  const app = createApp();
  const mockPrisma = prisma as MockedPrisma;
  const testToken = generateToken('user-123', 'testuser');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/:userId', () => {
    it('should return user profile with follower counts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        username: 'targetuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        createdAt: new Date('2024-01-01'),
        _count: {
          followers: 10,
          following: 5,
          hostedRooms: 3,
        },
      });
      mockPrisma.userFollow.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/user-456')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'user-456',
        username: 'targetuser',
        followerCount: 10,
        followingCount: 5,
        roomCount: 3,
        isFollowing: false,
      });
    });

    it('should return 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/users/nonexistent')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('POST /api/users/:userId/follow', () => {
    it('should follow a user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        username: 'targetuser',
      });
      mockPrisma.userFollow.findUnique.mockResolvedValue(null);
      mockPrisma.userFollow.create.mockResolvedValue({
        id: 'follow-1',
        followerId: 'user-123',
        followingId: 'user-456',
      });

      const response = await request(app)
        .post('/api/users/user-456/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully followed user');
      expect(mockPrisma.userFollow.create).toHaveBeenCalledWith({
        data: {
          followerId: 'user-123',
          followingId: 'user-456',
        },
      });
    });

    it('should not allow following yourself', async () => {
      const response = await request(app)
        .post('/api/users/user-123/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot follow yourself');
    });

    it('should return 400 if already following', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        username: 'targetuser',
      });
      mockPrisma.userFollow.findUnique.mockResolvedValue({
        id: 'follow-1',
        followerId: 'user-123',
        followingId: 'user-456',
      });

      const response = await request(app)
        .post('/api/users/user-456/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Already following this user');
    });

    it('should return 404 if target user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/users/nonexistent/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });
  });

  describe('DELETE /api/users/:userId/follow', () => {
    it('should unfollow a user successfully', async () => {
      mockPrisma.userFollow.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .delete('/api/users/user-456/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully unfollowed user');
    });

    it('should return 404 if not following', async () => {
      mockPrisma.userFollow.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .delete('/api/users/user-456/follow')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Not following this user');
    });
  });

  describe('GET /api/users/:userId/followers', () => {
    it('should return list of followers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-456' });
      mockPrisma.userFollow.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-15'),
          follower: {
            id: 'follower-1',
            username: 'follower1',
            avatarUrl: null,
            bio: 'Bio 1',
          },
        },
        {
          createdAt: new Date('2024-01-10'),
          follower: {
            id: 'follower-2',
            username: 'follower2',
            avatarUrl: 'https://example.com/avatar.jpg',
            bio: null,
          },
        },
      ]);

      const response = await request(app)
        .get('/api/users/user-456/followers')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: 'follower-1',
        username: 'follower1',
      });
    });

    it('should return empty array for user with no followers', async () => {
      mockPrisma.userFollow.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/nonexistent/followers')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/users/:userId/following', () => {
    it('should return list of following', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-456' });
      mockPrisma.userFollow.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-15'),
          following: {
            id: 'following-1',
            username: 'following1',
            avatarUrl: null,
            bio: 'Bio',
          },
        },
      ]);

      const response = await request(app)
        .get('/api/users/user-456/following')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 'following-1',
        username: 'following1',
      });
    });
  });

  describe('GET /api/users/:userId/podcasts', () => {
    const OWNER = '550e8400-e29b-41d4-a716-446655440001';

    it('owner sees public + private drafts', async () => {
      const token = generateToken(OWNER, 'owner');
      mockPrisma.recording.findMany.mockResolvedValue([
        { id: 'a', title: 'Pub', isPublic: true, shareSlug: 's', durationSeconds: 10, playCount: 2, createdAt: new Date('2024-01-02'), room: { title: 'R' } },
        { id: 'b', title: null, isPublic: false, shareSlug: null, durationSeconds: 5, playCount: 0, createdAt: new Date('2024-01-01'), room: { title: 'Room2' } },
      ]);

      const res = await request(app)
        .get(`/api/users/${OWNER}/podcasts`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.podcasts).toHaveLength(2);
      expect(mockPrisma.recording.findMany.mock.calls[0][0].where).toEqual({ ownerId: OWNER });
    });

    it('a different requester sees only public', async () => {
      const token = generateToken('550e8400-e29b-41d4-a716-446655440099', 'other');
      mockPrisma.recording.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/users/${OWNER}/podcasts`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.recording.findMany.mock.calls[0][0].where).toEqual({ ownerId: OWNER, isPublic: true });
    });
  });
});
