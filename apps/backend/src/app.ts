import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';

import { getPrismaClient, checkDatabaseHealth, disconnectDatabase } from './lib/database';
import { loggers } from './lib/logger';
import { handleError } from './lib/errors';
import { registerAuth } from './plugins/auth';
import { submissionRoutes } from './routes/v1/submissions';
import { adminRoutes } from './routes/v1/admin'; // Step 2: Enabled
import { bidsRoutes } from './routes/v1/bids';
import { accountVerificationRoutes } from './routes/v1/verification'; // Step 2: Enabled
import { usersRoutes } from './routes/v1/users';
// import { webhooksRoutes } from './routes/v1/webhooks';
import { listingRoutes } from './routes/v1/listings'; // Step 5: Enabled
import { contactRoutes } from './routes/v1/contact';
import { purchaseRoutes } from './routes/v1/purchase';
import { commentsRoutes } from './routes/v1/comments';
import { tokensRoutes } from './routes/v1/tokens';
import { twitchRoutes } from './routes/v1/twitch';
import { priceRoutes } from './routes/v1/price';
import gcsTestRoutes from './routes/v1/debug/gcs-test';

import { cronRoutes } from './routes/v1/cron/trigger';

// NEW: Phase 1 - Token creation and notifications
import { notificationRoutes } from './routes/v1/notifications';
import { tokenCreationRoutes } from './routes/v1/token-creation';
import productImagesRoutes from './routes/v1/product-images';

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

  // Register custom plugins
  fastify.register(registerAuth);

  // Dynamic CORS configuration
  const getAllowedOrigins = () => {
    const origins = [];

    // Always allow localhost for development (regardless of NODE_ENV)
    origins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002');

    // Production origins from environment variables
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }

    // Staging/dev branch URLs (common Vercel pattern)
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`);
    }

    // Production domains
    origins.push(
      'https://www.aces.fun',
      'https://aces.fun',
      'https://aces-monorepo-git-dev-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-main-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app',
      'https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app',
    );

    return origins;
  };

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (!origin) return false;

    const allowedOrigins = getAllowedOrigins();

    // Exact match for listed origins
    if (allowedOrigins.includes(origin)) return true;

    // Allow any vercel.app preview deployment
    if (origin.endsWith('.vercel.app')) return true;

    return false;
  };

  // Add CORS hook to all requests
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    if (isOriginAllowed(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        .header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        )
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Vary', 'Origin');
    }
  });

  // Handle OPTIONS preflight requests globally with proper CORS headers
  fastify.options('*', async (request, reply) => {
    const origin = request.headers.origin;

    if (isOriginAllowed(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        .header(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, Accept, Origin, X-Requested-With',
        )
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Access-Control-Max-Age', '86400')
        .header('Vary', 'Origin');
    }

    reply.code(204).send();
  });

  // Register v1 routes with proper API prefixes
  fastify.register(submissionRoutes, { prefix: '/api/v1/submissions' }); // Step 4: Enabled
  fastify.register(adminRoutes, { prefix: '/api/v1/admin' }); // Step 2: Enabled
  fastify.register(bidsRoutes, { prefix: '/api/v1/bids' }); // NEW: Bidding system
  fastify.register(accountVerificationRoutes, { prefix: '/api/v1/verification' }); // Step 2: Enabled
  fastify.register(usersRoutes, { prefix: '/api/v1/users' });
  // import { webhooksRoutes } from './routes/v1/webhooks';
  fastify.register(listingRoutes, { prefix: '/api/v1/listings' }); // Step 5: Enabled
  fastify.register(tokensRoutes, { prefix: '/api/v1/tokens' });
  fastify.register(contactRoutes, { prefix: '/api/v1/contact' });
  fastify.register(purchaseRoutes, { prefix: '/api/v1/purchase' });
  fastify.register(commentsRoutes, { prefix: '/api/v1/comments' });
  fastify.register(twitchRoutes, { prefix: '/api/v1/twitch' });
  fastify.register(priceRoutes, { prefix: '/api/v1/price' });

  // NEW: Phase 1 - Token creation and notifications
  fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  fastify.register(tokenCreationRoutes, { prefix: '/api/v1/token-creation' });
  fastify.register(productImagesRoutes, { prefix: '/api/v1/product-images' });

  // Register debug routes
  fastify.register(gcsTestRoutes, { prefix: '/api/v1' });
  // Register cron routes for manual testing
  fastify.register(cronRoutes);

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
