import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Extend the PrismaClient with middleware
const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Log database queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug(
        {
          type: 'database',
          query: e.query,
          params: e.params,
          duration: e.duration,
        },
        'Database query executed',
      );
    });
  }

  // Log database errors
  prisma.$on('error', (e) => {
    logger.error(
      {
        type: 'database',
        error: e,
      },
      'Database error occurred',
    );
  });

  // Add performance monitoring middleware
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      logger.warn(
        {
          type: 'database',
          action: params.action,
          model: params.model,
          duration,
        },
        'Slow database query detected',
      );
    }

    return result;
  });

  return prisma;
};

// Singleton instance
let prisma: PrismaClient;

export const getPrismaClient = () => {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
};

// Health check utility
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
};

// Graceful shutdown
export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
};

// Transaction utility
export const withTransaction = async <T>(
  callback: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
  ) => Promise<T>,
): Promise<T> => {
  const client = getPrismaClient();
  return await client.$transaction(callback);
};
