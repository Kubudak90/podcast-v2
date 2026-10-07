import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendNotification, prismaMock } = vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = 'test-public';
  process.env.VAPID_PRIVATE_KEY = 'test-private';
  return {
    sendNotification: vi.fn().mockResolvedValue({}),
    prismaMock: {
      user: { findUnique: vi.fn(), findMany: vi.fn() },
      userFollow: { findMany: vi.fn() },
      block: { findMany: vi.fn() },
      notificationSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
    },
  };
});

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification,
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: prismaMock,
}));

import { notifyFollowersOfLive, notifyNewFollower } from '../lib/push.js';

function subscription(userId: string) {
  return {
    id: `sub-${userId}`,
    endpoint: `https://push.example/${userId}`,
    p256dh: 'p256',
    auth: 'auth',
  };
}

describe('live and follow push recipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendNotification.mockResolvedValue({});
    prismaMock.notificationSubscription.findMany.mockImplementation(
      async ({ where }: { where: { userId: string } }) => [subscription(where.userId)]
    );
  });

  it('skips followers blocked in either direction and suspended accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isBanned: false });
    prismaMock.userFollow.findMany.mockResolvedValue([
      { followerId: 'fan' },
      { followerId: 'blocked-host' },
      { followerId: 'blocked-fan' },
    ]);
    prismaMock.block.findMany.mockResolvedValue([
      { blockerId: 'blocked-host', blockedId: 'host-1' },
      { blockerId: 'host-1', blockedId: 'blocked-fan' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'fan' }]);

    const count = await notifyFollowersOfLive('host-1', 'ada', 'Friday Talk', 'friday');

    expect(count).toBe(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['fan'] }, isBanned: false },
      select: { id: true },
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0].endpoint).toBe('https://push.example/fan');
  });

  it('does not notify anyone when the host is suspended', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isBanned: true });

    const count = await notifyFollowersOfLive('host-1', 'ada', 'Friday Talk', 'friday');

    expect(count).toBe(0);
    expect(prismaMock.userFollow.findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('does not notify when every remaining follower is suspended', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isBanned: false });
    prismaMock.userFollow.findMany.mockResolvedValue([{ followerId: 'fan' }]);
    prismaMock.block.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const count = await notifyFollowersOfLive('host-1', 'ada', 'Friday Talk', 'friday');

    expect(count).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('does not announce a follow across a block or a suspended account', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; username?: string } }) => {
      if (where.id === 'host-1') return { isBanned: false };
      if (where.username === 'blocker') return { id: 'blocker', isBanned: false };
      return null;
    });
    prismaMock.block.findMany.mockResolvedValue([{ blockerId: 'host-1', blockedId: 'blocker' }]);

    const blocked = await notifyNewFollower('host-1', 'blocker');
    expect(blocked).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();

    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; username?: string } }) => {
      if (where.id === 'host-1') return { isBanned: false };
      if (where.username === 'suspended') return { id: 'suspended', isBanned: true };
      return null;
    });
    const suspended = await notifyNewFollower('host-1', 'suspended');
    expect(suspended).toBe(0);
    expect(prismaMock.block.findMany).toHaveBeenCalledTimes(1);
  });

  it('sends a follow notification when neither account is suspended or blocked', async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; username?: string } }) => {
      if (where.id === 'host-1') return { isBanned: false };
      if (where.username === 'fan') return { id: 'fan', isBanned: false };
      return null;
    });
    prismaMock.block.findMany.mockResolvedValue([]);

    const count = await notifyNewFollower('host-1', 'fan', 'https://cdn.example/a.png');

    expect(count).toBe(1);
    const body = JSON.parse(sendNotification.mock.calls[0][1] as string);
    expect(body.title).toBe('New follower');
    expect(body.body).toBe('fan started following you');
    expect(body.icon).toBe('https://cdn.example/a.png');
  });
});
