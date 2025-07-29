import { PrismaClient, RwaSubmission, SubmissionStatus } from '@prisma/client';
import { errors } from '../lib/errors';
import { loggers } from '../lib/logger';
import { withTransaction } from '../lib/database';
import { ListingService } from './listing-service';

export class ApprovalService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Admin approval - updates database status and automatically creates RWAListing
   */
  async adminApproveSubmission(
    submissionId: string,
    adminId: string,
  ): Promise<{ success: boolean; submissionId: string; listingId?: string }> {
    try {
      let listingId: string | undefined;

      await withTransaction(async (tx) => {
        // Get submission
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        if (submission.status !== 'PENDING') {
          throw errors.validation(`Submission status is ${submission.status}, cannot approve`);
        }

        // Update submission status to APPROVED
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            updatedBy: adminId,
          },
        });

        // Log to audit trail
        await tx.submissionAuditLog.create({
          data: {
            submissionId,
            fromStatus: 'PENDING',
            toStatus: 'APPROVED',
            actorId: adminId,
            actorType: 'ADMIN',
            notes: 'Admin approval - RWAListing created automatically',
          },
        });
      });

      // After successful transaction, create the RWAListing
      try {
        const listingService = new ListingService(this.prisma);
        const listing = await listingService.createListingFromApprovedSubmission({
          submissionId,
          approvedBy: adminId,
        });
        listingId = listing.id;

        loggers.auth(adminId, null, 'admin_validated');
      } catch (listingError) {
        // Log error but don't fail the approval since submission is already approved
        loggers.error(listingError as Error, {
          submissionId,
          adminId,
          operation: 'createListingFromApprovedSubmission',
        });
        // Could implement a retry mechanism or manual intervention here
      }

      return { success: true, submissionId, listingId };
    } catch (error) {
      loggers.error(error as Error, { submissionId, adminId, operation: 'adminApproveSubmission' });
      throw error;
    }
  }

  async approveSubmission(
    submissionId: string,
    adminId: string,
    correlationId: string,
  ): Promise<{ success: boolean; submissionId: string; listingId?: string }> {
    try {
      // Use the simplified admin approval logic
      return await this.adminApproveSubmission(submissionId, adminId);
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        adminId,
        correlationId,
        operation: 'approveSubmission',
      });
      throw errors.internal('Failed to approve submission', { cause: error });
    }
  }

  async rejectSubmission(
    submissionId: string,
    adminId: string,
    reason: string,
    correlationId: string,
  ): Promise<boolean> {
    try {
      const result = await withTransaction(async (tx) => {
        // Get submission
        const submission = await tx.rwaSubmission.findUnique({
          where: { id: submissionId },
        });

        if (!submission) {
          throw errors.notFound('Submission not found');
        }

        if (submission.status !== 'PENDING') {
          throw errors.validation(`Submission status is ${submission.status}, cannot reject`);
        }

        // Update submission to rejected
        await tx.rwaSubmission.update({
          where: { id: submissionId },
          data: {
            status: 'REJECTED',
            rejectionReason: reason,
            updatedBy: adminId,
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
            notes: `Rejected: ${reason}`,
          },
        });

        return true;
      });

      loggers.auth(adminId, null, 'admin_rejected');
      return result;
    } catch (error) {
      loggers.error(error as Error, {
        submissionId,
        adminId,
        reason,
        correlationId,
        operation: 'rejectSubmission',
      });
      throw error;
    }
  }

  async validateAdminPermissions(userId: string, walletAddress?: string | null): Promise<boolean> {
    try {
      // Get user from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return false;
      }

      // Check if user has admin role
      return user.role === 'ADMIN';
    } catch (error) {
      loggers.error(error as Error, { userId, operation: 'validateAdminPermissions' });
      return false;
    }
  }

  async getSubmissionsByStatus(
    status: SubmissionStatus,
    options: { limit?: number; offset?: number } = {},
  ): Promise<RwaSubmission[]> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const offset = options.offset || 0;

      return await this.prisma.rwaSubmission.findMany({
        where: { status },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
              email: true,
            },
          },
          rwaListing: true, // Changed from token to rwaListing
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      loggers.error(error as Error, { status, options, operation: 'getSubmissionsByStatus' });
      throw error;
    }
  }

  async getSubmissionById(submissionId: string): Promise<RwaSubmission | null> {
    try {
      return await this.prisma.rwaSubmission.findUnique({
        where: { id: submissionId },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              walletAddress: true,
              email: true,
            },
          },
          rwaListing: true, // Changed from token to rwaListing
        },
      });
    } catch (error) {
      loggers.error(error as Error, { submissionId, operation: 'getSubmissionById' });
      throw error;
    }
  }
}
