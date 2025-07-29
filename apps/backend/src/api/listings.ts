import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ListingService } from '../services/listing-service';
import { getPrismaClient } from '../lib/database';
import { errors } from '../lib/errors';
import { logger } from '../lib/logger';

const listingService = new ListingService(getPrismaClient());

// Schema definitions
const toggleListingStatusSchema = z.object({
  isLive: z.boolean(),
});

const listingParamsSchema = z.object({
  listingId: z.string().cuid(),
});

/**
 * Get all live listings for public view
 * GET /api/v1/listings
 */
export async function getLiveListings(request: FastifyRequest, reply: FastifyReply) {
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
}

/**
 * Get a specific listing by ID
 * GET /api/v1/listings/:listingId
 */
export async function getListingById(
  request: FastifyRequest<{
    Params: z.infer<typeof listingParamsSchema>;
  }>,
  reply: FastifyReply,
) {
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
}

/**
 * Toggle listing live status (Admin only)
 * POST /api/v1/listings/:listingId/toggle
 */
export async function toggleListingStatus(
  request: FastifyRequest<{
    Params: z.infer<typeof listingParamsSchema>;
    Body: z.infer<typeof toggleListingStatusSchema>;
  }>,
  reply: FastifyReply,
) {
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
}

/**
 * Get all listings for admin view (including inactive ones)
 * GET /api/v1/admin/listings
 */
export async function getAllListingsForAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get user from request (should be set by auth middleware)
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
}

/**
 * Get listings by owner (for user dashboard)
 * GET /api/v1/listings/my-listings
 */
export async function getMyListings(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get user from request (should be set by auth middleware)
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
}
