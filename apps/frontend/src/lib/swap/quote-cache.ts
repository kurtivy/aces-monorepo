/**
 * Client-side Quote Cache
 *
 * Caches bonding curve and DEX quotes to reduce API load during high traffic.
 * Features:
 * - Time-based cache invalidation (configurable TTL)
 * - Amount-based cache key with tolerance (reduces cache misses for similar amounts)
 * - Automatic cache cleanup
 * - Memory-efficient LRU eviction
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

interface QuoteCacheConfig {
  ttlMs: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached entries
  amountTolerance: number; // Percentage tolerance for amount matching (e.g., 0.5 = 0.5%)
}

const DEFAULT_CONFIG: QuoteCacheConfig = {
  ttlMs: 3000, // 3 seconds - balances freshness with API load
  maxSize: 100, // Keep last 100 unique quotes
  amountTolerance: 0.01, // 0.01% tolerance - very tight matching to prevent false cache hits
};

export class QuoteCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: QuoteCacheConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<QuoteCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Generate cache key with amount tolerance
   * This reduces cache misses for similar amounts (e.g., 100.5 and 100.3 use same cache)
   *
   * The tolerance works by rounding amounts to buckets:
   * - With 0.5% tolerance: amounts within 0.5% of each other share the same bucket
   * - Example: 100, 100.3, 100.5 all round to the same bucket
   */
  private generateKey(tokenAddress: string, amount: string, params: Record<string, any>): string {
    const amountNum = parseFloat(amount);

    if (!isFinite(amountNum) || amountNum <= 0) {
      return `invalid:${tokenAddress}:${amount}:${JSON.stringify(params)}`;
    }

    // Round amount to tolerance bucket
    // Formula: bucket = floor(amount / (amount * tolerance))
    // With 0.5% tolerance (0.005), bucket size = amount * 0.005
    // This creates buckets that scale with the amount size
    const toleranceDecimal = this.config.amountTolerance / 100;
    const bucketSize = amountNum * toleranceDecimal;

    // If bucket size is too small (< 0.01), use a minimum bucket size
    // This prevents excessive cache fragmentation for very small amounts
    const effectiveBucketSize = Math.max(bucketSize, 0.01);
    const bucketIndex = Math.floor(amountNum / effectiveBucketSize);
    const roundedAmount = bucketIndex * effectiveBucketSize;

    const paramsStr = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');

    // Use rounded amount with precision to avoid floating point issues
    return `${tokenAddress}:${roundedAmount.toFixed(6)}:${paramsStr}`;
  }

  /**
   * Check if two amounts are significantly different (more than tolerance)
   * Used to detect when user input changes significantly and cache should be bypassed
   */
  private isSignificantlyDifferent(amount1: string, amount2: string): boolean {
    const num1 = parseFloat(amount1);
    const num2 = parseFloat(amount2);

    if (!isFinite(num1) || !isFinite(num2) || num1 <= 0 || num2 <= 0) {
      return true; // Treat invalid amounts as different
    }

    // If amounts differ by more than tolerance, they're significantly different
    const diff = Math.abs(num1 - num2);
    const avg = (num1 + num2) / 2;
    const toleranceDecimal = this.config.amountTolerance / 100;
    const threshold = avg * toleranceDecimal;

    return diff > threshold;
  }

  /**
   * Get cached quote if available and not expired
   * @param previousAmount - Optional previous amount to detect significant changes
   */
  get(
    tokenAddress: string,
    amount: string,
    params: Record<string, any> = {},
    previousAmount?: string,
  ): T | null {
    const key = this.generateKey(tokenAddress, amount, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;

    // Check if cache entry is still valid
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // If previous amount is provided and significantly different, bypass cache
    // This ensures quotes update immediately when user types new digits
    if (previousAmount && this.isSignificantlyDifferent(previousAmount, amount)) {
      return null; // Force fresh fetch for significant changes
    }

    // Cache hit! Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Store quote in cache
   */
  set(tokenAddress: string, amount: string, data: T, params: Record<string, any> = {}): void {
    const key = this.generateKey(tokenAddress, amount, params);

    // Enforce max size with LRU eviction
    if (this.cache.size >= this.config.maxSize) {
      // Delete oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key,
    });
  }

  /**
   * Invalidate all quotes for a specific token
   */
  invalidateToken(tokenAddress: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.cache) {
      if (key.startsWith(`${tokenAddress}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    ttlMs: number;
    oldestEntryAge: number | null;
  } {
    let oldestAge: number | null = null;

    if (this.cache.size > 0) {
      const now = Date.now();
      for (const entry of this.cache.values()) {
        const age = now - entry.timestamp;
        if (oldestAge === null || age > oldestAge) {
          oldestAge = age;
        }
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
      oldestEntryAge: oldestAge,
    };
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every TTL period
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.ttlMs);
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.config.ttlMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[QuoteCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Stop cleanup interval (call on unmount)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instances for different quote types
export const bondingQuoteCache = new QuoteCache<any>({
  ttlMs: 3000, // 3 seconds for bonding quotes
  maxSize: 100,
  amountTolerance: 0.01, // Very tight tolerance to prevent false cache hits
});

export const dexQuoteCache = new QuoteCache<any>({
  ttlMs: 5000, // 5 seconds for DEX quotes (less volatile)
  maxSize: 100,
  amountTolerance: 0.01, // Very tight tolerance to prevent false cache hits
});

export const multiHopQuoteCache = new QuoteCache<any>({
  ttlMs: 4000, // 4 seconds for multi-hop quotes
  maxSize: 50,
  amountTolerance: 0.01, // Very tight tolerance to prevent false cache hits
});
