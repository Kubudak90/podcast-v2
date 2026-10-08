// List routes forward query numbers into Prisma `skip` / `take`.
// A negative or fractional `skip`, or a fractional `take`, fails client
// validation and the route answers 500. Normalize those values before the query.

export function sanitizeListArgs<T>(args: T): T {
  if (args === null || typeof args !== 'object') return args;

  const source = args as T & { skip?: unknown; take?: unknown };
  const skip = sanitizeSkip(source.skip);
  const take = sanitizeTake(source.take);
  if (skip === source.skip && take === source.take) return args;

  return {
    ...source,
    ...(skip !== source.skip ? { skip } : {}),
    ...(take !== source.take ? { take } : {}),
  };
}

function sanitizeSkip(value: unknown): unknown {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) return 0;
  const n = Math.trunc(value);
  return n > 0 ? n : 0;
}

function sanitizeTake(value: unknown): unknown {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) return 0;
  // Negative take is Prisma's "from the end" and stays intact.
  return Math.trunc(value);
}
