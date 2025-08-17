import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';
import { logger } from '../lib/logger';

// Privy official server SDK
import { PrivyClient } from '@privy-io/server-auth';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

  if (!PRIVY_APP_ID) {
    throw new Error('PRIVY_APP_ID is required');
  }

  if (!PRIVY_APP_SECRET) {
    throw new Error('PRIVY_APP_SECRET is required');
  }

  // Initialize Privy client
  const privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

  // Auth verification hook
  fastify.addHook('preHandler', async (request) => {
    const authHeader = request.headers.authorization;
    const walletAddressHeader = request.headers['x-wallet-address'] as string;

    // Skip auth for health check and public routes
    const publicPaths = ['/health', '/api/health'];
    if (publicPaths.includes(request.url)) {
      request.user = null;
      request.auth = createAuthContext(null);
      return;
    }

    // Verify Privy JWT token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.user = null;
      request.auth = createAuthContext(null);
      return;
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT token using official Privy SDK
      const verifiedClaims = await privyClient.verifyAuthToken(token);

      const privyDid = verifiedClaims.userId; // Privy user ID
      const walletAddress = walletAddressHeader;

      // Find or create user in database
      const prisma = getPrismaClient();
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ privyDid }, { walletAddress: walletAddress || '' }],
        },
      });

      if (!user && privyDid) {
        // Create new user
        user = await prisma.user.create({
          data: {
            privyDid,
            walletAddress: walletAddress || '',
            email: '', // We'll get email from Privy API separately if needed
            role: 'TRADER',
            isActive: true,
            displayName: 'User',
          },
        });
        logger.info(`Created new user: ${user.id} with Privy DID: ${privyDid}`);
      } else if (user && walletAddress && user.walletAddress !== walletAddress) {
        // Update wallet address if changed
        user = await prisma.user.update({
          where: { id: user.id },
          data: { walletAddress },
        });
      }

      request.user = user;
      request.auth = createAuthContext(user);
    } catch (error) {
      logger.error('JWT verification failed:', error);
      request.user = null;
      request.auth = createAuthContext(null);
    }
  });
};

export const registerAuth = fp(registerAuthPlugin);
export default registerAuth;
