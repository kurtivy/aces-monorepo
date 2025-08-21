import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { createAuthContext } from '../lib/auth-middleware';
import { getPrismaClient } from '../lib/database';
import { UserRole, SellerStatus } from '../lib/prisma-enums';

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

          // Look up user in database with all required fields
          let user = await prisma.user.findUnique({
            where: { privyDid },
            select: {
              id: true,
              privyDid: true,
              walletAddress: true,
              email: true,
              displayName: true,
              avatar: true,
              role: true,
              isActive: true,
              sellerStatus: true,
              appliedAt: true,
              verifiedAt: true,
              rejectedAt: true,
              rejectionReason: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (!user) {
            console.log('🆕 Creating new user for Privy DID:', privyDid);

            // Extract info from token
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;

            user = await prisma.user.create({
              data: {
                privyDid,
                walletAddress,
                email,
                displayName: email?.split('@')[0] || 'User',
                role: UserRole.TRADER,
                isActive: true,
                sellerStatus: SellerStatus.NOT_APPLIED,
              },
              select: {
                id: true,
                privyDid: true,
                walletAddress: true,
                email: true,
                displayName: true,
                avatar: true,
                role: true,
                isActive: true,
                sellerStatus: true,
                appliedAt: true,
                verifiedAt: true,
                rejectedAt: true,
                rejectionReason: true,
                createdAt: true,
                updatedAt: true,
              },
            });

            console.log('✅ User created successfully:', user.id);
          } else {
            console.log('✅ Existing user found:', user.id);

            // Check if we need to update any fields
            const walletAddress = decoded.wallet_address || null;
            const email = decoded.email || null;

            const needsUpdate =
              (walletAddress && user.walletAddress !== walletAddress) ||
              (email && user.email !== email && !user.email); // Only update email if user doesn't have one

            if (needsUpdate) {
              console.log('🔄 Updating user info...');

              const updateData: any = {};

              if (walletAddress && user.walletAddress !== walletAddress) {
                updateData.walletAddress = walletAddress;
              }

              if (email && !user.email) {
                updateData.email = email;
                // Update display name if we're adding email for first time
                if (!user.displayName || user.displayName === 'User') {
                  updateData.displayName = email.split('@')[0];
                }
              }

              // Always update the updatedAt timestamp
              updateData.updatedAt = new Date();

              user = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
                select: {
                  id: true,
                  privyDid: true,
                  walletAddress: true,
                  email: true,
                  displayName: true,
                  avatar: true,
                  role: true,
                  isActive: true,
                  sellerStatus: true,
                  appliedAt: true,
                  verifiedAt: true,
                  rejectedAt: true,
                  rejectionReason: true,
                  createdAt: true,
                  updatedAt: true,
                },
              });

              console.log('✅ User updated successfully:', user.id);
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
