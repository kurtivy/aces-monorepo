"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = exports.disconnectDatabase = exports.checkDatabaseHealth = exports.getPrismaClient = void 0;
const logger_1 = require("./logger");
// Import PrismaClient from the correct path
const client_1 = require("@prisma/client");
const createPrismaClient = () => {
    const prisma = new client_1.PrismaClient({
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
            logger_1.logger.debug({
                type: 'database',
                query: e.query,
                params: e.params,
                duration: e.duration,
            }, 'Database query executed');
        });
    }
    // Log database errors
    prisma.$on('error', (e) => {
        logger_1.logger.error({
            type: 'database',
            error: e,
        }, 'Database error occurred');
    });
    // Add performance monitoring middleware
    prisma.$use(async (params, next) => {
        const start = Date.now();
        const result = await next(params);
        const duration = Date.now() - start;
        // Log slow queries
        if (duration > 1000) {
            logger_1.logger.warn({
                type: 'database',
                action: params.action,
                model: params.model,
                duration,
            }, 'Slow database query detected');
        }
        return result;
    });
    return prisma;
};
// Singleton instance
let prisma;
const getPrismaClient = () => {
    if (!prisma) {
        prisma = createPrismaClient();
    }
    return prisma;
};
exports.getPrismaClient = getPrismaClient;
// Health check utility
const checkDatabaseHealth = async () => {
    try {
        const client = (0, exports.getPrismaClient)();
        await client.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Database health check failed');
        return false;
    }
};
exports.checkDatabaseHealth = checkDatabaseHealth;
// Graceful shutdown
const disconnectDatabase = async () => {
    if (prisma) {
        await prisma.$disconnect();
        logger_1.logger.info('Database connection closed');
    }
};
exports.disconnectDatabase = disconnectDatabase;
// Transaction utility
const withTransaction = async (callback) => {
    const client = (0, exports.getPrismaClient)();
    return await client.$transaction(callback);
};
exports.withTransaction = withTransaction;
