import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyMetrics from 'fastify-metrics';
import { User as PrismaUser, PrismaClient } from '@prisma/client';

// Extend Fastify types to include custom properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user: PrismaUser | null;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { registerAuth } from './plugins/auth';
import { submissionsRoutes } from './routes/v1/submissions';
import { adminRoutes } from './routes/v1/admin';
import { bidsRoutes } from './routes/v1/bids';
import { sellerVerificationRoutes } from './routes/v1/seller-verification';
import { userProfileRoutes } from './routes/v1/user-profile';
import { webhooksRoutes } from './routes/v1/webhooks';

export const buildApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(cors, { origin: '*' });
  fastify.register(helmet);
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register custom plugins
  fastify.register(registerAuth);

  // Register v1 routes with proper API prefixes
  fastify.register(submissionsRoutes, { prefix: '/submissions' });
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' });
  fastify.register(sellerVerificationRoutes, { prefix: '/api/v1/seller-verification' });
  fastify.register(userProfileRoutes, { prefix: '/api/v1/users' });
  fastify.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Health check routes
  fastify.get('/health/live', async () => ({ status: 'ok' }));
  fastify.get('/health/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    try {
      handleError(error, reply);
    } catch (error) {
      handleError(error, reply);
    }
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};
