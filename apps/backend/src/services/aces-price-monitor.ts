import { EventEmitter } from 'events';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { acesPriceTracker } from './aces-price-tracker';

interface AcesPriceUpdate {
  price: number;
  timestamp: number;
  source: 'aerodrome' | 'coingecko' | 'fallback';
  changePercent: number;
}

export class AcesPriceMonitor extends EventEmitter {
  private lastRecordedPrice: number | null = null;
  private lastCheckPrice: number | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS: number;
  private readonly CHANGE_THRESHOLD = 0.0001; // 0.01% change threshold

  constructor(
    private acesUsdPriceService: AcesUsdPriceService,
    pollIntervalMs: number = 3000,
  ) {
    super();
    this.POLL_INTERVAL_MS = pollIntervalMs;
  }

  start() {
    console.log(
      `[AcesPriceMonitor] 🚀 Starting ACES price monitoring (every ${this.POLL_INTERVAL_MS}ms, threshold: ${(this.CHANGE_THRESHOLD * 100).toFixed(2)}%)...`,
    );

    // Initial fetch
    this.checkPrice();

    // Poll continuously
    this.pollInterval = setInterval(() => {
      this.checkPrice();
    }, this.POLL_INTERVAL_MS);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[AcesPriceMonitor] ⏸️  Stopped ACES price monitoring');
    }
  }

  private async checkPrice() {
    try {
      const result = await this.acesUsdPriceService.getAcesUsdPrice();
      const newPrice = parseFloat(result.price);

      if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
        console.warn('[AcesPriceMonitor] ⚠️ Invalid ACES price received:', result.price);
        return;
      }

      this.lastCheckPrice = newPrice;

      // Always record and emit first price
      if (this.lastRecordedPrice === null) {
        console.log(
          `[AcesPriceMonitor] 💰 Initial ACES price: $${newPrice.toFixed(6)} (${result.source})`,
        );

        // Record in tracker
        acesPriceTracker.recordAcesPrice(newPrice, Date.now());
        this.lastRecordedPrice = newPrice;

        // Emit event
        const update: AcesPriceUpdate = {
          price: newPrice,
          timestamp: Date.now(),
          source: result.source,
          changePercent: 0,
        };
        this.emit('price-update', update);
        return;
      }

      // Check if price changed significantly (>0.01%)
      const changeRatio = Math.abs((newPrice - this.lastRecordedPrice) / this.lastRecordedPrice);

      if (changeRatio >= this.CHANGE_THRESHOLD) {
        const changePercent = changeRatio * 100;
        const direction = newPrice > this.lastRecordedPrice ? '📈' : '📉';

        console.log(
          `[AcesPriceMonitor] ${direction} ACES price changed: $${this.lastRecordedPrice.toFixed(6)} → $${newPrice.toFixed(6)} (${changePercent.toFixed(3)}%)`,
        );

        // Record in tracker
        acesPriceTracker.recordAcesPrice(newPrice, Date.now());
        this.lastRecordedPrice = newPrice;

        // Emit event for WebSocket to broadcast
        const update: AcesPriceUpdate = {
          price: newPrice,
          timestamp: Date.now(),
          source: result.source,
          changePercent,
        };
        this.emit('price-update', update);
      } else {
        // Price didn't change enough - skip recording
        console.log(
          `[AcesPriceMonitor] ⏭️  ACES unchanged: $${newPrice.toFixed(6)} (change: ${(changeRatio * 100).toFixed(4)}% < ${(this.CHANGE_THRESHOLD * 100).toFixed(2)}%)`,
        );
      }
    } catch (error) {
      console.error('[AcesPriceMonitor] ❌ Error checking ACES price:', error);
    }
  }

  /**
   * Get current price (last checked, may not be recorded)
   */
  getCurrentPrice(): number | null {
    return this.lastCheckPrice;
  }

  /**
   * Get last recorded price (only when it changed >0.01%)
   */
  getLastRecordedPrice(): number | null {
    return this.lastRecordedPrice;
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    isRunning: boolean;
    lastCheckPrice: number | null;
    lastRecordedPrice: number | null;
    pollIntervalMs: number;
    changeThreshold: number;
  } {
    return {
      isRunning: this.pollInterval !== null,
      lastCheckPrice: this.lastCheckPrice,
      lastRecordedPrice: this.lastRecordedPrice,
      pollIntervalMs: this.POLL_INTERVAL_MS,
      changeThreshold: this.CHANGE_THRESHOLD,
    };
  }
}
