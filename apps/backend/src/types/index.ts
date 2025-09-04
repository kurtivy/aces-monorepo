import { SimpleUser } from './fastify';

// Re-export types from fastify declarations
export type { SimpleUser, SimpleAuthContext } from './fastify.d.ts';

// Re-export enums from lib
export { UserRole, safeEnumValue } from '../lib/prisma-enums';
export type { UserRoleType } from '../lib/prisma-enums';

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// Step 1: Basic request/response types
export interface UserProfileResponse extends ApiResponse {
  data: SimpleUser;
}

export interface UserUpdateRequest {
  email?: string;
}

export interface VerifyOrCreateUserRequest {
  privyDid: string;
  walletAddress?: string;
  email?: string;
}

export interface VerifyOrCreateUserResponse extends ApiResponse {
  data: SimpleUser;
  created: boolean;
}
