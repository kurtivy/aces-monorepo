import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { registerAuth } from '../../plugins/auth';
import { handleError } from '../../lib/errors';
import { loggers } from '../../lib/logger';
import { disconnectDatabase } from '../../lib/database';

export interface SetupOptions {
  multipart?: boolean;
  fileSize?: number; // in bytes
}

export const setupCommonPlugins = async (fastify: FastifyInstance, options: SetupOptions = {}) => {
  // Register helmet for security
  await fastify.register(helmet);

  // 🚨 TEMPORARY: Allow ALL origins for testing
  await fastify.register(cors, {
    origin: true, // This allows ALL origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-Wallet-Address',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Register multipart if needed (for file uploads)
  if (options.multipart) {
    await fastify.register(multipart, {
      limits: {
        fileSize: options.fileSize || 5 * 1024 * 1024, // Default 5MB
      },
    });
  }

  // Register auth plugin
  await fastify.register(registerAuth);
};

// Common error handler setup
export const setupErrorHandling = (fastify: FastifyInstance) => {
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
};

// Common hooks setup
export const setupCommonHooks = (fastify: FastifyInstance) => {
  // 🚨 TEMPORARY: Simplified OPTIONS handler for testing
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      console.log(`🔍 OPTIONS request for: ${request.url} from origin: ${request.headers.origin}`);

      // Allow ALL origins for testing
      reply.header('Access-Control-Allow-Origin', request.headers.origin || '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Wallet-Address',
      );
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Access-Control-Max-Age', '86400');

      return reply.code(204).send();
    }
  });

  // Request timing and logging
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    loggers.request(request.id, request.method, request.url, request.headers['user-agent']);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    loggers.response(request.id, request.method, request.url, reply.statusCode, responseTime);
  });

  // Cleanup hook
  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });
};
