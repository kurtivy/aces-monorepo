// backend/src/routes/v1/admin.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { AccountVerificationService } from '../../services/verification-service';
import { requireAdmin } from '../../lib/auth-middleware';

export async function adminRoutes(fastify: FastifyInstance) {
  const verificationService = new AccountVerificationService(fastify.prisma);

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

  // Note: Individual verification actions are handled in the account-verification routes
  // This keeps the admin routes focused on dashboard-style endpoints
}
