// backend/src/api/v1/users.ts
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
import { usersRoutes } from '../../routes/v1/users';

const buildUsersApp = async (): Promise<FastifyInstance> => {
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

  // Register user profile routes
  fastify.register(usersRoutes);

  // Common hooks and error handling are now setup via setupCommonHooks() and setupErrorHandling()

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildUsersApp();
  await app.ready();

  // Handle path rewriting: /api/v1/users/me → /me
  if (req.url?.startsWith('/api/v1/users')) {
    req.url = req.url.replace('/api/v1/users', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
