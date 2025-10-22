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
  AERODROME_ACES_WETH_POOL,
  USDC_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WETH_USDC_POOL,
} from '../config/bitquery.config';

interface MarketCapOhlc {
  open: string;
  high: string;
  low: string;
  close: string;
}

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
  dataSource: 'bonding_curve' | 'dex' | 'graduation';
  circulatingSupply?: string;
  totalSupply?: string;
  marketCapAces?: string;
  marketCapUsd?: string;
  marketCapOhlcAces?: MarketCapOhlc;
  marketCapOhlcUsd?: MarketCapOhlc;
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
  private lastDexUsdPrice = new Map<string, number>();

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

        candles = this.mergeCandles(bondingCandles, candles, graduationState.dexLiveAt);
      }
    } else {
      // Token is still in bonding curve
      candles = await this.getBondingChartData(normalizedAddress, options, acesUsdPrice);
    }

    // Store candles to database (async, non-blocking) with actual timeframe
    this.storeCandlesAsync(normalizedAddress, options.timeframe, candles).catch((err) => {
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

        // 🔧 CHECK IF USD PRICES ARE VALID (not 0 or suspiciously ACES prices)
        const hasValidUsdPrices =
          options.includeUsd !== false &&
          acesUsdPrice &&
          parseFloat(acesUsdPrice) > 0 &&
          dbCandles[0].closeUsd &&
          dbCandles[0].closeUsd !== '0';

        // Check if USD price looks like it's actually an ACES price (> 0.01)
        const usdLooksWrong = hasValidUsdPrices && parseFloat(dbCandles[0].closeUsd || '0') > 0.01;

        if (!hasSupplyData) {
          // Fall through to generate fresh candles with supply data
        } else if (!hasValidUsdPrices || usdLooksWrong) {
          // Fall through to generate fresh candles with correct USD prices
        } else {
          // 🔧 CHECK IF CACHE IS STALE
          // For bonding curve tokens, cache should be fresh (< 10 seconds old)
          // to show recent trades immediately
          const latestCandle = dbCandles[dbCandles.length - 1];
          const latestCandleTime = new Date(latestCandle.timestamp).getTime();
          const now = Date.now();
          const cacheAgeMs = now - latestCandleTime;
          const maxCacheAgeMs = 10000; // 10 seconds

          if (cacheAgeMs > maxCacheAgeMs) {
            // Fall through to generate fresh candles
          } else {
            const converted = dbCandles.map((candle) =>
              this.convertDbCandleToUnified(candle, acesUsdPrice),
            );
            return converted;
          }
        }
      }

      // FALLBACK: Generate from supply-based service (real-time calculation)
      // Request latest candles (frontend windows by range)
      const candles = await this.supplyBasedOHLCVService.getCandles(
        tokenAddress,
        options.timeframe as any,
        3000,
      );

      // Parse ACES/USD price once for consistent usage
      const parsedAcesPrice = acesUsdPrice ? parseFloat(acesUsdPrice) : null;

      // 🔧 TEMPORARILY DISABLED: BitQuery series cache can have wrong conversion rates
      // Using spot price for all candles until we fix the series calculation
      // Build an ACES/USD series aligned to timeframe buckets for per-bucket conversion
      const acesUsdSeries: { map: Map<number, number>; lastPrice: number | null } = {
        map: new Map(),
        lastPrice: parsedAcesPrice, // Use current spot price for all candles
      };

      const alignToBucket = (date: Date) => {
        const ms = this.getIntervalMs(options.timeframe);
        return Math.floor(date.getTime() / ms) * ms;
      };

      // Convert to unified format with per-bucket USD values
      const unified = candles.map((candle, index) => {
        let openAces = parseFloat(candle.open);
        let highAces = parseFloat(candle.high);
        let lowAces = parseFloat(candle.low);
        let closeAces = parseFloat(candle.close);
        const volumeAces = parseFloat(candle.volume);
        const supply = candle.circulatingSupply ? parseFloat(candle.circulatingSupply) : 0;

        // Validate and fix high/low values to prevent zero or invalid values
        if (!Number.isFinite(highAces) || highAces <= 0) {
          highAces = Math.max(openAces, closeAces);
          console.warn('[UnifiedChartData] Invalid high value, using max(open, close):', {
            original: candle.high,
            fixed: highAces,
          });
        }

        if (!Number.isFinite(lowAces) || lowAces <= 0) {
          lowAces = Math.min(openAces, closeAces);
          console.warn('[UnifiedChartData] Invalid low value, using min(open, close):', {
            original: candle.low,
            fixed: lowAces,
          });
        }

        // Ensure high >= low
        if (highAces < lowAces) {
          [highAces, lowAces] = [lowAces, highAces];
          console.warn('[UnifiedChartData] Swapped high/low values to ensure high >= low');
        }

        // Determine per-bucket ACES/USD (prefer series value at bucket start; fallback to lastPrice or spot)
        const bucketTs = alignToBucket(candle.timestamp);
        let bucketAcesUsd =
          acesUsdSeries.map.get(bucketTs) ?? acesUsdSeries.lastPrice ?? parsedAcesPrice;

        const openUsd = bucketAcesUsd ? (openAces * bucketAcesUsd).toFixed(18) : '0';
        const highUsd = bucketAcesUsd ? (highAces * bucketAcesUsd).toFixed(18) : '0';
        const lowUsd = bucketAcesUsd ? (lowAces * bucketAcesUsd).toFixed(18) : '0';
        const closeUsd = bucketAcesUsd ? (closeAces * bucketAcesUsd).toFixed(18) : '0';

        // Calculate market cap using circulating supply
        const marketCapAces = supply > 0 ? (supply * closeAces).toFixed(2) : '0';
        const marketCapUsd =
          supply > 0 && parsedAcesPrice ? (supply * closeAces * parsedAcesPrice).toFixed(2) : '0';

        // Calculate full market cap OHLC (price OHLC × supply)
        const mcapOpenAces = supply > 0 ? supply * openAces : 0;
        const mcapHighAces = supply > 0 ? supply * highAces : 0;
        const mcapLowAces = supply > 0 ? supply * lowAces : 0;
        const mcapCloseAces = supply > 0 ? supply * closeAces : 0;

        const marketCapOhlcAces: MarketCapOhlc | undefined =
          supply > 0
            ? {
                open: mcapOpenAces.toFixed(2),
                high: mcapHighAces.toFixed(2),
                low: mcapLowAces.toFixed(2),
                close: mcapCloseAces.toFixed(2),
              }
            : undefined;

        const marketCapOhlcUsd: MarketCapOhlc | undefined =
          supply > 0 && parsedAcesPrice
            ? {
                open: (mcapOpenAces * parsedAcesPrice).toFixed(2),
                high: (mcapHighAces * parsedAcesPrice).toFixed(2),
                low: (mcapLowAces * parsedAcesPrice).toFixed(2),
                close: (mcapCloseAces * parsedAcesPrice).toFixed(2),
              }
            : undefined;

        return {
          timestamp: candle.timestamp,
          open: openAces.toString(),
          high: highAces.toString(),
          low: lowAces.toString(),
          close: closeAces.toString(),
          openUsd,
          highUsd,
          lowUsd,
          closeUsd,
          volume: candle.volume,
          volumeUsd: parsedAcesPrice ? (volumeAces * parsedAcesPrice).toFixed(2) : '0',
          trades: candle.trades,
          dataSource: 'bonding_curve' as const,
          circulatingSupply: candle.circulatingSupply || '0',
          totalSupply: '30000000',
          marketCapAces,
          marketCapUsd,
          marketCapOhlcAces,
          marketCapOhlcUsd,
        };
      });

      // Bridge candle opens to previous close to produce bodies when price changed within bucket
      if (unified.length > 1) {
        for (let i = 1; i < unified.length; i++) {
          const prev = unified[i - 1];
          const curr = unified[i];

          const prevCloseAces = parseFloat(prev.close);
          const currCloseAces = parseFloat(curr.close);
          const prevBucketTs = alignToBucket(prev.timestamp as unknown as Date);
          const prevBucketAcesUsd =
            acesUsdSeries.map.get(prevBucketTs) ?? acesUsdSeries.lastPrice ?? parsedAcesPrice;
          const prevCloseUsd = prevBucketAcesUsd ? prevCloseAces * prevBucketAcesUsd : 0;

          // Update open to previous close
          curr.open = prevCloseAces.toString();
          curr.openUsd = parsedAcesPrice ? prevCloseUsd.toFixed(18) : '0';

          // Adjust high/low to include previous close
          const currHighAces = Math.max(parseFloat(curr.high), prevCloseAces, currCloseAces);
          const currLowAces = Math.min(parseFloat(curr.low), prevCloseAces, currCloseAces);
          curr.high = currHighAces.toString();
          curr.low = currLowAces.toString();

          // Adjust USD highs/lows using available USD values and bridged prevCloseUsd
          if (prevCloseUsd > 0) {
            const currHighUsd = Math.max(
              parseFloat(curr.highUsd),
              prevCloseUsd,
              parseFloat(curr.closeUsd),
            );
            const currLowUsd = Math.min(
              parseFloat(curr.lowUsd),
              prevCloseUsd,
              parseFloat(curr.closeUsd),
            );
            curr.highUsd = currHighUsd.toFixed(18);
            curr.lowUsd = currLowUsd.toFixed(18);
          }
        }
      }

      return unified;
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

    // Validate and fix OHLC values from database
    let openVal = parseFloat(dbCandle.open);
    let highVal = parseFloat(dbCandle.high);
    let lowVal = parseFloat(dbCandle.low);
    let closeVal = parseFloat(dbCandle.close);

    if (!Number.isFinite(highVal) || highVal <= 0) {
      highVal = Math.max(openVal, closeVal);
      console.warn('[UnifiedChartData] DB candle has invalid high, fixing:', {
        timestamp: dbCandle.timestamp,
        original: dbCandle.high,
        fixed: highVal,
      });
    }

    if (!Number.isFinite(lowVal) || lowVal <= 0) {
      lowVal = Math.min(openVal, closeVal);
      console.warn('[UnifiedChartData] DB candle has invalid low, fixing:', {
        timestamp: dbCandle.timestamp,
        original: dbCandle.low,
        fixed: lowVal,
      });
    }

    if (highVal < lowVal) {
      [highVal, lowVal] = [lowVal, highVal];
    }

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
      open: openVal.toString(),
      high: highVal.toString(),
      low: lowVal.toString(),
      close: closeVal.toString(),
      openUsd: dbCandle.openUsd || (acesPrice ? (openVal * acesPrice).toFixed(18) : '0'),
      highUsd: dbCandle.highUsd || (acesPrice ? (highVal * acesPrice).toFixed(18) : '0'),
      lowUsd: dbCandle.lowUsd || (acesPrice ? (lowVal * acesPrice).toFixed(18) : '0'),
      closeUsd: dbCandle.closeUsd || (acesPrice ? (closeVal * acesPrice).toFixed(18) : '0'),
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
   * Get DEX chart data - refactored to match subgraph pattern
   * Fetches individual trades and aggregates them into candles
   */
  private async getDexChartData(
    tokenAddress: string,
    poolAddress: string,
    options: ChartDataOptions,
    acesUsdPriceHint: string | null,
  ): Promise<{ candles: UnifiedCandle[]; acesUsdPrice: string | null }> {
    try {
      console.log('[UnifiedChartData] Fetching individual DEX trades for aggregation...');

      // Fetch individual trades (not pre-aggregated candles)
      const trades = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
        from: options.from,
        to: options.to,
        counterTokenAddress: ACES_TOKEN_ADDRESS,
        limit: 10000, // Get enough trades to cover the requested timeframe
      });

      console.log(
        `[UnifiedChartData] Received ${trades.length} individual DEX trades, aggregating into ${options.timeframe} candles...`,
      );

      if (trades.length === 0) {
        console.warn('[UnifiedChartData] No DEX trades found for this token');
        return {
          candles: [],
          acesUsdPrice: acesUsdPriceHint,
        };
      }

      // Aggregate trades into candles using SAME pattern as bonding curve
      const candles = this.aggregateDexTradesToCandles(trades, options.timeframe);

      console.log(
        `[UnifiedChartData] ✅ Aggregated ${trades.length} trades into ${candles.length} candles`,
      );

      // Get latest price for market cap calculation
      let latestPriceUsd: number | null = null;
      let marketCapUsd: string | null = null;

      try {
        latestPriceUsd = await this.bitQueryService.getLatestPriceUSD(tokenAddress);
        if (latestPriceUsd) {
          marketCapUsd = this.bitQueryService.calculateMarketCap(latestPriceUsd);
        }
      } catch (error) {
        console.warn('[UnifiedChartData] Failed to get latest price for market cap:', error);
      }

      // Get total supply for graduated token (all 1B tokens minted at graduation)
      // For DEX tokens, supply is fixed at 1B since all tokens are minted upon graduation
      const totalSupply = 1000000000;

      // Convert to UnifiedCandle format with market cap OHLC
      const resolvedCandles: UnifiedCandle[] = candles.map((candle) => {
        const supply = totalSupply; // Use total supply for all DEX candles
        const parsedAcesPrice = acesUsdPriceHint ? parseFloat(acesUsdPriceHint) : null;

        // Price OHLC (already in USD from DEX)
        const openUsd = parseFloat(candle.openUsd);
        const highUsd = parseFloat(candle.highUsd);
        const lowUsd = parseFloat(candle.lowUsd);
        const closeUsd = parseFloat(candle.closeUsd);

        // Market Cap OHLC (price × supply)
        const mcapOpenUsd = supply * openUsd;
        const mcapHighUsd = supply * highUsd;
        const mcapLowUsd = supply * lowUsd;
        const mcapCloseUsd = supply * closeUsd;

        const marketCapOhlcUsd: MarketCapOhlc = {
          open: mcapOpenUsd.toFixed(2),
          high: mcapHighUsd.toFixed(2),
          low: mcapLowUsd.toFixed(2),
          close: mcapCloseUsd.toFixed(2),
        };

        // Calculate ACES market cap OHLC if we have ACES price
        const marketCapOhlcAces: MarketCapOhlc | undefined = parsedAcesPrice
          ? {
              open: (mcapOpenUsd / parsedAcesPrice).toFixed(2),
              high: (mcapHighUsd / parsedAcesPrice).toFixed(2),
              low: (mcapLowUsd / parsedAcesPrice).toFixed(2),
              close: (mcapCloseUsd / parsedAcesPrice).toFixed(2),
            }
          : undefined;

        return {
          ...candle,
          dataSource: 'dex' as const,
          circulatingSupply: supply.toString(),
          totalSupply: supply.toString(),
          marketCapAces: marketCapOhlcAces?.close,
          marketCapUsd: marketCapOhlcUsd.close,
          marketCapOhlcAces,
          marketCapOhlcUsd,
        };
      });

      return {
        candles: resolvedCandles,
        acesUsdPrice: acesUsdPriceHint,
      };
    } catch (error) {
      if (error instanceof BitQueryPaymentRequiredError) {
        console.warn(
          '[UnifiedChartData] BitQuery payment required while fetching trades – returning empty dataset.',
        );
        return {
          candles: [],
          acesUsdPrice: acesUsdPriceHint,
        };
      }
      throw error;
    }
  }

  /**
   * Aggregate individual DEX trades into candles
   * Uses SAME pattern as SupplyBasedOHLCVService.aggregateTradesToCandles()
   */
  private aggregateDexTradesToCandles(
    trades: Array<{
      blockTime: Date;
      priceInUsd: string;
      amountToken: string;
      volumeUsd: string;
    }>,
    timeframe: string,
  ): Array<{
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
  }> {
    const intervalMs = this.getIntervalMs(timeframe);
    const candleMap = new Map<
      number,
      {
        pricesUsd: number[];
        volumes: number[];
        volumesUsd: number[];
        timestamps: number[];
      }
    >();

    // Group trades by candle period
    for (const trade of trades) {
      const timestamp = trade.blockTime.getTime();
      const candleTimestamp = Math.floor(timestamp / intervalMs) * intervalMs;

      const priceUsd = parseFloat(trade.priceInUsd);
      const volume = parseFloat(trade.amountToken);
      const volumeUsd = parseFloat(trade.volumeUsd);

      if (!candleMap.has(candleTimestamp)) {
        candleMap.set(candleTimestamp, {
          pricesUsd: [],
          volumes: [],
          volumesUsd: [],
          timestamps: [],
        });
      }

      const candle = candleMap.get(candleTimestamp)!;
      candle.pricesUsd.push(priceUsd);
      candle.volumes.push(volume);
      candle.volumesUsd.push(volumeUsd);
      candle.timestamps.push(timestamp);
    }

    // Convert to OHLCV candles
    const candles: Array<{
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
    }> = [];

    for (const [timestamp, data] of candleMap.entries()) {
      if (data.pricesUsd.length === 0) continue;

      // Sort by timestamp to get correct open/close
      const sorted = data.pricesUsd
        .map((price, i) => ({
          price,
          volume: data.volumes[i],
          volumeUsd: data.volumesUsd[i],
          timestamp: data.timestamps[i],
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      const prices = sorted.map((s) => s.price);
      const open = prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const volume = data.volumes.reduce((sum, v) => sum + v, 0);
      const volumeUsd = data.volumesUsd.reduce((sum, v) => sum + v, 0);

      candles.push({
        timestamp: new Date(timestamp),
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        openUsd: open.toFixed(18),
        highUsd: high.toFixed(18),
        lowUsd: low.toFixed(18),
        closeUsd: close.toFixed(18),
        volume: volume.toString(),
        volumeUsd: volumeUsd.toFixed(2),
        trades: data.pricesUsd.length,
      });
    }

    // Sort by timestamp ascending
    return candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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
      100,
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

    // Validate and fix high/low values
    let openVal = parseFloat(latestCandle.open);
    let highVal = parseFloat(latestCandle.high);
    let lowVal = parseFloat(latestCandle.low);
    let closeVal = parseFloat(latestCandle.close);

    if (!Number.isFinite(highVal) || highVal <= 0) {
      highVal = Math.max(openVal, closeVal);
      console.warn('[UnifiedChartData] Latest candle has invalid high, using max(open, close)');
    }

    if (!Number.isFinite(lowVal) || lowVal <= 0) {
      lowVal = Math.min(openVal, closeVal);
      console.warn('[UnifiedChartData] Latest candle has invalid low, using min(open, close)');
    }

    if (highVal < lowVal) {
      [highVal, lowVal] = [lowVal, highVal];
    }

    // 🔧 CRITICAL FIX: When ACES/USD price fetch fails, try to get fallback USD values from database
    // This prevents WebSocket updates from breaking the chart by sending '0' USD values
    let openUsd: string;
    let highUsd: string;
    let lowUsd: string;
    let closeUsd: string;
    let volumeUsd: string;

    if (acesPrice && acesPrice > 0) {
      // Normal path: calculate USD from ACES price
      openUsd = (openVal * acesPrice).toFixed(18);
      highUsd = (highVal * acesPrice).toFixed(18);
      lowUsd = (lowVal * acesPrice).toFixed(18);
      closeUsd = (closeVal * acesPrice).toFixed(18);
      volumeUsd = (parseFloat(latestCandle.volume) * acesPrice).toFixed(2);
    } else {
      // Fallback: Try to get USD values from database candle for this timeframe
      console.warn(
        '[UnifiedChartData] ACES/USD price unavailable, attempting to use cached DB candle for USD values...',
      );
      try {
        const dbCandles = await this.getCachedCandles(tokenAddress, timeframe);
        const latestDbCandle = dbCandles.length > 0 ? dbCandles[dbCandles.length - 1] : null;

        // 🔧 Validate cached USD prices (check if they're suspiciously high = ACES not USD)
        const cachedCloseUsd = latestDbCandle?.closeUsd ? parseFloat(latestDbCandle.closeUsd) : 0;
        const usdLooksWrong = cachedCloseUsd > 0.01; // USD prices should be very small (< 0.01)

        if (
          latestDbCandle &&
          latestDbCandle.closeUsd &&
          latestDbCandle.closeUsd !== '0' &&
          !usdLooksWrong
        ) {
          // Use database USD values which already have price conversion applied
          openUsd = latestDbCandle.openUsd || '0';
          highUsd = latestDbCandle.highUsd || '0';
          lowUsd = latestDbCandle.lowUsd || '0';
          closeUsd = latestDbCandle.closeUsd || '0';
          volumeUsd = latestDbCandle.volumeUsd || '0';
        } else {
          if (usdLooksWrong) {
            console.warn(
              '[UnifiedChartData] ⚠️ Cached USD price looks wrong (too high), rejecting:',
              cachedCloseUsd,
            );
          }
          // No valid cached USD values either
          console.warn('[UnifiedChartData] ⚠️ No cached USD values available, sending ACES only');
          openUsd = '0';
          highUsd = '0';
          lowUsd = '0';
          closeUsd = '0';
          volumeUsd = '0';
        }
      } catch (error) {
        console.warn('[UnifiedChartData] Failed to get cached candle for USD fallback:', error);
        // Send ACES values without USD
        openUsd = '0';
        highUsd = '0';
        lowUsd = '0';
        closeUsd = '0';
        volumeUsd = '0';
      }
    }

    return {
      timestamp: latestCandle.timestamp,
      open: openVal.toString(),
      high: highVal.toString(),
      low: lowVal.toString(),
      close: closeVal.toString(),
      openUsd,
      highUsd,
      lowUsd,
      closeUsd,
      volume: latestCandle.volume,
      volumeUsd,
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
    let swaps: Awaited<ReturnType<BitQueryService['getDexTrades']>> = [];
    try {
      const intervalMs = this.getIntervalMs(timeframe);
      const latestTo = new Date();
      const latestFrom = new Date(latestTo.getTime() - intervalMs * 2);
      swaps = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
        from: latestFrom,
        to: latestTo,
        counterTokenAddress: ACES_TOKEN_ADDRESS,
        limit: 200,
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
    const latestSwap = swaps[swaps.length - 1];
    const intervalMs = this.getIntervalMs(timeframe);
    const candleStart = Math.floor(latestSwap.blockTime.getTime() / intervalMs) * intervalMs;

    const candleSwaps = swaps.filter((swap) => swap.blockTime.getTime() >= candleStart);
    const cacheKey = `${tokenAddress.toLowerCase()}:${timeframe}`;

    // Use per-trade USD prices from DEXTradeByTokens normalization (accurate USD per token)
    let pricesUsd = candleSwaps.map((s) => parseFloat(s.priceInUsd));
    let usedFallback = false;

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

    let finiteUsdPrices = pricesUsd.filter((val) => Number.isFinite(val) && val > 0);
    if (finiteUsdPrices.length === 0) {
      // Fallback: derive USD prices from ACES price using spot ACES/USD
      let spotAcesUsd: number | null = null;
      try {
        const priceResult = await this.acesUsdPriceService.getAcesUsdPrice();
        const parsed = parseFloat(priceResult.price);
        if (Number.isFinite(parsed) && parsed > 0) {
          spotAcesUsd = parsed;
        }
      } catch (error) {
        console.warn(
          '[UnifiedChartData] Failed to fetch spot ACES/USD for realtime fallback:',
          error,
        );
      }

      if (spotAcesUsd && spotAcesUsd > 0) {
        pricesUsd = candleSwaps.map((s) => {
          const priceInAces = parseFloat(s.priceInAces);
          return Number.isFinite(priceInAces) && priceInAces > 0 ? priceInAces * spotAcesUsd! : 0;
        });
        finiteUsdPrices = pricesUsd.filter((val) => Number.isFinite(val) && val > 0);
        usedFallback = true;
      }

      if (finiteUsdPrices.length === 0) {
        const cachedPrice = this.lastDexUsdPrice.get(cacheKey);
        if (cachedPrice && cachedPrice > 0) {
          console.warn(
            '[UnifiedChartData] Using cached USD price for DEX candle fallback as BitQuery returned no USD values.',
            {
              tokenAddress,
              timeframe,
              cachedPrice,
              swapCount: candleSwaps.length,
            },
          );
          pricesUsd = candleSwaps.map(() => cachedPrice);
          finiteUsdPrices = [cachedPrice];
        } else {
          return null;
        }
      }
    }

    if (usedFallback) {
      const previousClose = this.lastDexUsdPrice.get(cacheKey);
      const candidateClose =
        pricesUsd[pricesUsd.length - 1] ?? finiteUsdPrices[finiteUsdPrices.length - 1] ?? 0;
      if (previousClose && previousClose > 0 && candidateClose > 0) {
        const ratio =
          candidateClose > previousClose
            ? candidateClose / previousClose
            : previousClose / candidateClose;
        if (ratio > 10) {
          console.warn(
            '[UnifiedChartData] Fallback USD price deviates too much, reverting to cached close.',
            {
              tokenAddress,
              timeframe,
              candidateClose,
              previousClose,
            },
          );
          pricesUsd = pricesUsd.map(() => previousClose);
          finiteUsdPrices = [previousClose];
        }
      }
    }

    // Determine OHLC in USD directly from per-trade USD prices
    const openUsdValue = Number.isFinite(pricesUsd[0]) ? pricesUsd[0] : finiteUsdPrices[0];
    const closeUsdValue = Number.isFinite(pricesUsd[pricesUsd.length - 1])
      ? pricesUsd[pricesUsd.length - 1]
      : finiteUsdPrices[finiteUsdPrices.length - 1];
    const highUsdValue = Math.max(...finiteUsdPrices);
    const lowUsdValue = Math.min(...finiteUsdPrices);

    // Calculate market cap
    const supply = parseFloat(circulatingSupply);

    const marketCapUsd =
      supply > 0 && closeUsdValue > 0 ? (supply * closeUsdValue).toFixed(2) : '0';

    if (closeUsdValue > 0) {
      this.lastDexUsdPrice.set(cacheKey, closeUsdValue);
    }

    return {
      timestamp: new Date(candleStart),
      // For DEX, use USD prices for both base OHLC and USD OHLC to match historical path
      open: openUsdValue.toString(),
      high: highUsdValue.toString(),
      low: lowUsdValue.toString(),
      close: closeUsdValue.toString(),
      openUsd: openUsdValue.toFixed(18),
      highUsd: highUsdValue.toFixed(18),
      lowUsd: lowUsdValue.toFixed(18),
      closeUsd: closeUsdValue.toFixed(18),
      // Align volume with historical aggregation: sum of token amounts
      volume: candleSwaps.reduce((sum, s) => sum + parseFloat(s.amountToken), 0).toString(),
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
    if (!AERODROME_ACES_WETH_POOL || !WETH_USDC_POOL) {
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
        this.bitQueryService.getOHLCCandles(
          ACES_TOKEN_ADDRESS,
          AERODROME_ACES_WETH_POOL,
          timeframe,
          {
            from: range.from,
            to: range.to,
            counterTokenAddress: WETH_TOKEN_ADDRESS,
          },
        ),
        this.bitQueryService.getOHLCCandles(WETH_TOKEN_ADDRESS, WETH_USDC_POOL, timeframe, {
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
   * Merge bonding curve and DEX candles with graduation candle and bridging
   */
  private mergeCandles(
    bondingCandles: UnifiedCandle[],
    dexCandles: UnifiedCandle[],
    graduationTimestamp?: Date | null,
  ): UnifiedCandle[] {
    // Handle edge cases
    if (bondingCandles.length === 0) return dexCandles;
    if (dexCandles.length === 0) return bondingCandles;

    const merged: UnifiedCandle[] = [...bondingCandles];

    // Create graduation candle showing price jump
    if (graduationTimestamp && dexCandles.length > 0) {
      const lastBonding = bondingCandles[bondingCandles.length - 1];
      const firstDex = dexCandles[0];

      const graduationCandle: UnifiedCandle = {
        timestamp: graduationTimestamp,
        open: lastBonding.close,
        close: firstDex.open,
        high: Math.max(parseFloat(lastBonding.close), parseFloat(firstDex.open)).toString(),
        low: Math.min(parseFloat(lastBonding.close), parseFloat(firstDex.open)).toString(),
        openUsd: lastBonding.closeUsd,
        closeUsd: firstDex.openUsd,
        highUsd: Math.max(parseFloat(lastBonding.closeUsd), parseFloat(firstDex.openUsd)).toFixed(
          18,
        ),
        lowUsd: Math.min(parseFloat(lastBonding.closeUsd), parseFloat(firstDex.openUsd)).toFixed(
          18,
        ),
        volume: '0',
        volumeUsd: '0',
        trades: 0,
        dataSource: 'graduation' as const,
        circulatingSupply: firstDex.circulatingSupply,
        totalSupply: firstDex.totalSupply,
        marketCapAces: undefined,
        marketCapUsd: undefined,
      };

      merged.push(graduationCandle);

      console.log('🎓 [UnifiedChartData] Created graduation candle:', {
        timestamp: graduationCandle.timestamp,
        openPrice: graduationCandle.open,
        closePrice: graduationCandle.close,
        priceJump:
          (
            ((parseFloat(graduationCandle.close) - parseFloat(graduationCandle.open)) /
              parseFloat(graduationCandle.open)) *
            100
          ).toFixed(2) + '%',
      });
    }

    // Add DEX candles with bridging (like bonding curve does)
    for (let i = 0; i < dexCandles.length; i++) {
      const curr = { ...dexCandles[i] };
      const prev = merged[merged.length - 1];

      // Bridge current candle's open to previous close
      const prevCloseAces = parseFloat(prev.close);
      const prevCloseUsd = parseFloat(prev.closeUsd);
      const currCloseAces = parseFloat(curr.close);
      const currCloseUsd = parseFloat(curr.closeUsd);

      curr.open = prevCloseAces.toString();
      curr.openUsd = prevCloseUsd.toFixed(18);

      // Adjust high/low to include bridged open
      curr.high = Math.max(parseFloat(curr.high), prevCloseAces, currCloseAces).toString();
      curr.low = Math.min(parseFloat(curr.low), prevCloseAces, currCloseAces).toString();
      curr.highUsd = Math.max(parseFloat(curr.highUsd), prevCloseUsd, currCloseUsd).toFixed(18);
      curr.lowUsd = Math.min(parseFloat(curr.lowUsd), prevCloseUsd, currCloseUsd).toFixed(18);

      merged.push(curr);
    }

    // Sort by timestamp (should already be sorted, but ensure it)
    return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Store candles to database (async)
   */
  private async storeCandlesAsync(
    tokenAddress: string,
    timeframe: string,
    candles: UnifiedCandle[],
  ): Promise<void> {
    try {
      for (const candle of candles) {
        await this.prisma.tokenOHLCV.upsert({
          where: {
            contractAddress_timeframe_timestamp_dataSource: {
              contractAddress: tokenAddress,
              timeframe: timeframe,
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
            timeframe: timeframe,
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
