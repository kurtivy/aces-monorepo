// backend/src/routes/v1/users.ts - Step 1: Essential Endpoints Only
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { decode } from 'jsonwebtoken';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UsersService } from '../../services/users-service';
import { requireAuth } from '../../lib/auth-middleware';
import { errors } from '../../lib/errors';

// Step 1: Simple validation schema (only email updates allowed)
const UserProfileUpdateSchema = z.object({
  email: z.string().email().optional(),
});

export async function usersRoutes(fastify: FastifyInstance) {
  const usersService = new UsersService(fastify.prisma);

  /**
   * Verify or create user from Privy authentication
   * This endpoint is called by the frontend after successful Privy auth
   */
  fastify.post(
    '/verify-or-create',
    {
      schema: {
        body: zodToJsonSchema(
          z.object({
            privyDid: z.string().min(1),
            walletAddress: z.string().optional(),
            email: z.string().email().optional(),
          }),
        ),
      },
    },
    async (request, reply) => {
      const { privyDid, walletAddress, email } = request.body as {
        privyDid: string;
        walletAddress?: string;
        email?: string;
      };
      const correlationId = request.id;

      try {
        // Custom JWT verification for this endpoint
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw errors.unauthorized('Authentication token required');
        }

        const token = authHeader.replace('Bearer ', '');

        // Decode JWT to verify it contains the same privyDid
        const decoded = decode(token) as {
          sub: string;
          wallet_address?: string;
          email?: string;
        } | null;

        if (!decoded || !decoded.sub || decoded.sub !== privyDid) {
          throw errors.unauthorized('Invalid or mismatched authentication token');
        }

        // Check if user already exists
        let user = await fastify.prisma.user.findUnique({
          where: { privyDid },
        });

        if (!user) {
          console.log('Creating new user for Privy DID:', privyDid);

          user = await fastify.prisma.user.create({
            data: {
              privyDid,
              walletAddress: walletAddress || null,
              email: email || null,
              role: 'TRADER',
              isActive: true,
            },
          });
          console.log('User created successfully:', user.id);
        } else {
          console.log('Existing user found:', user.id);

          // Update user info if provided and different
          const updates: Record<string, unknown> = {};
          if (walletAddress && user.walletAddress !== walletAddress) {
            updates.walletAddress = walletAddress;
          }
          if (email && user.email !== email) {
            updates.email = email;
          }

          if (Object.keys(updates).length > 0) {
            user = await fastify.prisma.user.update({
              where: { id: user.id },
              data: { ...updates, updatedAt: new Date() },
            });
            console.log('Updated user info:', user.id);
          }
        }

        // Get user profile using service
        const profile = await usersService.getUserProfile(user.id);

        return reply.send({
          success: true,
          data: {
            profile: profile,
            created: user.createdAt.getTime() > Date.now() - 10000, // true if just created
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        fastify.log.error(
          { err, correlationId, privyDid, operation: 'verifyOrCreateUser' },
          'Failed to verify or create user',
        );
        throw error;
      }
    },
  );

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
        const profile = await usersService.getUserProfile(request.user!.id);

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
   * Update current user's profile (email only for Step 1)
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
        const updatedProfile = await usersService.updateUserProfile(request.user!.id, updates);

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

  // Note: All other endpoints (transactions, assets, search, etc.) will be added in later steps
  // when the required models (submissions, listings, bids, tokens) are available
}
