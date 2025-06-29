import Fastify, { FastifyInstance } from 'fastify';
import { PrivyClient } from '@privy-io/server-auth';
import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { logger, loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { randomUUID } from 'crypto';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      privyDid: string;
      walletAddress: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    startTime?: number;
  }

  interface FastifyInstance {
    prisma: ReturnType<typeof getPrismaClient>;
  }
}

const prisma = getPrismaClient();

// Initialize Privy client
const privyClient = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);

// Build the server
const buildServer = async () => {
  const fastify = Fastify({
    logger: false, // Use our custom logger instead
    genReqId: () => randomUUID(),
  });

  // Register Prisma on Fastify instance
  fastify.decorate('prisma', prisma);

  // Register CORS
  await fastify.register(import('@fastify/cors'), {
    origin: process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : true,
    credentials: true,
  });

  // Register security headers
  await fastify.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false, // Disable for development
  });

  // Register rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    loggers.error(error, {
      requestId: request.id,
      method: request.method,
      url: request.url,
    });
    handleError(reply, error);
  });

  // Add start time to request for response time calculation
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  // Authentication plugin
  await fastify.register(async function (fastify) {
    fastify.decorateRequest('user');

    fastify.addHook('preHandler', async (request) => {
      const authHeader = request.headers.authorization;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);

          const claims = await privyClient.verifyAuthToken(token);

          // Find or create user in database
          let user = await prisma.user.findUnique({
            where: { privyDid: claims.userId },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                privyDid: claims.userId,
                walletAddress: null, // Will be updated later when wallet is connected
              },
            });

            loggers.auth(user.id, user.walletAddress || undefined, 'registered');
          } else {
            loggers.auth(user.id, user.walletAddress || undefined, 'authenticated');
          }

          request.user = user;
        } catch (error) {
          // Optional auth - don't throw error, just log warning
          logger.warn({ error, requestId: request.id }, 'Auth verification failed');
        }
      }
    });
  });

  // Response logging hook
  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Health check routes
  fastify.get('/api/v1/health/live', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/api/v1/health/ready', async () => {
    const dbHealthy = await checkDatabaseHealth();

    if (!dbHealthy) {
      throw new Error('Database not ready');
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  });

  // Basic API info endpoint
  fastify.get('/api/v1/info', async () => {
    return {
      name: 'ACES Backend API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  });

  return fastify;
};

// Graceful shutdown handling
const gracefulShutdown = async (signal: string, server: FastifyInstance) => {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  try {
    await server.close();
    await disconnectDatabase();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

// Start server
const start = async () => {
  try {
    const server = await buildServer();

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

    // Set up graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
    process.on('SIGINT', () => gracefulShutdown('SIGINT', server));

    await server.listen({ port, host });

    logger.info({ port, host, env: process.env.NODE_ENV }, 'Server started successfully');

    return server;
  } catch (err) {
    logger.error({ error: err }, 'Failed to start server');
    process.exit(1);
  }
};

// Only start if this file is run directly (not imported)
if (require.main === module) {
  start();
}

// Export the server builder for testing and Vercel
export { buildServer };
export default start;
