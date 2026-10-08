import type { User } from '@prisma/client';
import { prisma } from './prisma.js';

/** Trim and lowercase an email so `Ada@Mail.com` and `ada@mail.com` are one address. */
export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function emailEquals(email: string): { equals: string; mode: 'insensitive' } {
  return { equals: normalizeEmail(email), mode: 'insensitive' };
}

/**
 * Look up a user by email. Exact lowercase match wins. If the row was stored
 * with mixed case, fall back to a case-insensitive match and prefer the oldest row.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const exact = await prisma.user.findUnique({ where: { email: normalized } });
  if (exact) return exact;

  return prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
}
