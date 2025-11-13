/**
 * Request Deduplicator
 * 
 * Prevents duplicate concurrent API requests by sharing the same Promise
 * for identical requests. This is critical when multiple users or components
 * request the same quote simultaneously.
 * 
 * Example: If 10 users are viewing the same token and typing amounts,
 * we only make 1 API request instead of 10.
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  refCount: number;
}

export class RequestDeduplicator<T> {
  private pending: Map<string, PendingRequest<T>> = new Map();
  private readonly maxAge: number;

  constructor(maxAgeMs: number = 10000) {
    this.maxAge = maxAgeMs;
  }

  /**
   * Generate a unique key for the request
   */
  private generateKey(params: Record<string, any>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
  }

  /**
   * Execute request with deduplication
   * If an identical request is already in-flight, return that Promise instead
   */
  async execute(
    params: Record<string, any>,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    const key = this.generateKey(params);
    const existing = this.pending.get(key);

    // Check if we have a pending request
    if (existing) {
      const age = Date.now() - existing.timestamp;
      
      // If request is still fresh, reuse it
      if (age < this.maxAge) {
        existing.refCount++;
        console.log(
          `[RequestDeduplicator] Reusing in-flight request (refs: ${existing.refCount})`,
          params,
        );
        return existing.promise;
      } else {
        // Stale request, remove it
        this.pending.delete(key);
      }
    }

    // Create new request
    const promise = requestFn()
      .then((result) => {
        // Clean up after successful completion
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        // Clean up after error
        this.pending.delete(key);
        throw error;
      });

    // Store pending request
    this.pending.set(key, {
      promise,
      timestamp: Date.now(),
      refCount: 1,
    });

    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pending.clear();
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): {
    pendingCount: number;
    totalRefs: number;
    avgRefsPerRequest: number;
  } {
    let totalRefs = 0;
    
    for (const pending of this.pending.values()) {
      totalRefs += pending.refCount;
    }

    const pendingCount = this.pending.size;
    
    return {
      pendingCount,
      totalRefs,
      avgRefsPerRequest: pendingCount > 0 ? totalRefs / pendingCount : 0,
    };
  }
}

// Singleton instances for different request types
export const bondingQuoteDeduplicator = new RequestDeduplicator();
export const dexQuoteDeduplicator = new RequestDeduplicator();
export const multiHopQuoteDeduplicator = new RequestDeduplicator();


