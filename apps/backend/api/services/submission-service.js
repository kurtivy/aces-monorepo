"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionService = void 0;
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const database_1 = require("../lib/database");
class SubmissionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSubmission(userId, data, correlationId) {
        try {
            logger_1.loggers.database('create', 'rwa_submissions', undefined, 0);
            const submission = await this.prisma.rwaSubmission.create({
                data: {
                    ...data,
                    ownerId: userId,
                    status: 'PENDING',
                },
                include: {
                    owner: true,
                },
            });
            // Log to audit trail
            await this.prisma.submissionAuditLog.create({
                data: {
                    submissionId: submission.id,
                    fromStatus: null,
                    toStatus: 'PENDING',
                    actorId: userId,
                    actorType: 'USER',
                    notes: 'Submission created',
                },
            });
            logger_1.loggers.database('created', 'rwa_submissions', submission.id);
            return submission;
        }
        catch (error) {
            logger_1.loggers.error(error, { userId, correlationId, operation: 'createSubmission' });
            throw error;
        }
    }
    async getUserSubmissions(userId, options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = {
                ownerId: userId,
                deletedAt: null,
            };
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const submissions = await this.prisma.rwaSubmission.findMany({
                where,
                include: {
                    owner: true,
                    token: true,
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1, // Take one extra to check for more
            });
            const hasMore = submissions.length > limit;
            const data = hasMore ? submissions.slice(0, -1) : submissions;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { userId, operation: 'getUserSubmissions' });
            throw error;
        }
    }
    async getSubmissionById(submissionId, userId) {
        try {
            const where = { id: submissionId, deletedAt: null };
            // If userId provided, ensure they own the submission
            if (userId) {
                where.ownerId = userId;
            }
            const submission = await this.prisma.rwaSubmission.findFirst({
                where,
                include: {
                    owner: true,
                    token: true,
                    bids: {
                        where: { deletedAt: null },
                        include: { bidder: true },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            return submission;
        }
        catch (error) {
            logger_1.loggers.error(error, { submissionId, userId, operation: 'getSubmissionById' });
            throw error;
        }
    }
    async softDeleteSubmission(submissionId, userId, correlationId) {
        try {
            const result = await (0, database_1.withTransaction)(async (tx) => {
                // Check if submission exists and belongs to user
                const submission = await tx.rwaSubmission.findFirst({
                    where: {
                        id: submissionId,
                        ownerId: userId,
                        status: 'PENDING', // Only allow deletion of pending submissions
                        deletedAt: null,
                    },
                });
                if (!submission) {
                    throw errors_1.errors.notFound('Submission not found or cannot be deleted');
                }
                // Soft delete the submission
                await tx.rwaSubmission.update({
                    where: { id: submissionId },
                    data: {
                        deletedAt: new Date(),
                        updatedBy: userId,
                        updatedByType: 'USER',
                    },
                });
                // Log to audit trail
                await tx.submissionAuditLog.create({
                    data: {
                        submissionId,
                        fromStatus: submission.status,
                        toStatus: submission.status, // Status doesn't change, but marked as deleted
                        actorId: userId,
                        actorType: 'USER',
                        notes: 'Submission soft deleted',
                    },
                });
                return true;
            });
            logger_1.loggers.database('soft_deleted', 'rwa_submissions', submissionId);
            return result;
        }
        catch (error) {
            logger_1.loggers.error(error, {
                submissionId,
                userId,
                correlationId,
                operation: 'softDeleteSubmission',
            });
            throw error;
        }
    }
    async getAllSubmissions(status, options = {}) {
        try {
            const limit = Math.min(options.limit || 20, 100);
            const where = { deletedAt: null };
            if (status) {
                where.status = status;
            }
            if (options.cursor) {
                where.id = { lt: options.cursor };
            }
            const submissions = await this.prisma.rwaSubmission.findMany({
                where,
                include: {
                    owner: true,
                    token: true,
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            });
            const hasMore = submissions.length > limit;
            const data = hasMore ? submissions.slice(0, -1) : submissions;
            const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
            return { data, nextCursor, hasMore };
        }
        catch (error) {
            logger_1.loggers.error(error, { status, operation: 'getAllSubmissions' });
            throw error;
        }
    }
}
exports.SubmissionService = SubmissionService;
