import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ListingService } from '../../services/listing-service';
import { getPrismaClient } from '../../lib/database';
import { errors } from '../../lib/errors';
import { logger } from '../../lib/logger';

const listingService = new ListingService(getPrismaClient());

// Schema definitions
const toggleListingStatusSchema = z.object({
  isLive: z.boolean(),
});

const listingParamsSchema = z.object({
  listingId: z.string().cuid(),
});

export async function listingsRoutes(fastify: FastifyInstance) {
  // Public routes - no authentication required
  // GET / - Get all live listings (was /listings, now / since path is rewritten)
  fastify.get('/', async (request, reply) => {
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

  // GET /:listingId - Get specific listing
  fastify.get('/:listingId', async (request, reply) => {
    try {
      const { listingId } = listingParamsSchema.parse(request.params);
      logger.info(`Getting listing by ID: ${listingId}`);
      const listing = await listingService.getListingById(listingId);
      return reply.status(200).send({
        success: true,
        data: listing,
      });
    } catch (error) {
      logger.error(
        `Error getting listing ${(request.params as { listingId: string })?.listingId}:`,
        error,
      );
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
  });

  // User routes - authentication required
  // GET /my - Get user's listings
  fastify.get('/my', async (request, reply) => {
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

  // Admin routes - authentication + admin role required
  // POST /:listingId/toggle - Toggle listing status
  fastify.post('/:listingId/toggle', async (request, reply) => {
    try {
      const { listingId } = listingParamsSchema.parse(request.params);
      const { isLive } = toggleListingStatusSchema.parse(request.body);
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      if (request.user?.role !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Admin access required',
        });
      }

      logger.info(
        `Admin ${userId} toggling listing ${listingId} to ${isLive ? 'live' : 'inactive'}`,
      );

      const result = await listingService.updateListingStatus({
        listingId,
        isLive,
        updatedBy: userId,
      });

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error toggling listing status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update listing status',
      });
    }
  });

  // GET /admin/all - Get all listings for admin
  fastify.get('/admin/all', async (request, reply) => {
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
}
