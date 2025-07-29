import { PrismaClient, Prisma, SubmissionStatus } from '@prisma/client';
import type { CreateSubmissionRequest, RwaSubmission } from '@aces/utils';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';

type SubmissionInclude = {
  owner: true;
  rwaListing: true; // Changed from token to rwaListing
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
      const submissionData = {
        title: data.name, // Map name to title
        symbol: data.symbol,
        description: data.description,
        imageGallery: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []), // Combine imageUrl and imageUrls
        proofOfOwnership: data.proofOfOwnership,
        typeOfOwnership: 'General', // Add required field with default
        location: null,
        contractAddress: null,
        ownerId: userId,
        email: data.email || null,
        status: 'PENDING' as SubmissionStatus,
      };

      const submission = await this.prisma.rwaSubmission.create({
        data: submissionData,
        include: {
          owner: true,
          rwaListing: true, // Changed from token to rwaListing
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
    filter?: { status?: SubmissionStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: Prisma.RwaSubmissionWhereInput = {
        ownerId: userId,
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          rwaListing: true, // Changed from token to rwaListing
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
      const where: Prisma.RwaSubmissionWhereInput = { id: submissionId };

      // If userId is provided, ensure the user can only see their own submissions
      if (userId) {
        where.ownerId = userId;
      }

      const submission = await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true,
          rwaListing: true, // Changed from token to rwaListing
        },
      });

      return submission;
    } catch (error) {
      loggers.error(error as Error, { submissionId, userId, operation: 'getSubmissionById' });
      throw error;
    }
  }

  async deleteSubmission(submissionId: string, userId: string): Promise<void> {
    try {
      await withTransaction(async (tx) => {
        const submission = await tx.rwaSubmission.findUnique({
          where: {
            id: submissionId,
            ownerId: userId, // Ensure user can only delete their own submissions
          },
        });

        if (!submission) {
          throw errors.notFound('Submission not found or access denied');
        }

        if (submission.status !== 'PENDING') {
          throw errors.validation(
            `Cannot delete submission with status: ${submission.status}. Only pending submissions can be deleted.`,
          );
        }

        // Hard delete the submission since we removed soft delete
        await tx.rwaSubmission.delete({
          where: { id: submissionId },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: submission.status,
            toStatus: 'REJECTED', // Use REJECTED as closest equivalent to deleted
            actorId: userId,
            actorType: 'USER',
            notes: 'Submission deleted by user',
          },
        });
      });

      loggers.database('deleted', 'rwa_submissions', submissionId);
    } catch (error) {
      loggers.error(error as Error, { submissionId, userId, operation: 'deleteSubmission' });
      throw error;
    }
  }

  async getAllSubmissions(
    adminId: string,
    filter?: { status?: SubmissionStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where: Prisma.RwaSubmissionWhereInput = {
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = await this.prisma.rwaSubmission.findMany({
        where,
        include: {
          owner: true,
          rwaListing: true, // Changed from token to rwaListing
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      loggers.error(error as Error, { adminId, operation: 'getAllSubmissions' });
      throw error;
    }
  }

  async getSubmissionByIds(submissionIds: string[]): Promise<SubmissionWithRelations[]> {
    try {
      return await this.prisma.rwaSubmission.findMany({
        where: {
          id: { in: submissionIds },
        },
        include: {
          owner: true,
          rwaListing: true, // Changed from token to rwaListing
        },
      });
    } catch (error) {
      loggers.error(error as Error, { submissionIds, operation: 'getSubmissionByIds' });
      throw error;
    }
  }
}
