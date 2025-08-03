import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  fastify.log.warn('Authentication disabled - Privy integration removed');

  // Set default auth context for unauthenticated state
  fastify.addHook('preHandler', async (request) => {
    request.user = null;
    request.auth = createAuthContext(null);
  });
};

export const registerAuth = fp(registerAuthPlugin);
export default registerAuth;
