// backend/src/services/submission-service.ts - V1 Clean Implementation
import { PrismaClient, Prisma, User } from '@prisma/client';
import { AssetType, SubmissionStatus, RejectionType } from '../lib/prisma-enums';
import { ProductStorageService } from '../lib/product-storage-utils';
import { errors } from '../lib/errors';

// Type for submissions with relations
type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: {
    owner: true;
  };
}> & {
  approvedByUser?: User | null;
};

export interface CreateSubmissionRequest {
  title: string;
  symbol: string;
  description: string;
  assetType: keyof typeof AssetType;
  imageGallery?: string[];
  location?: string;
  email?: string;
  proofOfOwnership: string;
  proofOfOwnershipImageUrl?: string;
  typeOfOwnership: string;
}

export class SubmissionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if user is verified before allowing submission
   */
  async checkUserVerification(userId: string): Promise<boolean> {
    const verification = await this.prisma.accountVerification.findUnique({
      where: { userId },
      select: { status: true },
    });

    return verification?.status === 'APPROVED';
  }

  /**
   * Create a new submission
   */
  async createSubmission(
    userId: string,
    data: CreateSubmissionRequest,
  ): Promise<SubmissionWithRelations> {
    try {
      // Check if user is verified
      const isVerified = await this.checkUserVerification(userId);
      if (!isVerified) {
        throw errors.forbidden('Account verification required to submit assets');
      }

      // Get user's email from their profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      const submissionData = {
        title: data.title,
        symbol: data.symbol,
        description: data.description,
        assetType: data.assetType,
        imageGallery: data.imageGallery || [],
        proofOfOwnership: data.proofOfOwnership,
        proofOfOwnershipImageUrl: data.proofOfOwnershipImageUrl || null,
        typeOfOwnership: data.typeOfOwnership,
        location: data.location || null,
        email: data.email || user?.email || null,
        ownerId: userId,
        status: SubmissionStatus.PENDING,
      };

      const submission = await this.prisma.submission.create({
        data: submissionData,
        include: {
          owner: true,
        },
      });

      return submission;
    } catch (error) {
      console.error('Error in createSubmission:', error);
      throw error;
    }
  }

  /**
   * Get user's submissions
   */
  async getUserSubmissions(
    userId: string,
    filter?: { status?: keyof typeof SubmissionStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const where: any = {
        ownerId: userId,
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Take one extra to check for more
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      // Convert image URLs to signed URLs for secure access
      const dataWithSignedUrls = await Promise.all(
        data.map(async (submission) => ({
          ...submission,
          imageGallery: await ProductStorageService.convertToSignedUrls(
            submission.imageGallery as string[],
          ),
        })),
      );

      return { data: dataWithSignedUrls, nextCursor, hasMore };
    } catch (error) {
      console.error('Error in getUserSubmissions:', error);
      throw error;
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(
    submissionId: string,
    userId?: string,
  ): Promise<SubmissionWithRelations | null> {
    try {
      const where: any = { id: submissionId };

      // If userId is provided, ensure the user can only see their own submissions
      if (userId) {
        where.ownerId = userId;
      }

      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          owner: true,
        },
      });

      if (!submission) {
        return null;
      }

      // Convert image URLs to signed URLs for secure access
      const submissionWithSignedUrls = {
        ...submission,
        imageGallery: await ProductStorageService.convertToSignedUrls(
          submission.imageGallery as string[],
        ),
      };

      return submissionWithSignedUrls;
    } catch (error) {
      console.error('Error in getSubmissionById:', error);
      throw error;
    }
  }

  /**
   * Delete submission (only if pending)
   */
  async deleteSubmission(submissionId: string, userId: string): Promise<void> {
    try {
      const submission = await this.prisma.submission.findUnique({
        where: {
          id: submissionId,
          ownerId: userId, // Ensure user can only delete their own submissions
        },
      });

      if (!submission) {
        throw errors.notFound('Submission not found or access denied');
      }

      if (submission.status !== SubmissionStatus.PENDING) {
        throw errors.validation(
          `Cannot delete submission with status: ${submission.status}. Only pending submissions can be deleted.`,
        );
      }

      await this.prisma.submission.delete({
        where: { id: submissionId },
      });
    } catch (error) {
      console.error('Error in deleteSubmission:', error);
      throw error;
    }
  }

  /**
   * Get all submissions (admin only)
   */
  async getAllSubmissions(
    filter?: { status?: keyof typeof SubmissionStatus },
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const where: any = {
        ...(filter?.status && { status: filter.status }),
      };

      if (options.cursor) {
        where.id = { lt: options.cursor };
      }

      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = submissions.length > limit;
      const data = hasMore ? submissions.slice(0, -1) : submissions;
      const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

      return { data, nextCursor, hasMore };
    } catch (error) {
      console.error('Error in getAllSubmissions:', error);
      throw error;
    }
  }

  /**
   * Get pending submissions (admin only)
   */
  async getPendingSubmissions(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ data: SubmissionWithRelations[]; nextCursor?: string; hasMore: boolean }> {
    return this.getAllSubmissions({ status: SubmissionStatus.PENDING }, options);
  }

  /**
   * Approve submission (admin only)
   */
  async approveSubmission(submissionId: string, adminId: string): Promise<SubmissionWithRelations> {
    try {
      const submission = await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.APPROVED,
          approvedBy: adminId,
          approvedAt: new Date(),
        },
        include: {
          owner: true,
        },
      });

      return submission;
    } catch (error) {
      console.error('Error in approveSubmission:', error);
      throw error;
    }
  }

  /**
   * Reject submission (admin only)
   */
  async rejectSubmission(
    submissionId: string,
    adminId: string,
    rejectionReason: string,
    rejectionType: keyof typeof RejectionType = RejectionType.MANUAL,
  ): Promise<SubmissionWithRelations> {
    try {
      const submission = await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.REJECTED,
          approvedBy: adminId,
          rejectionReason,
          rejectionType,
        },
        include: {
          owner: true,
        },
      });

      return submission;
    } catch (error) {
      console.error('Error in rejectSubmission:', error);
      throw error;
    }
  }

  /**
   * Get all submissions for admin dashboard
   */
  async getAllSubmissionsForAdmin(options?: {
    status?: string;
    limit?: number;
  }): Promise<SubmissionWithRelations[]> {
    try {
      const where: any = {};

      if (options?.status && options.status !== 'ALL') {
        where.status = options.status;
      }

      const submissions = await this.prisma.submission.findMany({
        where,
        include: {
          owner: {
            include: {
              accountVerification: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit || 50,
      });

      return submissions;
    } catch (error) {
      console.error('Error in getAllSubmissionsForAdmin:', error);
      throw error;
    }
  }
}
