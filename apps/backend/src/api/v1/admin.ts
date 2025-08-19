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

import { getPrismaClient } from '../../lib/database';
import { setupCommonPlugins, setupErrorHandling, setupCommonHooks } from '../shared/setup';
import { adminRoutes } from '../../routes/v1/admin';

const buildAdminApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Setup common plugins (CORS, helmet, auth)
  await setupCommonPlugins(fastify);

  // Setup error handling
  setupErrorHandling(fastify);

  // Setup common hooks (logging, cleanup)
  setupCommonHooks(fastify);

  // Register admin routes
  fastify.register(adminRoutes);

  // Common hooks and error handling are now setup via setupCommonHooks() and setupErrorHandling()

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildAdminApp();
  await app.ready();

  // Handle path rewriting: /api/v1/admin/something → /something
  if (req.url?.startsWith('/api/v1/admin')) {
    req.url = req.url.replace('/api/v1/admin', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
