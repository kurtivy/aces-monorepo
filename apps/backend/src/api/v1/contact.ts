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
import { contactRoutes } from '../../routes/v1/contact';

const buildContactApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Use shared plugins setup (includes CORS, helmet, auth)
  await setupCommonPlugins(fastify, { multipart: false });

  // Register route handlers
  fastify.register(contactRoutes);

  // Use shared error handling and hooks
  setupErrorHandling(fastify);
  setupCommonHooks(fastify);

  return fastify;
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildContactApp();
  await app.ready();

  // Handle path rewriting: /api/v1/contact/... → /...
  if (req.url?.startsWith('/api/v1/contact')) {
    req.url = req.url.replace('/api/v1/contact', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
