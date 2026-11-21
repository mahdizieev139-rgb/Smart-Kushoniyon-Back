/**
 * Prisma client — the single shared database connection.
 *
 * We export ONE instance and reuse it everywhere. Creating a new PrismaClient
 * per request would exhaust the database connection pool.
 *
 * The `globalThis` trick prevents creating many clients during development,
 * where file-watchers (tsx watch) re-run the module on every change.
 */
import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
