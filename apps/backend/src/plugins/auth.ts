import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  console.log('🔧 Registering enhanced auth plugin...');

  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  // Auth verification hook
  fastify.addHook('preHandler', async (request, reply) => {
    const startTime = Date.now();

    try {
      console.log('🔍 Auth hook triggered for:', {
        url: request.url,
        method: request.method,
        hasAuthHeader: !!request.headers.authorization,
      });

      const authHeader = request.headers.authorization;

      // Define public paths that don't require authentication
      const publicPaths = [
        '/health',
        '/api/health',
        '/live',
        '/search',
        '/stats',
        '/test',
        '/get-upload-url',
        '/upload-image',
        '/', // Root path for listings, contact, etc.
      ];

      // Check if this is a public path
      const isPublicPath =
        publicPaths.some((path) => {
          if (request.url === path) return true;
          if (path === '/health' && request.url.startsWith('/health')) return true;
          return false;
        }) ||
        (request.method === 'GET' && ['/live', '/search', '/stats', '/'].includes(request.url));

      if (isPublicPath) {
        console.log('✅ Public path, skipping auth:', request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error('❌ Error creating auth context for public path:', authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: () => false,
            isSellerVerified: false,
            canAccessSellerDashboard: false,
          };
        }
        return;
      }

      // Check for auth header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No valid auth header for route:', request.url);
        request.user = null;

        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error('❌ Error creating auth context for unauthenticated user:', authError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: () => false,
            isSellerVerified: false,
            canAccessSellerDashboard: false,
          };
        }

        // For clearly protected routes, return 401 immediately
        const protectedRoutes = ['/my', '/create', '/me'];
        if (protectedRoutes.includes(request.url)) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
          });
        }
        return;
      }

      console.log('🔍 Auth header found, testing database connection...');

      try {
        // Test database connection with error handling
        const prisma = getPrismaClient();
        const dbStart = Date.now();

        // Use a simpler query that's less likely to fail
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection successful in', Date.now() - dbStart, 'ms');

        // TODO: Add JWT verification here
        // For now, set null user but don't fail
        console.log('🔍 Creating auth context...');
        request.user = null;

        try {
          request.auth = createAuthContext(null);
          console.log('✅ Auth context created successfully');
        } catch (authContextError) {
          console.error('❌ Error in createAuthContext:', authContextError);
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: () => false,
            isSellerVerified: false,
            canAccessSellerDashboard: false,
          };
        }

        console.log('✅ Auth hook completed in', Date.now() - startTime, 'ms');
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);

        // For database errors, don't fail the request, just set no auth
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: () => false,
          isSellerVerified: false,
          canAccessSellerDashboard: false,
        };

        console.log('⚠️ Continuing without database connection');
      }
    } catch (error) {
      console.error('❌ Unexpected auth hook error:', error);

      // Set safe fallback auth
      request.user = null;
      request.auth = {
        user: null,
        isAuthenticated: false,
        hasRole: () => false,
        isSellerVerified: false,
        canAccessSellerDashboard: false,
      };

      console.log('🔧 Continuing with fallback auth due to error');
    }
  });

  console.log('✅ Enhanced auth plugin registered');
};

export const registerAuth = fp(registerAuthPlugin, {
  name: 'auth-plugin',
});

export default registerAuth;
