import { FastifyInstance } from 'fastify';
import { PaginationSchema } from '@aces/utils';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { Bid, RwaListing } from '@prisma/client';
import { BiddingService } from '../../services/bidding-service';
import { errors } from '../../lib/errors';

// Local schema and interface for bid creation (matches the bidding service)
const BidCreateSchema = z.object({
  listingId: z.string().cuid(),
  amount: z.string(),
  currency: z.enum(['ETH', 'ACES']),
  expiresAt: z.string().datetime().optional(),
});

interface LocalCreateBidRequest {
  listingId: string;
  amount: string;
  currency: string;
  expiresAt?: Date;
}

const IdParamSchema = z.object({
  id: z.string().cuid({ message: 'Invalid ID' }),
});
type IdParam = z.infer<typeof IdParamSchema>;

const ListingIdParamSchema = z.object({
  listingId: z.string().cuid({ message: 'Invalid Listing ID' }),
});
type ListingIdParam = z.infer<typeof ListingIdParamSchema>;

const TopBidsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
type TopBidsQuery = z.infer<typeof TopBidsQuerySchema>;

type PaginationParams = z.infer<typeof PaginationSchema>;

type BidWithListing = Bid & {
  listing: {
    id: string;
    title: string;
    symbol: string;
    isLive: boolean;
  };
  bidder: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
  };
  verification: {
    id: string;
    status: string;
  };
};

export async function bidsRoutes(fastify: FastifyInstance) {
  const biddingService = new BiddingService(fastify.prisma);

  // Create or update bid (upsert operation)
  fastify.post(
    '/',
    {
      schema: {
        body: zodToJsonSchema(BidCreateSchema),
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized('Authentication required');
      }

      // Parse and validate the body using our local schema
      const parsedBody = BidCreateSchema.parse(request.body);
      const correlationId = request.id;

      // Convert to the format expected by the service
      const body: LocalCreateBidRequest = {
        listingId: parsedBody.listingId,
        amount: parsedBody.amount,
        currency: parsedBody.currency,
        expiresAt: parsedBody.expiresAt ? new Date(parsedBody.expiresAt) : undefined,
      };

      const bid = await biddingService.createOrUpdateBid(request.user.id, body, correlationId);

      return reply.status(201).send({
        success: true,
        data: bid,
        message: 'Bid placed successfully',
      });
    },
  );

  // Get user's bids
  fastify.get('/my', async (request, reply) => {
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    const bids = await biddingService.getUserBids(request.user.id);

    return reply.send({
      success: true,
      data: bids,
    });
  });

  // Get offers for listings owned by the user (seller's perspective)
  fastify.get('/my-listings-offers', async (request, reply) => {
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    const offers = await biddingService.getOffersForUserListings(request.user.id);

    return reply.send({
      success: true,
      data: offers,
    });
  });

  // Get specific bid
  fastify.get(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(IdParamSchema),
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized('Authentication required');
      }

      const { id } = request.params as IdParam;

      const bidResult = await biddingService.getBidById(id);

      if (!bidResult) {
        throw errors.notFound('Bid not found');
      }

      // Type assertion since we know the service includes the listing relation
      const bid = bidResult as BidWithListing;

      return reply.send({
        success: true,
        data: {
          id: bid.id,
          amount: bid.amount,
          currency: bid.currency,
          createdAt: bid.createdAt,
          listing: {
            id: bid.listing.id,
            title: bid.listing.title,
            symbol: bid.listing.symbol,
            isLive: bid.listing.isLive,
          },
        },
      });
    },
  );

  // Delete bid
  fastify.delete(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(IdParamSchema),
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized('Authentication required');
      }

      const { id } = request.params as IdParam;

      await biddingService.deleteBid(id, request.user.id);

      return reply.send({
        success: true,
        message: 'Bid deleted successfully',
      });
    },
  );

  // Get highest bid for a listing (public endpoint)
  fastify.get(
    '/listing/:listingId/highest',
    {
      schema: {
        params: zodToJsonSchema(ListingIdParamSchema),
      },
    },
    async (request, reply) => {
      const { listingId } = request.params as ListingIdParam;

      const bid = await biddingService.getHighestBidForListing(listingId);

      return reply.send({
        success: true,
        data: bid,
      });
    },
  );

  // Get bidding statistics (public endpoint)
  fastify.get('/stats', async (request, reply) => {
    const stats = await biddingService.getBiddingStats();

    return reply.send({
      success: true,
      data: stats,
    });
  });

  // Get bids for a specific listing (public endpoint)
  fastify.get(
    '/listing/:listingId',
    {
      schema: {
        params: zodToJsonSchema(ListingIdParamSchema),
      },
    },
    async (request, reply) => {
      const { listingId } = request.params as ListingIdParam;

      const bids = await biddingService.getBidsForListing(listingId);

      return reply.send({
        success: true,
        data: bids,
      });
    },
  );
}
