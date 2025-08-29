import { logger } from './logger';
import { PrismaClient, Prisma } from '@prisma/client';

const createPrismaClient = () => {
  console.log('🔧 Creating Prisma client...');
  console.log('Database URL exists:', !!process.env.DATABASE_URL);

  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            {
              emit: 'event',
              level: 'error',
            },
            {
              emit: 'event',
              level: 'warn',
            },
          ]
        : [],
    errorFormat: 'pretty',
    // Optimize for Supabase connection pooling
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Query logging disabled by default for performance
  // Enable with LOG_QUERIES=true if needed for debugging

  // Log database errors
  prisma.$on('error', (e: Prisma.LogEvent) => {
    logger.error(
      {
        type: 'database',
        error: e,
      },
      'Database error occurred',
    );
  });

  // Add performance monitoring middleware
  prisma.$use(
    async (
      params: Prisma.MiddlewareParams,
      next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
    ) => {
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
    },
  );

  console.log('✅ Prisma client created successfully');
  return prisma;
};

// Singleton instance with better error handling
let prisma: PrismaClient | null = null;

export const getPrismaClient = () => {
  try {
    if (!prisma) {
      prisma = createPrismaClient();
    }
    return prisma;
  } catch (error) {
    console.error('❌ Failed to create Prisma client:', error);
    logger.error('Failed to create Prisma client', error);
    throw error;
  }
};

// Enhanced health check utility
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking database health...');
    const client = getPrismaClient();

    const start = Date.now();
    await client.$queryRaw`SELECT 1 as health_check`;
    const duration = Date.now() - start;

    console.log(`✅ Database health check passed in ${duration}ms`);
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    logger.error('Database health check failed', error);
    return false;
  }
};

// Enhanced connection test with detailed error info
export const testDatabaseConnection = async (): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    console.log('🔍 Testing database connection...');

    if (!process.env.DATABASE_URL) {
      return {
        success: false,
        error: 'DATABASE_URL environment variable not set',
      };
    }

    const client = getPrismaClient();

    // Test basic connectivity
    const start = Date.now();
    const result = await client.$queryRaw`SELECT 1 as test, NOW() as timestamp`;
    const duration = Date.now() - start;

    console.log('✅ Database connection test successful:', {
      duration,
      result,
    });

    return {
      success: true,
      details: {
        duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('❌ Database connection test failed:', error);

    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string })?.code,
      name: error instanceof Error ? error.name : 'Unknown',
    };

    logger.error('Database connection test failed', errorDetails);

    return {
      success: false,
      error: errorDetails.message,
      details: errorDetails,
    };
  }
};

// Graceful shutdown with timeout
export const disconnectDatabase = async (timeoutMs: number = 5000): Promise<void> => {
  if (prisma) {
    try {
      console.log('🔧 Disconnecting from database...');

      const disconnectPromise = prisma.$disconnect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database disconnect timeout')), timeoutMs),
      );

      await Promise.race([disconnectPromise, timeoutPromise]);

      prisma = null;
      console.log('✅ Database disconnected successfully');
      logger.info('Database connection closed');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error);
      logger.error('Error disconnecting from database', error);
      // Force set to null even if disconnect failed
      prisma = null;
    }
  }
};

// Transaction utility with better error handling
export const withTransaction = async <T>(
  callback: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
  ) => Promise<T>,
): Promise<T> => {
  const client = getPrismaClient();

  try {
    console.log('🔧 Starting database transaction...');
    const start = Date.now();

    const result = await client.$transaction(callback);

    const duration = Date.now() - start;
    console.log(`✅ Transaction completed in ${duration}ms`);

    return result;
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    logger.error('Database transaction failed', error);
    throw error;
  }
};

// Utility to safely execute database operations
export const safeDbOperation = async <T>(
  operation: () => Promise<T>,
  fallback?: T,
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    console.error('❌ Database operation failed:', error);
    logger.error('Database operation failed', error);

    if (fallback !== undefined) {
      return fallback;
    }

    return null;
  }
};
