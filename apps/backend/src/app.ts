import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
// Remove this import since we're not using the CORS plugin anymore
// import cors from '@fastify/cors';

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

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { registerAuth } from './plugins/auth';
import { submissionsRoutes } from './routes/v1/submissions';
import { adminRoutes } from './routes/v1/admin';
import { bidsRoutes } from './routes/v1/bids';
import { accountVerificationRoutes } from './routes/v1/account-verification';
import { usersRoutes } from './routes/v1/users';
import { webhooksRoutes } from './routes/v1/webhooks';
import listingsRoutes from './routes/v1/listings';
import tokensRoutes from './routes/v1/tokens';
import contactRoutes from './routes/v1/contact';

export const buildApp = async (): Promise<FastifyInstance> => {
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
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Manual CORS handling (replaces the CORS plugin)
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    // Check if origin is allowed
    let isAllowed = false;

    if (!origin) {
      isAllowed = true; // Allow requests with no origin (like mobile apps or curl requests)
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      isAllowed = true; // Always allow localhost for development
    } else if (origin.endsWith('.vercel.app')) {
      isAllowed = true; // Allow all vercel.app deployments (preview deployments)
    } else {
      // Production domains
      const allowedDomains = [
        'https://www.aces.fun',
        'https://aces.fun',
        'https://aceofbase.fun',
        'https://www.aceofbase.fun',
      ];

      // Environment-specific origins
      if (process.env.FRONTEND_URL) {
        allowedDomains.push(process.env.FRONTEND_URL);
      }

      isAllowed = allowedDomains.includes(origin);
    }

    if (isAllowed) {
      // Set CORS headers for allowed origins
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Wallet-Address',
      );
    } else {
      console.log('🚫 CORS rejected origin:', origin);
    }

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      console.log('🔍 OPTIONS request for:', request.url, 'from origin:', origin);

      if (isAllowed) {
        reply.header('Access-Control-Max-Age', '86400');
        return reply.code(204).send();
      } else {
        return reply.code(403).send('CORS not allowed');
      }
    }
  });

  // Register custom plugins
  fastify.register(registerAuth);

  // Register v1 routes with proper API prefixes
  fastify.register(submissionsRoutes, { prefix: '/api/v1/submissions' });
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' });
  fastify.register(accountVerificationRoutes, { prefix: '/api/v1/account-verification' });
  fastify.register(usersRoutes, { prefix: '/api/v1/users' });
  fastify.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });
  fastify.register(listingsRoutes, { prefix: '/api/v1/listings' });
  fastify.register(tokensRoutes, { prefix: '/api/v1/tokens' });
  fastify.register(contactRoutes, { prefix: '/api/v1/contact' });

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Health check routes
  fastify.get('/health/live', async () => ({ status: 'ok' }));
  fastify.get('/health/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Log the error with full context
    loggers.error(error instanceof Error ? error : new Error('Unknown error'), {
      url: request.url,
      method: request.method,
      headers: request.headers,
      params: request.params,
      query: request.query,
      userId: request.user?.id,
      requestId: request.id,
    });

    try {
      handleError(error, reply);
    } catch (handlerError) {
      loggers.error(
        handlerError instanceof Error ? handlerError : new Error('Error handler failed'),
        {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          url: request.url,
          method: request.method,
          requestId: request.id,
        },
      );
      handleError(handlerError, reply);
    }
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};
