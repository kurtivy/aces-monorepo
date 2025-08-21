// src/types/fastify.ts
import { UserRoleType, SellerStatusType } from '../lib/prisma-enums';

export interface EnhancedUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  displayName: string | null;
  avatar: string | null;
  role: UserRoleType;
  isActive: boolean;
  sellerStatus: SellerStatusType;
  appliedAt: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  user: EnhancedUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRoleType | UserRoleType[]) => boolean;
  isSellerVerified: boolean;
  canAccessSellerDashboard: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: EnhancedUser | null;
    auth: AuthContext;
  }
}
