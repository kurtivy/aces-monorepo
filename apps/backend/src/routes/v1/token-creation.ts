import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TokenCreationService } from '../../services/token-creation-service';
import { NotificationService } from '../../services/notification-service';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';

// Validation schemas
const SubmitUserDetailsSchema = z.object({
  additionalImages: z.array(z.string()).optional(),
  technicalSpecifications: z.string().optional(),
  additionalDescription: z.string().optional(),
  proofDocuments: z.array(z.string()).optional(),
});

const TokenParametersSchema = z.object({
  steepness: z.string(),
  floor: z.string(),
  tokensBondedAt: z.string(),
  curve: z.number().int().min(0).max(1),
  salt: z.string().optional(),
  useVanityMining: z.boolean().optional(),
  vanityTarget: z.string().optional(),
});

const ConfirmMintSchema = z.object({
  txHash: z.string().min(1),
  tokenAddress: z.string().min(1),
});

export async function tokenCreationRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService(fastify.prisma);
  const tokenCreationService = new TokenCreationService(fastify.prisma, notificationService);

  /**
   * Submit additional details for token creation (user endpoint)
   */
  fastify.post(
    '/listings/:id/submit-details',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(SubmitUserDetailsSchema),
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id: listingId } = request.params as { id: string };
        const details = request.body as z.infer<typeof SubmitUserDetailsSchema>;

        const listing = await tokenCreationService.submitUserDetails(listingId, userId, details);

        return reply.send({
          success: true,
          data: listing,
          message: 'Details submitted successfully. Awaiting admin review.',
        });
      } catch (error) {
        console.error('Error submitting user details:', error);
        throw error;
      }
    },
  );

  /**
   * Get mint parameters for a listing (user endpoint, readonly)
   */
  fastify.get(
    '/listings/:id/mint-parameters',
    {
      preHandler: [requireAuth],
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
        const userId = request.user!.id;
        const { id: listingId } = request.params as { id: string };

        const parameters = await tokenCreationService.getMintParameters(listingId, userId);

        return reply.send({
          success: true,
          data: parameters,
        });
      } catch (error) {
        console.error('Error fetching mint parameters:', error);
        throw error;
      }
    },
  );

  /**
   * Confirm token mint (user endpoint)
   */
  fastify.post(
    '/listings/:id/confirm-mint',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(ConfirmMintSchema),
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const { id: listingId } = request.params as { id: string };
        const { txHash, tokenAddress } = request.body as z.infer<typeof ConfirmMintSchema>;

        const listing = await tokenCreationService.confirmTokenMint(
          listingId,
          userId,
          txHash,
          tokenAddress,
        );

        // 🚀 Phase 3: Token auto-monitoring is now handled by WebSocket adapters
        // Real-time bonding status available at: /api/v1/ws/bonding/:tokenAddress
        console.log(
          `[TokenCreation] ✅ Token ${tokenAddress} created - real-time monitoring via WebSocket`,
        );

        return reply.send({
          success: true,
          data: listing,
          message: 'Token mint confirmed successfully! Your token is now live.',
        });
      } catch (error) {
        console.error('Error confirming token mint:', error);
        throw error;
      }
    },
  );

  /**
   * Get user's token creation status (user endpoint)
   */
  fastify.get(
    '/my-status',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const listings = await tokenCreationService.getUserTokenCreationStatus(userId);

        return reply.send({
          success: true,
          data: listings,
        });
      } catch (error) {
        console.error('Error fetching user token creation status:', error);
        throw error;
      }
    },
  );

  // ========== ADMIN ENDPOINTS ==========

  /**
   * Get listings pending admin review (admin endpoint)
   */
  fastify.get(
    '/admin/pending-review',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const listings = await tokenCreationService.getListingsPendingReview();

        return reply.send({
          success: true,
          data: listings,
        });
      } catch (error) {
        console.error('Error fetching listings pending review:', error);
        throw error;
      }
    },
  );

  /**
   * Approve token parameters (admin endpoint)
   */
  fastify.post(
    '/admin/listings/:id/approve-parameters',
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
        const adminId = request.user!.id;
        const { id: listingId } = request.params as { id: string };
        const parameters = request.body as z.infer<typeof TokenParametersSchema>;

        const listing = await tokenCreationService.approveTokenParameters(
          listingId,
          adminId,
          parameters,
        );

        return reply.send({
          success: true,
          data: listing,
          message: 'Token parameters approved successfully. User notified.',
        });
      } catch (error) {
        console.error('Error approving token parameters:', error);
        throw error;
      }
    },
  );

  /**
   * Get all token creation statuses (admin endpoint)
   */
  fastify.get(
    '/admin/all-statuses',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        // Get all listings with token creation status
        const listings = await (fastify.prisma as any).listing.findMany({
          where: {
            tokenCreationStatus: {
              not: null,
            },
          },
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                walletAddress: true,
              },
            },
            submission: {
              select: {
                id: true,
                assetType: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });

        return reply.send({
          success: true,
          data: listings,
        });
      } catch (error) {
        console.error('Error fetching all token creation statuses:', error);
        throw error;
      }
    },
  );
}
