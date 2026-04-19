import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logError } from '../lib/logger.js';
import { notifyNewFollower } from '../lib/push.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/users/:userId - Get user profile
router.get('/:userId', async (req: AuthRequest<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            hostedRooms: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (req.userId && req.userId !== userId) {
      const follow = await prisma.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.userId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    res.json({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      followerCount: user._count.followers,
      followingCount: user._count.following,
      roomCount: user._count.hostedRooms,
      isFollowing,
    });
  } catch (error) {
    logError(error as Error, { action: 'get_user_profile' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users/:userId/follow - Follow a user
router.post('/:userId/follow', async (req: AuthRequest<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;

    if (userId === req.userId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // Check if user exists
    const userToFollow = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const existingFollow = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: req.userId!,
          followingId: userId,
        },
      },
    });

    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    await prisma.userFollow.create({
      data: {
        followerId: req.userId!,
        followingId: userId,
      },
    });

    // Send push notification to the followed user (fire and forget)
    notifyNewFollower(userId, req.user!.username, req.user!.avatarUrl || undefined).catch((error) => {
      logError(error as Error, { action: 'notify_new_follower', followerId: req.userId, followingId: userId });
    });

    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    logError(error as Error, { action: 'follow_user', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/users/:userId/follow - Unfollow a user
router.delete('/:userId/follow', async (req: AuthRequest<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;

    const deleted = await prisma.userFollow.deleteMany({
      where: {
        followerId: req.userId!,
        followingId: userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ message: 'Not following this user' });
    }

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    logError(error as Error, { action: 'unfollow_user', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/:userId/followers - Get user's followers
router.get('/:userId/followers', async (req: AuthRequest<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const followers = await prisma.userFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const users = followers.map((f: typeof followers[number]) => ({
      id: f.follower.id,
      username: f.follower.username,
      avatarUrl: f.follower.avatarUrl,
      bio: f.follower.bio,
      followedAt: f.createdAt.toISOString(),
    }));

    res.json(users);
  } catch (error) {
    logError(error as Error, { action: 'get_followers' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/users/:userId/following - Get users this user is following
router.get('/:userId/following', async (req: AuthRequest<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const following = await prisma.userFollow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const users = following.map((f: typeof following[number]) => ({
      id: f.following.id,
      username: f.following.username,
      avatarUrl: f.following.avatarUrl,
      bio: f.following.bio,
      followedAt: f.createdAt.toISOString(),
    }));

    res.json(users);
  } catch (error) {
    logError(error as Error, { action: 'get_following' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
