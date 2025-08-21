// backend/src/api/v1/users.ts
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
import { usersRoutes } from '../routes/v1/users';

const buildUsersApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(helmet);

  // CORS configuration for local development
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://www.aces.fun',
      'https://aces.fun',
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

  // Handle OPTIONS preflight requests
  fastify.options('*', async (request, reply) => {
    reply.code(204).send();
  });

  // Register custom plugins
  fastify.register(registerAuth);
  fastify.register(usersRoutes);

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
    appPromise = appPromise ?? buildUsersApp();
    const app = await appPromise;
    await app.ready();

    // Add CORS for Vercel deployment
    const origin = req.headers.origin;
    const isOriginAllowed = (origin: string | undefined): boolean => {
      if (!origin) return false;
      if (origin.endsWith('.vercel.app')) return true;
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://www.aces.fun',
        'https://aces.fun',
      ].includes(origin);
    };

    if (isOriginAllowed(origin) && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    // Handle path rewriting: /api/v1/users/me → /me
    if (req.url?.startsWith('/api/v1/users')) {
      req.url = req.url.replace('/api/v1/users', '') || '/';
    }

    app.server.emit('request', req, res);
  } catch (error) {
    console.error('❌ Users handler error:', error);
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
