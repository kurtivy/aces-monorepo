import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SubmissionStatus } from '@prisma/client';
import { errors } from '../../lib/errors';
import { loggers } from '../../lib/logger';
import { getPrismaClient } from '../../lib/database';
import { ApprovalService } from '../../services/approval-service';
import { SubmissionService } from '../../services/submission-service';
import { RecoveryService } from '../../services/recovery-service';
import { BiddingService } from '../../services/bidding-service';
import { AccountVerificationService } from '../../services/account-verification-service';

// Schema definitions
const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const ApprovalSchema = z.object({
  submissionId: z.string().cuid(),
});

const RejectionSchema = z.object({
  submissionId: z.string().cuid(),
  rejectionReason: z.string().min(1).max(500),
});

const RecoverySchema = z.object({
  submissionId: z.string().cuid(),
});

const WebhookReplaySchema = z.object({
  webhookLogId: z.string().cuid(),
});

const SubmissionStatusEnum = z.nativeEnum(SubmissionStatus);

type PaginationRequest = z.infer<typeof PaginationSchema>;

export async function adminRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();
  const approvalService = new ApprovalService(prisma);
  const submissionService = new SubmissionService(prisma);
  const recoveryService = new RecoveryService(prisma);
  const biddingService = new BiddingService(prisma);
  const verificationService = new AccountVerificationService(prisma);

  // Admin authentication middleware
  fastify.addHook('preHandler', async (request) => {
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    if (request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }
  });

  // Get pending submissions for approval
  fastify.get(
    '/submissions',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit, cursor } = request.query as PaginationRequest;

      const submissions = await approvalService.getSubmissionsByStatus('PENDING', {
        limit,
        offset: cursor ? 1 : 0,
      });

      return reply.send({
        success: true,
        data: submissions,
        hasMore: submissions.length === limit,
        nextCursor:
          submissions.length === limit ? submissions[submissions.length - 1]?.id : undefined,
      });
    },
  );

  // Get all submissions with filtering
  fastify.get(
    '/submissions/all',
    {
      schema: {
        querystring: zodToJsonSchema(
          PaginationSchema.extend({
            status: SubmissionStatusEnum.optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { status, limit, cursor } = request.query as PaginationRequest & {
        status?: z.infer<typeof SubmissionStatusEnum>;
      };

      const result = await submissionService.getAllSubmissions(
        request.user!.id,
        status ? { status } : undefined,
        { limit, cursor },
      );

      return reply.send({
        success: true,
        ...result,
      });
    },
  );

  // Get detailed submission information
  fastify.get(
    '/submissions/:id',
    {
      schema: {
        params: zodToJsonSchema(z.object({ id: z.string().cuid() })),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const submission = await approvalService.getSubmissionById(id);

      if (!submission) {
        throw errors.notFound('Submission not found');
      }

      return reply.send({
        success: true,
        data: submission,
      });
    },
  );

  // Approve submission
  fastify.post(
    '/approve/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(ApprovalSchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as z.infer<typeof ApprovalSchema>;
      const adminId = request.user!.id;

      const result = await approvalService.adminApproveSubmission(submissionId, adminId);

      return reply.send({
        success: true,
        data: result,
        message: 'Submission approved successfully',
      });
    },
  );

  // Reject submission
  fastify.post(
    '/reject/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(RejectionSchema),
        body: zodToJsonSchema(z.object({ rejectionReason: z.string().min(1).max(500) })),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as z.infer<typeof RejectionSchema>;
      const { rejectionReason } = request.body as { rejectionReason: string };
      const adminId = request.user!.id;

      await approvalService.rejectSubmission(submissionId, adminId, rejectionReason, request.id);

      return reply.send({
        success: true,
        message: 'Submission rejected successfully',
      });
    },
  );

  // Recovery endpoints
  fastify.post(
    '/recover/retry/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(RecoverySchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as z.infer<typeof RecoverySchema>;
      const adminId = request.user!.id;
      const correlationId = request.id;

      const result = await recoveryService.retrySubmissionApproval(
        submissionId,
        adminId,
        correlationId,
      );

      return reply.send({
        success: true,
        data: result,
        message: 'Submission retry initiated successfully',
      });
    },
  );

  // Replay webhook
  fastify.post(
    '/recover/replay-webhook/:webhookLogId',
    {
      schema: {
        params: zodToJsonSchema(WebhookReplaySchema),
      },
    },
    async (request, reply) => {
      const { webhookLogId } = request.params as z.infer<typeof WebhookReplaySchema>;
      const adminId = request.user!.id;
      const correlationId = request.id;

      const result = await recoveryService.replayWebhook(webhookLogId, adminId, correlationId);

      return reply.send({
        success: true,
        data: result,
        message: result.processed
          ? 'Webhook was already processed'
          : 'Webhook replayed successfully',
      });
    },
  );

  // Get stuck submissions
  fastify.get(
    '/recovery/stuck-submissions',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit } = request.query as PaginationRequest;

      const submissions = await recoveryService.getStuckSubmissions({
        olderThanHours: 24,
      });

      return reply.send({
        success: true,
        data: submissions.slice(0, limit),
        total: submissions.length,
      });
    },
  );

  // Get failed webhooks
  fastify.get(
    '/recovery/failed-webhooks',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit } = request.query as PaginationRequest;

      const webhooks = await recoveryService.getFailedWebhooks(limit);

      return reply.send({
        success: true,
        data: webhooks,
        total: webhooks.length,
      });
    },
  );

  // Get admin dashboard statistics
  fastify.get('/stats', async (request, reply) => {
    const [totalSubmissions, totalBids, recoveryStats, biddingStats] = await Promise.all([
      prisma.rwaSubmission.count(),
      prisma.bid.count(),
      recoveryService.getRecoveryStats(),
      biddingService.getBiddingStats(),
    ]);

    // Get submission status breakdown
    const submissionStatuses = await prisma.rwaSubmission.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusBreakdown = submissionStatuses.reduce(
      (acc, item) => {
        if (item._count && typeof item._count === 'object' && 'status' in item._count) {
          acc[item.status] = (item._count as { status: number }).status;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return reply.send({
      success: true,
      data: {
        submissions: {
          total: totalSubmissions,
          byStatus: statusBreakdown,
        },
        bids: {
          total: totalBids,
          uniqueBidders: biddingStats.totalBidders,
        },
        recovery: recoveryStats,
      },
    });
  });

  // Get pending verifications
  fastify.get('/verifications/pending', async (request, reply) => {
    const verifications = await verificationService.getAllPendingVerifications();

    return reply.send({
      success: true,
      data: verifications,
    });
  });

  // Review verification
  fastify.post(
    '/verifications/:verificationId/review',
    {
      schema: {
        params: zodToJsonSchema(z.object({ verificationId: z.string().cuid() })),
        body: zodToJsonSchema(
          z.object({
            approved: z.boolean(),
            rejectionReason: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { verificationId } = request.params as { verificationId: string };
      const { approved, rejectionReason } = request.body as {
        approved: boolean;
        rejectionReason?: string;
      };
      const adminId = request.user!.id;

      const decision = approved ? 'APPROVED' : 'REJECTED';
      const result = await verificationService.reviewVerification(
        verificationId,
        adminId,
        decision as 'APPROVED' | 'REJECTED',
        rejectionReason,
      );

      return reply.send({
        success: true,
        data: result,
        message: `Verification ${approved ? 'approved' : 'rejected'} successfully`,
      });
    },
  );
}
