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
  // Authentication middleware for protected routes
  fastify.addHook('preHandler', async (request) => {
    // Skip auth check for public routes
    const publicRoutes = ['/listings', '/listings/:listingId'];

    const isPublicRoute = publicRoutes.some((route) => {
      const pattern = route.replace(':listingId', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    if (isPublicRoute) {
      return;
    }

    // All other routes require authentication
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    // Admin routes require admin role
    const adminRoutes = ['/listings/:listingId/toggle', '/admin/listings'];

    const isAdminRoute = adminRoutes.some((route) => {
      const pattern = route.replace(':listingId', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    if (isAdminRoute && request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }
  });

  // Public routes - no authentication required
  fastify.get('/listings', async (request, reply) => {
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

  fastify.get('/listings/:listingId', async (request, reply) => {
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
  fastify.get('/listings/my-listings', async (request, reply) => {
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
  fastify.post('/listings/:listingId/toggle', async (request, reply) => {
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

  fastify.get('/admin/listings', async (request, reply) => {
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
