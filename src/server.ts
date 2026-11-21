/**
 * Server bootstrap — the real entry point (npm run dev / npm start).
 *
 * It creates the Express app, starts listening, and sets up graceful shutdown
 * so the database connection is closed cleanly when the process is stopped.
 */
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';

async function main() {
  // Fail fast if the database is unreachable, with a clear message.
  try {
    await prisma.$connect();
    logger.info('✅ Database connection established');
  } catch (error) {
    logger.error({ error }, '❌ Failed to connect to the database');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 KUSHONIYON API running at http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

  // Graceful shutdown: stop accepting requests, then disconnect Prisma.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Closed HTTP server and database connection');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
