import Fastify, { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyMetrics from 'fastify-metrics';
import { User as PrismaUser, PrismaClient } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TokenService } from '../services/token-service';
import { getPrismaClient, disconnectDatabase } from '../lib/database';
import { errors } from '../lib/errors';
import { logger } from '../lib/logger';

// Extend Fastify types to include custom properties
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user: PrismaUser | null;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

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

const buildTokensApp = async (): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger: false,
    genReqId: () => randomUUID(),
  });

  const prisma = getPrismaClient();
  fastify.decorate('prisma', prisma);

  // Register plugins
  fastify.register(cors, { origin: '*' });
  fastify.register(helmet);
  fastify.register(fastifyMetrics, {
    endpoint: '/metrics',
    routeMetrics: { enabled: true },
  });

  // Register hooks
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
    logger.info(`${request.id} ${request.method} ${request.url} ${request.headers['user-agent']}`);
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = request.startTime ? Date.now() - request.startTime : 0;
    logger.info(`${request.id} ${request.method} ${request.url} ${reply.statusCode} ${responseTime}ms`);
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    try {
      handleError(error, reply);
    } catch (error) {
      handleError(error, reply);
    }
  });

  fastify.addHook('onClose', async () => {
    await disconnectDatabase();
  });

  // Register routes
  fastify.post('/', async (
    request: FastifyRequest<{
      Body: z.infer<typeof createTokenSchema>;
    }>,
    reply: FastifyReply,
  ) => {
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
  });

  fastify.get('/:tokenId', async (
    request: FastifyRequest<{
      Params: z.infer<typeof tokenParamsSchema>;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const { tokenId } = tokenParamsSchema.parse(request.params);

      logger.info(`Getting token by ID: ${tokenId}`);

      const token = await tokenService.getTokenById(tokenId);

      return reply.status(200).send({
        success: true,
        data: token,
      });
    } catch (error) {
      logger.error(`Error getting token ${request.params.tokenId}:`, error);

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

  fastify.get('/contract/:contractAddress', async (
    request: FastifyRequest<{
      Params: z.infer<typeof contractAddressParamsSchema>;
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const { contractAddress } = contractAddressParamsSchema.parse(request.params);

      logger.info(`Getting token by contract address: ${contractAddress}`);

      const token = await tokenService.getTokenByContractAddress(contractAddress);

      return reply.status(200).send({
        success: true,
        data: token,
      });
    } catch (error) {
      logger.error(`Error getting token by contract address ${request.params.contractAddress}:`, error);

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

  fastify.get('/admin/all', async (request: FastifyRequest, reply: FastifyReply) => {
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

  fastify.get('/my', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      logger.info(`User ${userId} getting their tokens`);

      const tokens = await tokenService.getTokensByOwner(userId);

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

  fastify.delete('/:tokenId', async (
    request: FastifyRequest<{
      Params: z.infer<typeof tokenParamsSchema>;
    }>,
    reply: FastifyReply,
  ) => {
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
  });

  return fastify;
};

import type { VercelRequest, VercelResponse } from '@vercel/node';

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const app = await buildTokensApp();
  await app.ready();

  // Handle path rewriting: /api/v1/tokens/something → /something
  if (req.url?.startsWith('/api/v1/tokens')) {
    req.url = req.url.replace('/api/v1/tokens', '') || '/';
  }

  app.server.emit('request', req, res);
};

export default handler;
