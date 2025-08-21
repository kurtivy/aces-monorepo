import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, SellerStatus, UserRoleType, SellerStatusType } from '../lib/prisma-enums';
import { errors } from './errors';
import { EnhancedUser, AuthContext } from '../types/fastify';

/**
 * Creates auth context for the request with safe enum handling
 */
export function createAuthContext(user: EnhancedUser | null): AuthContext {
  try {
    console.log('🔍 createAuthContext called with:', {
      userExists: !!user,
      userActive: user?.isActive,
      sellerStatus: user?.sellerStatus,
      userRole: user?.role,
      enumsAvailable: {
        SellerStatus: Object.keys(SellerStatus),
        UserRole: Object.keys(UserRole),
      },
      enumValues: {
        SellerStatus: Object.values(SellerStatus),
        UserRole: Object.values(UserRole),
      },
    });

    // Handle null user case
    if (!user) {
      return {
        user: null,
        isAuthenticated: false,
        hasRole: () => false,
        isSellerVerified: false,
        canAccessSellerDashboard: false,
      };
    }

    // Ensure user has required fields with defaults
    const isActive = user.isActive !== undefined ? user.isActive : true;
    const isAuthenticated = !!user && isActive;

    console.log('🔍 Authentication calculation:', {
      userExists: !!user,
      userIsActive: isActive,
      isAuthenticated,
      userRole: user.role,
    });

    // Safe seller status check with proper type handling
    let isSellerVerified = false;
    if (user.sellerStatus) {
      // Use the Prisma enum directly
      isSellerVerified = user.sellerStatus === SellerStatus.APPROVED;
      console.log('🔍 Seller verification check:', {
        userSellerStatus: user.sellerStatus,
        approvedEnum: SellerStatus.APPROVED,
        isVerified: isSellerVerified,
      });
    }

    const canAccessSellerDashboard = isSellerVerified && !!user?.verifiedAt;

    console.log('✅ Auth context created:', {
      isAuthenticated,
      isSellerVerified,
      canAccessSellerDashboard,
      userRole: user.role || 'TRADER',
    });

    return {
      user,
      isAuthenticated,
      hasRole: (role: UserRoleType | UserRoleType[]) => {
        if (!user || !user.role) return false;

        try {
          const roles = Array.isArray(role) ? role : [role];

          // Use direct enum comparison
          return roles.some((r) => user.role === r);
        } catch (error) {
          console.error('Error checking user role:', error);
          return false;
        }
      },
      isSellerVerified,
      canAccessSellerDashboard,
    };
  } catch (error) {
    console.error('❌ Critical error in createAuthContext:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userProvided: !!user,
      userData: user
        ? {
            id: user.id,
            isActive: user.isActive,
            role: user.role,
            sellerStatus: user.sellerStatus,
          }
        : null,
    });

    // Return safe default on any error
    return {
      user,
      isAuthenticated: false,
      hasRole: () => false,
      isSellerVerified: false,
      canAccessSellerDashboard: false,
    };
  }
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
export function requireRole(role: UserRoleType | UserRoleType[]) {
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
  requiredRole?: UserRoleType | UserRoleType[],
): boolean {
  if (!user) return false;

  // User can access their own resources
  if (user.id === resourceOwnerId) return true;

  // Check if user has required role for cross-user access
  if (requiredRole) {
    try {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      return roles.some((role) => user.role === role);
    } catch (error) {
      console.error('Error checking resource access role:', error);
      return false;
    }
  }

  return false;
}
