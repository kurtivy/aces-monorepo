import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from '../lib/database';
import { loggers } from '../lib/logger';
import { handleError } from '../lib/errors';
import { registerAuth } from '../plugins/auth';
import { bidsRoutes } from '../routes/v1/bids';

const buildBidsApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(cors, { origin: '*' });
  fastify.register(helmet);
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register custom plugins
  fastify.register(registerAuth);
  fastify.register(bidsRoutes);

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
  fastify.get('/api/v1/health/live', async () => ({ status: 'ok' }));
  fastify.get('/api/v1/health/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    handleError(reply, error);
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};

export default async (req: any, res: any) => {
  const app = await buildBidsApp();
  await app.ready();
  app.server.emit('request', req, res);
};
