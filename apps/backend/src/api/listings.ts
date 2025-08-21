import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';

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

import { getPrismaClient, disconnectDatabase } from '../lib/database';
import { loggers } from '../lib/logger';
import { handleError } from '../lib/errors';
import { registerAuth } from '../plugins/auth';
import { listingsRoutes } from '../routes/v1/listings';

const buildListingsApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: {
      level: 'info',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: req.headers,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  await fastify.register(helmet);
  await fastify.register(registerAuth);

  // Add CORS handling
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://www.aces.fun',
      'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-main-dan-aces-fun.vercel.app',
    ];

    if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      );
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Vary', 'Origin');
    }
  });

  // Handle OPTIONS preflight
  fastify.options('*', async (request, reply) => {
    reply.code(204).send();
  });

  // Register the listings routes from the routes file
  await fastify.register(listingsRoutes);

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Enhanced error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(
      {
        err: error,
        req: request,
        url: request.url,
        method: request.method,
        headers: request.headers,
        params: request.params,
        query: request.query,
        userId: request.user?.id,
        requestId: request.id,
      },
      'Listings request failed',
    );

    try {
      handleError(error, reply);
    } catch (handlerError) {
      fastify.log.error(
        {
          err: handlerError,
          originalError: error,
          url: request.url,
          method: request.method,
          requestId: request.id,
        },
        'Error handler failed',
      );

      if (!reply.sent) {
        reply.status(500).send({
          success: false,
          error: 'Internal server error',
          requestId: request.id,
        });
      }
    }
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};

import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    const app = await buildListingsApp();
    await app.ready();

    // Handle path rewriting: /api/v1/listings/... → /...
    let path = req.url || '/';

    if (path.startsWith('/api/v1/listings')) {
      path = path.replace('/api/v1/listings', '') || '/';
    }

    req.url = path;

    console.log('🔍 Listings handler processing:', {
      originalUrl: req.url,
      rewrittenPath: path,
      method: req.method,
    });

    app.server.emit('request', req, res);
  } catch (error) {
    console.error('❌ Listings handler error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
};

export default handler;
