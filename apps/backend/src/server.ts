import 'dotenv/config';
import { env } from './config/env.js';
import app from './app.js';
import prisma from './utils/prisma.js';
import logger from './utils/logger.js';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
  logger.info(`🔗 API available at http://localhost:${PORT}`);
});

// ─── Graceful Shutdown ───────────────────────────────

const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully…`);

  // 1. Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // 2. Disconnect Prisma
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  } catch (err) {
    logger.error('Error disconnecting Prisma:', err);
  }

  // 3. Exit
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});