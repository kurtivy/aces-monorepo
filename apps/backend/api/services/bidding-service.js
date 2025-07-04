"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingService = void 0;
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const database_1 = require("../lib/database");
class BiddingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createOrUpdateBid(userId, data, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // First, verify the submission exists and is in a biddable state
                const submission = await tx.rwaSubmission.findUnique({
                    where: {
                        id: data.submissionId,
                        deletedAt: null,
                    },
                    include: { owner: true },
                });
                if (!submission) {
                    throw errors_1.errors.notFound('Submission not found');
                }
                // Don't allow bidding on own submissions
                if (submission.ownerId === userId) {
                    throw errors_1.errors.validation('Cannot bid on your own submission');
                }
                // Only allow bidding on pending submissions
                if (submission.status !== 'PENDING') {
                    throw errors_1.errors.validation(`Cannot bid on submission with status: ${submission.status}`);
                }
                // Use upsert to handle create or update in one operation
                const bid = await tx.bid.upsert({
                    where: {
                        bidderId_submissionId: {
                            bidderId: userId,
                            submissionId: data.submissionId,
                        },
                    },
                    update: {
                        amount: data.amount,
                        currency: data.currency,
                        deletedAt: null, // In case they're un-deleting a previous bid
                        updatedBy: userId,
                        updatedByType: 'USER',
                    },
                    create: {
                        bidderId: userId,
                        submissionId: data.submissionId,
                        amount: data.amount,
                        currency: data.currency,
                    },
                    include: {
                        bidder: true,
                        submission: {
                            include: { owner: true },
                        },
                    },
                });
                return bid;
            });
            logger_1.loggers.database('bid_created_or_updated', 'bids', result.id);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                userId,
                submissionId: data.submissionId,
                correlationId,
                operation: 'createOrUpdateBid',
            });
            throw error;
        }
    }
    async getBidsForSubmission(submissionId, options = {}) {
        try {
            // First verify submission exists
            const submission = await this.prisma.rwaSubmission.findUnique({
                where: { id: submissionId, deletedAt: null },
            });
            if (!submission) {
                throw errors_1.errors.notFound('Submission not found');
            }
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                submissionId,
                deletedAt: null,
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const bids = await this.prisma.bid.findMany({
                where,
                include: {
                    bidder: {
                        select: {
                            id: true,
                            walletAddress: true,
                            // Don't expose email or other private info
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            });
            const hasMore = bids.length > limit;
            const data = hasMore ? bids.slice(0, -1) : bids;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { submissionId, operation: 'getBidsForSubmission' });
            throw error;
        }
    }
    async getUserBids(userId, options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                bidderId: userId,
                deletedAt: null,
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const bids = await this.prisma.bid.findMany({
                where,
                include: {
                    submission: {
                        select: {
                            id: true,
                            name: true,
                            symbol: true,
                            status: true,
                            imageUrl: true,
                            owner: {
                                select: {
                                    id: true,
                                    walletAddress: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            });
            const hasMore = bids.length > limit;
            const data = hasMore ? bids.slice(0, -1) : bids;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { userId, operation: 'getUserBids' });
            throw error;
        }
    }
    async softDeleteBid(bidId, userId, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Verify bid exists and belongs to user
                const bid = await tx.bid.findFirst({
                    where: {
                        id: bidId,
                        bidderId: userId,
                        deletedAt: null,
                    },
                    include: { submission: true },
                });
                if (!bid) {
                    throw errors_1.errors.notFound('Bid not found or already deleted');
                }
                // Only allow deletion if submission is still pending
                if (bid.submission.status !== 'PENDING') {
                    throw errors_1.errors.validation(`Cannot delete bid on submission with status: ${bid.submission.status}`);
                }
                // Soft delete the bid
                await tx.bid.update({
                    where: { id: bidId },
                    data: {
                        deletedAt: new Date(),
                        updatedBy: userId,
                        updatedByType: 'USER',
                    },
                });
                return true;
            });
            logger_1.loggers.database('bid_soft_deleted', 'bids', bidId);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                bidId,
                userId,
                correlationId,
                operation: 'softDeleteBid',
            });
            throw error;
        }
    }
    async getBidById(bidId, userId) {
        try {
            const where = {
                id: bidId,
                deletedAt: null,
            };
            // If userId provided, ensure they own the bid
            if (userId) {
                where.bidderId = userId;
            }
            const bid = await this.prisma.bid.findFirst({
                where,
                include: {
                    bidder: {
                        select: {
                            id: true,
                            walletAddress: true,
                        },
                    },
                    submission: {
                        include: {
                            owner: {
                                select: {
                                    id: true,
                                    walletAddress: true,
                                },
                            },
                        },
                    },
                },
            });
            return bid;
        }
        catch (error) {
            logger_1.loggers.error(error, { bidId, userId, operation: 'getBidById' });
            throw error;
        }
    }
    async getBiddingStats() {
        try {
            const [totalActiveBids, uniqueBiddersResult, currencyStats] = await Promise.all([
                // Total active bids
                this.prisma.bid.count({
                    where: { deletedAt: null },
                }),
                // Unique bidders
                this.prisma.bid.groupBy({
                    by: ['bidderId'],
                    where: { deletedAt: null },
                }),
                // Currency distribution
                this.prisma.bid.groupBy({
                    by: ['currency'],
                    where: { deletedAt: null },
                    _count: { currency: true },
                    orderBy: { _count: { currency: 'desc' } },
                }),
            ]);
            const totalBiddingUsers = uniqueBiddersResult.length;
            const topCurrency = currencyStats[0]?.currency || 'ETH';
            return {
                totalActiveBids,
                totalBiddingUsers,
                topCurrency,
            };
        }
        catch (error) {
            logger_1.loggers.error(error, { operation: 'getBiddingStats' });
            throw error;
        }
    }
    async getTopBidsForSubmission(submissionId, limit = 5) {
        try {
            const bids = await this.prisma.bid.findMany({
                where: {
                    submissionId,
                    deletedAt: null,
                },
                include: {
                    bidder: {
                        select: {
                            id: true,
                            walletAddress: true,
                        },
                    },
                },
                orderBy: {
                    // This is simplified - in reality you'd need to normalize by currency
                    amount: 'desc',
                },
                take: limit,
            });
            return bids;
        }
        catch (error) {
            logger_1.loggers.error(error, { submissionId, operation: 'getTopBidsForSubmission' });
            throw error;
        }
    }
}
exports.BiddingService = BiddingService;
