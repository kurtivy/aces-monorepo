// backend/src/api/listings.ts - V1 Clean Implementation
import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';

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
import { listingRoutes } from '../routes/v1/listings';

const buildListingsApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(helmet);
  fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB for listing images
    },
  });

  // Register custom plugins
  fastify.register(registerAuth);
  fastify.register(listingRoutes);

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
    } catch (handlerError) {
      handleError(handlerError, reply);
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
    appPromise = appPromise ?? buildListingsApp();
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
        'https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app',
        'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
        'https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app',
      ].includes(origin);
    };

    // Handle OPTIONS preflight first with proper CORS headers
    if (req.method === 'OPTIONS') {
      if (isOriginAllowed(origin) && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        );
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Vary', 'Origin');
      }
      res.status(204).end();
      return;
    }

    // Set CORS headers for actual requests
    if (isOriginAllowed(origin) && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }

    // Handle path rewriting: /api/v1/listings/something → /something
    if (req.url?.startsWith('/api/v1/listings')) {
      req.url = req.url.replace('/api/v1/listings', '') || '/';
    }

    app.server.emit('request', req, res);
  } catch (error) {
    console.error('⚠ Listings handler error:', error);
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
