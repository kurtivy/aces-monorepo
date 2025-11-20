/**
 * Chart Data Store - In-Memory Chart Data Management
 *
 * Stores trades and candles in memory for ultra-fast reads (<1ms).
 * Maintains 7-day rolling window per token/timeframe.
 *
 * Architecture:
 * - Webhook receives trade → addTrade() → aggregate → broadcast
 * - REST endpoint reads from memory first
 * - Auto-cleanup removes data older than 7 days
 */

import type { FastifyInstance } from 'fastify';
import type { SubgraphTrade } from '../lib/goldsky-client';

// Trade interface matching what we store
interface StoredTrade {
  id: string;
  timestamp: Date;
  priceInAces: number;
  priceInUsd: number;
  amountToken: number;
  volumeUsd: number;
  side: 'buy' | 'sell';
  circulatingSupply?: number;
  dataSource: 'bonding_curve' | 'dex';
}

// Candle interface matching ChartAggregationService
interface Candle {
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  openUsd: string;
  highUsd: string;
  lowUsd: string;
  closeUsd: string;
  volume: string;
  volumeUsd: string;
  trades: number;
  dataSource: 'bonding_curve' | 'dex';
  circulatingSupply: string;
  totalSupply: string;
  marketCapAces: string;
  marketCapUsd: string;
  marketCapOpenUsd?: string;
  marketCapHighUsd?: string;
  marketCapLowUsd?: string;
  marketCapCloseUsd?: string;
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export class ChartDataStore {
  // Structure: Map<tokenAddress, Map<timeframe, Candle[]>>
  private candles = new Map<string, Map<Timeframe, Candle[]>>();

  // Structure: Map<tokenAddress, StoredTrade[]>
  private trades = new Map<string, StoredTrade[]>();

  // Track last cleanup time per token
  private lastCleanup = new Map<string, number>();

  private readonly MEMORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  private fastify: FastifyInstance;
  private chartService: any; // ChartAggregationService - will be injected

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;

    // Start periodic cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Inject chart service for fallback/historical data
   */
  setChartService(chartService: any): void {
    this.chartService = chartService;
  }

  /**
   * Add a trade and update candles for all timeframes
   */
  async addTrade(
    tokenAddress: string,
    trade: SubgraphTrade,
    acesUsdPrice: number,
    webSocketService?: any,
  ): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Convert SubgraphTrade to StoredTrade
    const storedTrade: StoredTrade = {
      id: trade.id,
      timestamp: new Date(parseInt(trade.createdAt) * 1000),
      priceInAces: parseFloat(trade.acesTokenAmount) / parseFloat(trade.tokenAmount),
      priceInUsd:
        (parseFloat(trade.acesTokenAmount) / parseFloat(trade.tokenAmount)) * acesUsdPrice,
      amountToken: parseFloat(trade.tokenAmount),
      volumeUsd:
        (parseFloat(trade.acesTokenAmount) / parseFloat(trade.tokenAmount)) *
        acesUsdPrice *
        parseFloat(trade.tokenAmount),
      side: trade.isBuy ? 'buy' : 'sell',
      circulatingSupply: parseFloat(trade.supply) / 1e18,
      dataSource: 'bonding_curve',
    };

    // Add trade to store
    if (!this.trades.has(normalizedAddress)) {
      this.trades.set(normalizedAddress, []);
    }
    this.trades.get(normalizedAddress)!.push(storedTrade);

    // Update candles for all timeframes
    const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    for (const timeframe of timeframes) {
      await this.updateCandlesForTimeframe(normalizedAddress, timeframe, acesUsdPrice);

      // 🔥 PHASE 4: Broadcast candle update via WebSocket
      if (webSocketService) {
        await this.broadcastLatestCandle(normalizedAddress, timeframe, 'price', webSocketService);
      }
    }

    // Cleanup old data for this token
    this.cleanupTokenData(normalizedAddress);
  }

  /**
   * Update candles for a specific timeframe
   */
  private async updateCandlesForTimeframe(
    tokenAddress: string,
    timeframe: Timeframe,
    acesUsdPrice: number,
  ): Promise<void> {
    const tokenTrades = this.trades.get(tokenAddress) || [];

    if (tokenTrades.length === 0) {
      return;
    }

    // Filter trades within memory window
    const now = Date.now();
    const cutoffTime = now - this.MEMORY_WINDOW_MS;
    const recentTrades = tokenTrades.filter((trade) => trade.timestamp.getTime() >= cutoffTime);

    if (recentTrades.length === 0) {
      return;
    }

    // Get existing candles
    const existingCandles = this.getCandlesFromMemory(tokenAddress, timeframe);

    // Aggregate trades to candles
    const newCandles = this.aggregateTradesToCandles(
      recentTrades,
      timeframe,
      acesUsdPrice,
      existingCandles,
    );

    // Store updated candles
    if (!this.candles.has(tokenAddress)) {
      this.candles.set(tokenAddress, new Map());
    }
    this.candles.get(tokenAddress)!.set(timeframe, newCandles);
  }

  /**
   * Aggregate trades into candles
   */
  private aggregateTradesToCandles(
    trades: StoredTrade[],
    timeframe: Timeframe,
    acesUsdPrice: number,
    existingCandles: Candle[],
  ): Candle[] {
    const intervalMs = this.getIntervalMs(timeframe);

    // Group trades by aligned timestamp
    const tradeBuckets = new Map<number, StoredTrade[]>();
    for (const trade of trades) {
      const tradeTime = trade.timestamp.getTime();
      const alignedTime = Math.floor(tradeTime / intervalMs) * intervalMs;

      if (!tradeBuckets.has(alignedTime)) {
        tradeBuckets.set(alignedTime, []);
      }
      tradeBuckets.get(alignedTime)!.push(trade);
    }

    // Find time range
    const timestamps = Array.from(tradeBuckets.keys()).sort((a, b) => a - b);
    if (timestamps.length === 0) {
      return existingCandles;
    }

    const startTime = timestamps[0];
    const endTime = timestamps[timestamps.length - 1];

    // Merge with existing candles
    const existingMap = new Map<number, Candle>();
    for (const candle of existingCandles) {
      const candleTime = candle.timestamp.getTime();
      const alignedTime = Math.floor(candleTime / intervalMs) * intervalMs;
      existingMap.set(alignedTime, candle);
    }

    // Generate/update candles
    const candles: Candle[] = [];
    let previousCandle: Candle | null = null;
    let currentTime = startTime;

    while (currentTime <= endTime) {
      const bucketTrades = tradeBuckets.get(currentTime) || [];
      const existingCandle = existingMap.get(currentTime);

      let candle: Candle;

      if (bucketTrades.length > 0) {
        // Create candle from trades
        candle = this.createCandleFromTrades(
          bucketTrades,
          currentTime,
          acesUsdPrice,
          previousCandle,
        );
      } else if (existingCandle) {
        // Keep existing candle
        candle = existingCandle;
      } else if (previousCandle) {
        // Empty candle - use previous close
        candle = this.createEmptyCandle(currentTime, previousCandle, acesUsdPrice);
      } else {
        // Skip - no previous candle
        currentTime += intervalMs;
        continue;
      }

      candles.push(candle);
      previousCandle = candle;
      currentTime += intervalMs;
    }

    // Sort by timestamp
    candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return candles;
  }

  /**
   * Create candle from trades
   */
  private createCandleFromTrades(
    trades: StoredTrade[],
    timestamp: number,
    acesUsdPrice: number,
    previousCandle: Candle | null,
  ): Candle {
    const prices = trades.map((t) => t.priceInUsd);
    const volumes = trades.map((t) => t.volumeUsd);
    const supplies = trades.map((t) => t.circulatingSupply || 800000000).filter((s) => s > 0);

    const open = previousCandle ? previousCandle.closeUsd : prices[0]?.toString() || '0';
    const high = Math.max(...prices).toString();
    const low = Math.min(...prices).toString();
    const close = prices[prices.length - 1]?.toString() || '0';
    const volume = volumes.reduce((sum, v) => sum + v, 0).toString();
    const volumeUsd = volume;
    const supply = supplies.length > 0 ? supplies[supplies.length - 1] : 800000000;

    const openAces = previousCandle ? previousCandle.close : prices[0]?.toString() || '0';
    const highAces = Math.max(...trades.map((t) => t.priceInAces)).toString();
    const lowAces = Math.min(...trades.map((t) => t.priceInAces)).toString();
    const closeAces = trades[trades.length - 1]?.priceInAces.toString() || '0';

    const marketCapUsd = parseFloat(close) * supply;
    const marketCapOpenUsd = previousCandle?.marketCapCloseUsd || marketCapUsd.toString();
    const marketCapHighUsd = parseFloat(high) * supply;
    const marketCapLowUsd = parseFloat(low) * supply;
    const marketCapCloseUsd = marketCapUsd.toString();

    return {
      timestamp: new Date(timestamp),
      open: openAces,
      high: highAces,
      low: lowAces,
      close: closeAces,
      openUsd: open,
      highUsd: high,
      lowUsd: low,
      closeUsd: close,
      volume: volume,
      volumeUsd: volumeUsd,
      trades: trades.length,
      dataSource: 'bonding_curve',
      circulatingSupply: supply.toString(),
      totalSupply: '800000000',
      marketCapAces: (parseFloat(closeAces) * supply).toString(),
      marketCapUsd: marketCapCloseUsd,
      marketCapOpenUsd,
      marketCapHighUsd: marketCapHighUsd.toString(),
      marketCapLowUsd: marketCapLowUsd.toString(),
      marketCapCloseUsd,
    };
  }

  /**
   * Create empty candle (no trades)
   */
  private createEmptyCandle(
    timestamp: number,
    previousCandle: Candle,
    acesUsdPrice: number,
  ): Candle {
    // Use previous close for all OHLC
    const closeUsd = previousCandle.closeUsd;
    const closeAces = previousCandle.close;
    const supply = parseFloat(previousCandle.circulatingSupply);

    return {
      timestamp: new Date(timestamp),
      open: closeAces,
      high: closeAces,
      low: closeAces,
      close: closeAces,
      openUsd: closeUsd,
      highUsd: closeUsd,
      lowUsd: closeUsd,
      closeUsd: closeUsd,
      volume: '0',
      volumeUsd: '0',
      trades: 0,
      dataSource: previousCandle.dataSource,
      circulatingSupply: previousCandle.circulatingSupply,
      totalSupply: previousCandle.totalSupply,
      marketCapAces: previousCandle.marketCapAces,
      marketCapUsd: previousCandle.marketCapUsd,
      marketCapOpenUsd: previousCandle.marketCapCloseUsd,
      marketCapHighUsd: previousCandle.marketCapCloseUsd,
      marketCapLowUsd: previousCandle.marketCapCloseUsd,
      marketCapCloseUsd: previousCandle.marketCapCloseUsd,
    };
  }

  /**
   * Get candles from memory
   */
  private getCandlesFromMemory(tokenAddress: string, timeframe: Timeframe): Candle[] {
    const tokenCandles = this.candles.get(tokenAddress);
    if (!tokenCandles) {
      return [];
    }
    return tokenCandles.get(timeframe) || [];
  }

  /**
   * Get candles for a token/timeframe within date range
   */
  getCandles(tokenAddress: string, timeframe: Timeframe, from: Date, to: Date): Candle[] {
    const normalizedAddress = tokenAddress.toLowerCase();
    const candles = this.getCandlesFromMemory(normalizedAddress, timeframe);

    // Filter by date range
    return candles.filter((candle) => {
      const candleTime = candle.timestamp.getTime();
      return candleTime >= from.getTime() && candleTime <= to.getTime();
    });
  }

  /**
   * Get latest candle for a token/timeframe
   */
  getLatestCandle(tokenAddress: string, timeframe: Timeframe): Candle | null {
    const normalizedAddress = tokenAddress.toLowerCase();
    const candles = this.getCandlesFromMemory(normalizedAddress, timeframe);

    if (candles.length === 0) {
      return null;
    }

    // Return most recent candle
    return candles[candles.length - 1];
  }

  /**
   * Check if we have data for a token/timeframe
   */
  hasData(tokenAddress: string, timeframe: Timeframe): boolean {
    const normalizedAddress = tokenAddress.toLowerCase();
    const candles = this.getCandlesFromMemory(normalizedAddress, timeframe);
    return candles.length > 0;
  }

  /**
   * Cleanup old data for a specific token
   */
  private cleanupTokenData(tokenAddress: string): void {
    const now = Date.now();
    const cutoffTime = now - this.MEMORY_WINDOW_MS;

    // Cleanup trades
    const tokenTrades = this.trades.get(tokenAddress);
    if (tokenTrades) {
      const recentTrades = tokenTrades.filter((trade) => trade.timestamp.getTime() >= cutoffTime);
      this.trades.set(tokenAddress, recentTrades);
    }

    // Cleanup candles
    const tokenCandles = this.candles.get(tokenAddress);
    if (tokenCandles) {
      const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
      for (const timeframe of timeframes) {
        const candles = tokenCandles.get(timeframe) || [];
        const recentCandles = candles.filter((candle) => candle.timestamp.getTime() >= cutoffTime);
        tokenCandles.set(timeframe, recentCandles);
      }
    }

    this.lastCleanup.set(tokenAddress, now);
  }

  /**
   * Periodic cleanup of all tokens
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const tokens = Array.from(this.trades.keys());

    for (const tokenAddress of tokens) {
      this.cleanupTokenData(tokenAddress);
    }
  }

  /**
   * Get interval in milliseconds for a timeframe
   */
  private getIntervalMs(timeframe: Timeframe): number {
    const intervals: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe];
  }

  /**
   * Broadcast latest candle via WebSocket
   */
  private async broadcastLatestCandle(
    tokenAddress: string,
    timeframe: Timeframe,
    chartType: 'price' | 'mcap',
    webSocketService: any,
  ): Promise<void> {
    const latestCandle = this.getLatestCandle(tokenAddress, timeframe);
    if (!latestCandle) {
      return;
    }

    // Get graduation state (need chart service for this)
    let graduationState;
    if (this.chartService && typeof this.chartService.getChartData === 'function') {
      try {
        const minimalChartData = await this.chartService.getChartData(tokenAddress, {
          timeframe,
          from: new Date(Date.now() - 3600000),
          to: new Date(),
          limit: 1,
        });
        graduationState = minimalChartData.graduationState;
      } catch (error) {
        // Fallback graduation state
        graduationState = {
          isBonded: false,
          poolReady: false,
          poolAddress: null,
          dexLiveAt: null,
        };
      }
    } else {
      graduationState = {
        isBonded: false,
        poolReady: false,
        poolAddress: null,
        dexLiveAt: null,
      };
    }

    // Format candle for WebSocket broadcast
    const payload = {
      type: 'candle_update',
      tokenAddress,
      timeframe,
      chartType,
      candle: {
        timestamp: latestCandle.timestamp.getTime(),
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
        openUsd: latestCandle.openUsd,
        highUsd: latestCandle.highUsd,
        lowUsd: latestCandle.lowUsd,
        closeUsd: latestCandle.closeUsd,
        volume: latestCandle.volume,
        volumeUsd: latestCandle.volumeUsd,
        trades: latestCandle.trades,
        dataSource: latestCandle.dataSource,
      },
      graduationState,
      timestamp: Date.now(),
    };

    // Broadcast via WebSocket
    if (webSocketService && typeof webSocketService.broadcastCandleUpdate === 'function') {
      webSocketService.broadcastCandleUpdate(tokenAddress, timeframe, chartType, payload);
    }
  }

  /**
   * 🔥 LAZY LOADING: Populate memory from unified GoldSky service
   * Called when memory is empty but chart service has data
   * NOTE: Only works for bonding curve tokens - DEX tokens are handled by chart service
   */
  async populateFromUnifiedService(
    tokenAddress: string,
    acesUsdPrice: number,
    webSocketService?: any,
  ): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Check if we already have data
    if (this.trades.has(normalizedAddress) && this.trades.get(normalizedAddress)!.length > 0) {
      console.log(`[ChartDataStore] ⏭️  Already populated for ${tokenAddress}`);
      return; // Already populated
    }

    // Get unified service from fastify
    const unifiedService = (this.fastify as any).unifiedGoldSkyService;
    if (!unifiedService) {
      console.log(`[ChartDataStore] ⚠️  Unified service not available for ${tokenAddress}`);
      return; // Can't populate without unified service
    }

    // Check if token is in DEX mode - if so, skip lazy loading (DEX trades come from BitQuery)
    try {
      const tokenMetadataCache = (this.fastify as any).tokenMetadataCache;
      if (tokenMetadataCache) {
        const metadata = await tokenMetadataCache.getTokenMetadata(normalizedAddress);
        if (metadata && metadata.phase === 'DEX_TRADING' && metadata.poolAddress) {
          console.log(
            `[ChartDataStore] ⏭️  Token ${tokenAddress} is in DEX mode - skipping lazy loading (DEX trades from BitQuery)`,
          );
          return; // DEX tokens don't have bonding curve trades in unified data
        }
      }
    } catch (error) {
      console.warn(`[ChartDataStore] ⚠️  Failed to check graduation state:`, error);
      // Continue anyway - might be bonding curve token
    }

    try {
      console.log(`[ChartDataStore] 🔄 Lazy loading trades for ${tokenAddress}...`);
      // Fetch unified data (uses cache, fast)
      const unifiedData = await unifiedService.getUnifiedTokenData(tokenAddress);
      if (!unifiedData || !unifiedData.trades || unifiedData.trades.length === 0) {
        console.log(`[ChartDataStore] ⚠️  No trades found in unified data for ${tokenAddress}`);
        return; // No trades to populate
      }

      // Filter to last 7 days
      const now = Date.now();
      const cutoffTime = Math.floor((now - this.MEMORY_WINDOW_MS) / 1000);
      const recentTrades = unifiedData.trades.filter((trade: any) => {
        const tradeTimestamp = parseInt(trade.createdAt);
        return tradeTimestamp >= cutoffTime;
      });

      console.log(
        `[ChartDataStore] 📊 Found ${unifiedData.trades.length} total trades, ${recentTrades.length} within 7 days`,
      );

      if (recentTrades.length === 0) {
        console.log(`[ChartDataStore] ⚠️  No recent trades within 7 days for ${tokenAddress}`);
        return; // No recent trades
      }

      // Add each trade to memory
      for (const trade of recentTrades) {
        const subgraphTrade: SubgraphTrade = {
          id: trade.id,
          isBuy: trade.isBuy,
          tokenAmount: trade.tokenAmount,
          acesTokenAmount: trade.acesTokenAmount,
          supply: trade.supply,
          createdAt: trade.createdAt,
          blockNumber: trade.blockNumber,
          protocolFeeAmount: trade.protocolFeeAmount,
          subjectFeeAmount: trade.subjectFeeAmount,
          token: {
            address: unifiedData.address,
            name: '',
            symbol: '',
          },
          trader: {
            address: trade.trader?.id || '',
          },
        };

        await this.addTrade(tokenAddress, subgraphTrade, acesUsdPrice, webSocketService);
      }

      console.log(
        `[ChartDataStore] ✅ Lazy loaded ${recentTrades.length} trades for ${tokenAddress}`,
      );
    } catch (error) {
      console.error(`[ChartDataStore] ❌ Failed to populate from unified service:`, error);
      // Don't throw - lazy loading is optional
    }
  }
  getStats(): {
    tokenCount: number;
    totalTrades: number;
    totalCandles: number;
    memoryUsage: string;
  } {
    let totalTrades = 0;
    let totalCandles = 0;

    for (const trades of this.trades.values()) {
      totalTrades += trades.length;
    }

    for (const tokenCandles of this.candles.values()) {
      for (const candles of tokenCandles.values()) {
        totalCandles += candles.length;
      }
    }

    // Rough estimate: ~100 bytes per candle, ~200 bytes per trade
    const estimatedBytes = totalCandles * 100 + totalTrades * 200;
    const memoryUsage = `${(estimatedBytes / 1024 / 1024).toFixed(2)} MB`;

    return {
      tokenCount: this.trades.size,
      totalTrades,
      totalCandles,
      memoryUsage,
    };
  }
}
