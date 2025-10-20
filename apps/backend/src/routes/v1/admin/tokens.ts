import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TokenService } from '../../../services/token-service';
import { ListingService } from '../../../services/listing-service';
import { requireAdmin } from '../../../lib/auth-middleware';
import { TokenParametersSchema } from '@aces/utils';

// Validation schema for adding token
const AddTokenSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

// Validation schema for linking token to listing
const LinkTokenToListingSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  listingId: z.string().min(1, 'Listing ID is required'),
});

export async function adminTokenRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/admin/tokens/add
   * Manually add a newly created token to the database
   * Fetches token data from blockchain and subgraph
   */
  fastify.post(
    '/api/v1/admin/tokens/add',
    {
      preHandler: [requireAdmin],
      schema: {
        body: zodToJsonSchema(AddTokenSchema),
        response: {
          200: zodToJsonSchema(
            z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.object({
                contractAddress: z.string(),
                symbol: z.string(),
                name: z.string(),
                currentPrice: z.string(),
                currentPriceACES: z.string(),
              }),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body as z.infer<typeof AddTokenSchema>;
        const tokenService = new TokenService(fastify.prisma);

        console.log(`[ADMIN] Adding token: ${contractAddress}`);

        // Get or create token in database
        const token = await tokenService.getOrCreateToken(contractAddress);

        // Fetch latest data from blockchain/subgraph
        await tokenService.fetchAndUpdateTokenData(contractAddress);

        // Get updated token data
        const updatedToken = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
          select: {
            contractAddress: true,
            symbol: true,
            name: true,
            currentPrice: true,
            currentPriceACES: true,
            volume24h: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        console.log(`[ADMIN] Token added successfully: ${updatedToken?.symbol}`);

        return reply.send({
          success: true,
          message: `Token ${updatedToken?.symbol} (${updatedToken?.name}) added successfully`,
          data: {
            contractAddress: updatedToken!.contractAddress,
            symbol: updatedToken!.symbol,
            name: updatedToken!.name,
            currentPrice: updatedToken!.currentPrice,
            currentPriceACES: updatedToken!.currentPriceACES,
            volume24h: updatedToken?.volume24h || '0',
            createdAt: updatedToken!.createdAt,
            updatedAt: updatedToken!.updatedAt,
          },
        });
      } catch (error) {
        console.error('[ADMIN] Error adding token:', error);

        if (error instanceof Error) {
          return reply.code(500).send({
            success: false,
            error: 'Failed to add token',
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: 'Failed to add token',
          message: 'Unknown error occurred',
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/tokens/sync
   * Force sync a specific token
   */
  fastify.post(
    '/api/v1/admin/tokens/sync',
    {
      preHandler: [requireAdmin],
      schema: {
        body: zodToJsonSchema(AddTokenSchema),
      },
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body as z.infer<typeof AddTokenSchema>;
        const tokenService = new TokenService(fastify.prisma);

        console.log(`[ADMIN] Force syncing token: ${contractAddress}`);

        // Fetch latest data from blockchain/subgraph
        await tokenService.fetchAndUpdateTokenData(contractAddress);

        const updatedToken = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
        });

        return reply.send({
          success: true,
          message: `Token ${updatedToken?.symbol} synced successfully`,
          data: updatedToken,
        });
      } catch (error) {
        console.error('[ADMIN] Error syncing token:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to sync token',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * GET /api/v1/admin/tokens
   * Get all tokens (admin view with extra metadata)
   */
  fastify.get(
    '/api/v1/admin/tokens',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const tokens = await fastify.prisma.token.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100, // Limit to latest 100 tokens
          select: {
            contractAddress: true,
            symbol: true,
            name: true,
            currentPrice: true,
            currentPriceACES: true,
            volume24h: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            listingId: true,
            listing: {
              select: {
                id: true,
                title: true,
                symbol: true,
                isLive: true,
              },
            },
          },
        });

        return reply.send({
          success: true,
          count: tokens.length,
          data: tokens,
        });
      } catch (error) {
        console.error('[ADMIN] Error fetching tokens:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch tokens',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/tokens/link-listing
   * Link a token to a listing
   */
  fastify.post(
    '/api/v1/admin/tokens/link-listing',
    {
      preHandler: [requireAdmin],
      schema: {
        body: zodToJsonSchema(LinkTokenToListingSchema),
        response: {
          200: zodToJsonSchema(
            z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.object({
                contractAddress: z.string(),
                listingId: z.string(),
                listingTitle: z.string(),
              }),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      try {
        const { contractAddress, listingId } = request.body as z.infer<
          typeof LinkTokenToListingSchema
        >;

        console.log(`[ADMIN] Linking token ${contractAddress} to listing ${listingId}`);

        // Verify token exists
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
        });

        if (!token) {
          return reply.code(404).send({
            success: false,
            error: 'Token not found',
            message: `Token with address ${contractAddress} does not exist in database`,
          });
        }

        // Verify listing exists
        const listing = await fastify.prisma.listing.findUnique({
          where: { id: listingId },
        });

        if (!listing) {
          return reply.code(404).send({
            success: false,
            error: 'Listing not found',
            message: `Listing with ID ${listingId} does not exist`,
          });
        }

        // Check if listing is already linked to another token
        const existingToken = await fastify.prisma.token.findFirst({
          where: { listingId: listingId },
        });

        if (existingToken && existingToken.contractAddress !== token.contractAddress) {
          return reply.code(400).send({
            success: false,
            error: 'Listing already linked',
            message: `Listing "${listing.title}" is already linked to token ${existingToken.contractAddress}`,
          });
        }

        // Link token to listing
        const updatedToken = await fastify.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: { listingId: listingId },
        });

        console.log(
          `[ADMIN] Successfully linked token ${updatedToken.symbol} to listing ${listing.title}`,
        );

        return reply.send({
          success: true,
          message: `Token ${updatedToken.symbol} successfully linked to listing "${listing.title}"`,
          data: {
            contractAddress: updatedToken.contractAddress,
            listingId: listingId,
            listingTitle: listing.title,
          },
        });
      } catch (error) {
        console.error('[ADMIN] Error linking token to listing:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to link token to listing',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * DELETE /api/v1/admin/tokens/unlink-listing
   * Unlink a token from its listing
   */
  fastify.delete(
    '/api/v1/admin/tokens/unlink-listing',
    {
      preHandler: [requireAdmin],
      schema: {
        body: zodToJsonSchema(AddTokenSchema),
      },
    },
    async (request, reply) => {
      try {
        const { contractAddress } = request.body as z.infer<typeof AddTokenSchema>;

        console.log(`[ADMIN] Unlinking token ${contractAddress} from listing`);

        // Verify token exists and has a listing
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: contractAddress.toLowerCase() },
          include: {
            listing: true,
          },
        });

        if (!token) {
          return reply.code(404).send({
            success: false,
            error: 'Token not found',
            message: `Token with address ${contractAddress} does not exist in database`,
          });
        }

        if (!token.listingId) {
          return reply.code(400).send({
            success: false,
            error: 'Token not linked',
            message: 'Token is not currently linked to any listing',
          });
        }

        // Unlink token from listing
        const updatedToken = await fastify.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: { listingId: null },
        });

        console.log(`[ADMIN] Successfully unlinked token ${updatedToken.symbol} from listing`);

        return reply.send({
          success: true,
          message: `Token ${updatedToken.symbol} successfully unlinked from listing`,
          data: {
            contractAddress: updatedToken.contractAddress,
          },
        });
      } catch (error) {
        console.error('[ADMIN] Error unlinking token from listing:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to unlink token from listing',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * GET /api/v1/admin/listings/available
   * Get all approved listings that are available for token linking
   * (either not linked yet, or can be re-linked)
   */
  fastify.get(
    '/api/v1/admin/listings/available',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const listings = await fastify.prisma.listing.findMany({
          where: {
            approvedBy: { not: null }, // Only approved listings
          },
          select: {
            id: true,
            title: true,
            symbol: true,
            brand: true,
            story: true,
            details: true,
            provenance: true,
            value: true,
            reservePrice: true,
            hypeSentence: true,
            assetType: true,
            isLive: true,
            launchDate: true,
            createdAt: true,
            owner: {
              select: {
                walletAddress: true,
                email: true,
              },
            },
            token: {
              select: {
                contractAddress: true,
                symbol: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        return reply.send({
          success: true,
          count: listings.length,
          data: listings,
        });
      } catch (error) {
        console.error('[ADMIN] Error fetching available listings:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch available listings',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * PATCH /api/v1/admin/tokens/:address/pool-address
   * Update the Aerodrome pool address for a token
   */
  fastify.patch(
    '/api/v1/admin/tokens/:address/pool-address',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
          }),
        ),
        body: zodToJsonSchema(
          z.object({
            poolAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid pool address'),
          }),
        ),
        response: {
          200: zodToJsonSchema(
            z.object({
              success: z.boolean(),
              message: z.string(),
              data: z.object({
                contractAddress: z.string(),
                poolAddress: z.string(),
              }),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      try {
        const { address } = request.params as { address: string };
        const { poolAddress } = request.body as { poolAddress: string };

        console.log(`[ADMIN] Updating pool address for token ${address} to ${poolAddress}`);

        // Verify token exists
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: address.toLowerCase() },
        });

        if (!token) {
          return reply.code(404).send({
            success: false,
            error: 'Token not found',
            message: `Token with address ${address} does not exist in database`,
          });
        }

        // Update pool address
        const updatedToken = await fastify.prisma.token.update({
          where: { contractAddress: address.toLowerCase() },
          data: { poolAddress: poolAddress.toLowerCase() },
        });

        console.log(
          `[ADMIN] Successfully updated pool address for token ${updatedToken.symbol} to ${poolAddress}`,
        );

        return reply.send({
          success: true,
          message: `Pool address for token ${updatedToken.symbol} updated successfully`,
          data: {
            contractAddress: updatedToken.contractAddress,
            poolAddress: updatedToken.poolAddress!,
          },
        });
      } catch (error) {
        console.error('[ADMIN] Error updating pool address:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to update pool address',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * PATCH /api/v1/admin/listings/:id/token-parameters
   * Save token parameters for a listing (admin configures before minting)
   */
  fastify.patch(
    '/api/v1/admin/listings/:id/token-parameters',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(TokenParametersSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const tokenParameters = request.body as z.infer<typeof TokenParametersSchema>;

        console.log(`[ADMIN] Saving token parameters for listing ${id}`);

        const listingService = new ListingService(fastify.prisma);
        const listing = await listingService.saveTokenParameters(id, tokenParameters);

        return reply.send({
          success: true,
          data: listing,
          message: 'Token parameters saved successfully',
        });
      } catch (error) {
        console.error('[ADMIN] Error saving token parameters:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to save token parameters',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * POST /api/v1/admin/listings/:id/prepare-mint
   * Prepare listing for minting (admin finalizes and notifies user)
   */
  fastify.post(
    '/api/v1/admin/listings/:id/prepare-mint',
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

        console.log(`[ADMIN] Preparing listing ${id} for minting`);

        const listingService = new ListingService(fastify.prisma);
        const listing = await listingService.prepareForMinting(id);

        return reply.send({
          success: true,
          data: listing,
          message: 'Listing prepared for minting. User has been notified.',
        });
      } catch (error) {
        console.error('[ADMIN] Error preparing for minting:', error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to prepare for minting',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
