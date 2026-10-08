import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { emailEquals, findUserByEmail, normalizeEmail } from '../lib/emailAddress.js';
import { prisma } from '../lib/prisma.js';

const users = prisma.user as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
};

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ada@Mail.com ')).toBe('ada@mail.com');
  });

  it('returns an empty string for non-strings', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(12)).toBe('');
  });

  it('builds a case-insensitive filter', () => {
    expect(emailEquals('Ada@Mail.com')).toEqual({
      equals: 'ada@mail.com',
      mode: 'insensitive',
    });
  });
});

describe('findUserByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not query when the address is empty', async () => {
    await expect(findUserByEmail('   ')).resolves.toBeNull();
    expect(users.findUnique).not.toHaveBeenCalled();
    expect(users.findFirst).not.toHaveBeenCalled();
  });

  it('returns the exact lowercase row without a second query', async () => {
    const row = { id: 'exact', email: 'ada@mail.com' };
    users.findUnique.mockResolvedValue(row);

    await expect(findUserByEmail('Ada@Mail.com')).resolves.toBe(row);
    expect(users.findUnique).toHaveBeenCalledWith({ where: { email: 'ada@mail.com' } });
    expect(users.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to a case-insensitive match and prefers the oldest row', async () => {
    const legacy = { id: 'legacy', email: 'Ada@Mail.com' };
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValue(legacy);

    await expect(findUserByEmail('ada@mail.com')).resolves.toBe(legacy);
    expect(users.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ada@mail.com', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  });
});
