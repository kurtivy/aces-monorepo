// auth.ts - Simplified debug version to isolate the issue
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';
import { logger } from '../lib/logger';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  console.log('🔧 Registering SIMPLIFIED auth plugin for debugging...');

  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  // Auth verification hook
  fastify.addHook('preHandler', async (request) => {
    try {
      console.log('🔍 Auth hook triggered for:', request.url);

      const authHeader = request.headers.authorization;

      // Skip auth for health check and public routes
      const publicPaths = ['/health', '/api/health'];
      if (publicPaths.includes(request.url)) {
        console.log('✅ Skipping auth for public path');
        request.user = null;
        request.auth = createAuthContext(null);
        return;
      }

      // Check for auth header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No auth header - setting null user');
        request.user = null;
        request.auth = createAuthContext(null);
        return;
      }

      console.log('🔍 Auth header found, but SKIPPING JWT verification for debugging');

      // TEMPORARILY skip JWT verification to isolate database issues
      // Just set a mock user to test database connection
      console.log('🔍 Testing database connection...');

      const prisma = getPrismaClient();

      // Simple database test - just count users
      const userCount = await prisma.user.count();
      console.log('✅ Database connection successful, user count:', userCount);

      // Set a mock user for testing
      request.user = null; // Keep as null to trigger 401s
      request.auth = createAuthContext(null);

      console.log('✅ Auth hook completed successfully');
    } catch (error) {
      console.error('❌ Auth hook error:', error);
      logger.error('Auth hook failed:', error);

      // Set null user on error
      request.user = null;
      request.auth = createAuthContext(null);
    }
  });

  console.log('✅ Simplified auth plugin registered');
};

export const registerAuth = fp(registerAuthPlugin);
export default registerAuth;
