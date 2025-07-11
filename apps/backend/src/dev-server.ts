import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyMetrics from 'fastify-metrics';
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

// Import routes
import { submissionsRoutes } from './routes/v1/submissions';
import { bidsRoutes } from './routes/v1/bids';
import { adminRoutes } from './routes/v1/admin';
import { webhooksRoutes } from './routes/v1/webhooks';

const buildDevServer = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger:
      process.env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }
        : false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(cors, { origin: '*' });
  fastify.register(helmet);
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register custom plugins
  fastify.register(registerAuth);

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
  fastify.get('/api/v1/health/live', async () => ({ status: 'ok' }));
  fastify.get('/api/v1/health/ready', async () => {
    const isDbReady = await checkDatabaseHealth();
    if (!isDbReady) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  });

  // Register API routes - these mirror the serverless functions
  fastify.register(submissionsRoutes, { prefix: '/api/v1/submissions' });
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' });
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  fastify.register(webhooksRoutes, { prefix: '/api/v1/webhooks' });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    handleError(reply, error);
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  return fastify;
};

const start = async () => {
  try {
    const app = await buildDevServer();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Development server running on http://localhost:${port}`);
    console.log(`📊 Metrics available at http://localhost:${port}/metrics`);
    console.log(`🔍 API endpoints:`);
    console.log(`   - Submissions: http://localhost:${port}/api/v1/submissions/live`);
    console.log(`   - Health: http://localhost:${port}/api/v1/health/live`);
  } catch (err) {
    console.error('Error starting development server:', err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

start();
