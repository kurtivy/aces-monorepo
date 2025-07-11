import { PrismaClient, Prisma, SubmissionStatus } from '@prisma/client';
import type { CreateSubmissionRequest, RwaSubmission } from '@aces/utils';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';

type SubmissionInclude = {
  owner: true;
  token: true;
  bids: {
    include: {
      bidder: true;
    };
  };
};

type SubmissionWithRelations = Prisma.RwaSubmissionGetPayload<{
  include: SubmissionInclude;
}>;

export class SubmissionService {
  constructor(private prisma: PrismaClient) {}

  async createSubmission(
    userId: string,
    data: CreateSubmissionRequest,
    correlationId: string,
  ): Promise<SubmissionWithRelations> {
    try {
      const submissionData: Omit<
        RwaSubmission,
        | 'id'
        | 'createdAt'
        | 'updatedAt'
        | 'status'
        | 'txStatus'
        | 'rejectionType'
        | 'approvedAt'
        | 'rejectionReason'
        | 'txHash'
        | 'deletedAt'
        | 'updatedBy'
        | 'updatedByType'
      > = {
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        imageUrl: data.imageUrl,
        proofOfOwnership: data.proofOfOwnership,
        ownerId: userId,
        email: data.email || null,
        destinationWallet: data.destinationWallet || null,
        twitterLink: data.twitterLink || null,
      };

      const submission = await this.prisma.rwaSubmission.create({
        data: {
          ...submissionData,
          status: 'PENDING',
        },
        include: {
          owner: true,
          token: true,
          bids: {
            include: {
              bidder: true,
            },
          },
        },
      });
      // Log to audit trail
      await this.prisma.submissionAuditLog.create({
        data: {
          submissionId: submission.id,
          actorId: userId,
          actorType: 'USER',
          toStatus: 'PENDING',
          notes: 'Initial submission',
        },
      });

      return submission;
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Error in createSubmission:', err);
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
      } else {
        console.error('Unknown error in createSubmission:', err);
      }
      throw err;
    }
  }

  async getUserSubmissions(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.RwaSubmissionWhereInput = {
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
          bids: {
            include: {
              bidder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Take one extra to check for more
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'getUserSubmissions' });
      throw error;
    }
  }

  async getSubmissionById(
    submissionId: string,
    userId?: string,
  ): Promise<SubmissionWithRelations | null> {
    try {
      const where: Prisma.RwaSubmissionWhereInput = { id: submissionId, deletedAt: null };

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
    } catch (error) {
      loggers.error(error as Error, { submissionId, userId, operation: 'getSubmissionById' });
      throw error;
    }
  }

  async softDeleteSubmission(
    submissionId: string,
    userId: string,
    correlationId: string,
  ): Promise<boolean> {
    try {
      const result = await withTransaction(async (tx) => {
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
          throw errors.notFound('Submission not found or cannot be deleted');
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

      loggers.database('soft_deleted', 'rwa_submissions', submissionId);
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        userId,
        correlationId,
        operation: 'softDeleteSubmission',
      });
      throw error;
    }
  }

  async getAllSubmissions(
    status?: SubmissionStatus,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.RwaSubmissionWhereInput = { deletedAt: null };

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
          bids: {
            include: {
              bidder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { status, operation: 'getAllSubmissions' });
      throw error;
    }
  }
}
