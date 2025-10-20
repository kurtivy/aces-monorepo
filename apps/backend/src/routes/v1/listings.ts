// backend/src/routes/v1/listings.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ListingService, UpdateListingRequest } from '../../services/listing-service';
import { TokenHolderService } from '../../services/token-holder-service';

import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';

// Validation schemas
const CreateListingFromSubmissionSchema = z.object({
  submissionId: z.string(),
});

const UpdateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  symbol: z.string().min(1).max(10).optional(),
  description: z.string().min(1).max(2000).optional(),
  assetType: z
    .enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'])
    .optional(),
  imageGallery: z.array(z.string().url()).optional(),
  location: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

// Owner-allowed update schema (broader set for pre-launch editing)
const OwnerUpdateListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  symbol: z.string().min(1).max(10).optional(),
  brand: z.string().max(100).optional(),
  story: z.string().max(5000).optional(),
  details: z.string().max(5000).optional(),
  provenance: z.string().max(5000).optional(),
  value: z.string().max(100).optional(),
  reservePrice: z.string().max(100).optional(),
  hypeSentence: z.string().max(500).optional(),
  assetType: z
    .enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER'])
    .optional(),
  imageGallery: z.array(z.string().url()).optional(),
  location: z.string().max(200).optional(),
  assetDetails: z.record(z.string()).optional(),
  startingBidPrice: z.string().max(100).optional(),
});

const SetListingLiveSchema = z.object({
  isLive: z.boolean(),
});

const SetListingLaunchDateSchema = z.object({
  launchDate: z.string().datetime().nullable(),
});

export async function listingRoutes(fastify: FastifyInstance) {
  const listingService = new ListingService(fastify.prisma);
  const tokenHolderService = new TokenHolderService();

  /**
   * Get live listings (public endpoint)
   */
  fastify.get(
    '/live',
    {
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query as {
          limit?: number;
          cursor?: string;
        };

        const result = await listingService.getLiveListings({ limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting live listings:', error);
        throw error;
      }
    },
  );

  /**
   * Get listing by symbol (public endpoint)
   */
  fastify.get(
    '/symbol/:symbol',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            symbol: z.string().min(1).max(50),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { symbol } = request.params as { symbol: string };

        const listing = await listingService.getListingBySymbol(symbol);

        if (!listing) {
          throw errors.notFound('Listing not found');
        }

        const commentCount =
          typeof listing.commentCount === 'number' ? listing.commentCount : undefined;

        let holderCount: number | null = null;
        const tokenAddress = listing.token?.contractAddress;

        if (tokenAddress) {
          try {
            // Add a 5-second timeout to prevent the entire request from timing out
            const holderCountPromise = tokenHolderService.getHolderCount(
              tokenAddress,
              listing.token?.chainId ?? undefined,
            );
            holderCount = await Promise.race([
              holderCountPromise,
              new Promise<number>((_, reject) =>
                setTimeout(() => reject(new Error('Holder count timeout')), 5000),
              ),
            ]);
          } catch (error) {
            fastify.log.warn(
              { error, tokenAddress },
              '[Listings] Failed to compute holder count for listing symbol route',
            );
          }
        }

        const responseListing = {
          ...listing,
          commentCount: commentCount ?? 0,
          token: listing.token
            ? {
                ...listing.token,
                holderCount: holderCount ?? listing.token.holderCount ?? null,
                holdersCount: holderCount ?? listing.token.holdersCount ?? null,
              }
            : undefined,
        };

        return reply.send({
          success: true,
          data: responseListing,
        });
      } catch (error) {
        console.error('Error getting listing by symbol:', error);
        throw error;
      }
    },
  );

  /**
   * Get specific listing by ID (public endpoint)
   */
  fastify.get(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const listing = await listingService.getListingById(id);

        if (!listing) {
          throw errors.notFound('Listing not found');
        }

        return reply.send({
          success: true,
          data: listing,
        });
      } catch (error) {
        console.error('Error getting listing:', error);
        throw error;
      }
    },
  );

  /**
   * Get user's listings (authenticated)
   */
  fastify.get(
    '/my-listings',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query as {
          limit?: number;
          cursor?: string;
        };

        const result = await listingService.getListingsByOwner(request.user!.id, { limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting user listings:', error);
        throw error;
      }
    },
  );

  /**
   * Update listing (owner, pre-launch only)
   */
  fastify.put(
    '/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(OwnerUpdateListingSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = request.body as z.infer<typeof OwnerUpdateListingSchema>;

        const listing = await listingService.updateListingByOwner(
          id,
          data as any,
          request.user!.id,
        );

        return reply.send({
          success: true,
          data: listing,
          message: 'Listing updated successfully',
        });
      } catch (error) {
        console.error('Error updating listing (owner):', error);
        throw error;
      }
    },
  );

  // Admin routes

  /**
   * Create listing from approved submission (admin only)
   */
  fastify.post(
    '/admin/create-from-submission',
    {
      preHandler: [requireAdmin],
      schema: {
        body: zodToJsonSchema(CreateListingFromSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const { submissionId } = request.body as { submissionId: string };

        const listing = await listingService.createListingFromSubmission(
          submissionId,
          request.user!.id,
        );

        return reply.status(201).send({
          success: true,
          data: listing,
          message: 'Listing created successfully from submission',
        });
      } catch (error) {
        console.error('Error creating listing from submission:', error);
        throw error;
      }
    },
  );

  /**
   * Get all listings (admin only)
   */
  fastify.get(
    '/admin/all',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query as {
          limit?: number;
          cursor?: string;
        };

        const result = await listingService.getAllListings({ limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting all listings:', error);
        throw error;
      }
    },
  );

  /**
   * Get pending listings (admin only)
   */
  fastify.get(
    '/admin/pending',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { limit, cursor } = request.query as {
          limit?: number;
          cursor?: string;
        };

        const result = await listingService.getPendingListings({ limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting pending listings:', error);
        throw error;
      }
    },
  );

  /**
   * Update listing (admin only)
   */
  fastify.put(
    '/admin/:id',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(UpdateListingSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = request.body as UpdateListingRequest;

        const listing = await listingService.updateListing(id, data, request.user!.id);

        return reply.send({
          success: true,
          data: listing,
          message: 'Listing updated successfully',
        });
      } catch (error) {
        console.error('Error updating listing:', error);
        throw error;
      }
    },
  );

  /**
   * Set listing live status (admin only)
   */
  fastify.put(
    '/admin/:id/go-live',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(SetListingLiveSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { isLive } = request.body as { isLive: boolean };

        const listing = await listingService.setListingLive(id, isLive, request.user!.id);

        return reply.send({
          success: true,
          data: listing,
          message: `Listing ${isLive ? 'made live' : 'taken offline'} successfully`,
        });
      } catch (error) {
        console.error('Error setting listing live status:', error);
        throw error;
      }
    },
  );

  /**
   * Set listing launch date (admin only)
   */
  fastify.put(
    '/admin/:id/launch-date',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(SetListingLaunchDateSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { launchDate } = request.body as { launchDate: string | null };

        const parsedLaunchDate = launchDate ? new Date(launchDate) : null;
        const listing = await listingService.setListingLaunchDate(
          id,
          parsedLaunchDate,
          request.user!.id,
        );

        return reply.send({
          success: true,
          data: listing,
          message: `Listing launch date ${parsedLaunchDate ? 'set to ' + parsedLaunchDate.toISOString() : 'cleared'} successfully`,
        });
      } catch (error) {
        console.error('Error setting listing launch date:', error);
        throw error;
      }
    },
  );

  /**
   * Delete listing (admin only)
   */
  fastify.delete(
    '/admin/:id',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        await listingService.deleteListing(id);

        return reply.send({
          success: true,
          message: 'Listing deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting listing:', error);
        throw error;
      }
    },
  );
}
