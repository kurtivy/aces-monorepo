#!/usr/bin/env ts-node

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from '../lib/database';
import { logger } from '../lib/logger';

interface QueryResult {
  test: number;
}

async function handleShutdown() {
  logger.info('Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
}

async function testDatabaseConnection() {
  const prisma = getPrismaClient();

  try {
    logger.info({ phase: 'start' }, 'Starting database connection test');

    // Test basic connection
    logger.info({ phase: 'health_check' }, 'Checking database health...');
    const isHealthy = await checkDatabaseHealth();

    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    logger.info({ phase: 'health_check', status: 'success' }, '✅ Database connection successful!');

    // Test a simple query
    logger.info({ phase: 'query_test' }, 'Testing simple query...');
    const result = await prisma.$queryRaw<QueryResult[]>`SELECT 1 as test`;

    if (!result?.[0]?.test) {
      throw new Error('Query returned unexpected result');
    }

    logger.info(
      { phase: 'query_test', status: 'success', result: result[0] },
      '✅ Simple query successful',
    );

    // Test table existence
    try {
      logger.info({ phase: 'table_test' }, 'Testing table access...');
      const userCount = await prisma.user.count();
      logger.info(
        { phase: 'table_test', status: 'success', userCount },
        '✅ Tables exist and accessible',
      );
    } catch (error) {
      logger.warn(
        { phase: 'table_test', status: 'warning', error },
        '⚠️  Tables may not exist yet. Run: npx prisma migrate dev --name init',
      );
    }

    logger.info(
      { phase: 'complete', status: 'success' },
      '✅ All database tests completed successfully',
    );
  } catch (error) {
    logger.error(
      { phase: 'error', error: error instanceof Error ? error.message : String(error) },
      '❌ Database connection test failed',
    );
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// Handle shutdown signals
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Only run if called directly
if (require.main === module) {
  testDatabaseConnection().catch((error) => {
    logger.error({ error }, 'Unhandled error in database test script');
    process.exit(1);
  });
}
