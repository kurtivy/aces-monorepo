"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionsRoutes = submissionsRoutes;
const zod_1 = require("zod");
const zod_to_json_schema_1 = require("zod-to-json-schema");
const utils_1 = require("@aces/utils");
const submission_service_1 = require("../../services/submission-service");
const bidding_service_1 = require("../../services/bidding-service");
const errors_1 = require("../../lib/errors");
async function submissionsRoutes(fastify) {
    const submissionService = new submission_service_1.SubmissionService(fastify.prisma);
    const biddingService = new bidding_service_1.BiddingService(fastify.prisma);
    // Create submission
    fastify.post('/', {
        schema: {
            body: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.CreateSubmissionSchema),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const body = request.body;
        const correlationId = request.id;
        const submission = await submissionService.createSubmission(request.user.id, body, correlationId);
        return reply.status(201).send({
            success: true,
            data: submission,
        });
    });
    // Get user's submissions
    fastify.get('/my', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const { limit, cursor } = request.query;
        const result = await submissionService.getUserSubmissions(request.user.id, {
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get single submission details
    fastify.get('/:id', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({ id: zod_1.z.string().cuid() })),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const submission = await submissionService.getSubmissionById(id);
        if (!submission) {
            throw errors_1.errors.notFound('Submission not found');
        }
        // Only show full details to owner or make it public for live submissions
        if (submission.status !== 'LIVE' &&
            (!request.user || submission.ownerId !== request.user.id)) {
            throw errors_1.errors.forbidden('Cannot view this submission');
        }
        return reply.send({
            success: true,
            data: submission,
        });
    });
    // Delete submission (soft delete)
    fastify.delete('/:id', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({ id: zod_1.z.string().cuid() })),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const { id } = request.params;
        const correlationId = request.id;
        await submissionService.softDeleteSubmission(id, request.user.id, correlationId);
        return reply.send({
            success: true,
            message: 'Submission deleted successfully',
        });
    });
    // Get bids for a submission
    fastify.get('/:id/bids', {
        schema: {
            params: (0, zod_to_json_schema_1.zodToJsonSchema)(zod_1.z.object({ id: zod_1.z.string().cuid() })),
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { limit, cursor } = request.query;
        // First check if submission exists and is viewable
        const submission = await submissionService.getSubmissionById(id);
        if (!submission) {
            throw errors_1.errors.notFound('Submission not found');
        }
        // Only show bids for pending submissions or to the owner
        if (submission.status !== 'PENDING' &&
            (!request.user || submission.ownerId !== request.user.id)) {
            throw errors_1.errors.forbidden('Cannot view bids for this submission');
        }
        const result = await biddingService.getBidsForSubmission(id, {
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get public list of live submissions (tokens)
    fastify.get('/live', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { limit, cursor } = request.query;
        const result = await submissionService.getAllSubmissions('LIVE', {
            limit,
            cursor,
        });
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Search submissions (public endpoint for live submissions)
    fastify.get('/search', {
        schema: {
            querystring: (0, zod_to_json_schema_1.zodToJsonSchema)(utils_1.PaginationSchema.extend({
                q: zod_1.z.string().min(3),
            })),
        },
    }, async (request, reply) => {
        const { q, limit } = request.query;
        // Simple search implementation - can be enhanced with full-text search later
        const submissions = await fastify.prisma.rwaSubmission.findMany({
            where: {
                status: 'LIVE',
                deletedAt: null,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { symbol: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                ],
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        walletAddress: true,
                    },
                },
                token: true,
            },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit || 20, 100),
        });
        return reply.send({
            success: true,
            data: submissions,
            hasMore: submissions.length === (limit || 20),
        });
    });
    // Get submission statistics (public)
    fastify.get('/stats', async (request, reply) => {
        const [totalLive, totalPending, totalUsers] = await Promise.all([
            fastify.prisma.rwaSubmission.count({
                where: { status: 'LIVE', deletedAt: null },
            }),
            fastify.prisma.rwaSubmission.count({
                where: { status: 'PENDING', deletedAt: null },
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
    });
}
