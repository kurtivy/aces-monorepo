interface AcesPriceObservation {
  price: number;
  timestamp: number; // Absolute timestamp (ms)
}

export class AcesPriceTracker {
  // Store all ACES price observations in a time-ordered array
  private priceHistory: AcesPriceObservation[] = [];
  private readonly MAX_HISTORY_MS = 24 * 60 * 60 * 1000; // Keep 24 hours

  /**
   * Record an ACES price observation
   */
  recordAcesPrice(acesUsdPrice: number, timestamp: number = Date.now()): void {
    this.priceHistory.push({
      price: acesUsdPrice,
      timestamp,
    });

    // Keep array sorted by timestamp
    this.priceHistory.sort((a, b) => a.timestamp - b.timestamp);

    console.log(
      `[AcesPriceTracker] 💰 Recorded ACES = $${acesUsdPrice.toFixed(6)} at ${new Date(timestamp).toISOString()}`,
    );
  }

  /**
   * Get ACES OHLC for ANY candle bucket (works across all timeframes)
   * This is the core method that enables dynamic wicks across 5m/15m/1h/4h/1d
   */
  getAcesOHLCForPeriod(
    startTimestamp: number,
    endTimestamp: number,
  ): { open: number; high: number; low: number; close: number } | null {
    // Find all observations within this time range
    const observations = this.priceHistory.filter(
      (obs) => obs.timestamp >= startTimestamp && obs.timestamp < endTimestamp,
    );

    if (observations.length === 0) {
      return null;
    }

    // Calculate OHLC from observations
    const prices = observations.map((obs) => obs.price);

    return {
      open: observations[0].price, // First price in period
      high: Math.max(...prices), // Highest price in period
      low: Math.min(...prices), // Lowest price in period
      close: observations[observations.length - 1].price, // Last price in period
    };
  }

  /**
   * Get ACES OHLC for a specific candle timestamp and timeframe
   */
  getAcesOHLCForCandle(
    candleTimestamp: number,
    timeframeMs: number,
  ): { open: number; high: number; low: number; close: number } | null {
    return this.getAcesOHLCForPeriod(candleTimestamp, candleTimestamp + timeframeMs);
  }

  /**
   * Get the most recent ACES price
   */
  getCurrentPrice(): number | null {
    if (this.priceHistory.length === 0) return null;
    return this.priceHistory[this.priceHistory.length - 1].price;
  }

  /**
   * Get all observations in a time range (for debugging)
   */
  getObservationsInRange(startTimestamp: number, endTimestamp: number): AcesPriceObservation[] {
    return this.priceHistory.filter(
      (obs) => obs.timestamp >= startTimestamp && obs.timestamp < endTimestamp,
    );
  }

  /**
   * Clean up old observations (older than 24 hours)
   */
  cleanup(): void {
    const cutoff = Date.now() - this.MAX_HISTORY_MS;
    const beforeCount = this.priceHistory.length;

    this.priceHistory = this.priceHistory.filter((obs) => obs.timestamp >= cutoff);

    const cleaned = beforeCount - this.priceHistory.length;
    if (cleaned > 0) {
      console.log(
        `[AcesPriceTracker] 🧹 Cleaned up ${cleaned} old observations (keeping ${this.priceHistory.length})`,
      );
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalObservations: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    memoryEstimateKB: number;
    timeSpanHours: number;
  } {
    const oldest = this.priceHistory[0]?.timestamp || null;
    const newest = this.priceHistory[this.priceHistory.length - 1]?.timestamp || null;
    const timeSpanHours = oldest && newest ? (newest - oldest) / (1000 * 60 * 60) : 0;

    return {
      totalObservations: this.priceHistory.length,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      memoryEstimateKB: (this.priceHistory.length * 16) / 1024, // ~16 bytes per observation
      timeSpanHours,
    };
  }
}

// Singleton instance (shared by all users, lives in server memory)
export const acesPriceTracker = new AcesPriceTracker();

// Cleanup every hour
setInterval(
  () => {
    acesPriceTracker.cleanup();
  },
  60 * 60 * 1000,
);
