// backend/src/routes/v1/admin.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { AccountVerificationService } from '../../services/verification-service';
import { SubmissionService } from '../../services/submission-service';
import { ListingService } from '../../services/listing-service';
import { requireAdmin } from '../../lib/auth-middleware';
import { getSignedSecureUrl } from '../../lib/secure-storage-utils';
import { ProductStorageService } from '../../lib/product-storage-utils';
import { SubmissionStatus } from '../../lib/prisma-enums';
import { errors } from '../../lib/errors';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export async function adminRoutes(fastify: FastifyInstance) {
  const verificationService = new AccountVerificationService(fastify.prisma);
  const submissionService = new SubmissionService(fastify.prisma);
  const listingService = new ListingService(fastify.prisma);

  /**
   * Admin dashboard stats
   */
  fastify.get(
    '/dashboard/stats',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        // Get verification stats
        const [totalUsers, pendingVerifications, approvedVerifications, rejectedVerifications] =
          await Promise.all([
            fastify.prisma.user.count(),
            fastify.prisma.accountVerification.count({
              where: { status: 'PENDING' },
            }),
            fastify.prisma.accountVerification.count({
              where: { status: 'APPROVED' },
            }),
            fastify.prisma.accountVerification.count({
              where: { status: 'REJECTED' },
            }),
          ]);

        const stats = {
          users: {
            total: totalUsers,
            withVerification: approvedVerifications + rejectedVerifications + pendingVerifications,
          },
          verifications: {
            pending: pendingVerifications,
            approved: approvedVerifications,
            rejected: rejectedVerifications,
            total: approvedVerifications + rejectedVerifications + pendingVerifications,
          },
        };

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        console.error('Error getting admin stats:', error);
        throw error;
      }
    },
  );

  /**
   * Get all pending verifications
   */
  fastify.get(
    '/verifications/pending',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getPendingVerifications();

        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length,
        });
      } catch (error) {
        console.error('Error getting pending verifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get all verifications
   */
  fastify.get(
    '/verifications/all',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();

        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length,
        });
      } catch (error) {
        console.error('Error getting all verifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get all verifications (for admin dashboard)
   */
  fastify.get(
    '/verifications',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const verifications = await verificationService.getAllVerifications();

        return reply.send({
          success: true,
          data: verifications,
          count: verifications.length,
        });
      } catch (error) {
        console.error('Error getting all verifications:', error);
        throw error;
      }
    },
  );

  /**
   * Get all submissions for admin dashboard
   */
  fastify.get(
    '/submissions/all',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const query = request.query as { status?: string; limit?: string };
        const status = query.status;
        const limit = query.limit ? parseInt(query.limit) : 50;

        const submissions = await submissionService.getAllSubmissionsForAdmin({
          status: status && status !== 'ALL' ? status : undefined,
          limit,
        });

        return reply.send({
          success: true,
          data: submissions,
          count: submissions.length,
        });
      } catch (error) {
        console.error('Error getting admin submissions:', error);
        throw error;
      }
    },
  );

  /**
   * Get signed product image URLs for a submission's imageGallery (admin only)
   */
  fastify.get(
    '/submissions/:id/images',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const submission = await fastify.prisma.submission.findUnique({
          where: { id },
          select: { imageGallery: true },
        });

        if (!submission) {
          return reply.code(404).send({ success: false, message: 'Submission not found' });
        }

        const originalUrls: string[] = (submission.imageGallery as any) || [];
        const signed = await ProductStorageService.convertToSignedUrls(originalUrls, 60);
        const images = originalUrls.map((url, i) => ({
          originalUrl: url,
          signedUrl: signed[i] || url,
          expiresIn: 60 * 60, // seconds (1h)
        }));

        return reply.send({
          success: true,
          data: { submissionId: id, images },
        });
      } catch (error) {
        console.error('Error getting submission images:', error);
        throw error;
      }
    },
  );

  /**
   * Get signed ownership document URLs for a submission (admin only)
   */
  fastify.get(
    '/submissions/:id/ownership-docs',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const submission = await fastify.prisma.submission.findUnique({
          where: { id },
          select: {
            ownershipDocumentation: true,
          },
        });

        if (!submission) {
          return reply.code(404).send({ success: false, message: 'Submission not found' });
        }

        const docs: Array<{
          type: string;
          imageUrl: string;
          uploadedAt: string;
        }> = (submission.ownershipDocumentation as any) || [];

        const result = await Promise.all(
          docs.map(async (doc) => {
            const fileName = doc.imageUrl.split('/').slice(4).join('/');
            // If imageUrl is already a signed URL, keep as-is; else sign via secure util
            const signedUrl = doc.imageUrl.includes('X-Goog-Signature')
              ? doc.imageUrl
              : await getSignedSecureUrl(fileName, 30);
            return {
              type: doc.type,
              originalUrl: doc.imageUrl,
              signedUrl,
              uploadedAt: doc.uploadedAt,
            };
          }),
        );

        return reply.send({
          success: true,
          data: {
            submissionId: id,
            documents: result,
          },
        });
      } catch (error) {
        console.error('Error getting ownership docs:', error);
        throw error;
      }
    },
  );

  /**
   * Get verification details for a given user (admin only)
   */
  fastify.get(
    '/users/:id/verification',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const verification = await verificationService.getVerificationByUserId(id);
        return reply.send({ success: true, data: verification });
      } catch (error) {
        console.error('Error getting user verification (admin):', error);
        throw error;
      }
    },
  );

  /**
   * Approve a submission (admin convenience endpoint to match frontend)
   * POST /api/v1/admin/approve/:id
   * This ensures that BOTH submission approval AND listing creation succeed atomically
   */
  fastify.post(
    '/approve/:id',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Use transaction to ensure both operations succeed or both fail
        const result = await fastify.prisma.$transaction(async (tx) => {
          // Get submission first to verify it exists and is pending
          const submission = await tx.submission.findUnique({
            where: { id },
            include: { owner: true },
          });

          if (!submission) {
            throw errors.notFound('Submission not found');
          }

          if (submission.status !== SubmissionStatus.PENDING) {
            throw errors.validation(
              `Cannot approve submission with status: ${submission.status}. Only PENDING submissions can be approved.`,
            );
          }

          // Check if listing already exists
          const existingListing = await tx.listing.findUnique({
            where: { submissionId: id },
          });

          if (existingListing) {
            request.log?.warn(
              { submissionId: id, listingId: existingListing.id },
              'Listing already exists for submission, proceeding with approval only',
            );
            // Just approve the submission
            const approvedSubmission = await tx.submission.update({
              where: { id },
              data: {
                status: SubmissionStatus.APPROVED,
                approvedBy: request.user!.id,
                approvedAt: new Date(),
              },
              include: { owner: true },
            });
            return { submission: approvedSubmission, listing: existingListing };
          }

          // Update submission status to APPROVED
          const approvedSubmission = await tx.submission.update({
            where: { id },
            data: {
              status: SubmissionStatus.APPROVED,
              approvedBy: request.user!.id,
              approvedAt: new Date(),
            },
            include: { owner: true },
          });

          // Create listing within the same transaction
          const listing = await tx.listing.create({
            data: {
              title: approvedSubmission.title,
              symbol: approvedSubmission.symbol,
              brand: approvedSubmission.brand || null,
              story: approvedSubmission.story || null,
              details: approvedSubmission.details || null,
              provenance: approvedSubmission.provenance || null,
              value: approvedSubmission.value || null,
              reservePrice: approvedSubmission.reservePrice || null,
              hypeSentence: approvedSubmission.hypeSentence || null,
              assetType: approvedSubmission.assetType,
              imageGallery: approvedSubmission.imageGallery,
              location: approvedSubmission.location,
              isLive: false,
              tokenCreationStatus: 'AWAITING_USER_DETAILS',
              submissionId: approvedSubmission.id,
              ownerId: approvedSubmission.ownerId,
              approvedBy: request.user!.id,
            },
            include: {
              owner: true,
              submission: true,
            },
          });

          // Verify listing was created successfully
          if (!listing) {
            throw new Error('Failed to create listing after submission approval');
          }

          return { submission: approvedSubmission, listing };
        });

        // Send notifications outside transaction (these can fail without affecting approval)
        try {
          const notificationService =
            new (require('../../services/notification-service').NotificationService)(
              fastify.prisma,
            );
          const {
            NotificationTemplates,
            NotificationType,
          } = require('../../services/notification-service');

          // Notification for submission approval
          const approvalTemplate = NotificationTemplates[NotificationType.SUBMISSION_APPROVED];
          await notificationService.createNotification({
            userId: result.submission.ownerId,
            submissionId: result.submission.id,
            type: NotificationType.SUBMISSION_APPROVED,
            title: approvalTemplate.title,
            message: approvalTemplate.message,
            actionUrl: approvalTemplate.getActionUrl(),
          });

          // Notification for listing creation
          const listingTemplate = NotificationTemplates[NotificationType.LISTING_APPROVED];
          await notificationService.createNotification({
            userId: result.submission.ownerId,
            listingId: result.listing.id,
            type: NotificationType.LISTING_APPROVED,
            title: listingTemplate.title,
            message: listingTemplate.message,
            actionUrl: listingTemplate.getActionUrl(result.listing.id),
          });
        } catch (notificationError) {
          request.log?.warn(
            { err: notificationError, submissionId: id },
            'Failed to send notifications, but approval succeeded',
          );
        }

        return reply.send({
          success: true,
          data: result.submission,
          message: 'Submission approved and listing created successfully',
        });
      } catch (error) {
        console.error('Error approving submission (admin):', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to approve submission';

        // If listing creation failed, provide more specific error
        if (errorMessage.includes('listing') || errorMessage.includes('Listing')) {
          return reply.status(500).send({
            success: false,
            error:
              'Submission approval failed: Could not create listing. Please try again or contact support.',
            details: errorMessage,
          });
        }

        throw error;
      }
    },
  );

  /**
   * Reject a submission (admin convenience endpoint to match frontend)
   * POST /api/v1/admin/reject/:id
   */
  fastify.post(
    '/reject/:id',
    {
      preHandler: [requireAdmin],
      schema: {
        params: zodToJsonSchema(
          z.object({
            id: z.string(),
          }),
        ),
        body: zodToJsonSchema(
          z.object({
            rejectionReason: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { rejectionReason } = request.body as { rejectionReason: string };
        const submission = await submissionService.rejectSubmission(
          id,
          request.user!.id,
          rejectionReason,
        );
        return reply.send({
          success: true,
          data: submission,
          message: 'Submission rejected successfully',
        });
      } catch (error) {
        console.error('Error rejecting submission (admin):', error);
        throw error;
      }
    },
  );

  /**
   * Get all listings for admin dashboard
   */
  fastify.get(
    '/listings',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        const listings = await listingService.getAllListingsForAdmin();

        return reply.send({
          success: true,
          data: listings,
          count: listings.length,
        });
      } catch (error) {
        console.error('Error getting admin listings:', error);
        throw error;
      }
    },
  );

  /**
   * Get all sellers for admin dashboard
   */
  fastify.get(
    '/sellers',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        // Get all users with APPROVED seller status
        const sellers = await fastify.prisma.user.findMany({
          where: {
            sellerStatus: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
          },
          include: {
            accountVerification: true,
            listings: {
              select: {
                id: true,
                isLive: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                listings: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const sellersData = sellers.map((seller) => ({
          id: seller.id,
          displayName:
            seller.accountVerification?.firstName && seller.accountVerification?.lastName
              ? `${seller.accountVerification.firstName} ${seller.accountVerification.lastName}`
              : seller.email || seller.walletAddress || 'Unknown',
          email: seller.email,
          walletAddress: seller.walletAddress,
          sellerStatus: seller.sellerStatus,
          appliedAt: seller.appliedAt?.toISOString() || null,
          verifiedAt: seller.verifiedAt?.toISOString() || null,
          rejectedAt: seller.rejectedAt?.toISOString() || null,
          rejectionReason: seller.rejectionReason,
          createdAt: seller.createdAt.toISOString(),
          updatedAt: seller.updatedAt.toISOString(),
          accountVerification: seller.accountVerification
            ? {
                id: seller.accountVerification.id,
                status: seller.accountVerification.status,
                submittedAt: seller.accountVerification.submittedAt.toISOString(),
                reviewedAt: seller.accountVerification.reviewedAt?.toISOString() || null,
                attempts: seller.accountVerification.attempts,
                firstName: seller.accountVerification.firstName,
                lastName: seller.accountVerification.lastName,
                documentType: seller.accountVerification.documentType,
              }
            : null,
          listings: {
            total: seller._count.listings,
            live: seller.listings.filter((l) => l.isLive).length,
            recent: seller.listings.slice(0, 5).map((listing) => ({
              id: listing.id,
              title: 'Listing', // We don't have title in this query, could be enhanced
              symbol: 'N/A', // We don't have symbol in this query, could be enhanced
              isLive: listing.isLive,
              createdAt: listing.createdAt.toISOString(),
            })),
          },
          bidStats: {
            totalBids: 0, // TODO: Calculate from bids table when implemented
            totalBidValue: 0, // TODO: Calculate from bids table when implemented
          },
        }));

        return reply.send({
          success: true,
          data: sellersData,
          count: sellersData.length,
        });
      } catch (error) {
        console.error('Error getting admin sellers:', error);
        throw error;
      }
    },
  );

  /**
   * Get all bids for admin dashboard
   */
  fastify.get(
    '/bids',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      try {
        // For now, return empty array since bids functionality might not be fully implemented
        // This can be expanded when bid system is ready
        const bids: any[] = [];

        return reply.send({
          success: true,
          data: bids,
          count: bids.length,
        });
      } catch (error) {
        console.error('Error getting admin bids:', error);
        throw error;
      }
    },
  );

  // Note: Individual verification actions are handled in the account-verification routes
  // This keeps the admin routes focused on dashboard-style endpoints
}
