import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BidService, CreateBidRequest, RespondToBidRequest } from '../../services/bid-service';
import { BidStatus } from '../../lib/prisma-enums';
import { requireAuth } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';

// Validation schemas
const CreateBidSchema = z.object({
  listingId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal number'),
  message: z.string().max(500).optional(),
});

const RespondToBidSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  responseMessage: z.string().max(500).optional(),
});

export async function bidsRoutes(fastify: FastifyInstance) {
  const bidService = new BidService(fastify.prisma);

  /**
   * Check bidding eligibility
   */
  fastify.get(
    '/eligibility',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const isEligible = await bidService.checkUserBiddingEligibility(request.user!.id);

        return reply.send({
          success: true,
          data: {
            isEligible,
            message: isEligible
              ? 'You are eligible to place bids'
              : 'Account verification required to place bids',
          },
        });
      } catch (error) {
        console.error('Error checking bidding eligibility:', error);
        throw error;
      }
    },
  );

  /**
   * Create a new bid
   */
  fastify.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        body: zodToJsonSchema(CreateBidSchema),
      },
    },
    async (request, reply) => {
      try {
        const data = request.body as CreateBidRequest;

        const bid = await bidService.createBid(request.user!.id, data);

        return reply.status(201).send({
          success: true,
          data: bid,
          message: 'Bid placed successfully',
        });
      } catch (error) {
        console.error('Error creating bid:', error);
        throw error;
      }
    },
  );

  /**
   * Get bids for a specific listing
   */
  fastify.get(
    '/listing/:listingId',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            listingId: z.string(),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
            includeInactive: z
              .string()
              .transform((val) => val === 'true')
              .optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { listingId } = request.params as { listingId: string };
        const { limit, cursor, includeInactive } = request.query as {
          limit?: number;
          cursor?: string;
          includeInactive?: boolean;
        };

        const result = await bidService.getListingBids(listingId, {
          limit,
          cursor,
          includeInactive,
        });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting listing bids:', error);
        throw error;
      }
    },
  );

  /**
   * Get highest bid for a listing
   */
  fastify.get(
    '/listing/:listingId/highest',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            listingId: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { listingId } = request.params as { listingId: string };

        const highestBid = await bidService.getHighestBid(listingId);

        return reply.send({
          success: true,
          data: highestBid,
        });
      } catch (error) {
        console.error('Error getting highest bid:', error);
        throw error;
      }
    },
  );

  /**
   * Get user's bids
   */
  fastify.get(
    '/my',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
          limit?: number;
          cursor?: string;
        };

        const result = await bidService.getUserBids(
          request.user!.id,
          status ? { status: status as keyof typeof BidStatus } : undefined,
          { limit, cursor },
        );

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting user bids:', error);
        throw error;
      }
    },
  );

  /**
   * Get bids on user's listings
   */
  fastify.get(
    '/received',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
          limit?: number;
          cursor?: string;
        };

        const result = await bidService.getBidsOnUserListings(
          request.user!.id,
          status ? { status: status as keyof typeof BidStatus } : undefined,
          { limit, cursor },
        );

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting bids on user listings:', error);
        throw error;
      }
    },
  );

  /**
   * Respond to a bid (accept/reject) - listing owner only
   */
  fastify.put(
    '/:bidId/respond',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            bidId: z.string(),
          }),
        ),
        body: zodToJsonSchema(RespondToBidSchema),
      },
    },
    async (request, reply) => {
      try {
        const { bidId } = request.params as { bidId: string };
        const data = request.body as RespondToBidRequest;

        const bid = await bidService.respondToBid(bidId, request.user!.id, data);

        return reply.send({
          success: true,
          data: bid,
          message: `Bid ${data.status.toLowerCase()} successfully`,
        });
      } catch (error) {
        console.error('Error responding to bid:', error);
        throw error;
      }
    },
  );

  /**
   * Withdraw a bid - bidder only
   */
  fastify.delete(
    '/:bidId',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            bidId: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { bidId } = request.params as { bidId: string };

        await bidService.withdrawBid(bidId, request.user!.id);

        return reply.send({
          success: true,
          message: 'Bid withdrawn successfully',
        });
      } catch (error) {
        console.error('Error withdrawing bid:', error);
        throw error;
      }
    },
  );

  /**
   * Utility endpoint to expire old bids (can be called by cron job)
   */
  fastify.post('/expire', async (request, reply) => {
    try {
      const expiredCount = await bidService.expireBids();

      return reply.send({
        success: true,
        data: {
          expiredCount,
        },
        message: `${expiredCount} bids expired`,
      });
    } catch (error) {
      console.error('Error expiring bids:', error);
      throw error;
    }
  });
}
