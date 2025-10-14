import { PrismaClient } from '@prisma/client';
import { JsonRpcProvider } from 'ethers';
import { BitQueryService, BitQueryPaymentRequiredError } from './bitquery-service';
import { OHLCVService } from './ohlcv-service';
import { SupplyBasedOHLCVService } from './supply-based-ohlcv-service';
import { TokenService } from './token-service';
import { PoolDetectionService } from './pool-detection-service';
import { AcesUsdPriceService } from './aces-usd-price-service';
import {
  ACES_TOKEN_ADDRESS,
  ACES_WETH_POOL_ADDRESS,
  USDC_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WETH_USDC_POOL_ADDRESS,
} from '../config/bitquery.config';

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
  circulatingSupply?: string;
  totalSupply?: string;
  marketCapAces?: string;
  marketCapUsd?: string;
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

interface AcesUsdSeriesCacheEntry {
  map: Map<number, number>;
  lastPrice: number | null;
  minTimestamp: number;
  maxTimestamp: number;
  expiresAt: number;
}

export class UnifiedChartDataService {
  private provider: JsonRpcProvider;
  private readonly acesUsdSeriesCacheTtlMs: number;
  private acesUsdSeriesCache = new Map<string, AcesUsdSeriesCacheEntry>();

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
    this.acesUsdSeriesCacheTtlMs = Number(
      process.env.ACES_USD_SERIES_CACHE_TTL_MS || process.env.BITQUERY_CACHE_TTL_MS || '60000',
    );
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
      const dexResult = await this.getDexChartData(
        normalizedAddress,
        graduationState.poolAddress,
        options,
        acesUsdPrice,
      );
      candles = dexResult.candles;

      if (dexResult.acesUsdPrice) {
        acesUsdPrice = dexResult.acesUsdPrice;
      }

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
        // Check if cached candles have supply data
        const hasSupplyData =
          dbCandles[0].circulatingSupply && dbCandles[0].circulatingSupply !== '0';

        if (!hasSupplyData) {
          console.log(
            '[UnifiedChartData] ⚠️ Cached candles lack supply data, generating fresh candles with supply...',
          );
          console.log('[UnifiedChartData] First cached candle:', {
            circulatingSupply: dbCandles[0].circulatingSupply,
            marketCapAces: dbCandles[0].marketCapAces,
            marketCapUsd: dbCandles[0].marketCapUsd,
          });
          // Fall through to generate fresh candles with supply data
        } else {
          console.log(`[UnifiedChartData] Using ${dbCandles.length} cached candles from database`);
          console.log('[UnifiedChartData] 📊 First DB candle raw data:', {
            timestamp: dbCandles[0].timestamp,
            circulatingSupply: dbCandles[0].circulatingSupply,
            marketCapAces: dbCandles[0].marketCapAces,
            marketCapUsd: dbCandles[0].marketCapUsd,
            close: dbCandles[0].close,
            closeUsd: dbCandles[0].closeUsd,
          });
          const converted = dbCandles.map((candle) =>
            this.convertDbCandleToUnified(candle, acesUsdPrice),
          );
          console.log('🔍 [UnifiedChartData] First cached candle after conversion:', {
            hasUsd: !!converted[0]?.openUsd,
            openUsd: converted[0]?.openUsd,
            closeUsd: converted[0]?.closeUsd,
            marketCapAces: converted[0]?.marketCapAces,
            marketCapUsd: converted[0]?.marketCapUsd,
            circulatingSupply: converted[0]?.circulatingSupply,
          });
          return converted;
        }
      }

      // FALLBACK: Generate from supply-based service (real-time calculation)
      console.log('[UnifiedChartData] No cached candles, generating from trades...');
      const candles = await this.supplyBasedOHLCVService.getCandles(
        tokenAddress,
        options.timeframe as any,
      );

      // Convert to unified format with USD values
      return candles.map((candle, index) => {
        const acesPrice = acesUsdPrice ? parseFloat(acesUsdPrice) : null;

        const openAces = parseFloat(candle.open);
        const closeAces = parseFloat(candle.close);
        const volumeAces = parseFloat(candle.volume);
        const supply = candle.circulatingSupply ? parseFloat(candle.circulatingSupply) : 0;

        const openUsd = acesPrice ? (openAces * acesPrice).toFixed(18) : '0';
        const closeUsd = acesPrice ? (closeAces * acesPrice).toFixed(18) : '0';

        // Calculate market cap using circulating supply
        const marketCapAces = supply > 0 ? (supply * closeAces).toFixed(2) : '0';
        const marketCapUsd =
          supply > 0 && acesPrice ? (supply * closeAces * acesPrice).toFixed(2) : '0';

        // DEBUG: Log first candle conversion
        if (index === 0) {
          console.log('🔍 [UnifiedChartData] Converting first candle from supply service:', {
            acesUsdPrice,
            acesPrice,
            openRaw: candle.open,
            openParsed: openAces,
            openCalculated: openAces * (acesPrice || 0),
            openUsdFinal: openUsd,
            closeRaw: candle.close,
            closeParsed: closeAces,
            closeUsdFinal: closeUsd,
            circulatingSupply: candle.circulatingSupply,
            marketCapAces,
            marketCapUsd,
          });
        }

        return {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          openUsd,
          highUsd: acesPrice ? (parseFloat(candle.high) * acesPrice).toFixed(18) : '0',
          lowUsd: acesPrice ? (parseFloat(candle.low) * acesPrice).toFixed(18) : '0',
          closeUsd,
          volume: candle.volume,
          volumeUsd: acesPrice ? (volumeAces * acesPrice).toFixed(2) : '0',
          trades: candle.trades,
          dataSource: 'bonding_curve' as const,
          circulatingSupply: candle.circulatingSupply || '0',
          totalSupply: '30000000',
          marketCapAces,
          marketCapUsd,
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

    // Calculate market cap - prioritize stored values, but calculate on-the-fly if missing
    let marketCapAces = dbCandle.marketCapAces;
    let marketCapUsd = dbCandle.marketCapUsd;

    // If market cap is missing but we have circulatingSupply, calculate it
    if (
      (!marketCapAces || marketCapAces === '0') &&
      dbCandle.circulatingSupply &&
      dbCandle.circulatingSupply !== '0'
    ) {
      const supply = parseFloat(dbCandle.circulatingSupply);
      const priceInAces = parseFloat(dbCandle.close);
      marketCapAces = (supply * priceInAces).toFixed(2);

      if (acesPrice) {
        marketCapUsd = (supply * priceInAces * acesPrice).toFixed(2);
      }

      console.log('[UnifiedChartData] 💡 Calculated market cap from supply:', {
        supply,
        priceInAces,
        marketCapAces,
        marketCapUsd,
        acesPrice,
      });
    }

    // If still missing, calculate from ACES market cap using current ACES price
    if (
      (!marketCapUsd || marketCapUsd === '0') &&
      marketCapAces &&
      marketCapAces !== '0' &&
      acesPrice
    ) {
      marketCapUsd = (parseFloat(marketCapAces) * acesPrice).toFixed(2);
    }

    // Default to '0' if still missing
    marketCapAces = marketCapAces || '0';
    marketCapUsd = marketCapUsd || '0';

    // DEBUG: Warn if we're returning zeros
    if (marketCapAces === '0' || marketCapUsd === '0') {
      console.warn('[UnifiedChartData] ⚠️ Market cap is zero for candle:', {
        timestamp: dbCandle.timestamp,
        circulatingSupply: dbCandle.circulatingSupply,
        marketCapAces: dbCandle.marketCapAces,
        marketCapUsd: dbCandle.marketCapUsd,
        close: dbCandle.close,
        hadSupply: !!dbCandle.circulatingSupply,
      });
    }

    return {
      timestamp: new Date(dbCandle.timestamp),
      open: dbCandle.open,
      high: dbCandle.high,
      low: dbCandle.low,
      close: dbCandle.close,
      openUsd:
        dbCandle.openUsd || (acesPrice ? (parseFloat(dbCandle.open) * acesPrice).toFixed(18) : '0'),
      highUsd:
        dbCandle.highUsd || (acesPrice ? (parseFloat(dbCandle.high) * acesPrice).toFixed(18) : '0'),
      lowUsd:
        dbCandle.lowUsd || (acesPrice ? (parseFloat(dbCandle.low) * acesPrice).toFixed(18) : '0'),
      closeUsd:
        dbCandle.closeUsd ||
        (acesPrice ? (parseFloat(dbCandle.close) * acesPrice).toFixed(18) : '0'),
      volume: dbCandle.volume,
      volumeUsd:
        dbCandle.volumeUsd ||
        (acesPrice ? (parseFloat(dbCandle.volume) * acesPrice).toFixed(2) : '0'),
      trades: dbCandle.trades,
      dataSource: dbCandle.dataSource || 'bonding_curve',
      circulatingSupply: dbCandle.circulatingSupply || '0',
      totalSupply: dbCandle.totalSupply || '30000000',
      marketCapAces,
      marketCapUsd,
    };
  }

  /**
   * Get DEX chart data
   */
  private async getDexChartData(
    tokenAddress: string,
    poolAddress: string,
    options: ChartDataOptions,
    acesUsdPriceHint: string | null,
  ): Promise<{ candles: UnifiedCandle[]; acesUsdPrice: string | null }> {
    let candleData: Awaited<ReturnType<BitQueryService['getOHLCCandles']>> = [];
    try {
      candleData = await this.bitQueryService.getOHLCCandles(
        tokenAddress,
        poolAddress,
        options.timeframe,
        {
          from: options.from,
          to: options.to,
        },
      );
    } catch (error) {
      if (error instanceof BitQueryPaymentRequiredError) {
        console.warn(
          '[UnifiedChartData] BitQuery payment required while fetching candles – returning empty dataset.',
        );
        return {
          candles: [],
          acesUsdPrice: acesUsdPriceHint,
        };
      }
      throw error;
    }

    if (candleData.length === 0) {
      return {
        candles: [],
        acesUsdPrice: acesUsdPriceHint,
      };
    }

    const timeframeMs = this.getIntervalMs(options.timeframe);
    const toDate = options.to ?? new Date();
    const fromDate =
      options.from ??
      (candleData.length > 0
        ? candleData[0].timestamp
        : new Date(toDate.getTime() - timeframeMs * 12));

    let acesUsdLookup: Map<number, number> | null = null;
    let latestSeriesPrice: number | null = null;

    if (options.includeUsd !== false && candleData.length > 0) {
      const series = await this.getAcesUsdSeries(options.timeframe, {
        from: new Date(fromDate.getTime() - timeframeMs),
        to: new Date(toDate.getTime() + timeframeMs),
      });
      acesUsdLookup = series.map;
      latestSeriesPrice = series.lastPrice;
    }

    // Get circulating supply from subgraph (tokens that bonded have fixed supply)
    let circulatingSupply = '0';
    let totalSupply = '30000000';

    try {
      const tokenData = await this.tokenService.fetchFromSubgraph(tokenAddress);
      if (tokenData?.data?.tokens?.[0]) {
        circulatingSupply = tokenData.data.tokens[0].supply || '0';
        console.log(
          `[UnifiedChartData] Got supply from subgraph for ${tokenAddress}: ${circulatingSupply}`,
        );
      }
    } catch (error) {
      console.warn('[UnifiedChartData] Failed to get supply from subgraph:', error);
    }

    const fallbackAcesUsd =
      latestSeriesPrice && Number.isFinite(latestSeriesPrice) && latestSeriesPrice > 0
        ? latestSeriesPrice
        : acesUsdPriceHint
            ? parseFloat(acesUsdPriceHint)
            : null;

    const alignTime = (date: Date) => Math.floor(date.getTime() / timeframeMs) * timeframeMs;
    let lastKnownMultiplier =
      latestSeriesPrice && Number.isFinite(latestSeriesPrice) && latestSeriesPrice > 0
        ? latestSeriesPrice
        : fallbackAcesUsd;

    const resolvedCandles: UnifiedCandle[] = candleData.map((candle) => {
      const aligned = alignTime(candle.timestamp);
      const seriesMultiplier = acesUsdLookup?.get(aligned);

      let priceMultiplier = Number.isFinite(seriesMultiplier ?? NaN) && (seriesMultiplier ?? 0) > 0
        ? (seriesMultiplier as number)
        : lastKnownMultiplier && Number.isFinite(lastKnownMultiplier) && lastKnownMultiplier > 0
          ? lastKnownMultiplier
          : fallbackAcesUsd;

      if (!priceMultiplier || !Number.isFinite(priceMultiplier) || priceMultiplier <= 0) {
        priceMultiplier = null;
      } else {
        lastKnownMultiplier = priceMultiplier;
      }

      const openAces = parseFloat(candle.open);
      const highAces = parseFloat(candle.high);
      const lowAces = parseFloat(candle.low);
      const closeAces = parseFloat(candle.close);
      const volumeBase = parseFloat(candle.volume);

      const openUsd = priceMultiplier && Number.isFinite(openAces)
        ? (openAces * priceMultiplier).toFixed(18)
        : '0';
      const highUsd = priceMultiplier && Number.isFinite(highAces)
        ? (highAces * priceMultiplier).toFixed(18)
        : '0';
      const lowUsd = priceMultiplier && Number.isFinite(lowAces)
        ? (lowAces * priceMultiplier).toFixed(18)
        : '0';
      const closeUsdNumber =
        priceMultiplier && Number.isFinite(closeAces) ? closeAces * priceMultiplier : 0;
      const closeUsd =
        priceMultiplier && Number.isFinite(closeAces)
          ? closeUsdNumber.toFixed(18)
          : '0';

      const volumeUsd =
        priceMultiplier &&
        Number.isFinite(volumeBase) &&
        Number.isFinite(closeUsdNumber) &&
        closeUsdNumber > 0
          ? (volumeBase * closeUsdNumber).toFixed(2)
          : '0';

      // Calculate market cap from supply * price
      const supply = parseFloat(circulatingSupply);
      const marketCapAces =
        supply > 0 && Number.isFinite(closeAces) && closeAces > 0
          ? (supply * closeAces).toFixed(2)
          : '0';

      const marketCapUsd =
        supply > 0 && closeUsdNumber > 0
          ? (supply * closeUsdNumber).toFixed(2)
          : '0';

      return {
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        openUsd,
        highUsd,
        lowUsd,
        closeUsd,
        volume: candle.volume,
        volumeUsd,
        trades: candle.trades,
        dataSource: 'dex' as const,
        circulatingSupply,
        totalSupply,
        marketCapAces,
        marketCapUsd,
      };
    });

    const resolvedAcesUsd =
      lastKnownMultiplier && Number.isFinite(lastKnownMultiplier) && lastKnownMultiplier > 0
        ? lastKnownMultiplier
        : fallbackAcesUsd && Number.isFinite(fallbackAcesUsd) && fallbackAcesUsd > 0
          ? fallbackAcesUsd
          : null;

    return {
      candles: resolvedCandles,
      acesUsdPrice: resolvedAcesUsd ? resolvedAcesUsd.toFixed(6) : null,
    };
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
      openUsd: acesPrice ? (parseFloat(latestCandle.open) * acesPrice).toFixed(18) : '0',
      highUsd: acesPrice ? (parseFloat(latestCandle.high) * acesPrice).toFixed(18) : '0',
      lowUsd: acesPrice ? (parseFloat(latestCandle.low) * acesPrice).toFixed(18) : '0',
      closeUsd: acesPrice ? (parseFloat(latestCandle.close) * acesPrice).toFixed(18) : '0',
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
    let swaps: Awaited<ReturnType<BitQueryService['getRecentSwaps']>> = [];
    try {
      swaps = await this.bitQueryService.getRecentSwaps(tokenAddress, poolAddress, {
        limit: 100,
      });
    } catch (error) {
      if (error instanceof BitQueryPaymentRequiredError) {
        console.warn(
          '[UnifiedChartData] BitQuery payment required while fetching recent swaps – skipping latest DEX candle update.',
        );
        return null;
      }
      throw error;
    }

    if (swaps.length === 0) return null;

    // Build candle from recent swaps
    const latestSwap = swaps[0];
    const intervalMs = this.getIntervalMs(timeframe);
    const candleStart = Math.floor(latestSwap.blockTime.getTime() / intervalMs) * intervalMs;

    const candleSwaps = swaps.filter((swap) => swap.blockTime.getTime() >= candleStart);

    const prices = candleSwaps.map((s) => parseFloat(s.priceInAces));

    let priceMultiplier: number | null = null;
    try {
      const series = await this.getAcesUsdSeries(timeframe, {
        from: new Date(candleStart - intervalMs),
        to: new Date(candleStart + intervalMs * 2),
      });
      priceMultiplier = series.map.get(candleStart) ?? series.lastPrice ?? null;
    } catch (error) {
      console.warn('[UnifiedChartData] Failed to build ACES/USD series for latest candle:', error);
    }

    if (!priceMultiplier || !Number.isFinite(priceMultiplier) || priceMultiplier <= 0) {
      try {
        const priceResult = await this.acesUsdPriceService.getAcesUsdPrice();
        const parsed = parseFloat(priceResult.price);
        if (Number.isFinite(parsed) && parsed > 0) {
          priceMultiplier = parsed;
        }
      } catch (error) {
        console.warn('[UnifiedChartData] ACES/USD price fallback failed:', error);
      }
    }

    const pricesUsd = candleSwaps.map((s) => {
      const acesPrice = parseFloat(s.priceInAces);
      if (!priceMultiplier || !Number.isFinite(acesPrice) || !Number.isFinite(priceMultiplier)) {
        return 0;
      }
      return acesPrice * priceMultiplier;
    });

    // Get circulating supply from subgraph
    let circulatingSupply = '0';
    let totalSupply = '30000000';

    try {
      const tokenData = await this.tokenService.fetchFromSubgraph(tokenAddress);
      if (tokenData?.data?.tokens?.[0]) {
        circulatingSupply = tokenData.data.tokens[0].supply || '0';
      }
    } catch (error) {
      console.warn('[UnifiedChartData] Failed to get supply for latest DEX candle:', error);
    }

    const finitePrices = prices.filter((val) => Number.isFinite(val) && val > 0);
    if (finitePrices.length === 0) {
      return null;
    }

    const openPriceValue = Number.isFinite(prices[prices.length - 1])
      ? prices[prices.length - 1]
      : finitePrices[finitePrices.length - 1];
    const closePriceValue = Number.isFinite(prices[0]) ? prices[0] : finitePrices[0];
    const highPriceValue = Math.max(...finitePrices);
    const lowPriceValue = Math.min(...finitePrices);

    const finiteUsdPrices = pricesUsd.filter((val) => Number.isFinite(val) && val > 0);
    const openUsdValue =
      priceMultiplier && Number.isFinite(pricesUsd[pricesUsd.length - 1])
        ? pricesUsd[pricesUsd.length - 1]
        : finiteUsdPrices[finiteUsdPrices.length - 1] ?? 0;
    const closeUsdValue =
      priceMultiplier && Number.isFinite(pricesUsd[0])
        ? pricesUsd[0]
        : finiteUsdPrices[0] ?? 0;
    const highUsdValue =
      finiteUsdPrices.length > 0 ? Math.max(...finiteUsdPrices) : closeUsdValue;
    const lowUsdValue =
      finiteUsdPrices.length > 0 ? Math.min(...finiteUsdPrices) : closeUsdValue;

    // Calculate market cap
    const supply = parseFloat(circulatingSupply);

    const marketCapAces =
      supply > 0 && Number.isFinite(closePriceValue) && closePriceValue > 0
        ? (supply * closePriceValue).toFixed(2)
        : '0';

    const marketCapUsd =
      supply > 0 && closeUsdValue > 0 ? (supply * closeUsdValue).toFixed(2) : '0';

    return {
      timestamp: new Date(candleStart),
      open: openPriceValue.toString(),
      high: highPriceValue.toString(),
      low: lowPriceValue.toString(),
      close: closePriceValue.toString(),
      openUsd: priceMultiplier ? openUsdValue.toFixed(18) : '0',
      highUsd: priceMultiplier ? highUsdValue.toFixed(18) : '0',
      lowUsd: priceMultiplier ? lowUsdValue.toFixed(18) : '0',
      closeUsd: priceMultiplier ? closeUsdValue.toFixed(18) : '0',
      volume: candleSwaps.reduce((sum, s) => sum + parseFloat(s.amountAces), 0).toString(),
      volumeUsd: candleSwaps
        .reduce((sum, s, idx) => {
          const amountToken = parseFloat(s.amountToken);
          const usdPrice = pricesUsd[idx];
          if (!Number.isFinite(amountToken) || amountToken <= 0 || usdPrice <= 0) {
            return sum;
          }
          return sum + amountToken * usdPrice;
        }, 0)
        .toFixed(2),
      trades: candleSwaps.length,
      dataSource: 'dex',
      circulatingSupply,
      totalSupply,
      marketCapAces,
      marketCapUsd,
    };
  }

  /**
   * Build a map of ACES→USD prices by timeframe bucket using ACES/WETH and WETH/USDC candles.
   */
  private async getAcesUsdSeries(
    timeframe: string,
    range: { from: Date; to: Date },
  ): Promise<{ map: Map<number, number>; lastPrice: number | null }> {
    if (!ACES_WETH_POOL_ADDRESS || !WETH_USDC_POOL_ADDRESS) {
      console.warn(
        '[UnifiedChartData] Missing ACES/WETH or WETH/USDC pool address env vars – USD conversion disabled.',
      );
      return { map: new Map(), lastPrice: null };
    }

    const timeframeMs = this.getIntervalMs(timeframe);
    const align = (date: Date) => Math.floor(date.getTime() / timeframeMs) * timeframeMs;
    const alignedFrom = align(range.from);
    const alignedTo = align(range.to);
    const cacheKey = timeframe.toLowerCase();
    const now = Date.now();

    const cachedEntry = this.acesUsdSeriesCache.get(cacheKey);
    if (
      cachedEntry &&
      now < cachedEntry.expiresAt &&
      alignedFrom >= cachedEntry.minTimestamp &&
      alignedTo <= cachedEntry.maxTimestamp
    ) {
      return { map: cachedEntry.map, lastPrice: cachedEntry.lastPrice };
    }

    try {
      const [acesWethCandles, wethUsdCandles] = await Promise.all([
        this.bitQueryService.getOHLCCandles(ACES_TOKEN_ADDRESS, ACES_WETH_POOL_ADDRESS, timeframe, {
          from: range.from,
          to: range.to,
          counterTokenAddress: WETH_TOKEN_ADDRESS,
        }),
        this.bitQueryService.getOHLCCandles(WETH_TOKEN_ADDRESS, WETH_USDC_POOL_ADDRESS, timeframe, {
          from: range.from,
          to: range.to,
          counterTokenAddress: USDC_TOKEN_ADDRESS,
        }),
      ]);

      const acesWethMap = new Map<number, number>();
      for (const candle of acesWethCandles) {
        const price = parseFloat(candle.close);
        if (!Number.isFinite(price) || price <= 0) continue;
        acesWethMap.set(align(candle.timestamp), price);
      }

      const wethUsdMap = new Map<number, number>();
      for (const candle of wethUsdCandles) {
        const price = parseFloat(candle.close);
        if (!Number.isFinite(price) || price <= 0) continue;
        wethUsdMap.set(align(candle.timestamp), price);
      }

      const sortedAcesTimes = Array.from(acesWethMap.keys()).sort((a, b) => a - b);
      const sortedWethTimes = Array.from(wethUsdMap.keys()).sort((a, b) => a - b);

      const mergedMap = new Map<number, number>(cachedEntry?.map ?? []);
      let wethIndex = 0;
      let lastWethUsd: number | null = null;

      for (const time of sortedAcesTimes) {
        while (wethIndex < sortedWethTimes.length && sortedWethTimes[wethIndex] <= time) {
          const candidate = wethUsdMap.get(sortedWethTimes[wethIndex]) ?? null;
          if (candidate && Number.isFinite(candidate) && candidate > 0) {
            lastWethUsd = candidate;
          }
          wethIndex += 1;
        }

        if (!lastWethUsd || !Number.isFinite(lastWethUsd) || lastWethUsd <= 0) {
          continue;
        }

        const acesWeth = acesWethMap.get(time);
        if (!acesWeth || !Number.isFinite(acesWeth) || acesWeth <= 0) {
          continue;
        }

        mergedMap.set(time, acesWeth * lastWethUsd);
      }

      if (mergedMap.size === 0) {
        if (cachedEntry) {
          cachedEntry.expiresAt = now + this.acesUsdSeriesCacheTtlMs;
          this.acesUsdSeriesCache.set(cacheKey, cachedEntry);
          return { map: cachedEntry.map, lastPrice: cachedEntry.lastPrice };
        }
        return { map: new Map(), lastPrice: null };
      }

      const sortedKeys = Array.from(mergedMap.keys()).sort((a, b) => a - b);

      // Prune to keep cache size reasonable
      const MAX_ENTRIES = 500;
      if (sortedKeys.length > MAX_ENTRIES) {
        const removeCount = sortedKeys.length - MAX_ENTRIES;
        for (let i = 0; i < removeCount; i++) {
          mergedMap.delete(sortedKeys[i]);
        }
      }

      const updatedKeys = Array.from(mergedMap.keys()).sort((a, b) => a - b);
      const minTimestamp = updatedKeys[0];
      const maxTimestamp = updatedKeys[updatedKeys.length - 1];
      const lastPrice = mergedMap.get(maxTimestamp) ?? lastWethUsd ?? null;

      const refreshedAt = Date.now();
      const newEntry: AcesUsdSeriesCacheEntry = {
        map: mergedMap,
        lastPrice,
        minTimestamp,
        maxTimestamp,
        expiresAt: refreshedAt + this.acesUsdSeriesCacheTtlMs,
      };

      this.acesUsdSeriesCache.set(cacheKey, newEntry);

      return { map: mergedMap, lastPrice };
    } catch (error) {
      console.warn('[UnifiedChartData] Failed to fetch ACES/USD series:', error);
      if (cachedEntry) {
        cachedEntry.expiresAt = Date.now() + this.acesUsdSeriesCacheTtlMs;
        this.acesUsdSeriesCache.set(cacheKey, cachedEntry);
        return { map: cachedEntry.map, lastPrice: cachedEntry.lastPrice };
      }
      return { map: new Map(), lastPrice: null };
    }
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
