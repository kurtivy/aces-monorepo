import { FastifyInstance } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import {
  ApprovalSchema,
  RejectionSchema,
  RecoverySchema,
  WebhookReplaySchema,
  PaginationSchema,
  SubmissionStatusEnum,
  type RejectionRequest,
  type PaginationRequest,
  type ChainEventWebhookRequest,
} from '@aces/utils';
import { ApprovalService } from '../../services/approval-service';
import { RecoveryService } from '../../services/recovery-service';
import { SubmissionService } from '../../services/submission-service';
import { errors } from '../../lib/errors';

export async function adminRoutes(fastify: FastifyInstance) {
  const approvalService = new ApprovalService(fastify.prisma);
  const recoveryService = new RecoveryService(fastify.prisma);
  const submissionService = new SubmissionService(fastify.prisma);

  // Admin authentication middleware
  fastify.addHook('preHandler', async (request) => {
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    // Validate admin permissions
    const isAdmin = await approvalService.validateAdminPermissions(
      request.user.id,
      request.user.walletAddress,
    );

    if (!isAdmin) {
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

      const result = await approvalService.getPendingApprovals({
        limit,
        cursor,
      });

      return reply.send({
        success: true,
        ...result,
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

      const result = await submissionService.getAllSubmissions(status, {
        limit,
        cursor,
      });

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

      const submission = await approvalService.getSubmissionDetails(id);

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
      const correlationId = request.id;

      const result = await approvalService.approveSubmission(submissionId, adminId, correlationId);

      return reply.send({
        success: true,
        data: result,
        message: 'Submission approved and transaction submitted',
      });
    },
  );

  // Reject submission
  fastify.post(
    '/reject/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(z.object({ submissionId: z.string().cuid() })),
        body: zodToJsonSchema(RejectionSchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as { submissionId: string };
      const { rejectionReason } = request.body as RejectionRequest;
      const adminId = request.user!.id;
      //   const correlationId = request.id;

      // Manual rejection implementation
      await fastify.prisma.$transaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        if (submission.status !== 'PENDING') {
          throw errors.validation(`Cannot reject submission with status: ${submission.status}`);
        }

        // Update submission status
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'REJECTED',
            rejectionType: 'MANUAL',
            rejectionReason: rejectionReason,
            updatedBy: adminId,
            updatedByType: 'ADMIN',
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: 'PENDING',
            toStatus: 'REJECTED',
            actorId: adminId,
            actorType: 'ADMIN',
            notes: `Manual rejection: ${rejectionReason}`,
          },
        });
      });

      return reply.send({
        success: true,
        message: 'Submission rejected successfully',
      });
    },
  );

  // Recovery endpoints
  fastify.post(
    '/recover/resubmit/:submissionId',
    {
      schema: {
        params: zodToJsonSchema(RecoverySchema),
      },
    },
    async (request, reply) => {
      const { submissionId } = request.params as z.infer<typeof RecoverySchema>;
      const adminId = request.user!.id;
      const correlationId = request.id;

      const result = await recoveryService.resubmitTransaction(
        submissionId,
        adminId,
        correlationId,
      );

      return reply.send({
        success: true,
        data: result,
        message: 'Transaction resubmitted successfully',
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

  // Get failed transactions
  fastify.get(
    '/recovery/failed-transactions',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit, cursor } = request.query as PaginationRequest;

      const result = await recoveryService.getFailedTransactions({
        limit,
        cursor,
      });

      return reply.send({
        success: true,
        ...result,
      });
    },
  );

  // Get unprocessed webhooks
  fastify.get(
    '/recovery/unprocessed-webhooks',
    {
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit, cursor } = request.query as PaginationRequest;

      const result = await recoveryService.getUnprocessedWebhooks({
        limit,
        cursor,
      });

      return reply.send({
        success: true,
        ...result,
      });
    },
  );

  // Get admin dashboard stats
  fastify.get('/stats', async (request, reply) => {
    const [recoveryStats, submissionStats, systemHealth] = await Promise.all([
      recoveryService.getRecoveryStats(),
      Promise.all([
        fastify.prisma.rwaSubmission.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { status: true },
        }),
        fastify.prisma.user.count(),
        fastify.prisma.bid.count({ where: { deletedAt: null } }),
      ]),
      // Add system health checks here if needed
      Promise.resolve({ dbConnected: true }),
    ]);

    const [statusCounts, totalUsers, totalBids] = submissionStats;

    return reply.send({
      success: true,
      data: {
        recovery: recoveryStats,
        submissions: {
          byStatus: statusCounts.reduce((acc: Record<string, number>, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {}),
          totalUsers,
          totalBids,
        },
        system: systemHealth,
      },
    });
  });

  // Update transaction status (called by webhooks typically, but admin can also use)
  fastify.post(
    '/update-transaction-status',
    {
      schema: {
        body: zodToJsonSchema(
          z.object({
            txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
            status: z.enum(['MINED', 'FAILED', 'DROPPED']),
            blockNumber: z.number().optional(),
            gasUsed: z.string().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { txHash, status, blockNumber, gasUsed } = request.body as ChainEventWebhookRequest;
      const correlationId = request.id;

      const result = await approvalService.updateTransactionStatus(
        txHash,
        status,
        blockNumber,
        gasUsed,
        correlationId,
      );

      return reply.send({
        success: true,
        data: { updated: result },
        message: result ? 'Transaction status updated' : 'Transaction not found or already updated',
      });
    },
  );
}
