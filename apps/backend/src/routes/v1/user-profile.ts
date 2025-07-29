import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UserProfileService } from '../../services/user-profile-service';
import { requireAuth, optionalAuth, canAccessResource } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';
import { UserRole } from '@prisma/client';

// Validation schemas
const UserProfileUpdateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  displayName: z.string().min(1).max(30).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  twitterHandle: z
    .string()
    .regex(/^@?[A-Za-z0-9_]{1,15}$/)
    .optional(),
  avatar: z.string().url().optional(),
  notifications: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  darkMode: z.boolean().optional(),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const UserSearchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function userProfileRoutes(fastify: FastifyInstance) {
  const profileService = new UserProfileService(fastify.prisma);

  /**
   * Get current user's profile
   */
  fastify.get(
    '/me',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const profile = await profileService.getUserProfile(request.user!.id);

        return reply.send({
          success: true,
          data: profile,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, operation: 'getCurrentUserProfile' },
          'Failed to get current user profile',
        );
        throw error;
      }
    },
  );

  /**
   * Update current user's profile
   */
  fastify.put(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        body: zodToJsonSchema(UserProfileUpdateSchema),
      },
    },
    async (request, reply) => {
      const updates = request.body as z.infer<typeof UserProfileUpdateSchema>;
      const correlationId = request.id;

      try {
        const updatedProfile = await profileService.updateUserProfile(
          request.user!.id,
          updates,
          correlationId,
        );

        return reply.send({
          success: true,
          data: updatedProfile,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, correlationId, operation: 'updateCurrentUserProfile' },
          'Failed to update current user profile',
        );
        throw error;
      }
    },
  );

  /**
   * Get user profile by ID (public view)
   */
  fastify.get(
    '/:userId',
    {
      preHandler: [optionalAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            userId: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      try {
        // If accessing own profile, return full details
        if (request.auth.isAuthenticated && request.user!.id === userId) {
          const profile = await profileService.getUserProfile(userId);
          return reply.send({
            success: true,
            data: profile,
          });
        }

        // Otherwise, return public profile
        const publicProfile = await profileService.getPublicUserProfile(userId);
        return reply.send({
          success: true,
          data: publicProfile,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, userId, operation: 'getUserProfileById' },
          'Failed to get user profile',
        );
        throw error;
      }
    },
  );

  /**
   * Get current user's transaction history
   */
  fastify.get(
    '/me/transactions',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { limit, cursor } = request.query as z.infer<typeof PaginationSchema>;

      try {
        const transactions = await profileService.getUserTransactionHistory(
          request.user!.id,
          limit,
          cursor,
        );

        return reply.send({
          success: true,
          data: transactions,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, operation: 'getUserTransactionHistory' },
          'Failed to get user transaction history',
        );
        throw error;
      }
    },
  );

  /**
   * Get user's transaction history by ID (limited access)
   */
  fastify.get(
    '/:userId/transactions',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            userId: z.string().min(1),
          }),
        ),
        querystring: zodToJsonSchema(PaginationSchema),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const { limit, cursor } = request.query as z.infer<typeof PaginationSchema>;

      try {
        // Check if user can access this data
        if (!canAccessResource(request.user, userId, [UserRole.ADMIN])) {
          throw errors.forbidden('Access denied');
        }

        const transactions = await profileService.getUserTransactionHistory(userId, limit, cursor);

        return reply.send({
          success: true,
          data: transactions,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, userId, operation: 'getUserTransactionHistoryById' },
          'Failed to get user transaction history',
        );
        throw error;
      }
    },
  );

  /**
   * Get current user's on-chain assets
   */
  fastify.get(
    '/me/assets',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const assets = await profileService.getUserOnChainAssets(
          request.user!.id,
          request.user!.walletAddress || undefined,
        );

        return reply.send({
          success: true,
          data: assets,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, operation: 'getUserOnChainAssets' },
          'Failed to get user on-chain assets',
        );
        throw error;
      }
    },
  );

  /**
   * Get user's on-chain assets by ID (limited access)
   */
  fastify.get(
    '/:userId/assets',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            userId: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      try {
        // Check if user can access this data
        if (!canAccessResource(request.user, userId, [UserRole.ADMIN])) {
          throw errors.forbidden('Access denied');
        }

        const user = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { walletAddress: true },
        });

        if (!user) {
          throw errors.notFound('User not found');
        }

        const assets = await profileService.getUserOnChainAssets(
          userId,
          user.walletAddress || undefined,
        );

        return reply.send({
          success: true,
          data: assets,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, userId, operation: 'getUserOnChainAssetsById' },
          'Failed to get user on-chain assets',
        );
        throw error;
      }
    },
  );

  /**
   * Search users
   */
  fastify.get(
    '/search',
    {
      preHandler: [optionalAuth],
      schema: {
        querystring: zodToJsonSchema(UserSearchSchema),
      },
    },
    async (request, reply) => {
      const { q, limit } = request.query as z.infer<typeof UserSearchSchema>;

      try {
        const users = await profileService.searchUsers(q, limit);

        return reply.send({
          success: true,
          data: {
            users,
            query: q,
            total: users.length,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error({ err, query: q, operation: 'searchUsers' }, 'Failed to search users');
        throw error;
      }
    },
  );

  /**
   * Get user statistics (admin only)
   */
  fastify.get(
    '/:userId/stats',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            userId: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      try {
        // Check if user can access this data (admin or own data)
        if (!canAccessResource(request.user, userId, [UserRole.ADMIN])) {
          throw errors.forbidden('Access denied');
        }

        // Get comprehensive user statistics
        const [profile, transactions, assets] = await Promise.all([
          profileService.getUserProfile(userId),
          profileService.getUserTransactionHistory(userId, 1),
          profileService.getUserOnChainAssets(userId),
        ]);

        const stats = {
          profile: {
            id: profile.id,
            role: profile.role,
            sellerStatus: profile.sellerStatus,
            createdAt: profile.createdAt,
            isVerifiedSeller: profile.isVerifiedSeller,
          },
          activity: {
            totalSubmissions: transactions.totalSubmissions,
            totalBids: transactions.totalBids,
            totalSpent: transactions.totalSpent,
          },
          assets: {
            totalTokens: assets.tokens.length,
            totalValue: assets.totalValue,
          },
        };

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, userId, operation: 'getUserStats' },
          'Failed to get user statistics',
        );
        throw error;
      }
    },
  );

  /**
   * Get user's tokens
   */
  fastify.get(
    '/:userId/tokens',
    {
      preHandler: [requireAuth],
      schema: {
        params: zodToJsonSchema(
          z.object({
            userId: z.string().min(1),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      try {
        // Check if user can access this data (admin or own data)
        if (!canAccessResource(request.user, userId, [UserRole.ADMIN])) {
          throw errors.forbidden('Access denied');
        }

        const tokens = await profileService.getUserTokens(userId);

        return reply.send({
          success: true,
          data: tokens,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error({ err, userId, operation: 'getUserTokens' }, 'Failed to get user tokens');
        throw error;
      }
    },
  );

  /**
   * Get current user's tokens
   */
  fastify.get(
    '/me/tokens',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      try {
        const tokens = await profileService.getUserTokens(request.user!.id);

        return reply.send({
          success: true,
          data: tokens,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, operation: 'getCurrentUserTokens' },
          'Failed to get current user tokens',
        );
        throw error;
      }
    },
  );
}
