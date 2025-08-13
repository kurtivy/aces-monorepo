import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  fastify.log.warn('Authentication disabled - Using mock user for development');

  // Create a mock user for development purposes
  const mockUser = {
    id: 'dev-user-001',
    privyDid: 'did:privy:dev-user',
    walletAddress: '0x742d35Cc6634C0532925a3b8D5c5C0dcB21e1B0E',
    createdAt: new Date(),
    updatedAt: new Date(),
    email: 'dev@aces.fun',
    role: 'TRADER' as const,
    isActive: true,
    firstName: 'Dev',
    lastName: 'User',
    displayName: 'Development User',
    avatar: null,
    bio: 'Mock user for development',
    website: null,
    twitterHandle: null,
    sellerStatus: 'NOT_APPLIED' as const,
    appliedAt: null,
    verifiedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    notifications: true,
    newsletter: true,
    darkMode: false,
    verificationAttempts: 0,
    lastVerificationAttempt: null,
  };

  // Set mock authenticated context
  fastify.addHook('preHandler', async (request) => {
    request.user = mockUser;
    request.auth = createAuthContext(mockUser);
  });
};

export const registerAuth = fp(registerAuthPlugin);
export default registerAuth;
