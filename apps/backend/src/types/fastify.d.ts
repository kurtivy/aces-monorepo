import { PrismaClient } from '@prisma/client';

// Step 1: Simplified User interface (matches your new User model)
export interface SimpleUser {
  id: string;
  privyDid: string;
  walletAddress: string | null;
  email: string | null;
  role: 'TRADER' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Step 1: Simplified Auth Context
export interface SimpleAuthContext {
  user: SimpleUser | null;
  isAuthenticated: boolean;
  hasRole: (role: 'TRADER' | 'ADMIN' | ('TRADER' | 'ADMIN')[]) => boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SimpleUser | null;
    auth?: SimpleAuthContext;
    startTime?: number;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
