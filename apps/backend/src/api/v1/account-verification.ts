import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { User as PrismaUser, PrismaClient } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
import { accountVerificationRoutes } from '../../routes/v1/account-verification';

const buildAccountVerificationApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Use shared plugins setup (includes CORS, helmet, auth, multipart)
  await setupCommonPlugins(fastify, {
    multipart: true,
    fileSize: 5 * 1024 * 1024, // 5MB
  });

  // Register route handlers
  fastify.register(accountVerificationRoutes);

  // Use shared error handling and hooks
  setupErrorHandling(fastify);
  setupCommonHooks(fastify);

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildAccountVerificationApp();
  await app.ready();

  // Handle path rewriting: /api/v1/account-verification/... → /...
  if (req.url?.startsWith('/api/v1/account-verification')) {
    req.url = req.url.replace('/api/v1/account-verification', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
