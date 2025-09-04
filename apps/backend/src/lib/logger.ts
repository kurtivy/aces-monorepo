import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
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
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  base: {
    service: 'aces-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
});

// Utility functions for structured logging
export const loggers = {
  request: (requestId: string, method: string, url: string, userAgent?: string) =>
    logger.info(
      {
        type: 'request',
        requestId,
        method,
        url,
        userAgent,
      },
      'Request received',
    ),

  response: (
    requestId: string,
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
  ) =>
    logger.info(
      {
        type: 'response',
        requestId,
        method,
        url,
        statusCode,
        responseTime,
      },
      'Request completed',
    ),

  auth: (
    userId: string,
    walletAddress: string | null,
    action: 'registered' | 'authenticated' | 'admin_validated' | 'admin_rejected',
  ) =>
    logger.info(
      {
        type: 'auth',
        userId,
        walletAddress,
        action,
      },
      `User ${action}`,
    ),

  blockchain: (txHash: string, action: string, contractAddress?: string) =>
    logger.info(
      {
        type: 'blockchain',
        txHash,
        action,
        contractAddress,
      },
      `Blockchain ${action}`,
    ),

  database: (operation: string, table: string, recordId?: string, duration?: number) =>
    logger.info(
      {
        type: 'database',
        operation,
        table,
        recordId,
        duration,
      },
      `Database ${operation}`,
    ),

  error: (error: Error, context: Record<string, unknown> = {}) =>
    logger.error(
      {
        type: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...context,
      },
      error.message,
    ),
};
