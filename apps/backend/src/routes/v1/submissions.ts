// backend/src/routes/v1/submissions.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SubmissionService, CreateSubmissionRequest } from '../../services/submission-service';
import { SubmissionStatus, RejectionType } from '../../lib/prisma-enums';
import { requireAuth, requireAdmin } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';

// Validation schemas
const CreateSubmissionSchema = z.object({
  title: z.string().min(1).max(200),
  symbol: z.string().min(1).max(10),
  description: z.string().min(1).max(2000),
  assetType: z.enum(['VEHICLE', 'JEWELRY', 'COLLECTIBLE', 'ART', 'FASHION', 'ALCOHOL', 'OTHER']),
  imageGallery: z.array(z.string().url()).optional().default([]),
  location: z.string().max(200).optional(),
  email: z.string().email().optional(),
  proofOfOwnership: z.string().min(1).max(1000),
  proofOfOwnershipImageUrl: z.string().url().optional(),
  typeOfOwnership: z.string().min(1).max(100),
});

const RejectSubmissionSchema = z.object({
  rejectionReason: z.string().min(1).max(1000),
  rejectionType: z.enum(['MANUAL', 'TX_FAILURE']).optional().default('MANUAL'),
});

export async function submissionRoutes(fastify: FastifyInstance) {
  const submissionService = new SubmissionService(fastify.prisma);

  /**
   * Check verification status
   */
  fastify.get(
    '/verification-status',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const isVerified = await submissionService.checkUserVerification(request.user!.id);

        return reply.send({
          success: true,
          data: {
            isVerified,
            message: isVerified
              ? 'Account is verified and ready for submissions'
              : 'Account verification required to submit assets',
          },
        });
      } catch (error) {
        console.error('Error checking verification status:', error);
        throw error;
      }
    },
  );

  /**
   * Create submission
   */
  fastify.post(
    '/',
    {
      preHandler: [requireAuth],
      schema: {
        body: zodToJsonSchema(CreateSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const data = request.body as CreateSubmissionRequest;

        const submission = await submissionService.createSubmission(request.user!.id, data);

        return reply.status(201).send({
          success: true,
          data: submission,
          message: 'Submission created successfully',
        });
      } catch (error) {
        console.error('Error creating submission:', error);
        throw error;
      }
    },
  );

  /**
   * Get user's submissions
   */
  fastify.get(
    '/my-submissions',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          limit?: number;
          cursor?: string;
        };

        const result = await submissionService.getUserSubmissions(
          request.user!.id,
          status ? { status: status as keyof typeof SubmissionStatus } : undefined,
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
        console.error('Error getting user submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Get specific submission
   */
  fastify.get(
    '/:id',
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
        const { id } = request.params as { id: string };

        const submission = await submissionService.getSubmissionById(id, request.user!.id);

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        return reply.send({
          success: true,
          data: submission,
        });
      } catch (error) {
        console.error('Error getting submission:', error);
        throw error;
      }
    },
  );

  /**
   * Delete submission
   */
  fastify.delete(
    '/:id',
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
        const { id } = request.params as { id: string };

        await submissionService.deleteSubmission(id, request.user!.id);

        return reply.send({
          success: true,
          message: 'Submission deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting submission:', error);
        throw error;
      }
    },
  );

  // Admin routes

  /**
   * Get all submissions (admin only)
   */
  fastify.get(
    '/admin/all',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: zodToJsonSchema(
          z.object({
            status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
            limit: z.string().transform(Number).optional(),
            cursor: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { status, limit, cursor } = request.query as {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          limit?: number;
          cursor?: string;
        };

        const result = await submissionService.getAllSubmissions(
          status ? { status: status as keyof typeof SubmissionStatus } : undefined,
          {
            limit,
            cursor,
          },
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
        console.error('Error getting all submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Get pending submissions (admin only)
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

        const result = await submissionService.getPendingSubmissions({ limit, cursor });

        return reply.send({
          success: true,
          data: result.data,
          pagination: {
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
          },
        });
      } catch (error) {
        console.error('Error getting pending submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Approve submission (admin only)
   */
  fastify.put(
    '/admin/:id/approve',
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

        const submission = await submissionService.approveSubmission(id, request.user!.id);

        return reply.send({
          success: true,
          data: submission,
          message: 'Submission approved successfully',
        });
      } catch (error) {
        console.error('Error approving submission:', error);
        throw error;
      }
    },
  );

  /**
   * Reject submission (admin only)
   */
  fastify.put(
    '/admin/:id/reject',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(RejectSubmissionSchema),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { rejectionReason, rejectionType } = request.body as {
          rejectionReason: string;
          rejectionType: 'MANUAL' | 'TX_FAILURE';
        };

        const submission = await submissionService.rejectSubmission(
          id,
          request.user!.id,
          rejectionReason,
          rejectionType as keyof typeof RejectionType,
        );

        return reply.send({
          success: true,
          data: submission,
          message: 'Submission rejected successfully',
        });
      } catch (error) {
        console.error('Error rejecting submission:', error);
        throw error;
      }
    },
  );
}
