import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';

import { PrismaClient } from '@prisma/client';

// Extend Fastify types to include custom properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

import { getPrismaClient, disconnectDatabase } from '../lib/database';
import { loggers } from '../lib/logger';
import { handleError } from '../lib/errors';
import { registerAuth } from '../plugins/auth';
import { tokenCreationRoutes } from '../routes/v1/token-creation';

const buildTokenCreationApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(helmet);

  // Register custom plugins
  fastify.register(registerAuth);
  fastify.register(tokenCreationRoutes);

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

import type { VercelRequest, VercelResponse } from '@vercel/node';

let appPromise: Promise<FastifyInstance> | undefined;

const handler = async (req: VercelRequest, res: VercelResponse) => {
  try {
    appPromise = appPromise ?? buildTokenCreationApp();
    const app = await appPromise;
    await app.ready();

    // Add CORS for Vercel deployment
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://www.aces.fun',
      'https://aces.fun',
      'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-main-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app',
    ];

    if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    await app
      .inject({
        method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS',
        url: req.url || '/',
        headers: req.headers as Record<string, string>,
        payload: req.body,
      })
      .then((result) => {
        res.status(result.statusCode);

        // Set response headers
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });

        res.end(result.payload);
      });
  } catch (error) {
    console.error('API Handler Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export default handler;
