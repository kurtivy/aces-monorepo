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
// import { registerAuth } from '../plugins/auth'; // Disabled - no auth needed
import { webhooksRoutes } from '../routes/v1/webhooks';

const buildWebhooksApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Always decorate the request with user property for compatibility
  fastify.decorateRequest('user', null);

  // Register plugins
  fastify.register(cors, { origin: '*' });
  fastify.register(helmet);
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register custom plugins
  // fastify.register(registerAuth); // Disabled - no auth needed
  fastify.register(webhooksRoutes);

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
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

import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildWebhooksApp();
  await app.ready();

  // Handle path rewriting: /api/v1/webhooks/something → /something
  if (req.url?.startsWith('/api/v1/webhooks')) {
    req.url = req.url.replace('/api/v1/webhooks', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
