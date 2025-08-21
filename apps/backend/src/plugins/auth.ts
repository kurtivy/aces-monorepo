// auth.ts - Custom JWT validation without Privy SDK
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';
import { logger } from '../lib/logger';
import jwt from 'jsonwebtoken';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  // Get Privy configuration
  const PRIVY_PUBLIC_KEY = process.env.PRIVY_PUBLIC_KEY; // Base64 encoded public key
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID; // cmcndpmaw02tnl50mw0tuk5h3

  if (!PRIVY_APP_ID) {
    throw new Error('PRIVY_APP_ID is required');
  }

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

    // Check for auth header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.user = null;
      request.auth = createAuthContext(null);
      return;
    }

    const token = authHeader.substring(7);

    try {
      // Manual JWT verification using Privy's public key
      let decoded;

      if (PRIVY_PUBLIC_KEY) {
        // Decode the base64 public key
        const publicKey = Buffer.from(PRIVY_PUBLIC_KEY, 'base64').toString('ascii');

        // Verify JWT with Privy's public key
        decoded = jwt.verify(token, publicKey, {
          algorithms: ['ES256'], // Privy uses ES256
          issuer: 'privy.io',
          audience: PRIVY_APP_ID,
        }) as jwt.JwtPayload;

        logger.info('JWT verified successfully with Privy public key');
      } else {
        // Fallback: Just decode without verification (INSECURE - only for testing)
        logger.warn('PRIVY_PUBLIC_KEY not set - using decode only (INSECURE)');
        decoded = jwt.decode(token) as jwt.JwtPayload;

        if (!decoded) {
          throw new Error('Invalid token format');
        }
      }

      const privyDid = decoded.sub; // Privy user ID from JWT subject
      const walletAddress = walletAddressHeader;

      if (!privyDid) {
        throw new Error('No user ID in token');
      }

      // Find or create user in database (same logic as before)
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
            email: decoded.email || '',
            role: 'TRADER',
            isActive: true,
            displayName: decoded.name || 'User',
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
