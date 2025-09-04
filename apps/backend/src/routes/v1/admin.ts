// backend/src/routes/v1/admin.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { AccountVerificationService } from '../../services/verification-service';
import { SubmissionService } from '../../services/submission-service';
import { ListingService } from '../../services/listing-service';
import { requireAdmin } from '../../lib/auth-middleware';

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
