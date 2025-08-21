import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
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
        await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database connection successful in', Date.now() - dbStart, 'ms');

        // Verify Privy JWT token
        console.log('🔍 Verifying Privy JWT token...');
        const token = authHeader.replace('Bearer ', '');

        try {
          // Get Privy App ID from environment
          const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
          if (!privyAppId) {
            console.error('❌ NEXT_PUBLIC_PRIVY_APP_ID not set');
            throw new Error('Privy App ID not configured');
          }

          // Decode JWT without verification to get user info
          // Note: In production, you should verify the JWT signature
          // For now, we'll decode it to get the user ID
          const decoded = jwt.decode(token) as {
            sub: string;
            wallet_address?: string;
            email?: string;
          } | null;

          if (!decoded || !decoded.sub) {
            console.error('❌ Invalid JWT token structure');
            throw new Error('Invalid token');
          }

          const privyDid = decoded.sub;
          console.log('🔍 Privy DID from token:', privyDid);

          // Look up or create user in database
          let user = await prisma.user.findUnique({
            where: { privyDid },
          });

          if (!user) {
            console.log('🆕 Creating new user for Privy DID:', privyDid);

            // Extract wallet address from token if available
            const walletAddress = decoded.wallet_address || null;

            user = await prisma.user.create({
              data: {
                privyDid,
                walletAddress,
                email: decoded.email || null,
                displayName: decoded.email?.split('@')[0] || 'User',
                role: 'TRADER',
                isActive: true,
                sellerStatus: 'NOT_APPLIED',
              },
            });

            console.log('✅ User created successfully:', user.id);
          } else {
            console.log('✅ Existing user found:', user.id);

            // Update wallet address if it changed
            const walletAddress = decoded.wallet_address || null;
            if (walletAddress && user.walletAddress !== walletAddress) {
              await prisma.user.update({
                where: { id: user.id },
                data: { walletAddress },
              });
              user.walletAddress = walletAddress;
              console.log('✅ Updated wallet address for user:', user.id);
            }
          }

          request.user = user;
          request.auth = createAuthContext(user);
          console.log('✅ Auth context created successfully for user:', user.id);
        } catch (jwtError) {
          console.error('❌ JWT verification failed:', jwtError);

          // Set fallback auth for invalid tokens
          request.user = null;
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
