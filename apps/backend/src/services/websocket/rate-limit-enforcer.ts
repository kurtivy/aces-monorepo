/**
 * Rate Limit Enforcer
 *
 * Proactively enforces rate limits by queuing or rejecting requests
 * when approaching external API limits. Works in conjunction with
 * RateLimitMonitor to prevent violations before they occur.
 *
 * Key Features:
 * - Blocks requests at 90% capacity
 * - Queues requests with priority handling
 * - Auto-processes queue when capacity available
 * - Provides backpressure to prevent cascading failures
 */

import { EventEmitter } from 'events';
import { RateLimitMonitor } from './rate-limit-monitor';

interface QueuedRequest {
  service: string;
  priority: 'high' | 'normal' | 'low';
  resolve: (allowed: boolean) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutMs: number;
}

interface EnforcerStats {
  queuedRequests: number;
  totalQueued: number;
  totalProcessed: number;
  totalRejected: number;
  avgQueueTime: number;
}

export class RateLimitEnforcer extends EventEmitter {
  private monitor: RateLimitMonitor;
  private requestQueue: QueuedRequest[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  // Stats
  private stats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalRejected: 0,
    queueTimes: [] as number[],
  };

  // Configuration
  private readonly ENFORCEMENT_THRESHOLD = 0.9; // Start enforcing at 90%
  private readonly QUEUE_PROCESS_INTERVAL_MS = 500; // Check queue every 500ms
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

  constructor(monitor: RateLimitMonitor) {
    super();
    this.monitor = monitor;
    this.startQueueProcessor();
  }

  /**
   * Check if a request should be allowed
   *
   * @param service - Service name (bitquery, aerodrome, etc.)
   * @param priority - Request priority (default: 'normal')
   * @param timeoutMs - How long to wait in queue before rejecting (default: 30s)
   * @returns Promise<boolean> - true if allowed, false if rejected
   */
  async checkRateLimit(
    service: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS,
  ): Promise<boolean> {
    const usage = this.monitor.getUsage(service);

    // If service has no limit (e.g., Goldsky, QuickNode), always allow
    if (usage.limit === Infinity) {
      return true;
    }

    const utilizationRatio = usage.current / usage.limit;

    // Below enforcement threshold - allow immediately
    if (utilizationRatio < this.ENFORCEMENT_THRESHOLD) {
      return true;
    }

    // At or above threshold - queue the request
    console.warn(
      `[RateLimitEnforcer] Service ${service} at ${(utilizationRatio * 100).toFixed(1)}% capacity, queueing request (priority: ${priority})`,
    );

    return this.queueRequest(service, priority, timeoutMs);
  }

  /**
   * Queue a request when capacity is full
   */
  private queueRequest(
    service: string,
    priority: 'high' | 'normal' | 'low',
    timeoutMs: number,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Check queue size limit
      if (this.requestQueue.length >= this.MAX_QUEUE_SIZE) {
        this.stats.totalRejected++;
        this.emit('queue_full', { service, queueSize: this.requestQueue.length });
        console.error(
          `[RateLimitEnforcer] Queue full (${this.requestQueue.length}/${this.MAX_QUEUE_SIZE}), rejecting request for ${service}`,
        );
        reject(new Error(`Rate limit queue full for ${service}`));
        return;
      }

      const queuedRequest: QueuedRequest = {
        service,
        priority,
        resolve,
        reject,
        queuedAt: Date.now(),
        timeoutMs,
      };

      // Insert based on priority (high first, then normal, then low)
      let insertIndex = this.requestQueue.length;
      for (let i = 0; i < this.requestQueue.length; i++) {
        const existing = this.requestQueue[i];
        if (this.getPriorityValue(priority) > this.getPriorityValue(existing.priority)) {
          insertIndex = i;
          break;
        }
      }

      this.requestQueue.splice(insertIndex, 0, queuedRequest);
      this.stats.totalQueued++;

      this.emit('request_queued', {
        service,
        priority,
        queueSize: this.requestQueue.length,
        position: insertIndex,
      });

      // Set timeout to reject if not processed in time
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queuedRequest);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          this.stats.totalRejected++;
          this.emit('request_timeout', { service, waitedMs: timeoutMs });
          reject(new Error(`Request timeout after ${timeoutMs}ms in queue for ${service}`));
        }
      }, timeoutMs);
    });
  }

  /**
   * Process queued requests when capacity available
   */
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) {
      return;
    }

    // Group requests by service
    const requestsByService = new Map<string, QueuedRequest[]>();
    this.requestQueue.forEach((req) => {
      if (!requestsByService.has(req.service)) {
        requestsByService.set(req.service, []);
      }
      requestsByService.get(req.service)!.push(req);
    });

    // Process each service's queue
    for (const [service, requests] of requestsByService.entries()) {
      const usage = this.monitor.getUsage(service);

      // Skip if no limit (unlimited services)
      if (usage.limit === Infinity) {
        continue;
      }

      const utilizationRatio = usage.current / usage.limit;

      // If below threshold, process requests
      if (utilizationRatio < this.ENFORCEMENT_THRESHOLD) {
        const availableCapacity =
          Math.floor(usage.limit * this.ENFORCEMENT_THRESHOLD) - usage.current;
        const toProcess = Math.min(availableCapacity, requests.length);

        for (let i = 0; i < toProcess; i++) {
          const request = requests[i];
          const queueTime = Date.now() - request.queuedAt;

          this.stats.queueTimes.push(queueTime);
          if (this.stats.queueTimes.length > 100) {
            this.stats.queueTimes.shift(); // Keep last 100 measurements
          }

          this.stats.totalProcessed++;

          // Remove from queue
          const index = this.requestQueue.indexOf(request);
          if (index !== -1) {
            this.requestQueue.splice(index, 1);
          }

          this.emit('request_processed', {
            service,
            queueTime,
            remainingQueue: this.requestQueue.length,
          });

          // Resolve the promise (allow the request)
          request.resolve(true);
        }

        if (toProcess > 0) {
          console.log(
            `[RateLimitEnforcer] Processed ${toProcess} queued requests for ${service} (${this.requestQueue.length} remaining in queue)`,
          );
        }
      }
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processQueue().catch((err) => {
        console.error('[RateLimitEnforcer] Error processing queue:', err);
      });
    }, this.QUEUE_PROCESS_INTERVAL_MS);

    console.log('[RateLimitEnforcer] Queue processor started');
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Reject all pending requests
    this.requestQueue.forEach((req) => {
      req.reject(new Error('Rate limit enforcer stopped'));
    });
    this.requestQueue = [];

    console.log('[RateLimitEnforcer] Queue processor stopped');
  }

  /**
   * Get current statistics
   */
  getStats(): EnforcerStats {
    const avgQueueTime =
      this.stats.queueTimes.length > 0
        ? this.stats.queueTimes.reduce((a, b) => a + b, 0) / this.stats.queueTimes.length
        : 0;

    return {
      queuedRequests: this.requestQueue.length,
      totalQueued: this.stats.totalQueued,
      totalProcessed: this.stats.totalProcessed,
      totalRejected: this.stats.totalRejected,
      avgQueueTime: Math.round(avgQueueTime),
    };
  }

  /**
   * Get priority value for sorting (higher = more important)
   */
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'normal':
        return 2;
      case 'low':
        return 1;
    }
  }

  /**
   * Clear queue (for testing/maintenance)
   */
  clearQueue(): void {
    const count = this.requestQueue.length;
    this.requestQueue.forEach((req) => {
      req.reject(new Error('Queue cleared'));
    });
    this.requestQueue = [];
    console.log(`[RateLimitEnforcer] Cleared ${count} queued requests`);
  }

  /**
   * Get queue info for debugging
   */
  getQueueInfo(): Array<{
    service: string;
    priority: string;
    waitedMs: number;
  }> {
    return this.requestQueue.map((req) => ({
      service: req.service,
      priority: req.priority,
      waitedMs: Date.now() - req.queuedAt,
    }));
  }
}
