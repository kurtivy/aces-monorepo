import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import helmet from '@fastify/helmet';
import fastifyMetrics from 'fastify-metrics';
import { User as PrismaUser, PrismaClient } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ListingService } from '../services/listing-service';
import { getPrismaClient, disconnectDatabase } from '../lib/database';
import { errors, handleError } from '../lib/errors';
import { logger } from '../lib/logger';

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

const listingService = new ListingService(getPrismaClient());

// Schema definitions
const toggleListingStatusSchema = z.object({
  isLive: z.boolean(),
});

const listingParamsSchema = z.object({
  listingId: z.string().cuid(),
});

const buildListingsApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  // CORS handled at CDN level via vercel.json
  fastify.register(helmet);
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    logger.info(`${request.id} ${request.method} ${request.url} ${request.headers['user-agent']}`);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    logger.info(
      `${request.id} ${request.method} ${request.url} ${reply.statusCode} ${responseTime}ms`,
    );
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

  // Register routes
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Getting all live listings');

      const listings = await listingService.getLiveListings();

      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length,
      });
    } catch (error) {
      logger.error('Error getting live listings:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch live listings',
      });
    }
  });

  fastify.get(
    '/:listingId',
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof listingParamsSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);

        logger.info(`Getting listing by ID: ${listingId}`);

        const listing = await listingService.getListingById(listingId);

        return reply.status(200).send({
          success: true,
          data: listing,
        });
      } catch (error) {
        logger.error(`Error getting listing ${request.params.listingId}:`, error);

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            success: false,
            error: 'Listing not found',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch listing',
        });
      }
    },
  );

  fastify.post(
    '/:listingId/toggle',
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof listingParamsSchema>;
        Body: z.infer<typeof toggleListingStatusSchema>;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { listingId } = listingParamsSchema.parse(request.params);
        const { isLive } = toggleListingStatusSchema.parse(request.body);

        // Get user from request (should be set by auth middleware)
        const userId = request.user?.id;
        const userRole = request.user?.role;

        if (!userId || userRole !== 'ADMIN') {
          return reply.status(403).send({
            success: false,
            error: 'Admin access required',
          });
        }

        logger.info(`Admin ${userId} toggling listing ${listingId} to isLive: ${isLive}`);

        const updatedListing = await listingService.updateListingStatus({
          listingId,
          isLive,
          updatedBy: userId,
        });

        return reply.status(200).send({
          success: true,
          data: updatedListing,
          message: `Listing ${isLive ? 'activated' : 'deactivated'} successfully`,
        });
      } catch (error) {
        logger.error(`Error toggling listing status for ${request.params.listingId}:`, error);

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            success: false,
            error: 'Listing not found',
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Failed to update listing status',
        });
      }
    },
  );

  fastify.get('/admin/all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      const userRole = request.user?.role;

      if (!userId || userRole !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Admin access required',
        });
      }

      logger.info(`Admin ${userId} getting all listings`);

      const listings = await listingService.getAllListings();

      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length,
      });
    } catch (error) {
      logger.error('Error getting all listings for admin:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch listings',
      });
    }
  });

  fastify.get('/my', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info(`User ${userId} getting their listings`);

      const listings = await listingService.getListingsByOwner(userId);

      return reply.status(200).send({
        success: true,
        data: listings,
        count: listings.length,
      });
    } catch (error) {
      logger.error(`Error getting listings for user ${request.user?.id}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch your listings',
      });
    }
  });

  return fastify;
};

import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildListingsApp();
  await app.ready();

  // Handle path rewriting: /api/v1/listings/something → /something
  if (req.url?.startsWith('/api/v1/listings')) {
    req.url = req.url.replace('/api/v1/listings', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
