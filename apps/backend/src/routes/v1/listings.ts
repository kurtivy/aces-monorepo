import { FastifyInstance } from 'fastify';
import {
  getLiveListings,
  getListingById,
  toggleListingStatus,
  getAllListingsForAdmin,
  getMyListings,
} from '../../api/listings.js';
import { errors } from '../../lib/errors.js';

export default async function listingsRoutes(fastify: FastifyInstance) {
  // Authentication middleware for protected routes
  fastify.addHook('preHandler', async (request) => {
    // Skip auth check for public routes
    const publicRoutes = ['/api/v1/listings', '/api/v1/listings/:listingId'];

    const isPublicRoute = publicRoutes.some((route) => {
      const pattern = route.replace(':listingId', '[^/]+');
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
    const adminRoutes = ['/api/v1/listings/:listingId/toggle', '/api/v1/admin/listings'];

    const isAdminRoute = adminRoutes.some((route) => {
      const pattern = route.replace(':listingId', '[^/]+');
      return new RegExp(`^${pattern}$`).test(request.routeOptions.url || '');
    });

    if (isAdminRoute && request.user.role !== 'ADMIN') {
      throw errors.forbidden('Admin access required');
    }
  });

  // Public routes - no authentication required
  fastify.get('/listings', getLiveListings);
  fastify.get('/listings/:listingId', getListingById);

  // User routes - authentication required
  fastify.get('/listings/my-listings', getMyListings);

  // Admin routes - authentication + admin role required
  fastify.post('/listings/:listingId/toggle', toggleListingStatus);
  fastify.get('/admin/listings', getAllListingsForAdmin);
}
