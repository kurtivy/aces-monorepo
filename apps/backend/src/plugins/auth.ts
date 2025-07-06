import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrivyClient, AuthTokenClaims } from '@privy-io/server-auth';
import { loggers } from '../lib/logger';

interface PrivyUserClaims extends AuthTokenClaims {
  walletAddress?: string;
}

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user property
  fastify.decorateRequest('user', null);

  // Skip auth verification if Privy credentials are missing
  if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    fastify.log.warn('Privy credentials missing - authentication disabled');
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

        const user = await fastify.prisma.user.upsert({
          where: { privyDid: claims.userId },
          update: { walletAddress: walletAddress || claims.walletAddress || null },
          create: {
            privyDid: claims.userId,
            walletAddress: walletAddress || claims.walletAddress,
          },
        });

        if (user) {
          // Update user with wallet address from header if different
          if (walletAddress && user.walletAddress !== walletAddress) {
            await fastify.prisma.user.update({
              where: { id: user.id },
              data: { walletAddress },
            });
            user.walletAddress = walletAddress;
          }
          loggers.auth(user.id, user.walletAddress, 'authenticated');
        }
        request.user = user;
      } catch (error) {
        fastify.log.warn('Auth verification failed:', error);
      }
    }
  });
};

export const registerAuth = fp(registerAuthPlugin);
