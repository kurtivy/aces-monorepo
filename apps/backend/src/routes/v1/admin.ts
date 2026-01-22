// backend/src/routes/v1/admin.ts - V1 Clean Implementation
import { FastifyInstance } from 'fastify';
import { ListingService } from '../../services/listing-service';
import { requireAdmin } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export async function adminRoutes(fastify: FastifyInstance) {
  const listingService = new ListingService(fastify.prisma, undefined, fastify);

  /**
   * GoldSky cache + rate limit metrics
   */
  fastify.get(
    '/goldsky/metrics',
    {
      preHandler: [requireAdmin],
    },
    async (_request, reply) => {
      const service = fastify.unifiedGoldSkyService;

      if (!service) {
        return reply.send({
          success: false,
          error: 'Unified GoldSky service not configured',
        });
      }

      const metrics = service.getMetrics();

      return reply.send({
        success: true,
        data: {
          ...metrics,
          timestamp: Date.now(),
          rateLimit: {
            limitPerWindow: 50,
            windowSeconds: 10,
          },
        },
      });
    },
  );

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
        // Get user stats
        const totalUsers = await fastify.prisma.user.count();

        const stats = {
          users: {
            total: totalUsers,
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

}
