"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bidsRoutes = bidsRoutes;
const utils_1 = require("@aces/utils");
const zod_1 = require("zod");
const zod_to_json_schema_1 = __importDefault(require("zod-to-json-schema"));
const bidding_service_1 = require("../../services/bidding-service");
const errors_1 = require("../../lib/errors");
const IdParamSchema = zod_1.z.object({
    id: zod_1.z.string().cuid({ message: 'Invalid ID' }),
});
const SubmissionIdParamSchema = zod_1.z.object({
    submissionId: zod_1.z.string().cuid({ message: 'Invalid Submission ID' }),
});
const TopBidsQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(10).default(5),
});
async function bidsRoutes(fastify) {
    const biddingService = new bidding_service_1.BiddingService(fastify.prisma);
    // Create or update bid (upsert operation)
    fastify.post('/', {
        schema: {
            body: (0, zod_to_json_schema_1.default)(utils_1.CreateBidSchema),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const body = request.body;
        const correlationId = request.id;
        const bid = await biddingService.createOrUpdateBid(request.user.id, body, correlationId);
        return reply.status(201).send({
            success: true,
            data: bid,
            message: 'Bid placed successfully',
        });
    });
    // Get user's bids
    fastify.get('/my', {
        schema: {
            querystring: (0, zod_to_json_schema_1.default)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const query = request.query;
        const result = await biddingService.getUserBids(request.user.id, query);
        return reply.send({
            success: true,
            ...result,
        });
    });
    // Get single bid details
    fastify.get('/:id', {
        schema: {
            params: (0, zod_to_json_schema_1.default)(IdParamSchema),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const bid = (await biddingService.getBidById(id));
        if (!bid) {
            throw errors_1.errors.notFound('Bid not found');
        }
        // Only show bid details to the bidder or submission owner
        if (request.user &&
            (bid.bidderId === request.user.id || bid.submission.ownerId === request.user.id)) {
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
    });
    // Delete bid (soft delete)
    fastify.delete('/:id', {
        schema: {
            params: (0, zod_to_json_schema_1.default)(IdParamSchema),
        },
    }, async (request, reply) => {
        if (!request.user) {
            throw errors_1.errors.unauthorized('Authentication required');
        }
        const { id } = request.params;
        const correlationId = request.id;
        await biddingService.softDeleteBid(id, request.user.id, correlationId);
        return reply.send({
            success: true,
            message: 'Bid deleted successfully',
        });
    });
    // Get top bids for a submission (public endpoint)
    fastify.get('/submission/:submissionId/top', {
        schema: {
            params: (0, zod_to_json_schema_1.default)(SubmissionIdParamSchema),
            querystring: (0, zod_to_json_schema_1.default)(TopBidsQuerySchema),
        },
    }, async (request, reply) => {
        const { submissionId } = request.params;
        const { limit } = request.query;
        const bids = await biddingService.getTopBidsForSubmission(submissionId, limit);
        return reply.send({
            success: true,
            data: bids,
        });
    });
    // Get bidding statistics (public endpoint)
    fastify.get('/stats', async (request, reply) => {
        const stats = await biddingService.getBiddingStats();
        return reply.send({
            success: true,
            data: stats,
        });
    });
    // Get bids for a specific submission (with access control)
    fastify.get('/submission/:submissionId', {
        schema: {
            params: (0, zod_to_json_schema_1.default)(SubmissionIdParamSchema),
            querystring: (0, zod_to_json_schema_1.default)(utils_1.PaginationSchema),
        },
    }, async (request, reply) => {
        const { submissionId } = request.params;
        const query = request.query;
        // This will handle access control internally
        const result = await biddingService.getBidsForSubmission(submissionId, query);
        return reply.send({
            success: true,
            ...result,
        });
    });
}
