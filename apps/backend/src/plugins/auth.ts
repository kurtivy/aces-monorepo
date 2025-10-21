import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../lib/database';
import { requireAuth } from '../lib/auth-middleware';

const registerAuthPlugin = async (fastify: FastifyInstance) => {
  console.log('🔧 Registering simplified auth plugin...');

  // Always decorate the request with user and auth properties
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('auth', null);

  // Add authenticate decorator for route-level authentication
  fastify.decorate('authenticate', requireAuth);

  // Auth verification hook
  fastify.addHook('preHandler', async (request, reply) => {
    const startTime = Date.now();

    try {
      // Only log auth checks for non-public paths to reduce noise
      const isLikelyPublic =
        request.url.startsWith('/api/v1/tokens') ||
        request.url.startsWith('/health') ||
        request.url.startsWith('/api/health');

      if (!isLikelyPublic) {
        console.log('🔍 Auth hook triggered for:', {
          url: request.url,
          method: request.method,
          hasAuthHeader: !!request.headers.authorization,
        });
      }

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
        '/api/v1/tokens', // Token data and chart data endpoints
        '/api/v1/dex', // DEX quote/pool endpoints
        '/api/v1/twitch', // Twitch stream endpoints
        '/api/v1/cron/trigger', // Cron trigger endpoint for manual testing
        '/api/v1/cron/status', // Cron status endpoint
        '/api/cron/sync-tokens', // Vercel cron endpoint
        '/api/cron/sync-liquidity',
        '/', // Root path for listings, contact, etc.
        '/api/v1/bonding', // Bonding curve endpoints
        '/api/v1/listings/live', // Public listing endpoints
        '/api/v1/listings/symbol', // Public listing by symbol endpoint
        '/api/v1/prices', // Public price endpoints
      ];

      // Check if this is a public path
      const isPublicPath =
        publicPaths.some((path) => {
          if (request.url === path) return true;
          if (path === '/health' && request.url.startsWith('/health')) return true;
          // Allow all token-related endpoints
          if (path === '/api/v1/tokens' && request.url.startsWith('/api/v1/tokens')) return true;
          if (path === '/api/v1/dex' && request.url.startsWith('/api/v1/dex')) return true;
          if (path === '/api/v1/bonding' && request.url.startsWith('/api/v1/bonding')) return true;
          if (path === '/api/v1/listings/live' && request.url.startsWith('/api/v1/listings/live')) return true;
          if (path === '/api/v1/listings/symbol' && request.url.startsWith('/api/v1/listings/symbol')) return true;
          if (path === '/api/v1/prices' && request.url.startsWith('/api/v1/prices')) return true;
          return false;
        }) ||
        (request.method === 'GET' && ['/live', '/search', '/stats', '/'].includes(request.url));

      if (isPublicPath) {
        // Only log public path skips for non-token/non-listing endpoints to reduce noise
        const quietPaths = ['/api/v1/tokens', '/api/v1/listings', '/api/v1/prices'];
        if (!quietPaths.some(p => request.url.startsWith(p))) {
          console.log('✅ Public path, skipping auth:', request.url);
        }
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: () => false,
        };
        return;
      }

      // Check for auth header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No valid auth header for route:', request.url);
        request.user = null;
        request.auth = {
          user: null,
          isAuthenticated: false,
          hasRole: () => false,
        };

        // For clearly protected routes, return 401 immediately
        const protectedRoutes = ['/my', '/create', '/me'];
        if (protectedRoutes.some((route) => request.url.startsWith(route))) {
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

        const slowQueryTime = Date.now() - dbStart;
        if (slowQueryTime > 2000) {
          console.warn('⚠️ Slow database query detected:', slowQueryTime, 'ms');
        } else {
          console.log('✅ Database connection successful in', slowQueryTime, 'ms');
        }

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

          // Look up user in database - SIMPLIFIED FIELDS ONLY
          let user = await prisma.user.findUnique({
            where: { privyDid },
            select: {
              id: true,
              privyDid: true,
              walletAddress: true,
              email: true,
              role: true,
              isActive: true,
              sellerStatus: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!user) {
            console.log('🆕 Creating new user for Privy DID:', privyDid);

            // Extract info from token
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;

            // SIMPLIFIED USER CREATION
            user = await prisma.user.create({
              data: {
                privyDid,
                walletAddress,
                email,
                role: 'TRADER', // Using string literal to match enum
                isActive: true,
                sellerStatus: 'NOT_APPLIED', // Default seller status
              },
              select: {
                id: true,
                privyDid: true,
                walletAddress: true,
                email: true,
                role: true,
                isActive: true,
                sellerStatus: true,
                createdAt: true,
                updatedAt: true,
              },
            });

            if (user) {
              console.log('✅ User created successfully:', user.id);
            }
          } else {
            console.log('✅ Existing user found:', user.id);

            // Check if we need to update any fields
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;

            const needsUpdate =
              (walletAddress && user.walletAddress !== walletAddress) ||
              (email && user.email !== email && !user.email);

            if (needsUpdate) {
              console.log('🔄 Updating user info...');

              const updateData: {
                walletAddress?: string | null;
                email?: string | null;
                updatedAt?: Date;
              } = {};

              if (walletAddress && user.walletAddress !== walletAddress) {
                updateData.walletAddress = walletAddress;
              }

              if (email && !user.email) {
                updateData.email = email;
              }

              updateData.updatedAt = new Date();

              user = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
                select: {
                  id: true,
                  privyDid: true,
                  walletAddress: true,
                  email: true,
                  role: true,
                  isActive: true,
                  sellerStatus: true,
                  createdAt: true,
                  updatedAt: true,
                },
              });

              if (user) {
                console.log('✅ User updated successfully:', user.id);
              }
            }
          }

          // SIMPLIFIED AUTH CONTEXT
          request.user = user;
          request.auth = {
            user,
            isAuthenticated: !!user && user.isActive,
            hasRole: (role: string | string[]) => {
              if (!user) return false;
              const roles = Array.isArray(role) ? role : [role];
              return roles.includes(user.role);
            },
          };

          if (user) {
            console.log('✅ Auth context created successfully for user:', user.id);
          }
        } catch (jwtError) {
          console.error('❌ JWT verification failed:', jwtError);

          // Set fallback auth for invalid tokens
          request.user = null;
          request.auth = {
            user: null,
            isAuthenticated: false,
            hasRole: () => false,
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
      };

      console.log('🔧 Continuing with fallback auth due to error');
    }
  });

  console.log('✅ Simplified auth plugin registered');
};

export const registerAuth = fp(registerAuthPlugin, {
  name: 'auth-plugin',
});

export default registerAuth;
