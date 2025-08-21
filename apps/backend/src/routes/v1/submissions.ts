import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CreateSubmissionSchema,
  PaginationSchema,
  type CreateSubmissionRequest,
  type PaginationRequest,
} from '@aces/utils';
import { SubmissionService } from '../../services/submission-service';
import { BiddingService } from '../../services/bidding-service';
import { StorageService } from '../../lib/storage-utils';
import { errors } from '../../lib/errors';

export async function submissionsRoutes(fastify: FastifyInstance) {
  let submissionService: SubmissionService;
  let biddingService: BiddingService;

  try {
    submissionService = new SubmissionService(fastify.prisma);
    biddingService = new BiddingService(fastify.prisma);
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }

  // Direct image upload endpoint (bypasses CORS)
  fastify.post('/upload-image', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided',
        });
      }

      // Validate file type
      if (!data.mimetype.startsWith('image/')) {
        return reply.status(400).send({
          success: false,
          error: 'File must be an image',
        });
      }

      // Validate file size (5MB limit)
      const buffer = await data.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: 'File size too large (max 5MB)',
        });
      }

      // Upload to Google Cloud Storage
      const fileName = `submissions/${Date.now()}-${data.filename}`;
      const bucket = StorageService.getBucket();
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType: data.mimetype,
        },
      });

      const publicUrl = StorageService.getPublicUrl(fileName);

      return reply.send({
        success: true,
        data: { publicUrl },
      });
    } catch (error) {
      fastify.log.error({ error, operation: 'uploadImage' }, 'Failed to upload image');
      return reply.status(500).send({
        success: false,
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get signed URL for image upload
  fastify.post(
    '/get-upload-url',
    {
      schema: {
        body: zodToJsonSchema(
          z.object({
            fileType: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { fileType } = request.body as { fileType: string };

        const { url, fileName } = await StorageService.getSignedUploadUrl(fileType);
        const publicUrl = StorageService.getPublicUrl(fileName);

        return reply.send({
          success: true,
          data: { url, fileName, publicUrl },
        });
      } catch (error) {
        fastify.log.error({ error, operation: 'getUploadUrl' }, 'Failed to generate signed URL');
        return reply.status(500).send({
          success: false,
          error: 'Failed to generate signed URL',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Test endpoint - no auth required
  fastify.post(
    '/test',
    {
      schema: {
        body: zodToJsonSchema(CreateSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as CreateSubmissionRequest;
        const correlationId = request.id;

        console.log('🧪 Test submission received:', { body, correlationId });

        // Create or get test user
        const testUser = await fastify.prisma.user.upsert({
          where: { privyDid: 'test-user' },
          update: {},
          create: {
            privyDid: 'test-user',
            walletAddress: '0xTestUser',
            email: 'test@example.com',
          },
        });

        // Create submission with test user
        const submission = await submissionService.createSubmission(
          testUser.id,
          body,
          correlationId,
        );

        return { success: true, data: submission };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error({ err, operation: 'testSubmission' }, 'Failed to create test submission');
        return reply.status(500).send({
          success: false,
          error: 'Failed to create test submission',
          details: err.message,
        });
      }
    },
  );

  // Regular submission endpoint - requires auth
  fastify.post(
    '/create',
    {
      schema: {
        body: zodToJsonSchema(CreateSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const body = request.body as CreateSubmissionRequest;
        const correlationId = request.id;

        // Check if user exists
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const submission = await submissionService.createSubmission(
          request.user.id,
          body,
          correlationId,
        );

        return { success: true, data: submission };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error({ err, operation: 'createSubmission' }, 'Failed to create submission');
        return reply.status(500).send({
          success: false,
          error: 'Failed to create submission',
          details: err.message,
        });
      }
    },
  );

  // Get user's submissions
  fastify.get(
    '/my',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          throw errors.unauthorized('Authentication required');
        }

        const { limit, cursor } = request.query as PaginationRequest;

        const result = await submissionService.getUserSubmissions(
          request.user.id,
          undefined, // no status filter
          { limit, cursor },
        );

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get user submissions',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get single submission details
  fastify.get(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(z.object({ id: z.string().cuid() })),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const submission = await submissionService.getSubmissionById(id);

        if (!submission) {
          return reply.status(404).send({
            success: false,
            error: 'Submission not found',
          });
        }

        // Only show full details to owner or make it public for approved submissions with live listings
        const hasLiveListing = submission.rwaListing && submission.rwaListing.isLive;
        if (!hasLiveListing && (!request.user || submission.ownerId !== request.user.id)) {
          return reply.status(403).send({
            success: false,
            error: 'Cannot view this submission',
          });
        }

        return reply.send({
          success: true,
          data: submission,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get submission',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get public list of live submissions (tokens) - THIS IS THE CRITICAL ONE
  fastify.get(
    '/live',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      try {
        console.log('🔍 Getting live submissions...');
        const { limit, cursor } = request.query as PaginationRequest;

        // Query live listings instead of submissions
        const limitValue = Math.min(limit || 20, 100);
        const where: { isLive: boolean; id?: { lt: string } } = { isLive: true };

        if (cursor) {
          where.id = { lt: cursor };
        }

        const listings = await fastify.prisma.rwaListing.findMany({
          where,
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
            rwaSubmission: {
              select: {
                id: true,
                status: true,
                createdAt: true,
              },
            },
            token: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limitValue + 1,
        });

        const hasMore = listings.length > limitValue;
        const data = hasMore ? listings.slice(0, -1) : listings;
        const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

        console.log('✅ Live submissions retrieved:', { count: data.length, hasMore });

        return reply.send({
          success: true,
          data,
          nextCursor,
          hasMore,
        });
      } catch (error) {
        console.error('❌ Error getting live submissions:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to get live submissions',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Search submissions (public endpoint for live submissions)
  fastify.get(
    '/search',
    {
      schema: {
        querystring: zodToJsonSchema(
          PaginationSchema.extend({
            q: z.string().min(3),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { q, limit } = request.query as PaginationRequest & { q: string };

        // Search live listings instead of submissions
        const listings = await fastify.prisma.rwaListing.findMany({
          where: {
            isLive: true,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { symbol: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          include: {
            owner: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true,
              },
            },
            rwaSubmission: {
              select: {
                id: true,
                status: true,
              },
            },
            token: true,
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit || 20, 100),
        });

        return reply.send({
          success: true,
          data: listings,
          hasMore: listings.length === (limit || 20),
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to search submissions',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get submission statistics (public)
  fastify.get('/stats', async (request, reply) => {
    try {
      const [totalLive, totalPending, totalUsers] = await Promise.all([
        fastify.prisma.rwaListing.count({
          where: { isLive: true },
        }),
        fastify.prisma.rwaSubmission.count({
          where: { status: 'PENDING' },
        }),
        fastify.prisma.user.count(),
      ]);

      return reply.send({
        success: true,
        data: {
          totalLiveTokens: totalLive,
          totalPendingSubmissions: totalPending,
          totalUsers,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get submission statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete submission (soft delete)
  fastify.delete(
    '/:id',
    {
      schema: {
        params: zodToJsonSchema(z.object({ id: z.string().cuid() })),
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const { id } = request.params as { id: string };

        await submissionService.deleteSubmission(id, request.user.id);

        return reply.send({
          success: true,
          message: 'Submission deleted successfully',
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete submission',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get bids for a submission
  fastify.get(
    '/:id/bids',
    {
      schema: {
        params: zodToJsonSchema(z.object({ id: z.string().cuid() })),
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { limit, cursor } = request.query as PaginationRequest;

        // First check if submission exists and is viewable
        const submission = await submissionService.getSubmissionById(id);

        if (!submission) {
          return reply.status(404).send({
            success: false,
            error: 'Submission not found',
          });
        }

        // Only show bids for submissions with live listings or to the owner
        const hasLiveListing = submission.rwaListing && submission.rwaListing.isLive;
        if (!hasLiveListing && (!request.user || submission.ownerId !== request.user.id)) {
          return reply.status(403).send({
            success: false,
            error: 'Cannot view bids for this submission',
          });
        }

        // If submission has a live listing, get bids for the listing
        if (!submission.rwaListing) {
          return reply.send({
            success: true,
            data: [],
            hasMore: false,
          });
        }

        const bids = await biddingService.getBidsForListing(submission.rwaListing.id);

        // Apply pagination manually since getBidsForListing doesn't support it
        const limitValue = Math.min(limit || 20, 100);
        const startIndex = cursor ? bids.findIndex((bid) => bid.id === cursor) + 1 : 0;
        const endIndex = startIndex + limitValue;
        const paginatedBids = bids.slice(startIndex, endIndex);
        const hasMore = endIndex < bids.length;
        const nextCursor = hasMore ? paginatedBids[paginatedBids.length - 1]?.id : undefined;

        return reply.send({
          success: true,
          data: paginatedBids,
          nextCursor,
          hasMore,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to get submission bids',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
