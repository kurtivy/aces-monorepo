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

  constructor(private debug = false) {}

  /**
   * Subscribe to candle updates for a specific timeframe
   */
  subscribe(timeframe: string, callback: CandleUpdateCallback): () => void {
    const callbacks = this.callbacks.get(timeframe) || [];
    callbacks.push(callback);
    this.callbacks.set(timeframe, callbacks);

    if (this.debug) {
      console.log(`[CandleBuilder] Subscribed to ${timeframe} candles`);
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
      }
    };
  }

  /**
   * Process incoming trade and update relevant candles
   */
  processTrade(trade: Trade): void {
    // Update all active timeframes
    for (const timeframe of this.callbacks.keys()) {
      this.updateCandle(timeframe, trade);
    }
  }

  /**
   * Update a specific candle with new trade data
   */
  private updateCandle(timeframe: string, trade: Trade): void {
    const intervalMs = this.getIntervalMs(timeframe);
    const candleTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;

    const key = `${timeframe}:${candleTime}`;
    let candle = this.currentCandles.get(key);

    if (!candle) {
      // New candle - create it
      candle = {
        time: candleTime,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.volume,
      };
      this.currentCandles.set(key, candle);

      if (this.debug) {
        console.log(
          `[CandleBuilder] 🆕 New ${timeframe} candle at ${new Date(candleTime).toISOString()}`,
        );
      }
    } else {
      // Update existing candle
      candle.high = Math.max(candle.high, trade.price);
      candle.low = Math.min(candle.low, trade.price);
      candle.close = trade.price;
      candle.volume += trade.volume;
    }

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

    if (this.debug) {
      console.log(
        `[CandleBuilder] 🌱 Seeded ${timeframe} candle at ${new Date(candle.time).toISOString()}`,
      );
    }
  }

  /**
   * Clear all candles (useful when switching tokens)
   */
  clear(): void {
    this.currentCandles.clear();
    if (this.debug) {
      console.log('[CandleBuilder] 🧹 Cleared all candles');
    }
  }
}


