import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';
// import { loggers } from '../lib/logger';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  console.log('🔧 Registering production auth plugin...');

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
        '/live', // Public live submissions
        '/search', // Public search
        '/stats', // Public stats
        '/test', // Test endpoint
        '/get-upload-url', // File upload - you may want to protect this
        '/upload-image', // Direct image upload
      ];

      const isPublicPath =
        publicPaths.some((path) => {
          // Exact match
          if (request.url === path) return true;
          // Starts with for health checks
          if (path === '/health' && request.url.startsWith('/health')) return true;
          return false;
        }) ||
        (request.method === 'GET' && ['/live', '/search', '/stats'].includes(request.url));

      if (isPublicPath) {
        console.log('✅ Public path, skipping auth:', request.url);
        request.user = null;
        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error('❌ Error creating auth context for public path:', authError);
          // Safe fallback
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
        console.log('❌ No valid auth header for protected route:', request.url);
        request.user = null;

        try {
          request.auth = createAuthContext(null);
        } catch (authError) {
          console.error('❌ Error creating auth context for unauthenticated user:', authError);
          // Safe fallback
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

      // Test database connection
      const prisma = getPrismaClient();

      try {
        // Simple database health check
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection successful in', Date.now() - dbStart, 'ms');

        // TODO: Add JWT verification here
        // const token = authHeader.replace('Bearer ', '');
        // const decoded = await verifyJWT(token);
        // const user = await prisma.user.findUnique({
        //   where: { id: decoded.userId },
        //   include: { /* your user includes */ }
        // });

        // For now, set null user to test auth context creation
        console.log('🔍 Creating auth context...');
        request.user = null;

        try {
          request.auth = createAuthContext(null);
          console.log('✅ Auth context created successfully');
        } catch (authContextError) {
          console.error('❌ Error in createAuthContext:', authContextError);
          // Safe fallback
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
        // loggers.error('Database connection failed in auth hook', dbError);

        // Database error should return 503 Service Unavailable
        return reply.status(503).send({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_ERROR',
        });
      }
    } catch (error) {
      console.error('❌ Unexpected auth hook error:', error);
      // loggers.error('Auth hook failed with unexpected error', error);

      // Set safe fallback auth
      request.user = null;
      request.auth = {
        user: null,
        isAuthenticated: false,
        hasRole: () => false,
        isSellerVerified: false,
        canAccessSellerDashboard: false,
      };

      // Don't fail the request, just log and continue with no auth
      console.log('🔧 Continuing with no auth due to error');
    }
  });

  console.log('✅ Production auth plugin registered');
};

export const registerAuth = fp(registerAuthPlugin, {
  name: 'auth-plugin',
});

export default registerAuth;
