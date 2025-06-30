import { FastifyInstance } from 'fastify';
import { CreateBidSchema, PaginationSchema, CreateBidRequest } from '@aces/utils';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { Bid, RwaSubmission } from '@prisma/client';
import { BiddingService } from '../../services/bidding-service';
import { errors } from '../../lib/errors';

const IdParamSchema = z.object({
  id: z.string().cuid({ message: 'Invalid ID' }),
});
type IdParam = z.infer<typeof IdParamSchema>;

const SubmissionIdParamSchema = z.object({
  submissionId: z.string().cuid({ message: 'Invalid Submission ID' }),
});
type SubmissionIdParam = z.infer<typeof SubmissionIdParamSchema>;

const TopBidsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});
type TopBidsQuery = z.infer<typeof TopBidsQuerySchema>;

type PaginationParams = z.infer<typeof PaginationSchema>;

type BidWithSubmission = Bid & {
  submission: RwaSubmission;
};

export async function bidsRoutes(fastify: FastifyInstance) {
  const biddingService = new BiddingService(fastify.prisma);

  // Create or update bid (upsert operation)
  fastify.post(
    '/',
    {
      schema: {
        body: zodToJsonSchema(CreateBidSchema),
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized('Authentication required');
      }

      const body = request.body as CreateBidRequest;
      const correlationId = request.id;

      const bid = await biddingService.createOrUpdateBid(request.user.id, body, correlationId);

      return reply.status(201).send({
        success: true,
        data: bid,
        message: 'Bid placed successfully',
      });
    },
  );

  // Get user's bids
  fastify.get(
    '/my',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      if (!request.user) {
        throw errors.unauthorized('Authentication required');
      }

      const query = request.query as PaginationParams;

      const result = await biddingService.getUserBids(request.user.id, query);

      return reply.send({
        success: true,
        ...result,
      });
    },
  );

  // Get single bid details
  fastify.get(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(IdParamSchema),
      },
    },
    async (request, reply) => {
      const { id } = request.params as IdParam;

      const bid = (await biddingService.getBidById(id)) as BidWithSubmission | null;

      if (!bid) {
        throw errors.notFound('Bid not found');
      }

      // Only show bid details to the bidder or submission owner
      if (
        request.user &&
        (bid.bidderId === request.user.id || bid.submission.ownerId === request.user.id)
      ) {
        return reply.send({
          success: true,
          data: bid,
        });
      }

      // For others, show limited information
      return reply.send({
        success: true,
        data: {
          id: bid.id,
          amount: bid.amount,
          currency: bid.currency,
          createdAt: bid.createdAt,
          submission: {
            id: bid.submission.id,
            name: bid.submission.name,
            symbol: bid.submission.symbol,
            status: bid.submission.status,
          },
        },
      });
    },
  );

  // Delete bid (soft delete)
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
      const correlationId = request.id;

      await biddingService.softDeleteBid(id, request.user.id, correlationId);

      return reply.send({
        success: true,
        message: 'Bid deleted successfully',
      });
    },
  );

  // Get top bids for a submission (public endpoint)
  fastify.get(
    '/submission/:submissionId/top',
    {
      schema: {
        params: zodToJsonSchema(SubmissionIdParamSchema),
        querystring: zodToJsonSchema(TopBidsQuerySchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as SubmissionIdParam;
      const { limit } = request.query as TopBidsQuery;

      const bids = await biddingService.getTopBidsForSubmission(submissionId, limit);

      return reply.send({
        success: true,
        data: bids,
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

  // Get bids for a specific submission (with access control)
  fastify.get(
    '/submission/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(SubmissionIdParamSchema),
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as SubmissionIdParam;
      const query = request.query as PaginationParams;

      // This will handle access control internally
      const result = await biddingService.getBidsForSubmission(submissionId, query);

      return reply.send({
        success: true,
        ...result,
      });
    },
  );
}
