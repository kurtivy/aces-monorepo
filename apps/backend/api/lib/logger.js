"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggers = exports.logger = void 0;
const pino_1 = require("pino");
exports.logger = (0, pino_1.pino)({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino_1.pino.stdTimeFunctions.isoTime,
    base: {
        service: 'aces-backend',
        version: process.env.npm_package_version || '1.0.0',
    },
});
// Utility functions for structured logging
exports.loggers = {
    request: (requestId, method, url, userAgent) => exports.logger.info({
        type: 'request',
        requestId,
        method,
        url,
        userAgent,
    }, 'Request received'),
    response: (requestId, method, url, statusCode, responseTime) => exports.logger.info({
        type: 'response',
        requestId,
        method,
        url,
        statusCode,
        responseTime,
    }, 'Request completed'),
    auth: (userId, walletAddress, action) => exports.logger.info({
        type: 'auth',
        userId,
        walletAddress,
        action,
    }, `User ${action}`),
    blockchain: (txHash, action, contractAddress) => exports.logger.info({
        type: 'blockchain',
        txHash,
        action,
        contractAddress,
    }, `Blockchain ${action}`),
    database: (operation, table, recordId, duration) => exports.logger.info({
        type: 'database',
        operation,
        table,
        recordId,
        duration,
    }, `Database ${operation}`),
    error: (error, context = {}) => exports.logger.error({
        type: 'error',
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        ...context,
    }, error.message),
};
