import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrivyClient, AuthTokenClaims } from '@privy-io/server-auth';
import { loggers } from '../lib/logger';

interface PrivyUserClaims extends AuthTokenClaims {
  walletAddress?: string;
}

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  const privyClient = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);

  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const claims = (await privyClient.verifyAuthToken(token)) as PrivyUserClaims;

        const user = await fastify.prisma.user.upsert({
          where: { privyDid: claims.userId },
          update: { walletAddress: claims.walletAddress || null },
          create: {
            privyDid: claims.userId,
            walletAddress: claims.walletAddress,
          },
        });

        if (user) {
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
