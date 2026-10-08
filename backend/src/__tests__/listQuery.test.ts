import { describe, it, expect, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { sanitizeListArgs } from '../lib/listQuery.js';

describe('sanitizeListArgs', () => {
  it('leaves a normal page untouched', () => {
    const args = { skip: 20, take: 10, where: { isPublic: true } };
    expect(sanitizeListArgs(args)).toBe(args);
  });

  it('turns a negative skip into 0', () => {
    expect(sanitizeListArgs({ skip: -5, take: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('drops the fraction on skip and treats a fraction below 1 as 0', () => {
    expect(sanitizeListArgs({ skip: 2.9 })).toEqual({ skip: 2 });
    expect(sanitizeListArgs({ skip: 0.4 })).toEqual({ skip: 0 });
  });

  it('turns a non-finite skip into 0', () => {
    expect(sanitizeListArgs({ skip: Number.NaN })).toEqual({ skip: 0 });
    expect(sanitizeListArgs({ skip: Number.POSITIVE_INFINITY })).toEqual({ skip: 0 });
  });

  it('drops the fraction on take and keeps a negative take', () => {
    expect(sanitizeListArgs({ take: 10.8 })).toEqual({ take: 10 });
    expect(sanitizeListArgs({ take: -1 })).toEqual({ take: -1 });
  });

  it('turns a non-finite take into 0', () => {
    expect(sanitizeListArgs({ take: Number.NaN })).toEqual({ take: 0 });
    expect(sanitizeListArgs({ take: Number.NEGATIVE_INFINITY })).toEqual({ take: 0 });
  });

  it('ignores non-numeric skip and take', () => {
    const args = { skip: '20', take: null };
    expect(sanitizeListArgs(args)).toBe(args);
  });

  it('returns non-objects unchanged', () => {
    expect(sanitizeListArgs(undefined)).toBeUndefined();
    expect(sanitizeListArgs(null)).toBeNull();
  });
});

describe('prisma list guard', () => {
  let disconnect: (() => Promise<void>) | undefined;

  afterAll(async () => {
    if (disconnect) await disconnect();
  });

  it('does not reject a negative skip or a fractional take as invalid', async () => {
    process.env.DATABASE_URL =
      'postgresql://test:test@127.0.0.1:5432/test?connect_timeout=2';
    const { prisma } = await import('../lib/prisma.js');
    disconnect = () => prisma.$disconnect();

    try {
      await prisma.user.findMany({ skip: -4, take: 1.2 });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(Prisma.PrismaClientValidationError);
    }
  });
});
