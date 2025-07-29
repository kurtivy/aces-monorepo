import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TokenService } from '../services/token-service.js';
import { getPrismaClient } from '../lib/database.js';
import { errors } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const tokenService = new TokenService(getPrismaClient());

// Schema definitions
const createTokenSchema = z.object({
  listingId: z.string().cuid(),
  contractAddress: z.string().min(1),
});

const tokenParamsSchema = z.object({
  tokenId: z.string().cuid(),
});

const contractAddressParamsSchema = z.object({
  contractAddress: z.string().min(1),
});

/**
 * Create token from listing (Admin/Owner only)
 * POST /api/v1/tokens
 */
export async function createToken(
  request: FastifyRequest<{
    Body: z.infer<typeof createTokenSchema>;
  }>,
  reply: FastifyReply,
) {
  try {
    const { listingId, contractAddress } = createTokenSchema.parse(request.body);

    // Get user from request (should be set by auth middleware)
    const userId = request.user?.id;
    const userRole = request.user?.role;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    // Only admins or listing owners can create tokens
    if (userRole !== 'ADMIN') {
      // Check if user owns the listing
      const listing = await getPrismaClient().rwaListing.findUnique({
        where: { id: listingId },
        select: { ownerId: true },
      });

      if (!listing || listing.ownerId !== userId) {
        return reply.status(403).send({
          success: false,
          error: 'Only listing owners or admins can create tokens',
        });
      }
    }

    logger.info(`User ${userId} creating token for listing ${listingId}`);

    const token = await tokenService.createTokenFromListing({
      listingId,
      contractAddress,
      userId,
    });

    return reply.status(201).send({
      success: true,
      data: token,
      message: 'Token created successfully',
    });
  } catch (error) {
    logger.error('Error creating token:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return reply.status(404).send({
        success: false,
        error: 'Listing not found',
      });
    }

    if (error instanceof Error && error.message.includes('validation')) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: 'Failed to create token',
    });
  }
}

/**
 * Get token by ID
 * GET /api/v1/tokens/:tokenId
 */
export async function getTokenById(
  request: FastifyRequest<{
    Params: z.infer<typeof tokenParamsSchema>;
  }>,
  reply: FastifyReply,
) {
  try {
    const { tokenId } = tokenParamsSchema.parse(request.params);

    logger.info(`Getting token by ID: ${tokenId}`);

    const token = await tokenService.getTokenById(tokenId);

    if (!token) {
      return reply.status(404).send({
        success: false,
        error: 'Token not found',
      });
    }

    return reply.status(200).send({
      success: true,
      data: token,
    });
  } catch (error) {
    logger.error(`Error getting token ${request.params.tokenId}:`, error);

    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch token',
    });
  }
}

/**
 * Get token by contract address
 * GET /api/v1/tokens/contract/:contractAddress
 */
export async function getTokenByContractAddress(
  request: FastifyRequest<{
    Params: z.infer<typeof contractAddressParamsSchema>;
  }>,
  reply: FastifyReply,
) {
  try {
    const { contractAddress } = contractAddressParamsSchema.parse(request.params);

    logger.info(`Getting token by contract address: ${contractAddress}`);

    const token = await tokenService.getTokenByContractAddress(contractAddress);

    if (!token) {
      return reply.status(404).send({
        success: false,
        error: 'Token not found',
      });
    }

    return reply.status(200).send({
      success: true,
      data: token,
    });
  } catch (error) {
    logger.error(`Error getting token by contract ${request.params.contractAddress}:`, error);

    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch token',
    });
  }
}

/**
 * Get all tokens (Admin only)
 * GET /api/v1/admin/tokens
 */
export async function getAllTokensForAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get user from request (should be set by auth middleware)
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
}

/**
 * Get user's tokens
 * GET /api/v1/tokens/my-tokens
 */
export async function getMyTokens(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get user from request (should be set by auth middleware)
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
}

/**
 * Delete token (Admin only)
 * DELETE /api/v1/tokens/:tokenId
 */
export async function deleteToken(
  request: FastifyRequest<{
    Params: z.infer<typeof tokenParamsSchema>;
  }>,
  reply: FastifyReply,
) {
  try {
    const { tokenId } = tokenParamsSchema.parse(request.params);

    // Get user from request (should be set by auth middleware)
    const userId = request.user?.id;
    const userRole = request.user?.role;

    if (!userId || userRole !== 'ADMIN') {
      return reply.status(403).send({
        success: false,
        error: 'Admin access required',
      });
    }

    logger.info(`Admin ${userId} deleting token ${tokenId}`);

    await tokenService.deleteToken(tokenId);

    return reply.status(200).send({
      success: true,
      message: 'Token deleted successfully',
    });
  } catch (error) {
    logger.error(`Error deleting token ${request.params.tokenId}:`, error);

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
}
