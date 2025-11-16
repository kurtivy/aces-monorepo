/**
 * Server-side Quote Cache
 * 
 * In-memory LRU cache for bonding curve and DEX quotes to handle high traffic.
 * Reduces RPC calls and external API requests during peak load.
 * 
 * Features:
 * - LRU eviction when max size reached
 * - TTL-based expiration
 * - Automatic cleanup of stale entries
 * - Thread-safe for concurrent requests
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntryAge: number | null;
  averageHits: number;
}

export class QuoteCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlMs: number = 5000, maxSize: number = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.startCleanup();
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(params: Record<string, any>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
  }

  /**
   * Get value from cache
   */
  get(params: Record<string, any>): T | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const age = Date.now() - entry.timestamp;

    // Check if expired
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit
    this.hits++;
    entry.hits++;

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(params: Record<string, any>, data: T): void {
    const key = this.generateKey(params);

    // Enforce max size with LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Invalidate entries matching pattern
   */
  invalidate(pattern: Partial<Record<string, any>>): number {
    const keysToDelete: string[] = [];
    const patternStr = this.generateKey(pattern);

    for (const key of this.cache.keys()) {
      if (key.includes(patternStr)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    return keysToDelete.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    let oldestAge: number | null = null;
    let totalHits = 0;

    if (this.cache.size > 0) {
      const now = Date.now();
      for (const entry of this.cache.values()) {
        const age = now - entry.timestamp;
        if (oldestAge === null || age > oldestAge) {
          oldestAge = age;
        }
        totalHits += entry.hits;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate * 100,
      oldestEntryAge: oldestAge,
      averageHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Run cleanup every TTL period
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.ttlMs);

    // Don't prevent process from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[QuoteCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Stop cleanup and destroy cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton cache instances
export const bondingQuoteCache = new QuoteCache<any>(
  5000, // 5 second TTL
  1000, // Max 1000 entries
);

export const dexQuoteCache = new QuoteCache<any>(
  8000, // 8 second TTL (DEX quotes change less frequently)
  1000,
);

export const multiHopQuoteCache = new QuoteCache<any>(
  6000, // 6 second TTL
  500, // Smaller cache (less common)
);

// Export cache stats endpoint helper
export function getAllCacheStats() {
  return {
    bondingQuote: bondingQuoteCache.getStats(),
    dexQuote: dexQuoteCache.getStats(),
    multiHopQuote: multiHopQuoteCache.getStats(),
  };
}







