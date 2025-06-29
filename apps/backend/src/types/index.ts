// Backend-specific types that extend shared utils types
import type { User, RwaSubmission } from '@aces/utils';
import { PrismaClient } from '@prisma/client';

// Fastify request extensions
declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    startTime?: number;
  }

  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Service method types
export interface ServiceContext {
  userId: string;
  userRole: 'USER' | 'ADMIN';
  correlationId: string;
}

// Database query options
export interface QueryOptions {
  limit?: number;
  cursor?: string;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// Submission with populated relations
export interface SubmissionWithOwner extends RwaSubmission {
  owner: User;
}

// Admin-specific types
export interface AdminContext extends ServiceContext {
  userRole: 'ADMIN';
  adminId: string;
}

// Blockchain interaction types
export interface ContractCallResult {
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  success: boolean;
  error?: string;
}

export interface ContractCallParams {
  address: `0x${string}`; // Contract address with hex string type
  abi: unknown[]; // Contract ABI
  functionName: string;
  args: unknown[]; // Function arguments
  value?: bigint;
}

export interface WalletClient {
  address: string;
  chainId: number;
  writeContract: (params: ContractCallParams) => Promise<`0x${string}`>; // Returns transaction hash
}

// Environment configuration
export interface Config {
  database: {
    url: string;
  };
  blockchain: {
    network: 'localhost' | 'baseSepolia' | 'base';
    privateKey: string;
    rpcUrl: string;
  };
  auth: {
    privyAppId: string;
    privyAppSecret: string;
    adminWallets: string[];
  };
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
  };
}

// Audit log context
export interface AuditContext {
  actorId: string;
  actorType: 'USER' | 'ADMIN' | 'SYSTEM' | 'WEBHOOK';
  correlationId: string;
  metadata?: Record<string, unknown>;
}
