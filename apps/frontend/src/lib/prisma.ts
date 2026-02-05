import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/nextjs-best-practices
//
// Lazy init: only create the client when first used (at runtime). This avoids
// "It should have this form: { url: 'CONNECTION_STRING' }" during Vercel build,
// when DIRECT_DATABASE_URL is not available in the build environment.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) {
    throw new Error(
      'DIRECT_DATABASE_URL is not set. Set it in your environment (e.g. Vercel project settings).',
    );
  }
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
