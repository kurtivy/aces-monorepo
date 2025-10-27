import { PrismaClient } from '@prisma/client';

/**
 * Cached token metadata for fast lookups
 */
export interface TokenMetadata {
  contractAddress: string;
  phase: 'BONDING_CURVE' | 'DEX_TRADING';
  priceSource: 'BONDING_CURVE' | 'DEX';
  poolAddress: string | null;
  dexLiveAt: Date | null;
  symbol?: string;
  name?: string;
}

interface CacheEntry {
  data: TokenMetadata;
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<TokenMetadata | null>;
  timestamp: number;
}

/**
 * TokenMetadataCacheService
 *
 * Centralized caching for token metadata queries
 * Used across all routes to eliminate slow Token.findUnique() calls
 *
 * Features:
 * - 5-minute cache TTL (token metadata is stable)
 * - Request deduplication (prevents database stampedes)
 * - Automatic cache cleanup
 * - Manual invalidation support
 */
export class TokenMetadataCacheService {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();

  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly REQUEST_TIMEOUT_MS = 30 * 1000; // 30 seconds
  private cleanupInterval: NodeJS.Timeout;

  constructor(private prisma: PrismaClient) {
    // Periodic cache cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), 10 * 60 * 1000);
  }

  /**
   * Get token metadata with caching
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    const now = Date.now();
    const cacheKey = tokenAddress.toLowerCase();

    // 1. Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      // console.log(
      //   `[TokenCache] 🎯 Cache hit for ${tokenAddress} (age: ${Math.floor((now - cached.timestamp) / 1000)}s)`,
      // );
      return cached.data;
    }

    // 2. Check if there's already a pending request (deduplication)
    const pending = this.pendingRequests.get(cacheKey);
    if (pending && now - pending.timestamp < this.REQUEST_TIMEOUT_MS) {
      // console.log(`[TokenCache] 🔄 Waiting for pending request: ${tokenAddress}`);
      return pending.promise;
    }

    // 3. Make new request
    const promise = this._fetchTokenMetadata(cacheKey);

    this.pendingRequests.set(cacheKey, {
      promise,
      timestamp: now,
    });

    try {
      const result = await promise;

      // Cache the result (even if null)
      if (result) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: now,
        });
        // console.log(`[TokenCache] ✅ Cached metadata for ${tokenAddress}`);
      } else {
        // console.log(`[TokenCache] ⚠️ Token not found in database: ${tokenAddress}`);
      }

      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Actual database query (separated for error handling)
   */
  private async _fetchTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
      // console.log(`[TokenCache] 🔍 Fetching from database: ${tokenAddress}`);
      const startTime = Date.now();

      const token = await this.prisma.token.findUnique({
        where: { contractAddress: tokenAddress },
        select: {
          contractAddress: true,
          phase: true,
          priceSource: true,
          poolAddress: true,
          dexLiveAt: true,
          symbol: true,
          name: true,
        },
      });

      const duration = Date.now() - startTime;
      // console.log(`[TokenCache] ⏱️ Query completed in ${duration}ms`);

      if (!token) {
        return null;
      }

      return {
        contractAddress: token.contractAddress,
        phase: token.phase as 'BONDING_CURVE' | 'DEX_TRADING',
        priceSource: token.priceSource as 'BONDING_CURVE' | 'DEX',
        poolAddress: token.poolAddress,
        dexLiveAt: token.dexLiveAt,
        symbol: token.symbol,
        name: token.name,
      };
    } catch (error) {
      console.error(`[TokenCache] ❌ Error fetching token metadata:`, error);
      return null;
    }
  }

  /**
   * Check if token has graduated to DEX
   */
  async isTokenGraduated(tokenAddress: string): Promise<boolean> {
    const metadata = await this.getTokenMetadata(tokenAddress);

    if (!metadata) {
      return false;
    }

    return metadata.phase === 'DEX_TRADING' && metadata.priceSource === 'DEX';
  }

  /**
   * Get pool address for a token (returns null if not graduated)
   */
  async getPoolAddress(tokenAddress: string): Promise<string | null> {
    const metadata = await this.getTokenMetadata(tokenAddress);
    return metadata?.poolAddress || null;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean metadata cache
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // Clean stale pending requests
    for (const [key, entry] of this.pendingRequests.entries()) {
      if (now - entry.timestamp > this.REQUEST_TIMEOUT_MS) {
        this.pendingRequests.delete(key);
      }
    }

    if (cleanedCount > 0) {
      // console.log(`[TokenCache] 🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Manual cache invalidation
   */
  public invalidate(tokenAddress?: string): void {
    if (tokenAddress) {
      const key = tokenAddress.toLowerCase();
      this.cache.delete(key);
      this.pendingRequests.delete(key);
      // console.log(`[TokenCache] 🗑️ Cache invalidated for ${tokenAddress}`);
    } else {
      this.cache.clear();
      this.pendingRequests.clear();
      // console.log('[TokenCache] 🗑️ All caches cleared');
    }
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheTtl: `${this.CACHE_TTL_MS / 1000}s`,
    };
  }

  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.pendingRequests.clear();
    // console.log('[TokenCache] 🛑 Service shutdown');
  }
}

// Singleton instance (initialized in app.ts)
let instance: TokenMetadataCacheService | null = null;

export function initTokenMetadataCache(prisma: PrismaClient): TokenMetadataCacheService {
  if (!instance) {
    instance = new TokenMetadataCacheService(prisma);
    // console.log('[TokenCache] ✅ Service initialized');
  }
  return instance;
}

export function getTokenMetadataCache(): TokenMetadataCacheService {
  if (!instance) {
    throw new Error(
      'TokenMetadataCacheService not initialized. Call initTokenMetadataCache() first.',
    );
  }
  return instance;
}
