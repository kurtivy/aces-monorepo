import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrivyClient, AuthTokenClaims } from '@privy-io/server-auth';
import { loggers } from '../lib/logger';
import { createAuthContext } from '../lib/auth-middleware';
import { EnhancedUser } from '../types/fastify';

interface PrivyUserClaims extends AuthTokenClaims {
  walletAddress?: string;
}

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  // Skip auth verification if Privy credentials are missing
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    fastify.log.warn(
      {
        hasAppId: !!process.env.PRIVY_APP_ID,
        hasAppSecret: !!process.env.PRIVY_APP_SECRET,
      },
      'Privy credentials missing - authentication disabled',
    );

    // Set default auth context for unauthenticated state
    fastify.addHook('preHandler', async (request) => {
      request.user = null;
      request.auth = createAuthContext(null);
    });

    return;
  }

  const privyClient = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);

  fastify.addHook('preHandler', async (request) => {
    const authHeader = request.headers.authorization;
    const walletAddress = request.headers['x-wallet-address'] as string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const claims = (await privyClient.verifyAuthToken(token)) as PrivyUserClaims;

        const user = (await fastify.prisma.user.upsert({
          where: { privyDid: claims.userId },
          update: {
            walletAddress: walletAddress || claims.walletAddress || undefined,
            updatedAt: new Date(),
          },
          create: {
            privyDid: claims.userId,
            walletAddress: walletAddress || claims.walletAddress,
            // Default values for new users (role defaults to TRADER via schema)
          },
        })) as EnhancedUser;

        // Update wallet address if different
        if (walletAddress && user.walletAddress !== walletAddress) {
          const updatedUser = (await fastify.prisma.user.update({
            where: { id: user.id },
            data: { walletAddress },
          })) as EnhancedUser;
          request.user = updatedUser;
        } else {
          request.user = user;
        }

        // Set auth context
        request.auth = createAuthContext(request.user);

        if (request.user) {
          loggers.auth(request.user.id, request.user.walletAddress, 'authenticated');
        }
      } catch (error) {
        fastify.log.warn('Auth verification failed:', error);
        request.user = null;
        request.auth = createAuthContext(null);
      }
    } else {
      // No auth header provided
      request.user = null;
      request.auth = createAuthContext(null);
    }
  });
};

export const registerAuth = fp(registerAuthPlugin);
export default registerAuth;
