import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TokenService } from '../../services/token-service';
import { getPrismaClient } from '../../lib/database';
import { errors } from '../../lib/errors';
import { logger } from '../../lib/logger';

const tokenService = new TokenService(getPrismaClient());

// Schema definitions
const tokenParamsSchema = z.object({
  tokenId: z.string().cuid(),
});

const contractAddressSchema = z.object({
  contractAddress: z.string().min(1),
});

const createTokenSchema = z.object({
  contractAddress: z.string().min(1),
  listingId: z.string().cuid(),
});

export default async function tokensRoutes(fastify: FastifyInstance) {
  // Authentication middleware for protected routes
  fastify.addHook('preHandler', async (request) => {
    // Skip auth check for public routes
    const publicRoutes = ['/tokens/:tokenId', '/tokens/contract/:contractAddress'];

    const isPublicRoute = publicRoutes.some((route) => {
      const pattern = route.replace(':tokenId', '[^/]+').replace(':contractAddress', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    if (isPublicRoute) {
      return;
    }

    // All other routes require authentication
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    // Admin routes require admin role
    const adminRoutes = ['/admin/tokens'];

    const isAdminRoute = adminRoutes.some((route) => {
      return new RegExp(`^${route}$`).test(request.routeOptions.url || '');
    });

    if (isAdminRoute && request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }
  });

  // Public routes - no authentication required
  fastify.get('/tokens/:tokenId', async (request, reply) => {
    try {
      const { tokenId } = tokenParamsSchema.parse(request.params);
      logger.info(`Getting token by ID: ${tokenId}`);
      const token = await tokenService.getTokenById(tokenId);
      return reply.status(200).send({
        success: true,
        data: token,
      });
    } catch (error) {
      logger.error(`Error getting token ${(request.params as any)?.tokenId}:`, error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Token not found',
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token',
      });
    }
  });

  fastify.get('/tokens/contract/:contractAddress', async (request, reply) => {
    try {
      const { contractAddress } = contractAddressSchema.parse(request.params);
      logger.info(`Getting token by contract address: ${contractAddress}`);
      const token = await tokenService.getTokenByContractAddress(contractAddress);
      return reply.status(200).send({
        success: true,
        data: token,
      });
    } catch (error) {
      logger.error(
        `Error getting token by contract ${(request.params as any)?.contractAddress}:`,
        error,
      );
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Token not found',
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token',
      });
    }
  });

  // User routes - authentication required
  fastify.post('/tokens', async (request, reply) => {
    try {
      const tokenData = createTokenSchema.parse(request.body);
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info(`User ${userId} creating token from listing: ${tokenData.listingId}`);

      const token = await tokenService.createTokenFromListing({
        listingId: tokenData.listingId,
        contractAddress: tokenData.contractAddress,
        userId: userId,
      });

      return reply.status(201).send({
        success: true,
        data: token,
      });
    } catch (error) {
      logger.error('Error creating token:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create token',
      });
    }
  });

  fastify.delete('/tokens/:tokenId', async (request, reply) => {
    try {
      const { tokenId } = tokenParamsSchema.parse(request.params);
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info(`User ${userId} deleting token: ${tokenId}`);

      await tokenService.deleteToken(tokenId);

      return reply.status(200).send({
        success: true,
        message: 'Token deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting token:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Token not found',
        });
      }
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete token',
      });
    }
  });

  fastify.get('/tokens/my', async (request, reply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info(`User ${userId} getting their tokens`);
      const tokens = await tokenService.getTokensByUser(userId);

      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error) {
      logger.error(`Error getting tokens for user ${request.user?.id}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch your tokens',
      });
    }
  });

  // Admin routes - authentication + admin role required
  fastify.get('/admin/tokens', async (request, reply) => {
    try {
      const userId = request.user?.id;
      const userRole = request.user?.role;

      if (!userId || userRole !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Admin access required',
        });
      }

      logger.info(`Admin ${userId} getting all tokens`);
      const tokens = await tokenService.getAllTokens();

      return reply.status(200).send({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error) {
      logger.error('Error getting all tokens for admin:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch tokens',
      });
    }
  });
}
