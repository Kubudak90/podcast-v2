import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { sanitizeListArgs } from './listQuery.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const adapter = new PrismaPg({ connectionString });

const base = new PrismaClient({ adapter });

// Cast keeps call sites typed as PrismaClient. The extension still runs.
export const prisma: PrismaClient = base.$extends({
  query: {
    $allModels: {
      $allOperations({ args, query }) {
        return query(sanitizeListArgs(args));
      },
    },
  },
}) as unknown as PrismaClient;
