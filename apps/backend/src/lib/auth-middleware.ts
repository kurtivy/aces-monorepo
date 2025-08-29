import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRoleType } from '../lib/prisma-enums';
import { errors } from './errors';

// Simplified User type for Step 1
export interface SimpleUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Simplified Auth Context for Step 1
export interface SimpleAuthContext {
  user: SimpleUser | null;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
}

/**
 * Creates simplified auth context for Step 1
 */
export function createAuthContext(user: SimpleUser | null): SimpleAuthContext {
  console.log('Creating auth context for user:', user?.id || 'null');

  // Handle null user case
  if (!user) {
    return {
      user: null,
      isAuthenticated: false,
      hasRole: () => false,
    };
  }

  const isAuthenticated = !!user && user.isActive;

  return {
    user,
    isAuthenticated,
    hasRole: (role: string | string[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
  };
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth) {
    console.error('request.auth is null/undefined');
    throw errors.unauthorized('Authentication not initialized');
  }

  if (!request.auth.isAuthenticated) {
    console.error('User not authenticated');
    throw errors.unauthorized('Authentication required');
  }
}

/**
 * Middleware to require specific role(s)
 */
export function requireRole(role: UserRoleType | UserRoleType[]) {
  return async (request: FastifyRequest) => {
    if (!request.auth?.isAuthenticated) {
      throw errors.unauthorized('Authentication required');
    }

    if (!request.auth.hasRole(role)) {
      const roleNames = Array.isArray(role) ? role.join(' or ') : role;
      throw errors.forbidden(`${roleNames} role required`);
    }
  };
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth?.isAuthenticated) {
    throw errors.unauthorized('Authentication required');
  }

  if (!request.auth.hasRole('ADMIN')) {
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
  user: SimpleUser | null,
  resourceOwnerId: string,
  requiredRole?: UserRoleType | UserRoleType[],
): boolean {
  if (!user) return false;

  // User can access their own resources
  if (user.id === resourceOwnerId) return true;

  // Check if user has required role for cross-user access
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.some((role) => user.role === role);
  }

  return false;
}
