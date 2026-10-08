import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    block: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { blockedUserIds } from '../lib/blocks.js';
import { prisma } from '../lib/prisma.js';

const blockFindMany = prisma.block.findMany as ReturnType<typeof vi.fn>;
const userFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;

describe('blockedUserIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindMany.mockResolvedValue([]);
  });

  it('returns the other person from either side of a block', async () => {
    blockFindMany.mockResolvedValue([
      { blockerId: 'me', blockedId: 'them' },
      { blockerId: 'other', blockedId: 'me' },
    ]);

    await expect(blockedUserIds('me')).resolves.toEqual(['them', 'other']);
    expect(userFindMany).toHaveBeenCalledWith({
      where: { isBanned: true },
      select: { id: true },
    });
  });

  it('drops a self-block and the viewer id', async () => {
    blockFindMany.mockResolvedValue([
      { blockerId: 'me', blockedId: 'me' },
      { blockerId: 'me', blockedId: 'them' },
    ]);

    await expect(blockedUserIds('me')).resolves.toEqual(['them']);
  });

  it('hides suspended accounts even when nobody is blocked', async () => {
    blockFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([{ id: 'banned' }, { id: 'also' }]);

    await expect(blockedUserIds('me')).resolves.toEqual(['banned', 'also']);
  });

  it('does not hide the viewer when they themselves are suspended', async () => {
    blockFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([{ id: 'me' }, { id: 'banned' }]);

    await expect(blockedUserIds('me')).resolves.toEqual(['banned']);
  });

  it('lists a person once when they are both blocked and suspended', async () => {
    blockFindMany.mockResolvedValue([{ blockerId: 'me', blockedId: 'banned' }]);
    userFindMany.mockResolvedValue([{ id: 'banned' }]);

    await expect(blockedUserIds('me')).resolves.toEqual(['banned']);
  });

  it('ignores a user stub that cannot list accounts', async () => {
    blockFindMany.mockResolvedValue([{ blockerId: 'them', blockedId: 'me' }]);
    const user = prisma.user as unknown as { findMany?: typeof userFindMany };
    const original = user.findMany;
    user.findMany = undefined;
    try {
      await expect(blockedUserIds('me')).resolves.toEqual(['them']);
    } finally {
      user.findMany = original;
    }
  });
});
