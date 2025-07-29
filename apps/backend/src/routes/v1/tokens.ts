import { FastifyInstance } from 'fastify';
import {
  getTokenById,
  getTokenByContractAddress,
  createToken,
  deleteToken,
  getMyTokens,
  getAllTokensForAdmin,
} from '../../api/tokens';
import { errors } from '../../lib/errors';

export default async function tokensRoutes(fastify: FastifyInstance) {
  // Authentication middleware for protected routes
  fastify.addHook('preHandler', async (request) => {
    // Skip auth check for public routes (token lookups)
    const publicRoutes = ['/api/v1/tokens/:tokenId', '/api/v1/tokens/contract/:contractAddress'];

    const isPublicRoute = publicRoutes.some((route) => {
      const pattern = route.replace(':tokenId', '[^/]+').replace(':contractAddress', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    if (isPublicRoute) {
      return;
    }

    // All other routes require authentication
    if (!request.user) {
      throw errors.unauthorized('Authentication required');
    }

    // Admin routes require admin role
    const adminRoutes = ['/api/v1/admin/tokens', '/api/v1/tokens/:tokenId'];

    const isAdminRoute = adminRoutes.some((route) => {
      const pattern = route.replace(':tokenId', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    // For DELETE requests, always require admin
    if (request.method === 'DELETE' && request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }

    if (isAdminRoute && request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }
  });

  // Public routes - no authentication required
  fastify.get('/tokens/:tokenId', getTokenById);
  fastify.get('/tokens/contract/:contractAddress', getTokenByContractAddress);

  // User routes - authentication required
  fastify.post('/tokens', createToken); // Create token (admin or owner)
  fastify.get('/tokens/my-tokens', getMyTokens);

  // Admin routes - authentication + admin role required
  fastify.get('/admin/tokens', getAllTokensForAdmin);
  fastify.delete('/tokens/:tokenId', deleteToken);
}
