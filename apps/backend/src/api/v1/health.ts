import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { User as PrismaUser, PrismaClient } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

import { getPrismaClient, checkDatabaseHealth } from '../../lib/database';
import { setupCommonPlugins, setupErrorHandling, setupCommonHooks } from '../shared/setup';

const buildHealthApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Always decorate the request with user property for compatibility
  fastify.decorateRequest('user', null);

  // Use shared plugins setup (includes CORS, helmet)
  // Health endpoints don't need auth
  await setupCommonPlugins(fastify, { multipart: false });

  // Use shared error handling and hooks
  setupErrorHandling(fastify);
  setupCommonHooks(fastify);

  // Health check routes
  fastify.get('/live', async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready', version: '1.0.0', timestamp: new Date().toISOString() };
  });

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildHealthApp();
  await app.ready();

  // Handle path rewriting: /api/v1/health/... → /...
  if (req.url?.startsWith('/api/v1/health')) {
    req.url = req.url.replace('/api/v1/health', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
