/// <reference path="../types/fastify.d.ts" />
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { errors } from './errors';

// Simplified User type for Step 1
export interface SimpleUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Simplified Auth Context for Step 1
export interface SimpleAuthContext {
  user: SimpleUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
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
  console.log('🔐 requireAuth middleware called for:', request.method, request.url);
  console.log('🔐 Has auth?', !!request.auth);
  console.log('🔐 Has user?', !!request.user);
  console.log('🔐 isAuthenticated?', request.auth?.isAuthenticated);
  console.log('🔐 User ID:', request.user?.id);

  if (!request.auth) {
    console.error('❌ request.auth is null/undefined');
    throw errors.unauthorized('Authentication not initialized');
  }

  if (!request.auth.isAuthenticated || !request.user) {
    console.error(
      '❌ User not authenticated - isAuthenticated:',
      request.auth.isAuthenticated,
      'user:',
      !!request.user,
    );
    throw errors.unauthorized('Authentication required');
  }

  console.log('✅ Auth check passed for user:', request.user.id);
}

/**
 * Middleware to require admin role - V1 simplified version
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  if (!request.auth?.isAuthenticated || !request.user) {
    throw errors.unauthorized('Authentication required');
  }

  if (!request.auth.hasRole('ADMIN')) {
    throw errors.forbidden('Admin access required');
  }
}

/**
 * Middleware to require specific role(s)
 */
export function requireRole(role: UserRole | UserRole[]) {
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
 * Middleware to require user to be verified (for future steps when verification gates other features)
 */
export async function requireVerified(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth?.isAuthenticated || !request.user) {
    throw errors.unauthorized('Authentication required');
  }

  // Step 2: This will check verification status once we have the relationship set up
  // For now, we'll implement a basic check that can be expanded later

  // TODO: Implement verification check when needed for Step 4 (Submissions)
  // const verification = await prisma.accountVerification.findUnique({
  //   where: { userId: request.user.id },
  //   select: { status: true }
  // });
  //
  // if (verification?.status !== 'APPROVED') {
  //   throw errors.forbidden('Account verification required');
  // }
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
  requiredRole?: UserRole | UserRole[],
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
