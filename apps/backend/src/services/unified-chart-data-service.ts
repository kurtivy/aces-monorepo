import { PrismaClient } from '@prisma/client';
import { JsonRpcProvider } from 'ethers';
import { BitQueryService } from './bitquery-service';
import { OHLCVService } from './ohlcv-service';
import { SupplyBasedOHLCVService } from './supply-based-ohlcv-service';
import { TokenService } from './token-service';
import { PoolDetectionService } from './pool-detection-service';
import { AcesUsdPriceService } from './aces-usd-price-service';

interface UnifiedCandle {
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
}

interface ChartDataOptions {
  timeframe: string;
  limit?: number;
  from?: Date;
  to?: Date;
  includeUsd?: boolean;
}

interface TokenGraduationState {
  isBonded: boolean;
  poolAddress: string | null;
  poolReady: boolean;
  dexLiveAt: Date | null;
}

export class UnifiedChartDataService {
  private provider: JsonRpcProvider;

  constructor(
    private prisma: PrismaClient,
    private bitQueryService: BitQueryService,
    private ohlcvService: OHLCVService,
    private supplyBasedOHLCVService: SupplyBasedOHLCVService,
    private tokenService: TokenService,
    private poolDetectionService: PoolDetectionService,
    private acesUsdPriceService: AcesUsdPriceService,
    provider: JsonRpcProvider,
  ) {
    this.provider = provider;
    void this.provider; // TODO: Provider will be used for supply tracking integrations
  }

  /**
   * Get chart data - automatically routes to correct data source
   */
  async getChartData(
    tokenAddress: string,
    options: ChartDataOptions,
  ): Promise<{
    candles: UnifiedCandle[];
    graduationState: TokenGraduationState;
    acesUsdPrice: string | null;
  }> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Check token graduation state
    const graduationState = await this.getGraduationState(normalizedAddress);

    console.log('[UnifiedChartData] Token state:', {
      tokenAddress: normalizedAddress,
      isBonded: graduationState.isBonded,
      poolReady: graduationState.poolReady,
      dexLiveAt: graduationState.dexLiveAt,
    });

    // Get ACES/USD price for conversions
    let acesUsdPrice: string | null = null;
    if (options.includeUsd !== false) {
      try {
        const priceResult = await this.acesUsdPriceService.getAcesUsdPrice();
        acesUsdPrice = priceResult.price;
      } catch (error) {
        console.warn('[UnifiedChartData] Failed to get ACES/USD price:', error);
      }
    }

    // Route to appropriate data source
    let candles: UnifiedCandle[];

    if (graduationState.poolReady && graduationState.poolAddress) {
      // Token is graduated - fetch DEX data
      console.log('[UnifiedChartData] Fetching DEX data from BitQuery');
      candles = await this.getDexChartData(
        normalizedAddress,
        graduationState.poolAddress,
        options,
        acesUsdPrice,
      );

      // Merge with historical bonding curve data if requested
      if (graduationState.dexLiveAt) {
        const bondingCandles = await this.getBondingChartData(
          normalizedAddress,
          {
            ...options,
            to: graduationState.dexLiveAt, // Only get data before graduation
          },
          acesUsdPrice,
        );

        candles = this.mergeCandles(bondingCandles, candles);
      }
    } else {
      // Token is still in bonding curve
      console.log('[UnifiedChartData] Fetching bonding curve data from Goldsky');
      candles = await this.getBondingChartData(normalizedAddress, options, acesUsdPrice);
    }

    // Store candles to database (async, non-blocking)
    this.storeCandlesAsync(normalizedAddress, candles).catch((err) => {
      console.warn('[UnifiedChartData] Background storage failed:', err);
    });

    return {
      candles,
      graduationState,
      acesUsdPrice,
    };
  }

  /**
   * Get real-time candle update (for WebSocket)
   */
  async getLatestCandle(tokenAddress: string, timeframe: string): Promise<UnifiedCandle | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const graduationState = await this.getGraduationState(normalizedAddress);

    if (graduationState.poolReady && graduationState.poolAddress) {
      // DEX mode - get latest from BitQuery
      return await this.getLatestDexCandle(
        normalizedAddress,
        graduationState.poolAddress,
        timeframe,
      );
    } else {
      // Bonding curve mode - get latest from Goldsky
      return await this.getLatestBondingCandle(normalizedAddress, timeframe);
    }
  }

  /**
   * Check and update token graduation state
   */
  private async getGraduationState(tokenAddress: string): Promise<TokenGraduationState> {
    // Check database first
    const token = await this.prisma.token.findUnique({
      where: { contractAddress: tokenAddress },
      select: {
        poolAddress: true,
        dexLiveAt: true,
        phase: true,
      },
    });

    if (token?.poolAddress && token?.dexLiveAt) {
      // Token is already marked as graduated
      return {
        isBonded: true,
        poolAddress: token.poolAddress,
        poolReady: true,
        dexLiveAt: token.dexLiveAt,
      };
    }

    // Check if token has bonded (from subgraph)
    const subgraphData = await this.tokenService.fetchAndUpdateTokenData(tokenAddress);

    // Check bonded status from subgraph query
    // Note: This requires your TokenService to expose bonded status
    // For now, we'll check if poolAddress exists

    if (!token?.poolAddress) {
      return {
        isBonded: false,
        poolAddress: null,
        poolReady: false,
        dexLiveAt: null,
      };
    }

    // Verify pool is ready
    const poolReady = await this.poolDetectionService.isPoolReady(token.poolAddress);

    if (poolReady && !token.dexLiveAt) {
      // Update database to mark as graduated
      await this.prisma.token.update({
        where: { contractAddress: tokenAddress },
        data: {
          dexLiveAt: new Date(),
          phase: 'DEX_TRADING',
          priceSource: 'DEX',
        },
      });
    }

    return {
      isBonded: !!token.poolAddress,
      poolAddress: token.poolAddress,
      poolReady,
      dexLiveAt: token.dexLiveAt,
    };
  }

  /**
   * Get bonding curve chart data
   */
  private async getBondingChartData(
    tokenAddress: string,
    options: ChartDataOptions,
    acesUsdPrice: string | null,
  ): Promise<UnifiedCandle[]> {
    try {
      // FIRST: Try to get from database
      const dbCandles = await this.getCachedCandles(tokenAddress, options.timeframe);

      if (dbCandles.length > 0) {
        console.log(`[UnifiedChartData] Using ${dbCandles.length} cached candles from database`);
        return dbCandles.map((candle) => this.convertDbCandleToUnified(candle, acesUsdPrice));
      }

      // FALLBACK: Generate from supply-based service (real-time calculation)
      console.log('[UnifiedChartData] No cached candles, generating from trades...');
      const candles = await this.supplyBasedOHLCVService.getCandles(
        tokenAddress,
        options.timeframe as any,
      );

      // Convert to unified format with USD values
      return candles.map((candle) => {
        const acesPrice = acesUsdPrice ? parseFloat(acesUsdPrice) : null;

        return {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          openUsd: acesPrice ? (parseFloat(candle.open) * acesPrice).toFixed(6) : '0',
          highUsd: acesPrice ? (parseFloat(candle.high) * acesPrice).toFixed(6) : '0',
          lowUsd: acesPrice ? (parseFloat(candle.low) * acesPrice).toFixed(6) : '0',
          closeUsd: acesPrice ? (parseFloat(candle.close) * acesPrice).toFixed(6) : '0',
          volume: candle.volume,
          volumeUsd: acesPrice ? (parseFloat(candle.volume) * acesPrice).toFixed(2) : '0',
          trades: candle.trades,
          dataSource: 'bonding_curve' as const,
        };
      });
    } catch (error) {
      console.error('[UnifiedChartData] Error fetching bonding curve data:', error);
      return [];
    }
  }

  /**
   * Get cached candles from database
   */
  private async getCachedCandles(tokenAddress: string, timeframe: string): Promise<any[]> {
    try {
      const candles = await this.prisma.tokenOHLCV.findMany({
        where: {
          contractAddress: tokenAddress.toLowerCase(),
          timeframe,
          dataSource: 'bonding_curve',
        },
        orderBy: {
          timestamp: 'asc',
        },
        take: 1000, // Last 1000 candles
      });

      return candles;
    } catch (error) {
      console.error('[UnifiedChartData] Error fetching cached candles:', error);
      return [];
    }
  }

  /**
   * Convert database candle to unified format
   */
  private convertDbCandleToUnified(dbCandle: any, acesUsdPrice: string | null): UnifiedCandle {
    const acesPrice = acesUsdPrice ? parseFloat(acesUsdPrice) : null;

    return {
      timestamp: new Date(dbCandle.timestamp),
      open: dbCandle.open,
      high: dbCandle.high,
      low: dbCandle.low,
      close: dbCandle.close,
      openUsd:
        dbCandle.openUsd || (acesPrice ? (parseFloat(dbCandle.open) * acesPrice).toFixed(6) : '0'),
      highUsd:
        dbCandle.highUsd || (acesPrice ? (parseFloat(dbCandle.high) * acesPrice).toFixed(6) : '0'),
      lowUsd:
        dbCandle.lowUsd || (acesPrice ? (parseFloat(dbCandle.low) * acesPrice).toFixed(6) : '0'),
      closeUsd:
        dbCandle.closeUsd ||
        (acesPrice ? (parseFloat(dbCandle.close) * acesPrice).toFixed(6) : '0'),
      volume: dbCandle.volume,
      volumeUsd:
        dbCandle.volumeUsd ||
        (acesPrice ? (parseFloat(dbCandle.volume) * acesPrice).toFixed(2) : '0'),
      trades: dbCandle.trades,
      dataSource: dbCandle.dataSource || 'bonding_curve',
    };
  }

  /**
   * Get DEX chart data
   */
  private async getDexChartData(
    tokenAddress: string,
    poolAddress: string,
    options: ChartDataOptions,
    acesUsdPrice: string | null,
  ): Promise<UnifiedCandle[]> {
    const candles = await this.bitQueryService.getOHLCCandles(
      tokenAddress,
      poolAddress,
      options.timeframe,
      {
        from: options.from,
        to: options.to,
      },
    );

    // Convert to unified format
    return candles.map((candle) => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      openUsd: candle.openUsd,
      highUsd: candle.highUsd,
      lowUsd: candle.lowUsd,
      closeUsd: candle.closeUsd,
      volume: candle.volume,
      volumeUsd: candle.volumeUsd,
      trades: candle.trades,
      dataSource: 'dex' as const,
    }));
  }

  /**
   * Get latest bonding curve candle
   */
  private async getLatestBondingCandle(
    tokenAddress: string,
    timeframe: string,
  ): Promise<UnifiedCandle | null> {
    const candles = await this.supplyBasedOHLCVService.getCandles(
      tokenAddress,
      timeframe as any,
      100, // Last 100 trades
    );

    if (candles.length === 0) return null;

    const latestCandle = candles[candles.length - 1];

    // Get ACES/USD price
    let acesUsdPrice: string | null = null;
    try {
      const priceResult = await this.acesUsdPriceService.getAcesUsdPrice();
      acesUsdPrice = priceResult.price;
    } catch (error) {
      console.warn('[UnifiedChartData] Failed to get ACES/USD price for latest candle');
    }

    const acesPrice = acesUsdPrice ? parseFloat(acesUsdPrice) : null;

    return {
      timestamp: latestCandle.timestamp,
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
      openUsd: acesPrice ? (parseFloat(latestCandle.open) * acesPrice).toFixed(6) : '0',
      highUsd: acesPrice ? (parseFloat(latestCandle.high) * acesPrice).toFixed(6) : '0',
      lowUsd: acesPrice ? (parseFloat(latestCandle.low) * acesPrice).toFixed(6) : '0',
      closeUsd: acesPrice ? (parseFloat(latestCandle.close) * acesPrice).toFixed(6) : '0',
      volume: latestCandle.volume,
      volumeUsd: acesPrice ? (parseFloat(latestCandle.volume) * acesPrice).toFixed(2) : '0',
      trades: latestCandle.trades,
      dataSource: 'bonding_curve',
    };
  }

  /**
   * Get latest DEX candle
   */
  private async getLatestDexCandle(
    tokenAddress: string,
    poolAddress: string,
    timeframe: string,
  ): Promise<UnifiedCandle | null> {
    const swaps = await this.bitQueryService.getRecentSwaps(tokenAddress, poolAddress, {
      limit: 100,
    });

    if (swaps.length === 0) return null;

    // Build candle from recent swaps
    const latestSwap = swaps[0];
    const intervalMs = this.getIntervalMs(timeframe);
    const candleStart = Math.floor(latestSwap.blockTime.getTime() / intervalMs) * intervalMs;

    const candleSwaps = swaps.filter((swap) => swap.blockTime.getTime() >= candleStart);

    const prices = candleSwaps.map((s) => parseFloat(s.priceInAces));
    const pricesUsd = candleSwaps.map((s) => parseFloat(s.priceInUsd));

    return {
      timestamp: new Date(candleStart),
      open: prices[prices.length - 1].toString(),
      high: Math.max(...prices).toString(),
      low: Math.min(...prices).toString(),
      close: prices[0].toString(),
      openUsd: pricesUsd[pricesUsd.length - 1].toString(),
      highUsd: Math.max(...pricesUsd).toString(),
      lowUsd: Math.min(...pricesUsd).toString(),
      closeUsd: pricesUsd[0].toString(),
      volume: candleSwaps.reduce((sum, s) => sum + parseFloat(s.amountAces), 0).toString(),
      volumeUsd: candleSwaps.reduce((sum, s) => sum + parseFloat(s.volumeUsd), 0).toString(),
      trades: candleSwaps.length,
      dataSource: 'dex',
    };
  }

  /**
   * Merge bonding curve and DEX candles
   */
  private mergeCandles(
    bondingCandles: UnifiedCandle[],
    dexCandles: UnifiedCandle[],
  ): UnifiedCandle[] {
    const merged = [...bondingCandles, ...dexCandles];

    // Sort by timestamp
    merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Remove duplicates (prefer DEX data)
    const seen = new Set<string>();
    return merged.filter((candle) => {
      const key = `${candle.timestamp.getTime()}-${candle.dataSource}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Store candles to database (async)
   */
  private async storeCandlesAsync(tokenAddress: string, candles: UnifiedCandle[]): Promise<void> {
    try {
      for (const candle of candles) {
        await this.prisma.tokenOHLCV.upsert({
          where: {
            contractAddress_timeframe_timestamp_dataSource: {
              contractAddress: tokenAddress,
              timeframe: '1h', // TODO: Get actual timeframe
              timestamp: candle.timestamp,
              dataSource: candle.dataSource,
            },
          },
          update: {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            volumeUsd: candle.volumeUsd,
            openUsd: candle.openUsd,
            highUsd: candle.highUsd,
            lowUsd: candle.lowUsd,
            closeUsd: candle.closeUsd,
            trades: candle.trades,
          },
          create: {
            contractAddress: tokenAddress,
            timeframe: '1h', // TODO: Get actual timeframe
            timestamp: candle.timestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            volumeUsd: candle.volumeUsd,
            openUsd: candle.openUsd,
            highUsd: candle.highUsd,
            lowUsd: candle.lowUsd,
            closeUsd: candle.closeUsd,
            trades: candle.trades,
            dataSource: candle.dataSource,
          },
        });
      }
    } catch (error) {
      console.error('[UnifiedChartData] Storage error:', error);
    }
  }

  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || 60 * 60 * 1000;
  }
}
