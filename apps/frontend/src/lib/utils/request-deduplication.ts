/**
 * Request deduplication utility
 * Prevents multiple simultaneous requests to the same endpoint
 * Shares the result of a single request with all waiting callers
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingRequests: Map<string, PendingRequest<any>> = new Map();
  private readonly TIMEOUT = 30000; // 30 seconds

  /**
   * Execute a request with deduplication
   * If the same key is already in flight, return the existing promise
   * Otherwise, execute the request and cache the promise
   */
  async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Clean up stale requests
    this.cleanup();

    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise;
    }

    // Create new request
    const promise = requestFn()
      .then((result) => {
        // Remove from pending after successful completion
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        // Remove from pending after error
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Clean up stale requests that have been pending too long
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.TIMEOUT) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Clear all pending requests (useful for testing or forced refresh)
   */
  clear() {
    this.pendingRequests.clear();
  }

  /**
   * Clear a specific key
   */
  clearKey(key: string) {
    this.pendingRequests.delete(key);
  }
}

// Export singleton instance
export const requestDeduplicator = new RequestDeduplicator();
