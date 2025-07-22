import { User as PrismaUser, PrismaClient, UserRole, SellerStatus } from '@prisma/client';

// Enhanced User type with all the new fields
export interface EnhancedUser extends PrismaUser {
  role: UserRole;
  sellerStatus: SellerStatus;
  isActive: boolean;
}

// Authorization context for requests
export interface AuthContext {
  user: EnhancedUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isSellerVerified: boolean;
  canAccessSellerDashboard: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    user: EnhancedUser | null;
    auth: AuthContext;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
