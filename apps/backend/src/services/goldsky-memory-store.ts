/**
 * Goldsky In-Memory Event Store
 * Phase 3 - Store Goldsky webhook events in memory and broadcast via WebSocket
 * 
 * No database needed! Ultra-fast <1ms reads
 */

import { EventEmitter } from 'events';
import { TradeEvent, BondingStatusEvent } from '../types/adapters';

interface MemoryStoreConfig {
  maxTradesPerToken?: number;
  maxBondingHistoryPerToken?: number;
  cleanupIntervalMs?: number;
}

interface StoredTrade extends TradeEvent {
  receivedAt: number;
}

interface StoredBondingStatus extends BondingStatusEvent {
  receivedAt: number;
}

/**
 * In-Memory Event Store for Goldsky Webhook Data
 * Receives webhook events, stores in memory, broadcasts to WebSocket clients
 */
export class GoldskyMemoryStore extends EventEmitter {
  // In-memory storage (key = tokenAddress.toLowerCase())
  private trades = new Map<string, StoredTrade[]>();
  private bondingStatus = new Map<string, StoredBondingStatus>();
  
  // Configuration
  private config: Required<MemoryStoreConfig>;
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Stats
  private stats = {
    totalTradesStored: 0,
    totalBondingStatusStored: 0,
    totalWebhooksReceived: 0,
    totalBroadcasts: 0,
    memoryUsageBytes: 0,
  };

  constructor(config?: MemoryStoreConfig) {
    super();
    this.config = {
      maxTradesPerToken: config?.maxTradesPerToken || 1000, // Keep last 1000 trades per token
      maxBondingHistoryPerToken: config?.maxBondingHistoryPerToken || 100, // Keep last 100 bonding updates
      cleanupIntervalMs: config?.cleanupIntervalMs || 60000, // Cleanup every 60 seconds
    };

    console.log('[GoldskyMemoryStore] 🧠 Initialized with config:', this.config);
    this.startCleanup();
  }

  /**
   * Store a trade event from webhook
   * Ensures trades are stored in chronological order by timestamp
   */
  storeTrade(trade: TradeEvent): void {
    const key = trade.tokenAddress.toLowerCase();
    
    const storedTrade: StoredTrade = {
      ...trade,
      receivedAt: Date.now(),
    };

    // Get or create trade array for this token
    if (!this.trades.has(key)) {
      this.trades.set(key, []);
    }

    const trades = this.trades.get(key)!;
    
    // 🎯 SEQUENTIAL ORDER: Insert trade in chronological position
    // This handles out-of-order webhooks and maintains time sequence
    const insertIndex = this.findInsertIndex(trades, storedTrade.timestamp);
    trades.splice(insertIndex, 0, storedTrade);
    
    // Keep only the most recent trades (LRU)
    if (trades.length > this.config.maxTradesPerToken) {
      trades.shift(); // Remove oldest
    }

    this.stats.totalTradesStored++;
    this.stats.totalWebhooksReceived++;

    // Broadcast to WebSocket subscribers (in sequence order)
    this.emit('trade', trade);
    this.stats.totalBroadcasts++;

    console.log(`[GoldskyMemoryStore] 📊 Stored trade for ${trade.tokenAddress} at position ${insertIndex} (${trades.length} total)`);
  }

  /**
   * Find correct insertion index to maintain chronological order
   * Uses binary search for O(log n) performance
   */
  private findInsertIndex(trades: StoredTrade[], timestamp: number): number {
    if (trades.length === 0) return 0;
    
    // If new trade is newer than all existing, append to end
    if (timestamp >= trades[trades.length - 1].timestamp) {
      return trades.length;
    }
    
    // If new trade is older than all existing, insert at start
    if (timestamp < trades[0].timestamp) {
      return 0;
    }
    
    // Binary search to find insertion point
    let left = 0;
    let right = trades.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      
      if (trades[mid].timestamp === timestamp) {
        return mid + 1; // Insert after same timestamp
      } else if (trades[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return left;
  }

  /**
   * Store bonding status from webhook
   */
  storeBondingStatus(status: BondingStatusEvent): void {
    const key = status.tokenAddress.toLowerCase();
    
    const storedStatus: StoredBondingStatus = {
      ...status,
      receivedAt: Date.now(),
    };

    // Store latest bonding status
    this.bondingStatus.set(key, storedStatus);
    
    this.stats.totalBondingStatusStored++;
    this.stats.totalWebhooksReceived++;

    // Broadcast to WebSocket subscribers
    this.emit('bonding', status);
    this.stats.totalBroadcasts++;

    console.log(`[GoldskyMemoryStore] 📈 Stored bonding status for ${status.tokenAddress}`);
  }

  /**
   * Get recent trades for a token (ultra-fast <1ms)
   */
  getTrades(tokenAddress: string, limit: number = 100): StoredTrade[] {
    const key = tokenAddress.toLowerCase();
    const trades = this.trades.get(key) || [];
    
    // Return most recent trades
    return trades.slice(-limit);
  }

  /**
   * Get latest bonding status for a token (ultra-fast <1ms)
   */
  getBondingStatus(tokenAddress: string): StoredBondingStatus | null {
    const key = tokenAddress.toLowerCase();
    return this.bondingStatus.get(key) || null;
  }

  /**
   * Get all tokens with stored data
   */
  getTrackedTokens(): string[] {
    const tradeTokens = Array.from(this.trades.keys());
    const bondingTokens = Array.from(this.bondingStatus.keys());
    
    // Merge and deduplicate
    return [...new Set([...tradeTokens, ...bondingTokens])];
  }

  /**
   * Clear data for a specific token
   */
  clearToken(tokenAddress: string): void {
    const key = tokenAddress.toLowerCase();
    this.trades.delete(key);
    this.bondingStatus.delete(key);
    
    console.log(`[GoldskyMemoryStore] 🗑️ Cleared data for ${tokenAddress}`);
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.trades.clear();
    this.bondingStatus.clear();
    
    console.log('[GoldskyMemoryStore] 🗑️ Cleared all data');
  }

  /**
   * Get statistics
   */
  getStats() {
    // Calculate approximate memory usage
    const memoryUsageBytes = this.calculateMemoryUsage();
    
    return {
      ...this.stats,
      memoryUsageBytes,
      memoryUsageMB: (memoryUsageBytes / 1024 / 1024).toFixed(2),
      tokensTracked: this.getTrackedTokens().length,
      totalTradesInMemory: Array.from(this.trades.values()).reduce(
        (sum, trades) => sum + trades.length,
        0,
      ),
      totalBondingStatusInMemory: this.bondingStatus.size,
    };
  }

  /**
   * Start automatic cleanup of old data
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    console.log('[GoldskyMemoryStore] 🧹 Started automatic cleanup');
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[GoldskyMemoryStore] 🛑 Stopped automatic cleanup');
    }
  }

  /**
   * Cleanup old data to prevent memory bloat
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    let tradesRemoved = 0;
    let bondingRemoved = 0;

    // Remove old trades
    for (const [tokenAddress, trades] of this.trades.entries()) {
      const before = trades.length;
      
      // Keep only trades from last 24 hours
      const filtered = trades.filter((trade) => now - trade.receivedAt < maxAge);
      
      if (filtered.length === 0) {
        this.trades.delete(tokenAddress);
      } else if (filtered.length !== before) {
        this.trades.set(tokenAddress, filtered);
      }
      
      tradesRemoved += before - filtered.length;
    }

    // Remove old bonding status
    for (const [tokenAddress, status] of this.bondingStatus.entries()) {
      if (now - status.receivedAt > maxAge) {
        this.bondingStatus.delete(tokenAddress);
        bondingRemoved++;
      }
    }

    if (tradesRemoved > 0 || bondingRemoved > 0) {
      console.log(
        `[GoldskyMemoryStore] 🧹 Cleanup: removed ${tradesRemoved} trades, ${bondingRemoved} bonding statuses`,
      );
    }
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let bytes = 0;

    // Rough estimate: each trade ~500 bytes, each bonding status ~200 bytes
    for (const trades of this.trades.values()) {
      bytes += trades.length * 500;
    }

    bytes += this.bondingStatus.size * 200;

    return bytes;
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.stopCleanup();
    this.clearAll();
    this.removeAllListeners();
    
    console.log('[GoldskyMemoryStore] 🛑 Shutdown complete');
  }
}

// Singleton instance
let memoryStoreInstance: GoldskyMemoryStore | null = null;

export function getMemoryStore(): GoldskyMemoryStore {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new GoldskyMemoryStore();
  }
  return memoryStoreInstance;
}

