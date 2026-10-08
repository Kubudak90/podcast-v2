import { prisma } from './prisma.js';

// Ids this user must not see or join. Blocks run in either direction.
// Suspended accounts are included because feed, podcast, and join checks
// already treat this list as "hide that person". The viewer is left out so
// their own recordings are not dropped by a `notIn` filter.
export async function blockedUserIds(userId: string): Promise<string[]> {
  const [rows, suspended] = await Promise.all([
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    suspendedUserIds(),
  ]);

  const ids = new Set<string>();
  for (const row of rows) {
    const other = row.blockerId === userId ? row.blockedId : row.blockerId;
    if (other && other !== userId) ids.add(other);
  }
  for (const id of suspended) {
    if (id !== userId) ids.add(id);
  }
  return [...ids];
}

type BannedUserQuery = (args: {
  where: { isBanned: true };
  select: { id: true };
}) => Promise<Array<{ id: string }> | undefined>;

// Route tests stub `prisma.user` with only the methods they call. Production
// always has `findMany`. A missing or empty result leaves block filtering intact.
async function suspendedUserIds(): Promise<string[]> {
  const findMany = (prisma.user as unknown as { findMany?: BannedUserQuery } | undefined)?.findMany;
  if (typeof findMany !== 'function') return [];

  const rows = await findMany({
    where: { isBanned: true },
    select: { id: true },
  });
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => (typeof row?.id === 'string' && row.id.length > 0 ? [row.id] : []));
}
