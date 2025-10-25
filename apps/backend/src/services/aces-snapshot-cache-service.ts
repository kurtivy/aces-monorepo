import { PrismaClient } from '@prisma/client';

/**
 * Cached ACES price snapshots for a time range
 */
interface SnapshotCacheEntry {
  snapshots: Array<{ timestamp: bigint; price: number; source: string }>;
  timestamp: number; // When cached
  timeRange: { min: number; max: number }; // Time range cached
}

/**
 * AcesSnapshotCacheService
 *
 * Caches ACES price snapshot queries to eliminate slow database lookups
 *
 * Features:
 * - 10-minute cache TTL (price snapshots are historical/immutable)
 * - Smart cache key based on token + time range
 * - Automatic cache cleanup
 * - Request deduplication
 */
export class AcesSnapshotCacheService {
  private cache = new Map<string, SnapshotCacheEntry>();
  private pendingRequests = new Map<string, Promise<SnapshotCacheEntry>>();

  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (snapshots are immutable)
  private cleanupInterval: NodeJS.Timeout;

  constructor(private prisma: PrismaClient) {
    // Periodic cache cleanup every 15 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), 15 * 60 * 1000);
    console.log('[SnapshotCache] ✅ Service initialized');
  }

  /**
   * Get ACES price snapshots for a time range with caching
   */
  async getSnapshotsInTimeRange(
    tokenAddress: string,
    minTimestamp: number,
    maxTimestamp: number,
    bufferSeconds: number = 300,
  ): Promise<Array<{ timestamp: bigint; price: number; source: string }>> {
    const now = Date.now();
    const cacheKey = this.getCacheKey(tokenAddress, minTimestamp, maxTimestamp);

    // 1. Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      console.log(
        `[SnapshotCache] 🎯 Cache hit for ${tokenAddress} (${minTimestamp}-${maxTimestamp}, age: ${Math.floor((now - cached.timestamp) / 1000)}s)`,
      );
      return cached.snapshots;
    }

    // 2. Check if there's already a pending request (deduplication)
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      console.log(`[SnapshotCache] 🔄 Waiting for pending request: ${cacheKey}`);
      const result = await pending;
      return result.snapshots;
    }

    // 3. Make new request
    const promise = this._fetchSnapshotsFromDb(
      tokenAddress,
      minTimestamp,
      maxTimestamp,
      bufferSeconds,
    );

    this.pendingRequests.set(cacheKey, promise);

    try {
      const result = await promise;

      // Cache the result
      this.cache.set(cacheKey, result);
      console.log(
        `[SnapshotCache] ✅ Cached ${result.snapshots.length} snapshots for ${tokenAddress}`,
      );

      return result.snapshots;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Actual database query (separated for error handling)
   */
  private async _fetchSnapshotsFromDb(
    tokenAddress: string,
    minTimestamp: number,
    maxTimestamp: number,
    bufferSeconds: number,
  ): Promise<SnapshotCacheEntry> {
    console.log(
      `[SnapshotCache] 🔍 Fetching snapshots from DB: ${tokenAddress} (${minTimestamp}-${maxTimestamp})`,
    );
    const startTime = Date.now();

    const snapshots = await this.prisma.acesPriceSnapshot.findMany({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: {
          gte: BigInt(minTimestamp - bufferSeconds),
          lte: BigInt(maxTimestamp + bufferSeconds),
        },
      },
      select: {
        timestamp: true,
        acesUsdPrice: true,
        source: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[SnapshotCache] ⏱️ Fetched ${snapshots.length} snapshots in ${duration}ms`);

    const mapped = snapshots.map((s) => ({
      timestamp: s.timestamp,
      price: parseFloat(s.acesUsdPrice.toString()),
      source: s.source,
    }));

    return {
      snapshots: mapped,
      timestamp: Date.now(),
      timeRange: { min: minTimestamp, max: maxTimestamp },
    };
  }

  /**
   * Generate cache key from token address and time range
   */
  private getCacheKey(tokenAddress: string, minTimestamp: number, maxTimestamp: number): string {
    // Round to nearest hour to increase cache hit rate
    const minHour = Math.floor(minTimestamp / 3600) * 3600;
    const maxHour = Math.ceil(maxTimestamp / 3600) * 3600;
    return `${tokenAddress.toLowerCase()}:${minHour}:${maxHour}`;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[SnapshotCache] 🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Manual cache invalidation
   */
  public invalidate(tokenAddress?: string): void {
    if (tokenAddress) {
      const normalizedToken = tokenAddress.toLowerCase();
      let deletedCount = 0;

      for (const key of this.cache.keys()) {
        if (key.startsWith(normalizedToken)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      console.log(
        `[SnapshotCache] 🗑️ Invalidated ${deletedCount} cache entries for ${tokenAddress}`,
      );
    } else {
      this.cache.clear();
      this.pendingRequests.clear();
      console.log('[SnapshotCache] 🗑️ All caches cleared');
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
    console.log('[SnapshotCache] 🛑 Service shutdown');
  }
}

// Singleton instance (initialized in app.ts)
let instance: AcesSnapshotCacheService | null = null;

export function initAcesSnapshotCache(prisma: PrismaClient): AcesSnapshotCacheService {
  if (!instance) {
    instance = new AcesSnapshotCacheService(prisma);
  }
  return instance;
}

export function getAcesSnapshotCache(): AcesSnapshotCacheService {
  if (!instance) {
    throw new Error(
      'AcesSnapshotCacheService not initialized. Call initAcesSnapshotCache() first.',
    );
  }
  return instance;
}
