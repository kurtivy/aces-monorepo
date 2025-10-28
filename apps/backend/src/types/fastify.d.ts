import { PrismaClient, UserRole } from '@prisma/client';
import { FastifyRequest, FastifyReply } from 'fastify';

// Step 1: Simplified User interface (matches your new User model)
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

// Step 1: Simplified Auth Context
export interface SimpleAuthContext {
  user: SimpleUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SimpleUser | null;
    auth?: SimpleAuthContext;
    startTime?: number;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    bondingMonitor?: import('../websockets/bonding-monitor-socket').BondingMonitorWebSocket | null;
    chartAggregationService?: any;
    tokenMetadataCache?: any;
    acesSnapshotCache?: any;
  }
}
