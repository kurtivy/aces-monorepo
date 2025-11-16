/**
 * Real-Time Candle Builder
 *
 * Constructs OHLCV candles from streaming trade data in real-time.
 * This allows TradingView charts to update instantly as trades happen,
 * without polling the REST API.
 */

export interface Trade {
  timestamp: number; // milliseconds
  price: number;
  volume: number;
  isBuy: boolean;
}

export interface Candle {
  time: number; // milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // 🔥 NEW: Trade buffering for VWAP and chronological sorting
  trades: Trade[]; // Store all trades for this candle
  totalValue: number; // Σ(price × volume) for VWAP
  isFinalized: boolean; // Whether candle is "closed" (no more late trades expected)
  lastUpdateTime: number; // 🔥 NEW: When this candle was last updated (for emission buffering)
}

export type CandleUpdateCallback = (candle: Candle) => void;

export class RealtimeCandleBuilder {
  private currentCandles = new Map<string, Candle>(); // key = timeframe
  private callbacks = new Map<string, CandleUpdateCallback[]>();
  private lastClosePrices = new Map<string, number>(); // key = timeframe, value = last candle close price
  // 🔥 NEW: Time-driven emission - timers for each active timeframe
  private timeframeTimers = new Map<string, ReturnType<typeof setInterval>>();
  // Track which candles are synthetic (no real trades yet)
  private syntheticCandles = new Set<string>(); // key = timeframe:candleTime
  // 🔥 NEW: Track most recent candle time sent to avoid time violations
  private mostRecentCandleTimeSent = new Map<string, number>(); // key = timeframe, value = candleTime
  // 🔥 NEW: Emission buffer timer - checks for candles ready to emit
  private emissionTimer: ReturnType<typeof setInterval> | null = null;
  // 🔥 NEW: Emission buffer delay (5 seconds)
  private readonly EMISSION_DELAY_MS = 5000;

  constructor(private debug = false) {
    // Start the emission buffer timer
    this.startEmissionTimer();
  }

  /**
   * Subscribe to candle updates for a specific timeframe
   */
  subscribe(timeframe: string, callback: CandleUpdateCallback): () => void {
    const callbacks = this.callbacks.get(timeframe) || [];
    const isFirstSubscriber = callbacks.length === 0;

    callbacks.push(callback);
    this.callbacks.set(timeframe, callbacks);

    if (this.debug) {
      console.log(
        `[CandleBuilder] Subscribed to ${timeframe} candles (total: ${callbacks.length})`,
      );
    }

    // 🔥 NEW: Start time-driven emission timer for this timeframe if it's the first subscriber
    if (isFirstSubscriber) {
      this.startTimeframeTimer(timeframe);
    }

    // Return unsubscribe function
    return () => {
      const cbs = this.callbacks.get(timeframe) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
      }
      if (cbs.length === 0) {
        this.callbacks.delete(timeframe);
        // 🔥 NEW: Stop timer when last subscriber unsubscribes
        this.stopTimeframeTimer(timeframe);
      }
    };
  }

  /**
   * Process incoming trade and update relevant candles
   */
  processTrade(trade: Trade): void {
    // Update all active timeframes
    for (const timeframe of this.callbacks.keys()) {
      try {
        this.updateCandle(timeframe, trade);
      } catch (error) {
        console.error(`[CandleBuilder] ❌ Error updating ${timeframe}:`, error);
      }
    }
  }

  /**
   * Update a specific candle with new trade data
   */
  private updateCandle(timeframe: string, trade: Trade): void {
    const intervalMs = this.getIntervalMs(timeframe);
    const candleTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;

    // 🔥 DEBUG: Log candle time calculation for diagnostics
    if (this.debug) {
      console.log(`[CandleBuilder] 📊 Candle calculation for ${timeframe}:`, {
        tradeTime: new Date(trade.timestamp).toISOString(),
        intervalMs,
        candleTime: new Date(candleTime).toISOString(),
        candleTimeMs: candleTime,
      });
    }

    // 🔥 CRITICAL FIX: Prevent time violations by ignoring very old trades
    // Find the most recent candle time for this timeframe
    const prefix = `${timeframe}:`;
    let mostRecentCandleTime = 0;
    for (const key of this.currentCandles.keys()) {
      if (key.startsWith(prefix)) {
        const time = parseInt(key.split(':')[1]);
        if (time > mostRecentCandleTime) {
          mostRecentCandleTime = time;
        }
      }
    }

    // Reject trades older than 15 minutes to prevent cascading stale data
    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;

    if (trade.timestamp < fifteenMinutesAgo) {
      console.warn(
        `[CandleBuilder] ⚠️ Skipped very old ${timeframe} trade (trade: ${new Date(trade.timestamp).toISOString()}, now: ${new Date(now).toISOString()})`,
      );
      return;
    }

    // Also prevent trades far in the future (safeguard against bad data)
    if (trade.timestamp > now + 60000) {
      // 1 minute in the future
      console.warn(
        `[CandleBuilder] ⚠️ Skipped future ${timeframe} trade (trade: ${new Date(trade.timestamp).toISOString()}, now: ${new Date(now).toISOString()})`,
      );
      return;
    }

    // 🔥 REMOVED: The "1 interval latency" check was too aggressive
    // With 5s emission buffer + Bitquery delays, trades can legitimately be 2+ intervals old
    // The emission buffer's time violation check handles this properly

    const key = `${timeframe}:${candleTime}`;
    let candle = this.currentCandles.get(key);
    const isSynthetic = this.syntheticCandles.has(key);

    if (!candle) {
      // 🔥 CRITICAL: Get the previous candle's close price for proper OHLC continuity
      const previousClosePrice = this.lastClosePrices.get(timeframe);
      const openPrice = previousClosePrice !== undefined ? previousClosePrice : trade.price;

      // 🔥 NEW: Initialize candle with trade buffer for VWAP
      candle = {
        time: candleTime,
        open: openPrice, // Use previous candle's close as new open
        high: trade.price,
        low: trade.price,
        close: trade.price, // Will be recalculated as VWAP when more trades arrive
        volume: trade.volume,
        // New fields for VWAP
        trades: [trade],
        totalValue: trade.price * trade.volume,
        isFinalized: false,
        lastUpdateTime: Date.now(), // 🔥 NEW: Track when candle was last updated
      };
      this.currentCandles.set(key, candle);

      console.log(`[CandleBuilder] ✅ NEW ${timeframe} candle created`, {
        candleTime: new Date(candleTime).toISOString(),
        tradeTime: new Date(trade.timestamp).toISOString(),
        open: openPrice.toFixed(8),
        close: trade.price.toFixed(8),
        volume: trade.volume.toFixed(4),
        hasPreviousClose: previousClosePrice !== undefined,
      });
    } else if (isSynthetic) {
      // 🔥 NEW: Update synthetic candle with real trade data
      // Keep the open (which was set to previous close), but update OHLC with real prices
      candle.trades.push(trade);
      candle.totalValue += trade.price * trade.volume;
      candle.volume += trade.volume;

      // Recalculate OHLC with sorted trades
      const sortedPrices = candle.trades.map((t) => t.price);
      candle.high = Math.max(candle.open, ...sortedPrices);
      candle.low = Math.min(candle.open, ...sortedPrices);

      // 🔥 VWAP for close price
      candle.close = candle.volume > 0 ? candle.totalValue / candle.volume : candle.open;

      // Mark as no longer synthetic
      this.syntheticCandles.delete(key);

      if (this.debug) {
        console.log(`[CandleBuilder] 🔄 Converted synthetic to real candle:`, {
          trades: candle.trades.length,
          vwapClose: candle.close,
          candleTime: new Date(candle.time).toISOString(),
        });
      }
    } else {
      // 🔥 CRITICAL FIX: Check if candle is finalized first
      if (candle.isFinalized) {
        console.error(`[CandleBuilder] ❌ TRADE REJECTED - Candle is finalized!`, {
          candleTime: new Date(candle.time).toISOString(),
          tradeTime: new Date(trade.timestamp).toISOString(),
          tradeType: trade.isBuy ? 'BUY' : 'SELL',
          price: trade.price,
          volume: trade.volume,
          timeframe,
          ageMinutes: Math.round((Date.now() - candle.time) / 60000),
        });
        return;
      }

      // Update existing real candle with VWAP calculation
      candle.trades.push(trade);

      // Sort trades chronologically
      candle.trades.sort((a, b) => a.timestamp - b.timestamp);

      // Recalculate OHLC from sorted trades
      const sortedPrices = candle.trades.map((t) => t.price);

      // 🔥 CRITICAL: Open should NEVER change after initial creation
      // Open was set when candle was created, don't recalculate it!
      // (Keep existing candle.open value)

      // High/Low from all trades
      candle.high = Math.max(candle.open, ...sortedPrices);
      candle.low = Math.min(candle.open, ...sortedPrices);

      // 🔥 VWAP for close price
      candle.totalValue = candle.trades.reduce((sum, t) => sum + t.price * t.volume, 0);
      candle.volume = candle.trades.reduce((sum, t) => sum + t.volume, 0);
      candle.close = candle.volume > 0 ? candle.totalValue / candle.volume : candle.open;
    }

    // Store this candle's close price for potential future use
    this.lastClosePrices.set(timeframe, candle.close);

    // 🔥 NEW: Update lastUpdateTime for emission buffering
    candle.lastUpdateTime = Date.now();

    // 🔥 NEW: Don't emit immediately - let the emission timer handle it
    // This allows late trades to arrive and be included before emission

    // Clean up old candles (keep last 1000)
    this.cleanupOldCandles(timeframe, candleTime, 1000);

    // 🔥 NOTE: Finalization is now handled by the emission timer
    // Candles are finalized AFTER emission, not before
  }

  /**
   * 🔥 NEW: Finalize old candles to prevent late-arriving trades from modifying them
   * Also frees memory by clearing trade buffers
   */
  private finalizeOldCandles(timeframe: string): void {
    const now = Date.now();
    const finalizationDelay = 3 * 60 * 1000; // 3 minutes - reasonable buffer for Bitquery delays

    const prefix = `${timeframe}:`;
    let finalizedCount = 0;

    for (const [key, candle] of this.currentCandles.entries()) {
      if (!key.startsWith(prefix)) continue;

      const candleAge = now - candle.time;

      // Finalize candles older than 3 minutes
      if (!candle.isFinalized && candleAge > finalizationDelay) {
        candle.isFinalized = true;
        candle.trades = []; // Free memory - we no longer need the trade list
        finalizedCount++;

        if (this.debug) {
          console.log(`[CandleBuilder] 🔒 Finalized ${timeframe} candle:`, {
            candleTime: new Date(candle.time).toISOString(),
            ageMinutes: Math.round(candleAge / 60000),
          });
        }
      }
    }

    if (finalizedCount > 0 && this.debug) {
      console.log(`[CandleBuilder] Finalized ${finalizedCount} ${timeframe} candles`);
    }
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
    };

    return map[timeframe] || 60 * 1000; // Default to 1 minute
  }

  /**
   * Clean up old candles to prevent memory leaks
   */
  private cleanupOldCandles(timeframe: string, currentTime: number, keepCount: number): void {
    const prefix = `${timeframe}:`;
    const candleTimes: number[] = [];

    // Collect all candle times for this timeframe
    for (const key of this.currentCandles.keys()) {
      if (key.startsWith(prefix)) {
        const time = parseInt(key.split(':')[1]);
        candleTimes.push(time);
      }
    }

    // If we have too many, remove the oldest
    if (candleTimes.length > keepCount) {
      candleTimes.sort((a, b) => b - a); // Sort descending (newest first)
      const toRemove = candleTimes.slice(keepCount); // Get oldest candles to remove

      for (const time of toRemove) {
        this.currentCandles.delete(`${prefix}${time}`);
      }

      if (this.debug && toRemove.length > 0) {
        console.log(`[CandleBuilder] Cleaned up ${toRemove.length} old ${timeframe} candles`);
      }
    }
  }

  /**
   * Get the current candle for a timeframe (if it exists)
   */
  getCurrentCandle(timeframe: string): Candle | null {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const candleTime = Math.floor(now / intervalMs) * intervalMs;
    const key = `${timeframe}:${candleTime}`;

    return this.currentCandles.get(key) || null;
  }

  /**
   * Seed a candle with initial data (from REST API)
   * This prevents gaps when switching from REST to WebSocket
   */
  seedCandle(timeframe: string, candle: Candle): void {
    const key = `${timeframe}:${candle.time}`;
    // 🔥 NEW: Ensure seeded candles have VWAP fields initialized
    const seededCandle: Candle = {
      ...candle,
      trades: candle.trades || [],
      totalValue: candle.totalValue || 0,
      isFinalized: candle.isFinalized || false,
    };
    this.currentCandles.set(key, seededCandle);

    // 🔥 NEW: Store the close price for next candle continuity
    this.lastClosePrices.set(timeframe, candle.close);

    if (this.debug) {
      console.log(
        `[CandleBuilder] 🌱 Seeded ${timeframe} candle at ${new Date(candle.time).toISOString()} | close: ${candle.close}`,
      );
    }
  }

  /**
   * 🔥 NEW: Start the emission buffer timer
   * Checks every 500ms for candles that are ready to emit
   */
  private startEmissionTimer(): void {
    this.emissionTimer = setInterval(() => {
      this.checkAndEmitBufferedCandles();
    }, 500); // Check twice per second for responsiveness
  }

  /**
   * 🔥 NEW: Check all candles and emit those that have aged past the buffer delay
   */
  private checkAndEmitBufferedCandles(): void {
    const now = Date.now();

    // Group candles by timeframe
    const candlesByTimeframe = new Map<string, Candle[]>();

    for (const [key, candle] of this.currentCandles.entries()) {
      const timeframe = key.split(':')[0];
      if (!candlesByTimeframe.has(timeframe)) {
        candlesByTimeframe.set(timeframe, []);
      }
      candlesByTimeframe.get(timeframe)!.push(candle);
    }

    // Process each timeframe
    for (const [timeframe, candles] of candlesByTimeframe.entries()) {
      // Sort by time (oldest first) - CRITICAL: Maintain chronological order to prevent time violations
      const sortedCandles = candles.sort((a, b) => a.time - b.time);

      // 🔥 CRITICAL FIX: Always process candles in chronological order
      // The mostRecentSent check below will handle skipping old candles
      for (const candle of sortedCandles) {
        // Check if candle is old enough to emit
        const timeSinceUpdate = now - candle.lastUpdateTime;
        const candleAge = now - candle.time;

        // Emit if either:
        // 1. It's been EMISSION_DELAY_MS since last update (no new trades for 5s)
        // 2. The candle is older than EMISSION_DELAY_MS (handles late trades within window)
        const shouldEmit =
          timeSinceUpdate >= this.EMISSION_DELAY_MS || candleAge >= this.EMISSION_DELAY_MS;

        if (shouldEmit && !candle.isFinalized) {
          // Check time violation before emitting
          const mostRecentSent = this.mostRecentCandleTimeSent.get(timeframe) || 0;

          // 🔥 CRITICAL: Allow re-emitting the SAME candle with updates (currentBucket)
          // Only block candles OLDER than mostRecentSent
          if (candle.time < mostRecentSent) {
            // This is an OLD candle (from previous bucket), skip it
            console.warn('[CandleBuilder] ⏮️ Buffered candle too old to emit:', {
              timeframe,
              candleTime: new Date(candle.time).toISOString(),
              mostRecentSent: new Date(mostRecentSent).toISOString(),
            });
            continue;
          }
          // If candle.time === mostRecentSent, it's the current candle being updated - allow it!

          // Calculate current bucket time for this timeframe
          const intervalMs = this.getIntervalMs(timeframe);
          const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;

          // 🔥 CRITICAL FIX: Only finalize candles from PREVIOUS time buckets
          // This allows trades to continue updating the CURRENT candle
          const isFromPreviousBucket = candle.time < currentBucketTime;

          if (isFromPreviousBucket) {
            // Mark as finalized - no more updates allowed
            candle.isFinalized = true;
          }
          // else: Don't finalize yet - it's the current bucket, keep accepting trades

          // 🔥 CRITICAL FIX: Always update mostRecentSent to maintain chronological order
          // This prevents time violations by ensuring we never emit older candles after newer ones
          this.mostRecentCandleTimeSent.set(timeframe, candle.time);

          // Emit to subscribers
          const callbacks = this.callbacks.get(timeframe) || [];

          for (const callback of callbacks) {
            try {
              callback({ ...candle }); // Send a copy
            } catch (error) {
              console.error('[CandleBuilder] Error in callback:', error);
            }
          }
        }
      }
    }

    // 🔥 Clean up very old finalized candles to free memory
    this.cleanupFinalizedCandles();
  }

  /**
   * 🔥 NEW: Clean up finalized candles older than 10 minutes to free memory
   */
  private cleanupFinalizedCandles(): void {
    const now = Date.now();
    const cleanupThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [, candle] of this.currentCandles.entries()) {
      if (candle.isFinalized) {
        const candleAge = now - candle.time;
        if (candleAge > cleanupThreshold) {
          // Clear trades array to free memory
          candle.trades = [];
        }
      }
    }
  }

  /**
   * Clear all candles (useful when switching tokens)
   */
  clear(): void {
    this.currentCandles.clear();
    this.lastClosePrices.clear();
    this.syntheticCandles.clear();
    this.mostRecentCandleTimeSent.clear(); // 🔥 NEW: Clear tracking on token switch

    // Stop all timers
    for (const [timeframe, timer] of this.timeframeTimers.entries()) {
      clearInterval(timer);
      if (this.debug) {
        console.log(`[CandleBuilder] ⏹️ Stopped timer for ${timeframe}`);
      }
    }
    this.timeframeTimers.clear();

    // Stop emission timer
    if (this.emissionTimer) {
      clearInterval(this.emissionTimer);
      this.emissionTimer = null;
    }

    if (this.debug) {
      console.log('[CandleBuilder] 🧹 Cleared all candles, close prices, and timers');
    }
  }

  /**
   * 🔥 NEW: Start time-driven emission timer for a timeframe
   * Emits synthetic candles when no trades occur to keep chart clock moving
   */
  private startTimeframeTimer(timeframe: string): void {
    // Clear existing timer if any
    if (this.timeframeTimers.has(timeframe)) {
      clearInterval(this.timeframeTimers.get(timeframe)!);
    }

    // Check every 1 second for bucket rollovers
    const timer = setInterval(() => {
      this.checkAndEmitSyntheticCandle(timeframe);
    }, 1000);

    this.timeframeTimers.set(timeframe, timer);
  }

  /**
   * 🔥 NEW: Stop time-driven emission timer for a timeframe
   */
  private stopTimeframeTimer(timeframe: string): void {
    const timer = this.timeframeTimers.get(timeframe);
    if (timer) {
      clearInterval(timer);
      this.timeframeTimers.delete(timeframe);
    }
  }

  /**
   * 🔥 NEW: Check if we need to emit a synthetic candle for this timeframe
   * This is the core of time-driven emission
   */
  private checkAndEmitSyntheticCandle(timeframe: string): void {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(timeframe);
    const currentBucketTime = Math.floor(now / intervalMs) * intervalMs;
    const key = `${timeframe}:${currentBucketTime}`;

    // Check if we already have a candle for the current bucket
    const existingCandle = this.currentCandles.get(key);
    if (existingCandle) {
      // We already have a candle (either real or synthetic) for this bucket
      // No action needed
      return;
    }

    // No candle exists for current bucket - we need to emit a synthetic one
    const previousClosePrice = this.lastClosePrices.get(timeframe);

    // Only emit synthetic candles if we have a previous close price
    // (i.e., we've seen at least one candle before)
    if (previousClosePrice === undefined) {
      // No history yet, wait for first real trade
      if (this.debug) {
        console.log(
          `[CandleBuilder] ⏭️ Skipping synthetic candle for ${timeframe} - no previous close price`,
        );
      }
      return;
    }

    // 🔥 NEW: Create synthetic candle with new fields for VWAP
    const syntheticCandle: Candle = {
      time: currentBucketTime,
      open: previousClosePrice,
      high: previousClosePrice,
      low: previousClosePrice,
      close: previousClosePrice,
      volume: 0,
      // New fields for VWAP (empty for synthetic candles)
      trades: [],
      totalValue: 0,
      isFinalized: false,
      lastUpdateTime: Date.now(), // 🔥 NEW: Track when candle was last updated
    };

    this.currentCandles.set(key, syntheticCandle);
    this.syntheticCandles.add(key); // Mark as synthetic
    this.lastClosePrices.set(timeframe, previousClosePrice); // Carry forward close price

    // 🔥 CRITICAL FIX: Don't emit synthetic candles immediately!
    // Let the emission buffer system handle it to maintain chronological order
    // and proper mostRecentSent tracking. The emission timer will pick it up
    // within 500ms anyway.

    // Clean up old candles
    this.cleanupOldCandles(timeframe, currentBucketTime, 1000);
  }
}
