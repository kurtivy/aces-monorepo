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
}

export type CandleUpdateCallback = (candle: Candle) => void;

export class RealtimeCandleBuilder {
  private currentCandles = new Map<string, Candle>(); // key = timeframe
  private callbacks = new Map<string, CandleUpdateCallback[]>();
  private lastClosePrices = new Map<string, number>(); // key = timeframe, value = last candle close price
  // 🔥 NEW: Time-driven emission - timers for each active timeframe
  private timeframeTimers = new Map<string, NodeJS.Timeout>();
  // Track which candles are synthetic (no real trades yet)
  private syntheticCandles = new Set<string>(); // key = timeframe:candleTime

  constructor(private debug = false) {}

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
      console.log(`[CandleBuilder] 🔄 processTrade for ${timeframe}:`, {
        tradeTime: new Date(trade.timestamp).toISOString(),
        activeTimeframes: Array.from(this.callbacks.keys()),
        candlesCount: this.currentCandles.size,
        hasLastClosePrices: this.lastClosePrices.has(timeframe),
        lastClosePriceValue: this.lastClosePrices.get(timeframe),
      });
      this.updateCandle(timeframe, trade);
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

    // 🔥 Allow trades within a reasonable time window from NOW
    // This handles delays in BitQuery and other data feeds
    // Accept trades from the last 15 minutes (900000ms) to current
    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000; // 900 seconds

    // Reject trades older than 15 minutes to prevent cascading stale data
    if (trade.timestamp < fifteenMinutesAgo) {
      if (this.debug) {
        console.warn(
          `[CandleBuilder] ⚠️ Skipped very old ${timeframe} trade (trade: ${new Date(trade.timestamp).toISOString()}, now: ${new Date(now).toISOString()})`,
        );
      }
      return;
    }

    // Also prevent trades far in the future (safeguard against bad data)
    if (trade.timestamp > now + 60000) {
      // 1 minute in the future
      if (this.debug) {
        console.warn(
          `[CandleBuilder] ⚠️ Skipped future ${timeframe} trade (trade: ${new Date(trade.timestamp).toISOString()}, now: ${new Date(now).toISOString()})`,
        );
      }
      return;
    }

    // Additional check: prevent trades that would create candles MUCH older than most recent
    // This allows 1 interval of latency but not more
    const oneIntervalAgo = mostRecentCandleTime - intervalMs;
    if (mostRecentCandleTime > 0 && candleTime < oneIntervalAgo) {
      if (this.debug) {
        console.warn(
          `[CandleBuilder] ⚠️ Skipped out-of-order ${timeframe} trade (trade: ${new Date(candleTime).toISOString()}, recent: ${new Date(mostRecentCandleTime).toISOString()})`,
        );
      }
      return;
    }

    const key = `${timeframe}:${candleTime}`;
    let candle = this.currentCandles.get(key);
    const isSynthetic = this.syntheticCandles.has(key);

    if (!candle) {
      // 🔥 CRITICAL: Get the previous candle's close price for proper OHLC continuity
      const previousClosePrice = this.lastClosePrices.get(timeframe);
      const openPrice = previousClosePrice !== undefined ? previousClosePrice : trade.price;

      // New candle - create it with proper OHLC continuity
      candle = {
        time: candleTime,
        open: openPrice, // Use previous candle's close as new open
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.volume,
      };
      this.currentCandles.set(key, candle);

      console.log(
        `[CandleBuilder] 🆕 New ${timeframe} candle at ${new Date(candleTime).toISOString()} | OHLCV: ${candle.open} / ${candle.high} / ${candle.low} / ${candle.close} / ${candle.volume} (open from ${previousClosePrice !== undefined ? 'prev close' : 'first trade'})`,
      );
    } else if (isSynthetic) {
      // 🔥 NEW: Update synthetic candle with real trade data
      // Keep the open (which was set to previous close), but update OHLC with real prices
      candle.high = Math.max(candle.open, trade.price);
      candle.low = Math.min(candle.open, trade.price);
      candle.close = trade.price;
      candle.volume = trade.volume; // Replace 0 volume with real volume

      // Mark as no longer synthetic
      this.syntheticCandles.delete(key);

      console.log(
        `[CandleBuilder] 🔄 Converted synthetic → real ${timeframe} candle at ${new Date(candleTime).toISOString()} | OHLCV: ${candle.open} / ${candle.high} / ${candle.low} / ${candle.close} / ${candle.volume}`,
      );
    } else {
      // Update existing real candle
      candle.high = Math.max(candle.high, trade.price);
      candle.low = Math.min(candle.low, trade.price);
      candle.close = trade.price;
      candle.volume += trade.volume;

      if (this.debug) {
        console.log(
          `[CandleBuilder] 📈 Updated ${timeframe} candle | OHLCV: ${candle.open} / ${candle.high} / ${candle.low} / ${candle.close} / ${candle.volume}`,
        );
      }
    }

    // Store this candle's close price for potential future use
    this.lastClosePrices.set(timeframe, candle.close);

    // Notify subscribers
    const callbacks = this.callbacks.get(timeframe) || [];
    for (const callback of callbacks) {
      try {
        callback({ ...candle }); // Send a copy
      } catch (error) {
        console.error('[CandleBuilder] Error in callback:', error);
      }
    }

    // Clean up old candles (keep last 1000)
    this.cleanupOldCandles(timeframe, candleTime, 1000);
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
    this.currentCandles.set(key, { ...candle });

    // 🔥 NEW: Store the close price for next candle continuity
    this.lastClosePrices.set(timeframe, candle.close);

    if (this.debug) {
      console.log(
        `[CandleBuilder] 🌱 Seeded ${timeframe} candle at ${new Date(candle.time).toISOString()} | close: ${candle.close}`,
      );
    }
  }

  /**
   * Clear all candles (useful when switching tokens)
   */
  clear(): void {
    this.currentCandles.clear();
    this.lastClosePrices.clear();
    this.syntheticCandles.clear();

    // Stop all timers
    for (const [timeframe, timer] of this.timeframeTimers.entries()) {
      clearInterval(timer);
      if (this.debug) {
        console.log(`[CandleBuilder] ⏹️ Stopped timer for ${timeframe}`);
      }
    }
    this.timeframeTimers.clear();

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

    console.log(`[CandleBuilder] ▶️ Starting time-driven emission for ${timeframe}`);

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
      console.log(`[CandleBuilder] ⏹️ Stopped time-driven emission for ${timeframe}`);
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

    // Create synthetic candle: open = high = low = close = previous close, volume = 0
    const syntheticCandle: Candle = {
      time: currentBucketTime,
      open: previousClosePrice,
      high: previousClosePrice,
      low: previousClosePrice,
      close: previousClosePrice,
      volume: 0,
    };

    this.currentCandles.set(key, syntheticCandle);
    this.syntheticCandles.add(key); // Mark as synthetic
    this.lastClosePrices.set(timeframe, previousClosePrice); // Carry forward close price

    console.log(
      `[CandleBuilder] 🔵 Synthetic ${timeframe} candle emitted at ${new Date(currentBucketTime).toISOString()} | price: ${previousClosePrice} (no trades in interval)`,
    );

    // Notify subscribers
    const callbacks = this.callbacks.get(timeframe) || [];
    for (const callback of callbacks) {
      try {
        callback({ ...syntheticCandle });
      } catch (error) {
        console.error('[CandleBuilder] Error in callback for synthetic candle:', error);
      }
    }

    // Clean up old candles
    this.cleanupOldCandles(timeframe, currentBucketTime, 1000);
  }
}
