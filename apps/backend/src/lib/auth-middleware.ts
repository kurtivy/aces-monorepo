import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, SellerStatus } from '@prisma/client';
import { errors } from './errors';
import { EnhancedUser, AuthContext } from '../types/fastify';

/**
 * Creates auth context for the request
 */
export function createAuthContext(user: EnhancedUser | null): AuthContext {
  const isAuthenticated = !!user && user.isActive;
  const isSellerVerified = user?.sellerStatus === SellerStatus.APPROVED;
  const canAccessSellerDashboard = isSellerVerified && !!user?.verifiedAt;

  return {
    user,
    isAuthenticated,
    hasRole: (role: UserRole | UserRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    isSellerVerified,
    canAccessSellerDashboard,
  };
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth) {
    console.error('❌ request.auth is null/undefined');
    throw errors.unauthorized('Authentication not initialized');
  }

  if (!request.auth.isAuthenticated) {
    console.error('❌ User not authenticated');
    throw errors.unauthorized('Authentication required');
  }
}

/**
 * Middleware to require specific role(s)
 */
export function requireRole(role: UserRole | UserRole[]) {
  return async (request: FastifyRequest) => {
    if (!request.auth.isAuthenticated) {
      throw errors.unauthorized('Authentication required');
    }

    if (!request.auth.hasRole(role)) {
      const roleNames = Array.isArray(role) ? role.join(' or ') : role;
      throw errors.forbidden(`${roleNames} role required`);
    }
  };
}

/**
 * Middleware to require seller verification
 */
export async function requireSellerVerification(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth.isAuthenticated) {
    throw errors.unauthorized('Authentication required');
  }

  if (!request.auth.isSellerVerified) {
    throw errors.forbidden('Seller verification required');
  }
}

/**
 * Middleware to require seller dashboard access (verification + credentials)
 */
export async function requireSellerDashboard(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth.isAuthenticated) {
    throw errors.unauthorized('Authentication required');
  }

  if (!request.auth.canAccessSellerDashboard) {
    throw errors.forbidden('Seller dashboard access required');
  }
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth.isAuthenticated) {
    throw errors.unauthorized('Authentication required');
  }

  if (!request.auth.hasRole(UserRole.ADMIN)) {
    throw errors.forbidden('Admin access required');
  }
}

/**
 * Optional auth middleware - sets auth context but doesn't require authentication
 */
export async function optionalAuth(_request: FastifyRequest) {
  // Auth context is already set in the auth plugin, nothing needed here
  // This exists for routes that want auth info but don't require it
}

/**
 * Utility function to check if user can perform action on resource
 */
export function canAccessResource(
  user: EnhancedUser | null,
  resourceOwnerId: string,
  requiredRole?: UserRole | UserRole[],
): boolean {
  if (!user) return false;

  // User can access their own resources
  if (user.id === resourceOwnerId) return true;

  // Check if user has required role for cross-user access
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }

  return false;
}
