import { EventEmitter } from 'events';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface TokenSubscription {
  tokenAddress: string;
  timeframe: string;
  userId: string;
  lastUpdate: number;
  callback: (data: any) => void;
}

interface PollingConfig {
  interval: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
  healthCheckInterval: number;
}

interface TokenPollingState {
  tokenAddress: string;
  timeframe: string;
  subscribers: Set<string>;
  intervalId: NodeJS.Timeout | null;
  lastPoll: number;
  lastData: any;
  retryCount: number;
  isHealthy: boolean;
}

/**
 * Smart Polling Manager - Only polls tokens that users are actively viewing
 * Implements user-aware polling with automatic cleanup and error recovery
 */
export class SmartPollingManager extends EventEmitter {
  private subscriptions = new Map<string, TokenSubscription>();
  private pollingStates = new Map<string, TokenPollingState>();
  private config: PollingConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<PollingConfig> = {}) {
    super();

    this.config = {
      interval: 5000, // 5 seconds default
      maxRetries: 3,
      backoffMultiplier: 2,
      healthCheckInterval: 30000, // 30 seconds
      ...config,
    };

    // Start health monitoring
    this.startHealthCheck();
  }

  /**
   * Subscribe to real-time updates for a specific token
   */
  subscribe(
    tokenAddress: string,
    timeframe: string,
    userId: string,
    callback: (data: any) => void,
  ): string {
    const subscriptionId = `${userId}-${tokenAddress}-${timeframe}`;
    const pollingKey = `${tokenAddress}-${timeframe}`;

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      tokenAddress,
      timeframe,
      userId,
      lastUpdate: Date.now(),
      callback,
    });

    // Get or create polling state
    let pollingState = this.pollingStates.get(pollingKey);
    if (!pollingState) {
      pollingState = {
        tokenAddress,
        timeframe,
        subscribers: new Set(),
        intervalId: null,
        lastPoll: 0,
        lastData: null,
        retryCount: 0,
        isHealthy: true,
      };
      this.pollingStates.set(pollingKey, pollingState);
    }

    // Add subscriber
    pollingState.subscribers.add(subscriptionId);

    // Start polling if this is the first subscriber
    if (pollingState.subscribers.size === 1 && !pollingState.intervalId) {
      this.startPolling(pollingKey);
    }

    console.log(
      `[SmartPolling] New subscription: ${subscriptionId}, total subscribers for ${pollingKey}: ${pollingState.subscribers.size}`,
    );

    return subscriptionId;
  }

  /**
   * Unsubscribe from token updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    const pollingKey = `${subscription.tokenAddress}-${subscription.timeframe}`;
    const pollingState = this.pollingStates.get(pollingKey);

    if (pollingState) {
      pollingState.subscribers.delete(subscriptionId);

      // Stop polling if no more subscribers
      if (pollingState.subscribers.size === 0) {
        this.stopPolling(pollingKey);
      }

      console.log(
        `[SmartPolling] Unsubscribed: ${subscriptionId}, remaining subscribers for ${pollingKey}: ${pollingState.subscribers.size}`,
      );
    }

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get current polling statistics
   */
  getStats(): {
    activeSubscriptions: number;
    activePolls: number;
    tokenBreakdown: Record<string, number>;
    healthStatus: Record<string, boolean>;
  } {
    const tokenBreakdown: Record<string, number> = {};
    const healthStatus: Record<string, boolean> = {};

    for (const [key, state] of this.pollingStates) {
      tokenBreakdown[key] = state.subscribers.size;
      healthStatus[key] = state.isHealthy;
    }

    return {
      activeSubscriptions: this.subscriptions.size,
      activePolls: Array.from(this.pollingStates.values()).filter((s) => s.intervalId !== null)
        .length,
      tokenBreakdown,
      healthStatus,
    };
  }

  /**
   * Force refresh data for a specific token
   */
  async refreshToken(tokenAddress: string, timeframe: string): Promise<void> {
    const pollingKey = `${tokenAddress}-${timeframe}`;
    const pollingState = this.pollingStates.get(pollingKey);

    if (pollingState) {
      await this.fetchAndBroadcast(pollingKey, true);
    }
  }

  /**
   * Start polling for a specific token/timeframe combination
   */
  private startPolling(pollingKey: string): void {
    const pollingState = this.pollingStates.get(pollingKey);
    if (!pollingState || pollingState.intervalId) return;

    console.log(`[SmartPolling] Starting polling for ${pollingKey}`);

    // Initial fetch
    this.fetchAndBroadcast(pollingKey);

    // Start interval
    pollingState.intervalId = setInterval(() => {
      this.fetchAndBroadcast(pollingKey);
    }, this.config.interval);
  }

  /**
   * Stop polling for a specific token/timeframe combination
   */
  private stopPolling(pollingKey: string): void {
    const pollingState = this.pollingStates.get(pollingKey);
    if (!pollingState || !pollingState.intervalId) return;

    console.log(`[SmartPolling] Stopping polling for ${pollingKey}`);

    clearInterval(pollingState.intervalId);
    pollingState.intervalId = null;
    pollingState.retryCount = 0;

    // Clean up if no subscribers
    if (pollingState.subscribers.size === 0) {
      this.pollingStates.delete(pollingKey);
    }
  }

  /**
   * Fetch fresh data and broadcast to subscribers
   */
  private async fetchAndBroadcast(pollingKey: string, forceRefresh = false): Promise<void> {
    const pollingState = this.pollingStates.get(pollingKey);
    if (!pollingState) return;

    const { tokenAddress, timeframe } = pollingState;

    try {
      // Fetch live data from API
      const response = await fetch(
        `/api/v1/tokens/${tokenAddress}/live?timeframe=${timeframe}&since=${Math.floor((Date.now() - 60000) / 1000)}`,
        {
          signal: AbortSignal.timeout(8000), // 8 second timeout
        },
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;

      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      // Update polling state
      pollingState.lastPoll = Date.now();
      pollingState.lastData = data.data;
      pollingState.retryCount = 0;
      pollingState.isHealthy = true;

      // Broadcast to all subscribers
      const subscribers = Array.from(pollingState.subscribers);
      for (const subscriptionId of subscribers) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          try {
            subscription.callback({
              tokenAddress,
              timeframe,
              data: data.data,
              timestamp: Date.now(),
              isLive: true,
            });
            subscription.lastUpdate = Date.now();
          } catch (callbackError) {
            console.error(`[SmartPolling] Callback error for ${subscriptionId}:`, callbackError);
            // Remove broken subscription
            this.unsubscribe(subscriptionId);
          }
        }
      }

      // Emit success event
      this.emit('dataUpdated', {
        tokenAddress,
        timeframe,
        subscriberCount: pollingState.subscribers.size,
        dataLength: data.data.candles?.length || 0,
      });
    } catch (error) {
      console.error(`[SmartPolling] Error fetching data for ${pollingKey}:`, error);

      pollingState.retryCount++;
      pollingState.isHealthy = false;

      // Exponential backoff for retries
      if (pollingState.retryCount < this.config.maxRetries) {
        const delay =
          this.config.interval * Math.pow(this.config.backoffMultiplier, pollingState.retryCount);

        setTimeout(() => {
          this.fetchAndBroadcast(pollingKey);
        }, delay);

        console.log(
          `[SmartPolling] Retrying ${pollingKey} in ${delay}ms (attempt ${pollingState.retryCount})`,
        );
      } else {
        // Max retries exceeded, emit error
        this.emit('pollingError', {
          tokenAddress,
          timeframe,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: pollingState.retryCount,
        });

        // Notify subscribers of error
        const subscribers = Array.from(pollingState.subscribers);
        for (const subscriptionId of subscribers) {
          const subscription = this.subscriptions.get(subscriptionId);
          if (subscription) {
            try {
              subscription.callback({
                tokenAddress,
                timeframe,
                error: 'Failed to fetch live data',
                timestamp: Date.now(),
                isLive: false,
              });
            } catch (callbackError) {
              console.error(
                `[SmartPolling] Error callback failed for ${subscriptionId}:`,
                callbackError,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on all active polling states
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const staleThreshold = this.config.interval * 3; // 3 missed intervals = stale

    for (const [pollingKey, state] of this.pollingStates) {
      const timeSinceLastPoll = now - state.lastPoll;

      if (timeSinceLastPoll > staleThreshold && state.intervalId) {
        console.warn(
          `[SmartPolling] Health check: ${pollingKey} is stale (${timeSinceLastPoll}ms since last poll)`,
        );
        state.isHealthy = false;

        // Attempt to restart polling
        this.stopPolling(pollingKey);
        if (state.subscribers.size > 0) {
          this.startPolling(pollingKey);
        }
      }

      // Clean up dead subscriptions (no update in 5 minutes)
      const deadSubscribers: string[] = [];
      for (const subscriptionId of state.subscribers) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription && now - subscription.lastUpdate > 300000) {
          // 5 minutes
          deadSubscribers.push(subscriptionId);
        }
      }

      // Remove dead subscriptions
      for (const deadSub of deadSubscribers) {
        console.log(`[SmartPolling] Removing dead subscription: ${deadSub}`);
        this.unsubscribe(deadSub);
      }
    }

    // Emit health status
    this.emit('healthCheck', this.getStats());
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    console.log('[SmartPolling] Destroying polling manager');

    // Stop all polling
    for (const pollingKey of this.pollingStates.keys()) {
      this.stopPolling(pollingKey);
    }

    // Clear all subscriptions
    this.subscriptions.clear();
    this.pollingStates.clear();

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Remove all listeners
    this.removeAllListeners();
  }
}
