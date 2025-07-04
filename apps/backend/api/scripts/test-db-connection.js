#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../lib/database");
const logger_1 = require("../lib/logger");
async function handleShutdown() {
    logger_1.logger.info('Shutting down gracefully...');
    await (0, database_1.disconnectDatabase)();
    process.exit(0);
}
async function testDatabaseConnection() {
    const prisma = (0, database_1.getPrismaClient)();
    try {
        logger_1.logger.info({ phase: 'start' }, 'Starting database connection test');
        // Test basic connection
        logger_1.logger.info({ phase: 'health_check' }, 'Checking database health...');
        const isHealthy = await (0, database_1.checkDatabaseHealth)();
        if (!isHealthy) {
            throw new Error('Database health check failed');
        }
        logger_1.logger.info({ phase: 'health_check', status: 'success' }, '✅ Database connection successful!');
        // Test a simple query
        logger_1.logger.info({ phase: 'query_test' }, 'Testing simple query...');
        const result = await prisma.$queryRaw `SELECT 1 as test`;
        if (!result?.[0]?.test) {
            throw new Error('Query returned unexpected result');
        }
        logger_1.logger.info({ phase: 'query_test', status: 'success', result: result[0] }, '✅ Simple query successful');
        // Test table existence
        try {
            logger_1.logger.info({ phase: 'table_test' }, 'Testing table access...');
            const userCount = await prisma.user.count();
            logger_1.logger.info({ phase: 'table_test', status: 'success', userCount }, '✅ Tables exist and accessible');
        }
        catch (error) {
            logger_1.logger.warn({ phase: 'table_test', status: 'warning', error }, '⚠️  Tables may not exist yet. Run: npx prisma migrate dev --name init');
        }
        logger_1.logger.info({ phase: 'complete', status: 'success' }, '✅ All database tests completed successfully');
    }
    catch (error) {
        logger_1.logger.error({ phase: 'error', error: error instanceof Error ? error.message : String(error) }, '❌ Database connection test failed');
        process.exit(1);
    }
    finally {
        await (0, database_1.disconnectDatabase)();
    }
}
// Handle shutdown signals
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
// Only run if called directly
if (require.main === module) {
    testDatabaseConnection().catch((error) => {
        logger_1.logger.error({ error }, 'Unhandled error in database test script');
        process.exit(1);
    });
}
