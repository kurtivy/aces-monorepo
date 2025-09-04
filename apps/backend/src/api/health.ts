import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import { createServerlessHandler } from '../lib/serverless-adapter';

// Extend Fastify types to include custom properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

import { loggers } from '../lib/logger';
import { handleError } from '../lib/errors';

const buildHealthApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  // Register plugins
  fastify.register(helmet);

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Simple health check routes - no database required
  fastify.get('/live', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  }));

  // Database health check - but don't fail if database is unavailable
  fastify.get('/ready', async () => {
    try {
      // Only check database if DATABASE_URL is available
      if (process.env.DATABASE_URL) {
        const { getPrismaClient } = await import('../lib/database');
        const prisma = getPrismaClient();
        await prisma.$queryRaw`SELECT 1 as health_check`;
        return {
          status: 'ready',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          database: 'connected',
        };
      } else {
        return {
          status: 'ready',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          database: 'no_database_url',
        };
      }
    } catch (error) {
      // Don't fail the health check if database is down
      return {
        status: 'ready',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: 'error',
        databaseError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    try {
      handleError(error, reply);
    } catch (handlerError) {
      handleError(handlerError, reply);
    }
  });

  return fastify;
};

// Export the serverless handler
export default createServerlessHandler(buildHealthApp);
