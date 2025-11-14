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
    // 🚀 Phase 1-3: WebSocket Gateway Architecture
    adapterManager?: import('../services/websocket/adapter-manager').AdapterManager;
    // Services
    bitQueryService?: import('../services/bitquery-service').BitQueryService;
    acesUsdPriceService?: import('../services/aces-usd-price-service').AcesUsdPriceService;
    marketCapService?: import('../services/market-cap-service').MarketCapService;
    chartAggregationService?: any;
    tokenMetadataCache?: any;
    acesSnapshotCache?: any;
  }
}
