import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  fetches: number;
  invalidations: number;
  entries: number;
}

type CacheMap = Map<string, CacheEntry<unknown>>;

/**
 * In-Memory Cache Plugin for Fastify
 *
 * Provides centralized caching with token-aware invalidation for:
 * - Bonding data
 * - Token metrics
 * - Chart data
 * - Quotes (bonding & DEX)
 * - Trade history
 *
 * Features:
 * - Automatic expiration (TTL-based)
 * - Token-aware invalidation (invalidates all caches for a token)
 * - Cache statistics for monitoring
 * - Support for async fetchers (getOrFetch pattern)
 */
class InMemoryCache {
  // Separate maps for different data types (for better organization)
  private bondingData: CacheMap = new Map();
  private metrics: CacheMap = new Map();
  private chartData: CacheMap = new Map();
  private quotes: CacheMap = new Map();
  private trades: CacheMap = new Map();
  private other: CacheMap = new Map(); // Fallback for other cache types

  // Statistics tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    fetches: 0,
    invalidations: 0,
    entries: 0,
  };

  private readonly DEFAULT_TTL = 5000; // 5 seconds default

  /**
   * Get cache map for a given cache type
   */
  private getCacheMap(type: string): CacheMap {
    switch (type) {
      case 'bonding':
        return this.bondingData;
      case 'metrics':
        return this.metrics;
      case 'chart':
        return this.chartData;
      case 'quotes':
        return this.quotes;
      case 'trades':
        return this.trades;
      default:
        return this.other;
    }
  }

  /**
   * Get entry from cache
   */
  get<T>(type: string, key: string): T | null {
    const cache = this.getCacheMap(type);
    const entry = cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set entry in cache
   */
  set<T>(type: string, key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const cache = this.getCacheMap(type);
    const now = Date.now();

    cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    this.updateStats();
  }

  /**
   * Get from cache or fetch if not available
   *
   * @param type - Cache type (bonding, metrics, chart, quotes, trades)
   * @param key - Cache key
   * @param fetcher - Async function to fetch data if not cached
   * @param ttl - Time to live in milliseconds (default: 5 seconds)
   */
  async getOrFetch<T>(
    type: string,
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(type, key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    this.stats.fetches++;
    const data = await fetcher();
    this.set(type, key, data, ttl);
    return data;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(type: string, key: string): boolean {
    const cache = this.getCacheMap(type);
    const deleted = cache.delete(key);
    if (deleted) {
      this.stats.invalidations++;
      this.updateStats();
    }
    return deleted;
  }

  /**
   * Invalidate all caches for a token address
   *
   * This is the main method for token-aware cache invalidation.
   * It removes all cache entries that contain the token address.
   */
  invalidateToken(tokenAddress: string): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    // Invalidate from all cache types
    const caches = [
      this.bondingData,
      this.metrics,
      this.chartData,
      this.quotes,
      this.trades,
      this.other,
    ];

    for (const cache of caches) {
      for (const key of cache.keys()) {
        if (key.includes(normalized)) {
          cache.delete(key);
          count++;
        }
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Invalidate bonding data cache for a token
   */
  invalidateBondingData(tokenAddress: string, chainId?: number): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    for (const key of this.bondingData.keys()) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(normalized)) {
        if (!chainId || key.includes(`:${chainId}`)) {
          this.bondingData.delete(key);
          count++;
        }
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Invalidate metrics cache for a token
   */
  invalidateMetrics(tokenAddress: string, chainId?: number): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    for (const key of this.metrics.keys()) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(normalized)) {
        if (!chainId || key.includes(`:${chainId}`)) {
          this.metrics.delete(key);
          count++;
        }
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Invalidate chart data cache for a token
   */
  invalidateChartData(tokenAddress: string): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    for (const key of this.chartData.keys()) {
      if (key.toLowerCase().includes(normalized)) {
        this.chartData.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Invalidate quotes cache for a token
   */
  invalidateQuotes(tokenAddress: string): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    for (const key of this.quotes.keys()) {
      if (key.toLowerCase().includes(normalized)) {
        this.quotes.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Invalidate trade history cache for a token
   */
  invalidateTrades(tokenAddress: string): number {
    const normalized = tokenAddress.toLowerCase();
    let count = 0;

    for (const key of this.trades.keys()) {
      if (key.toLowerCase().includes(normalized)) {
        this.trades.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.stats.invalidations += count;
      this.updateStats();
    }

    return count;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.bondingData.clear();
    this.metrics.clear();
    this.chartData.clear();
    this.quotes.clear();
    this.trades.clear();
    this.other.clear();
    this.updateStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      entries: this.getTotalEntries(),
    };
  }

  /**
   * Get total number of cache entries
   */
  private getTotalEntries(): number {
    return (
      this.bondingData.size +
      this.metrics.size +
      this.chartData.size +
      this.quotes.size +
      this.trades.size +
      this.other.size
    );
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.entries = this.getTotalEntries();
  }
}

// Create singleton instance
const cache = new InMemoryCache();

/**
 * Cache Plugin Registration
 */
async function cachePlugin(fastify: FastifyInstance) {
  // Decorate fastify with cache instance
  fastify.decorate('cache', cache);

  // Add cache stats endpoint for monitoring (consolidated with existing cache stats)
  fastify.get('/api/v1/cache/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = cache.getStats();

    // Also include stats from other cache services if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenCache = (fastify as any).tokenMetadataCache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotCache = (fastify as any).acesSnapshotCache;

    return reply.send({
      success: true,
      data: {
        inMemoryCache: stats, // New unified cache
        tokenMetadataCache: tokenCache ? tokenCache.getStats() : null,
        acesSnapshotCache: snapshotCache ? snapshotCache.getStats() : null,
      },
      timestamp: Date.now(),
    });
  });

  // Add cache clear endpoint (consolidated with existing cache clear)
  fastify.post('/api/v1/cache/clear', async (_request: FastifyRequest, reply: FastifyReply) => {
    cache.clear();

    // Also clear other caches if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenCache = (fastify as any).tokenMetadataCache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotCache = (fastify as any).acesSnapshotCache;

    if (tokenCache) tokenCache.invalidate();
    if (snapshotCache) snapshotCache.invalidate();

    return reply.send({
      success: true,
      message: 'All caches cleared',
      timestamp: Date.now(),
    });
  });

  // Add cache invalidation endpoint (for testing)
  fastify.post(
    '/api/v1/cache/invalidate',
    async (
      request: FastifyRequest<{
        Body: {
          tokenAddress?: string;
          type?: string;
          key?: string;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { tokenAddress, type, key } = request.body;

      if (tokenAddress) {
        const count = cache.invalidateToken(tokenAddress);
        return reply.send({
          success: true,
          message: `Invalidated ${count} cache entries for token`,
          count,
          tokenAddress,
        });
      }

      if (type && key) {
        const deleted = cache.invalidate(type, key);
        return reply.send({
          success: true,
          message: deleted ? 'Cache entry invalidated' : 'Cache entry not found',
          deleted,
          type,
          key,
        });
      }

      return reply.code(400).send({
        success: false,
        error: 'Must provide either tokenAddress or both type and key',
      });
    },
  );

  console.log('✅ Cache plugin registered');
}

// Export as Fastify plugin
export default fp(cachePlugin, {
  name: 'cache-plugin',
});

// TypeScript declarations for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    cache: InMemoryCache;
  }
}
