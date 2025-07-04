"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
const zod_to_json_schema_1 = require("zod-to-json-schema");
const zod_1 = require("zod");
const utils_1 = require("@aces/utils");
const approval_service_1 = require("../../services/approval-service");
const recovery_service_1 = require("../../services/recovery-service");
const submission_service_1 = require("../../services/submission-service");
const errors_1 = require("../../lib/errors");
async function adminRoutes(fastify) {
    const approvalService = new approval_service_1.ApprovalService(fastify.prisma);
    const recoveryService = new recovery_service_1.RecoveryService(fastify.prisma);
    const submissionService = new submission_service_1.SubmissionService(fastify.prisma);
    // Admin authentication middleware
    fastify.addHook('preHandler', async (request) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        // Validate admin permissions
        const isAdmin = await approvalService.validateAdminPermissions(request.user.id, request.user.walletAddress);
        if (!isAdmin) {
            throw errors_1.errors.forbidden('Admin access required');
        }
    });
    // Get pending submissions for approval
    fastify.get('/submissions', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { limit, cursor } = request.query;
        const result = await approvalService.getPendingApprovals({
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get all submissions with filtering
    fastify.get('/submissions/all', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema.extend({
                status: utils_1.SubmissionStatusEnum.optional(),
            })),
        },
    }, async (request, reply) => {
        const { status, limit, cursor } = request.query;
        const result = await submissionService.getAllSubmissions(status, {
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get detailed submission information
    fastify.get('/submissions/:id', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({ id: zod_1.z.string().cuid() })),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const submission = await approvalService.getSubmissionDetails(id);
        if (!submission) {
            throw errors_1.errors.notFound('Submission not found');
        }
        return reply.send({
            success: true,
            data: submission,
        });
    });
    // Approve submission
    fastify.post('/approve/:submissionId', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.ApprovalSchema),
        },
    }, async (request, reply) => {
        const { submissionId } = request.params;
        const adminId = request.user.id;
        const correlationId = request.id;
        const result = await approvalService.approveSubmission(submissionId, adminId, correlationId);
        return reply.send({
            success: true,
            data: result,
            message: 'Submission approved and transaction submitted',
        });
    });
    // Reject submission
    fastify.post('/reject/:submissionId', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({ submissionId: zod_1.z.string().cuid() })),
            body: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.RejectionSchema),
        },
    }, async (request, reply) => {
        const { submissionId } = request.params;
        const { rejectionReason } = request.body;
        const adminId = request.user.id;
        //   const correlationId = request.id;
        // Manual rejection implementation
        await fastify.prisma.$transaction(async (tx) => {
            const submission = await tx.rwaSubmission.findUnique({
                where: { id: submissionId },
            });
            if (!submission) {
                throw errors_1.errors.notFound('Submission not found');
            }
            if (submission.status !== 'PENDING') {
                throw errors_1.errors.validation(`Cannot reject submission with status: ${submission.status}`);
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
    });
    // Recovery endpoints
    fastify.post('/recover/resubmit/:submissionId', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.RecoverySchema),
        },
    }, async (request, reply) => {
        const { submissionId } = request.params;
        const adminId = request.user.id;
        const correlationId = request.id;
        const result = await recoveryService.resubmitTransaction(submissionId, adminId, correlationId);
        return reply.send({
            success: true,
            data: result,
            message: 'Transaction resubmitted successfully',
        });
    });
    // Replay webhook
    fastify.post('/recover/replay-webhook/:webhookLogId', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.WebhookReplaySchema),
        },
    }, async (request, reply) => {
        const { webhookLogId } = request.params;
        const adminId = request.user.id;
        const correlationId = request.id;
        const result = await recoveryService.replayWebhook(webhookLogId, adminId, correlationId);
        return reply.send({
            success: true,
            data: result,
            message: result.processed
                ? 'Webhook was already processed'
                : 'Webhook replayed successfully',
        });
    });
    // Get failed transactions
    fastify.get('/recovery/failed-transactions', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { limit, cursor } = request.query;
        const result = await recoveryService.getFailedTransactions({
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get unprocessed webhooks
    fastify.get('/recovery/unprocessed-webhooks', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { limit, cursor } = request.query;
        const result = await recoveryService.getUnprocessedWebhooks({
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
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
                    byStatus: statusCounts.reduce((acc, item) => {
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
    fastify.post('/update-transaction-status', {
        schema: {
            body: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({
                txHash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/),
                status: zod_1.z.enum(['MINED', 'FAILED', 'DROPPED']),
                blockNumber: zod_1.z.number().optional(),
                gasUsed: zod_1.z.string().optional(),
            })),
        },
    }, async (request, reply) => {
        const { txHash, status, blockNumber, gasUsed } = request.body;
        const correlationId = request.id;
        const result = await approvalService.updateTransactionStatus(txHash, status, blockNumber, gasUsed, correlationId);
        return reply.send({
            success: true,
            data: { updated: result },
            message: result ? 'Transaction status updated' : 'Transaction not found or already updated',
        });
    });
}
