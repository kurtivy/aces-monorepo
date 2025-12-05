import { PrismaClient } from '@prisma/client';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { ACES_TOKEN_ADDRESS, DATA_SOURCE_CONFIG } from '../config/bitquery.config';
import { MIN_VISIBLE_TRADE_USD } from '../constants/trading';
import { TradePriceAggregator } from './trade-price-aggregator';
import { TokenMetadataCacheService } from './token-metadata-cache-service';
import { AcesSnapshotCacheService } from './aces-snapshot-cache-service';
import type { FastifyInstance } from 'fastify';
import type { BitQuerySwap } from '../types/bitquery.types';
import { ethers } from 'ethers'; // For calculateMarginalBuyPrice
import {
  type CacheEntry as GenericCacheEntry,
  coalesceRequest,
  getCacheEntry as getCachedEntry,
  getCacheKey,
  getPendingRequestKey,
  isCacheable,
  setCacheEntry as setCachedEntry,
  invalidateCacheForToken as invalidateCacheEntries,
  bucketTimestamp,
} from './cache/chart-cache-helpers';

// 🔥 PRICE FIX: Trade interface for memory store (matches ChartDataStore)
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

// Types
interface Trade {
  timestamp: Date;
  priceInAces: number;
  priceInUsd: number;
  amountToken: number;
  volumeUsd: number;
  side: 'buy' | 'sell';
  circulatingSupply?: number; // From SubGraph trades (bonding curve)
}

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
  // Market cap OHLC for smooth connections
  marketCapOpenUsd?: string;
  marketCapHighUsd?: string;
  marketCapLowUsd?: string;
  marketCapCloseUsd?: string;
}

interface ChartOptions {
  timeframe: string;
  from: Date;
  to: Date;
  limit?: number;
}

interface GraduationState {
  isBonded: boolean;
  poolAddress: string | null;
  poolReady: boolean;
  dexLiveAt: Date | null;
}

interface UnifiedChartResponse {
  candles: Candle[];
  graduationState: GraduationState;
  acesUsdPrice: string | null;
}

// 🔥 LOAD TEST FIX: Cache interface for chart data
type ChartCacheEntry = GenericCacheEntry<UnifiedChartResponse>;

export class ChartAggregationService {
  private readonly BONDING_SUPPLY = '700000000'; // 700M tokens for bonding curve
  private readonly GRADUATED_SUPPLY = '1000000000'; // 1B tokens after graduation
  private tradePriceAggregator: TradePriceAggregator;

  // 🔥 LOAD TEST FIX: In-memory cache for chart data (5min TTL)
  private chartCache = new Map<string, ChartCacheEntry>();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes - Fresh (historical data doesn't change)
  private readonly STALE_TTL_MS = 900000; // 15 minutes - Stale but usable
  private readonly CACHE_MAX_ENTRIES = 1000;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly CACHE_TELEMETRY_ENABLED = process.env.CACHE_TELEMETRY_ENABLED === 'true';
  private readonly CACHE_TELEMETRY_INTERVAL_MS = Number(
    process.env.CACHE_TELEMETRY_INTERVAL_MS ?? '60000',
  );
  private lastTelemetryLoggedAt = 0;

  // 🔥 LOAD TEST FIX: Request coalescing map to share in-flight promises
  private pendingRequests = new Map<string, Promise<UnifiedChartResponse>>();

  // 🔥 PRICE FIX: Cache invalidation for real-time trades
  private pendingInvalidations = new Map<string, NodeJS.Timeout>();
  private readonly INVALIDATION_DEBOUNCE_MS = 500; // 500ms debounce to prevent thrashing

  constructor(
    private prisma: PrismaClient,
    private acesUsdPriceService: AcesUsdPriceService,
    private tokenMetadataCache: TokenMetadataCacheService,
    private acesSnapshotCache: AcesSnapshotCacheService,
    private fastify?: FastifyInstance,
  ) {
    this.tradePriceAggregator = new TradePriceAggregator(prisma, acesSnapshotCache);
  }

  /**
   * DEX trades stub - returns empty array
   * DEX chart data is now handled by DexScreener iframe on frontend
   */
  private async getDexTradesFromProvider(
    _tokenAddress: string,
    _poolAddress: string,
    _options: {
      from?: Date;
      to?: Date;
      counterTokenAddress?: string;
      limit?: number;
    } = {},
  ): Promise<BitQuerySwap[]> {
    // DEX trades handled by DexScreener iframe on frontend
    // Return empty array - bonding curve data comes from Goldsky
    return [];
  }

  /**
   * 🔥 PRICE FIX: Invalidate chart cache for a token (debounced)
   *
   * Called when new trades arrive to ensure the next chart request includes fresh data.
   * Uses 500ms debouncing to prevent cache thrashing during burst trading.
   *
   * This fixes the issue where:
   * 1. New trade arrives with higher price
   * 2. Chart briefly shows correct price
   * 3. Chart cache still has old price (0.000987)
   * 4. Frontend re-seeds from stale cache → price reverts back
   *
   * @param tokenAddress - Token address (will be normalized to lowercase)
   */
  public invalidateCacheForToken(tokenAddress: string): void {
    const normalized = tokenAddress.toLowerCase();

    // Clear existing debounce timer if another trade arrived
    const existing = this.pendingInvalidations.get(normalized);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new debounce timer - will fire 500ms after the LAST trade in a burst
    const timer = setTimeout(() => {
      this._invalidateCacheNow(normalized);
      this.pendingInvalidations.delete(normalized);
    }, this.INVALIDATION_DEBOUNCE_MS);

    this.pendingInvalidations.set(normalized, timer);
  }

  /**
   * 🔥 PRICE FIX: Immediately invalidate all cache entries for a token
   *
   * Clears cache for ALL timeframes (1m, 5m, 15m, 1h, 4h, 1d) because a single
   * trade affects the current bucket across all timeframes.
   *
   * @param normalizedAddress - Token address in lowercase
   */
  private _invalidateCacheNow(normalizedAddress: string): void {
    const before = this.chartCache.size;
    invalidateCacheEntries(normalizedAddress, this.chartCache);
    const after = this.chartCache.size;
    const invalidated = before - after;

    console.log(
      `[ChartAggregation] 🔄 Cache invalidated for ${normalizedAddress}: ${invalidated} entries cleared`,
    );
  }

  /**
   * 🔥 PRICE FIX: Merge live trades from memory into the last candle
   *
   * This fixes the price snap-back issue by ensuring the REST response includes
   * the latest live trades that might not be indexed in the subgraph yet.
   *
   * How it works:
   * 1. Fetch recent trades from chartDataStore (in-memory, <1ms)
   * 2. Filter trades newer than the last candle's timestamp
   * 3. Update the last candle's close/high/low/volume with live trade data
   *
   * This ensures TradingView's getBars() doesn't overwrite WebSocket updates
   * with stale subgraph data during the indexing lag window.
   *
   * @param tokenAddress - Token address
   * @param candles - Array of candles (will be mutated if live trades found)
   * @param timeframe - Timeframe for bucket alignment
   * @param acesUsdPrice - ACES/USD price for USD calculations
   */
  private async mergeLiveTradesIntoCandles(
    tokenAddress: string,
    candles: Candle[],
    timeframe: string,
    acesUsdPrice: number | null,
  ): Promise<void> {
    // Guard: Skip if no candles or chartDataStore unavailable
    if (candles.length === 0 || !this.fastify?.chartDataStore) {
      return;
    }

    try {
      const chartDataStore = this.fastify.chartDataStore;
      const lastCandle = candles[candles.length - 1];
      const lastCandleTime = lastCandle.timestamp.getTime();

      // Fetch recent trades from memory (last 10 should be enough)
      const recentTrades = chartDataStore.getTrades(tokenAddress, 10) as StoredTrade[];

      if (!recentTrades || recentTrades.length === 0) {
        return;
      }

      // Filter trades newer than the last candle
      const newerTrades = recentTrades.filter((trade: StoredTrade) => {
        const tradeTime = trade.timestamp.getTime();
        return tradeTime > lastCandleTime;
      });

      if (newerTrades.length === 0) {
        return;
      }

      console.log(
        `[ChartAggregation] 🔄 Merging ${newerTrades.length} live trades into last candle for ${tokenAddress}`,
      );

      // Update the last candle with live trade data
      // Note: We use execution price (priceInAces) from the trade, not bonding curve formula
      const tradePricesAces = newerTrades.map((t: StoredTrade) => t.priceInAces);
      const tradePricesUsd = newerTrades.map((t: StoredTrade) => t.priceInUsd);
      const tradeVolumes = newerTrades.map((t: StoredTrade) => t.volumeUsd);

      // Update OHLC in ACES
      const currentHigh = Math.max(parseFloat(lastCandle.high), ...tradePricesAces);
      const currentLow = Math.min(parseFloat(lastCandle.low), ...tradePricesAces);
      const newClose = tradePricesAces[tradePricesAces.length - 1]; // Last trade price

      lastCandle.high = currentHigh.toString();
      lastCandle.low = currentLow.toString();
      lastCandle.close = newClose.toString();

      // Update OHLC in USD
      if (acesUsdPrice && acesUsdPrice > 0) {
        const currentHighUsd = Math.max(parseFloat(lastCandle.highUsd), ...tradePricesUsd);
        const currentLowUsd = Math.min(parseFloat(lastCandle.lowUsd), ...tradePricesUsd);
        const newCloseUsd = tradePricesUsd[tradePricesUsd.length - 1];

        lastCandle.highUsd = currentHighUsd.toString();
        lastCandle.lowUsd = currentLowUsd.toString();
        lastCandle.closeUsd = newCloseUsd.toString();

        // Update market cap based on new close price
        const supply = parseFloat(lastCandle.circulatingSupply);
        lastCandle.marketCapAces = (newClose * supply).toFixed(2);
        lastCandle.marketCapUsd = (newCloseUsd * supply).toFixed(2);
        lastCandle.marketCapCloseUsd = lastCandle.marketCapUsd;
      }

      // Update volume
      const additionalVolume = tradeVolumes.reduce((sum: number, v: number) => sum + v, 0);
      lastCandle.volumeUsd = (parseFloat(lastCandle.volumeUsd) + additionalVolume).toString();
      lastCandle.volume = lastCandle.volumeUsd; // Assuming volume is same as volumeUsd

      // Update trade count
      lastCandle.trades += newerTrades.length;

      console.log(
        `[ChartAggregation] ✅ Updated last candle: close=${lastCandle.close} ACES (${lastCandle.closeUsd} USD), trades=${lastCandle.trades}`,
      );
    } catch (error) {
      // Log but don't throw - merging live trades is an enhancement, not critical
      console.warn('[ChartAggregation] ⚠️ Failed to merge live trades:', error);
    }
  }

  /**
   * Main method: Get unified chart data with Caching + Request Coalescing + Stale-While-Revalidate
   */
  async getChartData(tokenAddress: string, options: ChartOptions): Promise<UnifiedChartResponse> {
    const requestStart = Date.now();
    const normalizedToken = tokenAddress.toLowerCase();
    const alignedToMs = this.alignTimestamp(options.to, options.timeframe);
    const alignedToDate = new Date(alignedToMs);
    const now = Date.now();

    const cacheable = isCacheable(options.from, options.to, now);
    const pendingKey = getPendingRequestKey({
      tokenAddress: normalizedToken,
      timeframe: options.timeframe,
      from: options.from,
      to: alignedToDate,
    });

    if (cacheable) {
      const cachedEntry = getCachedEntry(
        this.chartCache,
        normalizedToken,
        options.timeframe,
        options.from,
        alignedToDate,
      );

      if (cachedEntry) {
        const age = now - cachedEntry.timestamp;
        if (age < this.CACHE_TTL_MS) {
          this.cacheHits++;
          this.logCacheTelemetry({
            token: normalizedToken,
            timeframe: options.timeframe,
            source: 'cache',
            durationMs: Date.now() - requestStart,
            cacheHit: true,
            cacheEligible: cacheable,
          });
          return cachedEntry.data;
        }

        if (age < this.STALE_TTL_MS) {
          this.cacheHits++;
          if (!this.pendingRequests.has(pendingKey)) {
            coalesceRequest(this.pendingRequests, pendingKey, () =>
              this.fetchAndMaybeCache({
                tokenAddress,
                normalizedToken,
                options,
                alignedToDate,
                cacheable,
              }),
            ).catch((err) => {
              console.error(
                `[ChartAggregation] ❌ Background refresh failed for ${normalizedToken}`,
                err,
              );
            });
          }

          this.logCacheTelemetry({
            token: normalizedToken,
            timeframe: options.timeframe,
            source: 'cache-stale',
            durationMs: Date.now() - requestStart,
            cacheHit: true,
            cacheEligible: cacheable,
          });
          return cachedEntry.data;
        }
      }
    }

    this.cacheMisses++;

    return coalesceRequest(this.pendingRequests, pendingKey, () =>
      this.fetchAndMaybeCache({
        tokenAddress,
        normalizedToken,
        options,
        alignedToDate,
        cacheable,
      }),
    ).then((result) => {
      this.logCacheTelemetry({
        token: normalizedToken,
        timeframe: options.timeframe,
        source: cacheable ? 'backend-cache-fill' : 'backend',
        durationMs: Date.now() - requestStart,
        cacheHit: false,
        cacheEligible: cacheable,
      });
      return result;
    });
  }

  private fetchAndMaybeCache(params: {
    tokenAddress: string;
    normalizedToken: string;
    options: ChartOptions;
    alignedToDate: Date;
    cacheable: boolean;
  }): Promise<UnifiedChartResponse> {
    const { tokenAddress, normalizedToken, options, alignedToDate, cacheable } = params;

    return this._computeChartData(tokenAddress, options).then((result) => {
      if (cacheable) {
        setCachedEntry(
          this.chartCache,
          normalizedToken,
          options.timeframe,
          options.from,
          alignedToDate,
          {
            data: result,
            timestamp: Date.now(),
          },
          { maxSize: this.CACHE_MAX_ENTRIES },
        );
      }
      return result;
    });
  }

  private logCacheTelemetry(context: {
    token: string;
    timeframe: string;
    source: 'cache' | 'cache-stale' | 'backend' | 'backend-cache-fill';
    durationMs: number;
    cacheHit: boolean;
    cacheEligible: boolean;
  }): void {
    if (!this.CACHE_TELEMETRY_ENABLED) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTelemetryLoggedAt < this.CACHE_TELEMETRY_INTERVAL_MS) {
      return;
    }

    this.lastTelemetryLoggedAt = now;

    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? Number(((this.cacheHits / total) * 100).toFixed(2)) : 0;

    const payload = {
      token: context.token,
      timeframe: context.timeframe,
      source: context.source,
      cacheHit: context.cacheHit,
      cacheEligible: context.cacheEligible,
      durationMs: context.durationMs,
      cacheSize: this.chartCache.size,
      pendingRequests: this.pendingRequests.size,
      hitRate,
    };

    const logger = this.fastify?.log ?? console;
    if (typeof (logger as any)?.info === 'function') {
      (logger as any).info(payload, '[ChartAggregation] Cache telemetry');
    } else {
      console.log('[ChartAggregation] Cache telemetry', payload);
    }
  }

  /**
   * Internal method: The heavy lifting (Database + API calls)
   */
  private async _computeChartData(
    tokenAddress: string,
    options: ChartOptions,
  ): Promise<UnifiedChartResponse> {
    const now = Date.now();
    const currentCandleTimestamp = this.alignTimestamp(new Date(now), options.timeframe);

    // 🔥 PARALLEL FETCHING: Fetch independent data concurrently
    const [graduationState, acesUsdPriceResult] = await Promise.all([
      this.checkGraduation(tokenAddress),
      this.acesUsdPriceService.getAcesUsdPrice().catch((err) => {
        console.warn('[ChartAggregation] ⚠️ Failed to fetch ACES/USD price:', err);
        return { price: '0', source: 'fallback' };
      }),
    ]);

    // 🔥 DEBUG: Log graduation state and request parameters
    console.log('[ChartAggregation] 🔍 DEBUG - Graduation check:', {
      tokenAddress: tokenAddress.toLowerCase(),
      timeframe: options.timeframe,
      from: options.from.toISOString(),
      to: options.to.toISOString(),
      fromTimestamp: options.from.getTime(),
      toTimestamp: options.to.getTime(),
      currentTime: new Date().toISOString(),
      currentTimestamp: Date.now(),
      graduationState: {
        isBonded: graduationState.isBonded,
        poolAddress: graduationState.poolAddress,
        poolReady: graduationState.poolReady,
        dexLiveAt: graduationState.dexLiveAt?.toISOString() || null,
      },
    });

    // Process ACES/USD Price
    let acesUsdPrice: number | null = parseFloat(acesUsdPriceResult.price);
    if (!acesUsdPrice || isNaN(acesUsdPrice) || acesUsdPrice <= 0) {
      console.warn('[ChartAggregation] ⚠️ ACES/USD price invalid, will return ACES prices only');
      acesUsdPrice = null;
    }

    // 3. Route to appropriate data source(s) using smart switching
    let candles: Candle[];

    if (!graduationState.poolReady) {
      // TOKEN IS STILL IN BONDING CURVE
      // console.log('[ChartAggregation] 📈 Token bonding - using SubGraph');
      candles = await this.fetchBondingCurveData(
        tokenAddress,
        options,
        acesUsdPrice,
        currentCandleTimestamp,
      );

      // Note: If no bonding curve data found and token is graduated, 
      // the frontend uses DexScreener iframe for DEX chart data
      if (candles.length === 0) {
        console.log(
          '[ChartAggregation] ⚠️ No bonding curve data found - token may have graduated (frontend uses DexScreener for DEX)',
        );
      }
    } else if (graduationState.dexLiveAt) {
      // TOKEN HAS GRADUATED - check if request spans bonding/DEX boundary
      // console.log('[ChartAggregation] 🏊 Token graduated - checking boundaries');
      candles = await this.fetchGraduatedTokenData(
        tokenAddress,
        graduationState,
        options,
        acesUsdPrice,
        currentCandleTimestamp,
      );
    } else {
      // TOKEN ON DEX BUT NO GRADUATION DATE - use DEX switching only
      console.warn(
        '[ChartAggregation] ⚠️ Pool ready but no graduation date - using DEX smart switching',
      );
      candles = await this.fetchDexDataWithSmartSwitching(
        tokenAddress,
        graduationState.poolAddress!,
        options,
        currentCandleTimestamp,
        null,
      );
    }

    // console.log(`[ChartAggregation] ✅ Generated ${candles.length} candles`);

    // 5. Add market cap to each candle
    const enrichedCandles = candles.map((candle) => {
      const supply = parseFloat(candle.circulatingSupply);

      // Calculate market cap OHLC in ACES
      const marketCapOpenAces = (parseFloat(candle.open) * supply).toFixed(2);
      const marketCapHighAces = (parseFloat(candle.high) * supply).toFixed(2);
      const marketCapLowAces = (parseFloat(candle.low) * supply).toFixed(2);
      const marketCapCloseAces = (parseFloat(candle.close) * supply).toFixed(2);

      // Calculate market cap OHLC in USD (if ACES/USD price available)
      let marketCapOpenUsd = '0';
      let marketCapHighUsd = '0';
      let marketCapLowUsd = '0';
      let marketCapCloseUsd = '0';

      if (acesUsdPrice && acesUsdPrice > 0) {
        marketCapOpenUsd = (parseFloat(marketCapOpenAces) * acesUsdPrice).toFixed(2);
        marketCapHighUsd = (parseFloat(marketCapHighAces) * acesUsdPrice).toFixed(2);
        marketCapLowUsd = (parseFloat(marketCapLowAces) * acesUsdPrice).toFixed(2);
        marketCapCloseUsd = (parseFloat(marketCapCloseAces) * acesUsdPrice).toFixed(2);
      }

      return {
        ...candle,
        marketCapAces: marketCapCloseAces,
        marketCapUsd: marketCapCloseUsd,
      };
    });

    const result = {
      candles: enrichedCandles,
      graduationState,
      acesUsdPrice: acesUsdPrice ? acesUsdPrice.toFixed(6) : null,
    };

    // 🔥 PRICE FIX: Merge live trades from memory into the last candle
    // This ensures REST response matches WebSocket data even during subgraph lag
    await this.mergeLiveTradesIntoCandles(
      tokenAddress,
      result.candles,
      options.timeframe,
      acesUsdPrice,
    );

    return result;
  }

  /**
   * 🔥 Calculate marginal buy price using bonding curve formula
   * This uses the same quadratic formula as the frontend/smart contract
   * Returns the cost to buy 1 token at a given supply level (in ACES)
   */
  private calculateMarginalBuyPrice(
    supply: number, // Supply in tokens (not wei)
    steepness: string, // From token metadata
    floor: string, // From token metadata
  ): number {
    try {
      // Convert to bigint wei (18 decimals)
      const W = BigInt(10) ** BigInt(18);
      const supplyWei = BigInt(Math.floor(supply)) * W;
      const amountWei = W; // 1 token
      const steepnessWei = BigInt(steepness);
      const floorWei = BigInt(floor);

      // Quadratic bonding curve formula (same as smart contract)
      const sumSquares = (s: bigint): bigint => {
        if (s === BigInt(0)) return BigInt(0);
        const t1 = (s * (s + W)) / W;
        const t2 = (t1 * (BigInt(2) * s + W)) / W;
        return t2 / (BigInt(6) * W);
      };

      const startWei = supplyWei;
      const endWei = supplyWei + amountWei - W;

      const sumBefore = sumSquares(startWei - W);
      const sumAfter = sumSquares(endWei);
      const summation = sumAfter - sumBefore;

      const curveComponent = (summation * W) / steepnessWei;
      const linearComponent = (floorWei * amountWei) / W;
      const basePrice = curveComponent + linearComponent;

      // Add fees (assume 5% protocol + 5% subject = 10% total)
      const feePercent = (BigInt(10) * W) / BigInt(100); // 10%
      const priceWithFees = basePrice + (basePrice * feePercent) / W;

      // Convert to ACES (from wei)
      const priceInAces = parseFloat(ethers.formatEther(priceWithFees));

      return priceInAces;
    } catch (error) {
      console.error('[ChartAggregation] Error calculating marginal price:', error);
      return 0;
    }
  }

  /**
   * Fetch bonding curve trades from SubGraph with historical ACES prices
   * NOW USES TradePriceAggregator for accurate historical pricing
   */
  private async fetchBondingTrades(
    tokenAddress: string,
    from: Date,
    to: Date,
    limit: number = 1000,
  ): Promise<Trade[]> {
    const fromTimestamp = Math.floor(from.getTime() / 1000);
    const toTimestamp = Math.floor(to.getTime() / 1000);
    const pageLimit = Math.min(limit, 1000);

    try {
      const [firstPage, tokenMetadata] = await Promise.all([
        this.tradePriceAggregator.getTradesWithPrices(
          tokenAddress,
          pageLimit,
          fromTimestamp,
          toTimestamp,
        ),
        this.tokenMetadataCache.getTokenMetadata(tokenAddress),
      ]);

      console.log('[ChartAggregation] 📊 Bonding trades page 1 fetched', {
        tokenAddress: tokenAddress.toLowerCase(),
        requestedFrom: from.toISOString(),
        requestedTo: to.toISOString(),
        tradesReceived: firstPage.length,
        pageLimit,
      });

      let tradesWithPrices = [...firstPage];

      if (firstPage.length === pageLimit && firstPage.length > 0) {
        const oldestTrade = firstPage[firstPage.length - 1];
        const oldestTimestamp = parseInt(oldestTrade.createdAt);

        if (oldestTimestamp > fromTimestamp) {
          const gapSeconds = oldestTimestamp - fromTimestamp;
          console.log('[ChartAggregation] 🔄 Bonding trades gap detected, fetching earlier range', {
            tokenAddress: tokenAddress.toLowerCase(),
            requestedFrom: from.toISOString(),
            oldestFetched: new Date(oldestTimestamp * 1000).toISOString(),
            gapDays: (gapSeconds / 86400).toFixed(2),
          });

          const secondPage = await this.tradePriceAggregator.getTradesWithPrices(
            tokenAddress,
            pageLimit,
            fromTimestamp,
            oldestTimestamp - 1,
          );

          console.log('[ChartAggregation] 📊 Bonding trades page 2 fetched', {
            tokenAddress: tokenAddress.toLowerCase(),
            tradesReceived: secondPage.length,
          });

          tradesWithPrices = tradesWithPrices.concat(secondPage);

          if (secondPage.length === pageLimit) {
            console.warn(
              '[ChartAggregation] ⚠️ Bonding trades exceeded two pages (potential gaps remain)',
              { tokenAddress: tokenAddress.toLowerCase(), totalFetched: tradesWithPrices.length },
            );
          }
        }
      }

      let steepness: string | null = tokenMetadata?.steepness || null;
      let floor: string | null = tokenMetadata?.floor || null;

      if (
        (!steepness || !floor) &&
        (process.env.GOLDSKY_SUBGRAPH_URL || process.env.SUBGRAPH_URL)
      ) {
        try {
          const query = `{
            tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
              steepness
              floor
            }
          }`;

          const response = await fetch(
            process.env.GOLDSKY_SUBGRAPH_URL || process.env.SUBGRAPH_URL!,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
              signal: AbortSignal.timeout(3000), // 3s timeout
            },
          );

          if (response.ok) {
            const result = (await response.json()) as {
              data?: { tokens?: Array<{ steepness: string; floor: string }> };
            };
            const tokens = result?.data?.tokens;

            if (tokens && tokens.length > 0) {
              steepness = tokens[0].steepness;
              floor = tokens[0].floor;
            }
          }
        } catch (error) {
          console.warn(
            `[ChartAggregation] ⚠️ Fallback SubGraph fetch failed for ${tokenAddress}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      if (!steepness || !floor) {
        console.warn(
          `[ChartAggregation] ⚠️ Missing token parameters for ${tokenAddress}, using fallback pricing`,
        );
      }

      const transformedTrades: Trade[] = [];

      for (const trade of tradesWithPrices) {
        const tokenAmount = parseFloat(trade.tokenAmount) / 1e18;
        const acesTokenAmount = parseFloat(trade.acesTokenAmount) / 1e18;
        const supply = parseFloat(trade.supply) / 1e18; // Circulating supply AFTER this trade

        // 🔥 EXECUTION PRICE LOGIC:
        // Use the actual price paid/received in this trade (total ACES / total tokens)
        // This represents what traders actually experienced, not theoretical marginal prices
        //
        // Benefits:
        // - Charts match trade history exactly
        // - No artificial spikes from large trades
        // - Accurate OHLC for technical analysis
        // - Reflects real market execution prices
        //
        // For both BUY and SELL trades:
        // - Execution price = acesTokenAmount / tokenAmount (weighted average)
        // - This is what the trader actually paid/received per token

        // Always use execution price for chart data
        // This prevents artificial spikes and matches the trade history UI
        const priceInAces = tokenAmount > 0 ? acesTokenAmount / tokenAmount : 0;

        // console.log(
        //   `[ChartAggregation] ${trade.isBuy ? 'BUY' : 'SELL'} trade ${trade.id.slice(0, 10)}: ` +
        //     `Execution price=${priceInAces.toFixed(8)} ACES/token (${tokenAmount.toFixed(0)} tokens)`,
        // );

        // Calculate USD price using HISTORICAL ACES price
        const priceInUsd = priceInAces * trade.acesUsdPriceAtExecution;

        // Calculate volume in USD using historical ACES price
        const volumeUsd = tokenAmount * priceInAces * trade.acesUsdPriceAtExecution;

        transformedTrades.push({
          timestamp: new Date(parseInt(trade.createdAt) * 1000),
          priceInAces,
          priceInUsd, // Now using historical ACES price! ✅
          amountToken: tokenAmount,
          volumeUsd, // Now accurate! ✅
          side: (trade.isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
          circulatingSupply: supply, // Actual circulating supply from SubGraph
        });
      }

      //  console.log(`[ChartAggregation] ✅ Transformed ${transformedTrades.length} bonding trades`);

      const filteredTrades = transformedTrades.filter(
        (trade) => trade.volumeUsd >= MIN_VISIBLE_TRADE_USD,
      );

      const filteredCount = transformedTrades.length - filteredTrades.length;
      if (filteredCount > 0) {
        console.log('[ChartAggregation] ✂️ Filtered micro bonding trades', {
          tokenAddress: tokenAddress.toLowerCase(),
          removed: filteredCount,
          thresholdUsd: MIN_VISIBLE_TRADE_USD,
        });
      }

      return filteredTrades;
    } catch (error) {
      console.error('[ChartAggregation] Failed to fetch bonding trades:', error);
      throw error;
    }
  }

  /**
   * Fetch DEX trades from BitQuery
   */
  private async fetchDexTrades(
    tokenAddress: string,
    poolAddress: string,
    from: Date,
    to: Date,
    limit: number = 2000,
  ): Promise<Trade[]> {
    // 🔥 ALCHEMY MIGRATION: Use routing method
    const dexTrades = await this.getDexTradesFromProvider(tokenAddress, poolAddress, {
      from,
      to,
      counterTokenAddress: ACES_TOKEN_ADDRESS,
      limit: Math.min(limit, 5000),
    });

    // Transform to Trade format
    const transformedTrades = dexTrades.map((trade) => ({
      timestamp: trade.blockTime,
      priceInAces: parseFloat(trade.priceInAces),
      priceInUsd: parseFloat(trade.priceInUsd),
      amountToken: parseFloat(trade.amountToken),
      volumeUsd: parseFloat(trade.volumeUsd),
      side: trade.side,
    }));

    const filteredTrades = transformedTrades.filter(
      (trade) => trade.volumeUsd >= MIN_VISIBLE_TRADE_USD,
    );

    const filteredCount = transformedTrades.length - filteredTrades.length;
    if (filteredCount > 0) {
      console.log('[ChartAggregation] ✂️ Filtered micro DEX trades', {
        tokenAddress: tokenAddress.toLowerCase(),
        poolAddress: poolAddress || '(n/a)',
        removed: filteredCount,
        thresholdUsd: MIN_VISIBLE_TRADE_USD,
        source: 'bitquery',
      });
    }

    return filteredTrades;
  }

  /**
   * NEW: Aggregate trades into OHLCV candles WITH NO-GAP LOGIC
   * Key principle: candle[n].open = candle[n-1].close (ALWAYS)
   * Empty candles show ACES price movement within the body
   */
  private aggregateTradesToCandlesWithNoGaps(
    trades: Trade[],
    timeframe: string,
    from: Date,
    to: Date,
    acesUsdPrice: number | null,
    currentCandleTimestamp: number,
    dataSource: 'bonding_curve' | 'dex',
    seedCandle?: Candle | null,
  ): Candle[] {
    const intervalMs = this.getIntervalMs(timeframe);
    const startTime = this.alignTimestamp(from, timeframe);
    let endTime = this.alignTimestamp(to, timeframe);

    // 🔥 CRITICAL FIX: Prevent future candle generation
    // Only cap if endTime is beyond current bucket AND in the future
    // This preserves historical data loading (scroll-back)
    const now = Date.now();

    if (endTime > currentCandleTimestamp && endTime > now) {
      endTime = currentCandleTimestamp;
    }

    // Group trades by aligned timestamp
    const tradeBuckets = new Map<number, Trade[]>();
    for (const trade of trades) {
      const alignedTime = this.alignTimestamp(trade.timestamp, timeframe);
      if (!tradeBuckets.has(alignedTime)) {
        tradeBuckets.set(alignedTime, []);
      }
      tradeBuckets.get(alignedTime)!.push(trade);
    }

    // Generate all candles (with and without trades) with NO GAPS
    const candles: Candle[] = [];
    let previousCandle: Candle | null = seedCandle ? { ...seedCandle } : null;
    let currentTime = startTime;

    while (currentTime <= endTime) {
      const bucketTrades = tradeBuckets.get(currentTime) || [];
      const isCurrent = currentTime === currentCandleTimestamp;
      const supply = dataSource === 'dex' ? this.GRADUATED_SUPPLY : this.BONDING_SUPPLY;

      let candle: Candle;

      if (bucketTrades.length > 0) {
        // CANDLE WITH TRADES
        const { candle: builtCandle, totalVolumeUsd } = this.createCandleWithTrades(
          bucketTrades,
          currentTime,
          acesUsdPrice,
          dataSource,
          supply,
          previousCandle,
          intervalMs,
        );
        candle = this.applyMicroCandleClamp(builtCandle, previousCandle, totalVolumeUsd);
      } else if (previousCandle) {
        // EMPTY CANDLE - Show ACES price movement
        candle = this.createEmptyCandle(
          currentTime,
          previousCandle,
          acesUsdPrice,
          dataSource,
          supply,
          isCurrent,
          intervalMs,
        );
      } else {
        // Skip - no previous candle to connect to
        currentTime += intervalMs;
        continue;
      }

      candles.push(candle);
      previousCandle = candle;
      currentTime += intervalMs;
    }
    if (trades.length > 0) {
      // 🔥 CRITICAL FIX: Trade ordering differs by data source
      // - Goldsky (bonding_curve): DESC order (newest first) → trades[0] = newest
      // - BitQuery (dex): ASC order (oldest first) → trades[length-1] = newest
      // Using wrong index causes big red candles on page refresh (shows floor/first price)
      const newestTrade = dataSource === 'bonding_curve' ? trades[0] : trades[trades.length - 1];

      this.applyLivePriceToCurrentCandle(candles, newestTrade, currentCandleTimestamp, dataSource);
    }
    return candles;
  }

  /**
   * Create a candle with trades (has actual OHLCV data)
   */
  private createCandleWithTrades(
    bucketTrades: Trade[],
    timestamp: number,
    acesUsdPrice: number | null,
    dataSource: 'bonding_curve' | 'dex',
    supply: string,
    previousCandle: Candle | null,
    intervalMs: number,
  ): { candle: Candle; totalVolumeUsd: number } {
    // Sort trades by timestamp
    bucketTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Extract price arrays
    const pricesInAces = bucketTrades.map((t) => t.priceInAces);
    const pricesInUsd = bucketTrades.map((t) => t.priceInUsd);

    // 🔥 INDUSTRY STANDARD: Use last trade price for close (matches DEXScreener, Binance, TradingView)
    // VWAP is typically shown as a separate indicator, not used for candlestick close price.
    // Using last trade eliminates phantom wicks when price moves monotonically.
    //
    // 📝 VWAP calculations commented out for potential future use as indicator:
    // const totalValueAces = bucketTrades.reduce((sum, t) => sum + t.priceInAces * t.amountToken, 0);
    // const totalVolumeAces = bucketTrades.reduce((sum, t) => sum + t.amountToken, 0);
    // const vwapCloseAces = totalVolumeAces > 0 ? totalValueAces / totalVolumeAces : pricesInAces[0];
    // const totalValueUsd = bucketTrades.reduce((sum, t) => sum + t.priceInUsd * t.volumeUsd, 0);
    // const vwapCloseUsd = totalVolumeUsd > 0 ? totalValueUsd / totalVolumeUsd : pricesInUsd[0];

    const totalVolumeUsd = bucketTrades.reduce((sum, t) => sum + t.volumeUsd, 0);

    // OHLC in ACES - Close is the last trade price (industry standard)
    let openAces = pricesInAces[0];
    const closeAces = pricesInAces[pricesInAces.length - 1]; // ✅ Last trade price (industry standard)

    // CRITICAL: Connect to previous candle (NO GAPS!)
    if (previousCandle) {
      openAces = parseFloat(previousCandle.close);
    }

    // 🔥 FIX: High/Low MUST include open price to create valid candlesticks
    // Without this, when open (from previous close) differs from trade prices,
    // we get invalid candles where low > min(open, close) or high < max(open, close)
    // This fixes phantom wicks when price moves monotonically in one direction
    const highAces = Math.max(openAces, closeAces, ...pricesInAces);
    const lowAces = Math.min(openAces, closeAces, ...pricesInAces);

    // OHLC in USD
    let openUsd: number, closeUsd: number, highUsd: number, lowUsd: number;

    if (dataSource === 'dex' && pricesInUsd.some((p) => p > 0)) {
      // DEX: Use BitQuery USD prices (already in USD from BitQuery)
      const firstTradeUsd = pricesInUsd[0];
      closeUsd = pricesInUsd[pricesInUsd.length - 1]; // ✅ Last trade price (industry standard)

      // Connect USD to previous candle
      openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : firstTradeUsd;

      // 🔥 FIX: High/Low MUST include open and close prices for valid candlesticks
      // This ensures no phantom wicks when price moves monotonically
      highUsd = Math.max(openUsd, closeUsd, ...pricesInUsd);
      lowUsd = Math.min(openUsd, closeUsd, ...pricesInUsd);
    } else {
      // Bonding Curve: Use snapshot USD prices (already in trades from TradePriceAggregator)
      // The pricesInUsd array (line 391) contains USD values calculated using database snapshots
      const firstTradeUsd = pricesInUsd[0];
      closeUsd = pricesInUsd[pricesInUsd.length - 1]; // ✅ Last trade price (industry standard)

      // Connect USD to previous candle (NO GAPS)
      openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : firstTradeUsd;

      // 🔥 FIX: High/Low MUST include open and close prices for valid candlesticks
      // This ensures no phantom wicks when price moves monotonically
      highUsd = Math.max(openUsd, closeUsd, ...pricesInUsd);
      lowUsd = Math.min(openUsd, closeUsd, ...pricesInUsd);
    }

    // Volume
    const volume = bucketTrades.reduce((sum, t) => sum + t.amountToken, 0);
    const volumeUsd = totalVolumeUsd.toFixed(2);

    // Supply: Use actual circulating supply from last trade (bonding) or fixed supply (DEX)
    let actualSupply: string;
    if (dataSource === 'bonding_curve') {
      // Use circulating supply from the last trade in this bucket
      const lastTrade = bucketTrades[bucketTrades.length - 1];
      actualSupply = lastTrade.circulatingSupply ? lastTrade.circulatingSupply.toString() : supply; // Fallback to passed supply
      // console.log(
      //   `[ChartAggregation] 📊 Candle supply: ${(parseFloat(actualSupply) / 1e6).toFixed(2)}M (from trade)`,
      // );
    } else {
      // DEX: Use fixed graduated supply
      actualSupply = supply;
    }

    const supplyNum = parseFloat(actualSupply);

    // Calculate Market Cap OHLC with NO-GAP logic
    let marketCapOpenUsd: number;

    // CRITICAL: Market cap open connects to previous candle's market cap close (NO GAPS!)
    if (previousCandle && previousCandle.marketCapCloseUsd) {
      marketCapOpenUsd = parseFloat(previousCandle.marketCapCloseUsd);
      // console.log(
      //   `[ChartAggregation] 🔗 Connecting market cap: open=$${marketCapOpenUsd.toFixed(2)} (previous close)`,
      // );
    } else {
      // First candle: calculate from open price
      marketCapOpenUsd = openUsd * supplyNum;
    }

    // Close market cap: current price × current supply
    const marketCapCloseUsd = closeUsd * supplyNum;

    // High/Low: Calculate from price high/low × supply, but also consider open/close
    const marketCapAtHigh = highUsd * supplyNum;
    const marketCapAtLow = lowUsd * supplyNum;

    const marketCapHighUsd = Math.max(marketCapOpenUsd, marketCapCloseUsd, marketCapAtHigh);
    const marketCapLowUsd = Math.min(marketCapOpenUsd, marketCapCloseUsd, marketCapAtLow);

    return {
      candle: {
        timestamp: new Date(timestamp),
        open: openAces.toFixed(18),
        high: highAces.toFixed(18),
        low: lowAces.toFixed(18),
        close: closeAces.toFixed(18),
        openUsd: openUsd.toFixed(18),
        highUsd: highUsd.toFixed(18),
        lowUsd: lowUsd.toFixed(18),
        closeUsd: closeUsd.toFixed(18),
        volume: volume.toString(),
        volumeUsd: totalVolumeUsd.toFixed(2),
        trades: bucketTrades.length,
        dataSource,
        circulatingSupply: actualSupply,
        totalSupply: actualSupply,
        marketCapAces: (closeAces * supplyNum).toFixed(2),
        marketCapUsd: marketCapCloseUsd.toFixed(2),
        marketCapOpenUsd: marketCapOpenUsd.toFixed(2),
        marketCapHighUsd: marketCapHighUsd.toFixed(2),
        marketCapLowUsd: marketCapLowUsd.toFixed(2),
        marketCapCloseUsd: marketCapCloseUsd.toFixed(2),
      },
      totalVolumeUsd,
    };
  }

  /**
   * Create an empty candle (no trades, but shows ACES price movement)
   * Key: open = previous close (NO GAPS!)
   * USD price can change due to ACES/USD rate changes
   */
  private createEmptyCandle(
    timestamp: number,
    previousCandle: Candle,
    acesUsdPrice: number | null,
    dataSource: 'bonding_curve' | 'dex',
    supply: string,
    isCurrent: boolean,
    intervalMs: number,
  ): Candle {
    // CRITICAL: Connect to previous candle (NO GAPS!)
    const openAces = parseFloat(previousCandle.close);
    const closeAces = openAces; // No RWA trades, ACES price per RWA stays same

    // Open USD connects to previous candle
    const openUsd = parseFloat(previousCandle.closeUsd);

    // For both bonding curve AND DEX: Empty candle = flat line (no trades = no price movement)
    // No trades means no price change - USD value stays exactly the same
    const closeUsd = openUsd; // Flat line
    const highUsd = openUsd; // No wicks
    const lowUsd = openUsd; // No movement

    // Note: For DEX, Bitquery already provides USD prices, so we don't need ACES price conversion
    // Empty candles should maintain the last known price until new trades occur

    // Use supply from previous candle (no trades = no supply change)
    const supplyNum = parseFloat(previousCandle.circulatingSupply);

    // Calculate Market Cap OHLC with NO-GAP logic for empty candles
    let marketCapOpenUsd: number;

    // CRITICAL: Market cap open connects to previous candle's market cap close (NO GAPS!)
    if (previousCandle.marketCapCloseUsd) {
      marketCapOpenUsd = parseFloat(previousCandle.marketCapCloseUsd);
    } else {
      // Fallback: calculate from open price
      marketCapOpenUsd = openUsd * supplyNum;
    }

    // Close market cap: current price × current supply (supply unchanged for empty candle)
    const marketCapCloseUsd = closeUsd * supplyNum;

    // High/Low: Range of ACES movement affects market cap
    const marketCapHighUsd = Math.max(marketCapOpenUsd, marketCapCloseUsd);
    const marketCapLowUsd = Math.min(marketCapOpenUsd, marketCapCloseUsd);

    // console.log(
    //   `[ChartAggregation] 📊 Empty candle at ${new Date(timestamp).toISOString()}: ` +
    //     `price: $${openUsd.toFixed(8)} → $${closeUsd.toFixed(8)} ` +
    //     `mcap: $${marketCapOpenUsd.toFixed(2)} → $${marketCapCloseUsd.toFixed(2)} ` +
    //     `(ACES movement: ${((closeUsd / openUsd - 1) * 100).toFixed(2)}%)`,
    // );

    return {
      timestamp: new Date(timestamp),
      open: openAces.toFixed(18),
      high: openAces.toFixed(18), // ACES price unchanged
      low: openAces.toFixed(18), // ACES price unchanged
      close: closeAces.toFixed(18),
      openUsd: openUsd.toFixed(18),
      highUsd: highUsd.toFixed(18),
      lowUsd: lowUsd.toFixed(18),
      closeUsd: closeUsd.toFixed(18),
      volume: '0',
      volumeUsd: '0',
      trades: 0,
      dataSource,
      circulatingSupply: previousCandle.circulatingSupply,
      totalSupply: previousCandle.totalSupply,
      marketCapAces: (closeAces * supplyNum).toFixed(2),
      marketCapUsd: marketCapCloseUsd.toFixed(2),
      marketCapOpenUsd: marketCapOpenUsd.toFixed(2),
      marketCapHighUsd: marketCapHighUsd.toFixed(2),
      marketCapLowUsd: marketCapLowUsd.toFixed(2),
      marketCapCloseUsd: marketCapCloseUsd.toFixed(2),
    };
  }

  private applyMicroCandleClamp(
    candle: Candle,
    previousCandle: Candle | null,
    totalVolumeUsd: number,
  ): Candle {
    if (
      !previousCandle ||
      !Number.isFinite(totalVolumeUsd) ||
      totalVolumeUsd <= 0 ||
      totalVolumeUsd >= MIN_VISIBLE_TRADE_USD
    ) {
      return candle;
    }

    console.log('[ChartAggregation] 🛡️ Clamping candle due to low USD volume', {
      timestamp: candle.timestamp.toISOString(),
      volumeUsd: totalVolumeUsd,
      thresholdUsd: MIN_VISIBLE_TRADE_USD,
      dataSource: candle.dataSource,
    });

    return this.copyPricesFromPrevious(candle, previousCandle);
  }

  private copyPricesFromPrevious(candle: Candle, previousCandle: Candle): Candle {
    const prevClose = previousCandle.close;
    const prevCloseUsd = previousCandle.closeUsd;
    const prevMarketCap =
      previousCandle.marketCapCloseUsd ||
      previousCandle.marketCapUsd ||
      previousCandle.marketCapOpenUsd ||
      '0';

    candle.open = prevClose;
    candle.high = prevClose;
    candle.low = prevClose;
    candle.close = prevClose;

    candle.openUsd = prevCloseUsd;
    candle.highUsd = prevCloseUsd;
    candle.lowUsd = prevCloseUsd;
    candle.closeUsd = prevCloseUsd;

    candle.marketCapAces = previousCandle.marketCapAces;
    candle.marketCapUsd = prevMarketCap;
    candle.marketCapOpenUsd = prevMarketCap;
    candle.marketCapHighUsd = prevMarketCap;
    candle.marketCapLowUsd = prevMarketCap;
    candle.marketCapCloseUsd = prevMarketCap;
    candle.circulatingSupply = previousCandle.circulatingSupply;
    candle.totalSupply = previousCandle.totalSupply;

    return candle;
  }

  /**
   * Fetch bonding curve data from SubGraph and aggregate to candles
   * Wrapper method for bonding curve data fetching
   */
  private async fetchBondingCurveData(
    tokenAddress: string,
    options: ChartOptions,
    acesUsdPrice: number | null,
    currentCandleTimestamp: number,
  ): Promise<Candle[]> {
    // console.log('[ChartAggregation] 📈 Fetching bonding curve data from SubGraph');

    const trades = await this.fetchBondingTrades(tokenAddress, options.from, options.to, 1000);

    // console.log(`[ChartAggregation] ✅ Fetched ${trades.length} bonding trades`);

    let seedCandle: Candle | null = null;
    const alignedRangeStart = this.alignTimestamp(options.from, options.timeframe);
    const firstTradeBucket =
      trades.length > 0 ? this.alignTimestamp(trades[0].timestamp, options.timeframe) : null;

    if (
      trades.length === 0 ||
      (firstTradeBucket !== null && firstTradeBucket > alignedRangeStart)
    ) {
      seedCandle = await this.getBondingSeedCandle(
        tokenAddress,
        options.timeframe,
        options.from,
        acesUsdPrice,
      );
    }

    return this.aggregateTradesToCandlesWithNoGaps(
      trades,
      options.timeframe,
      options.from,
      options.to,
      acesUsdPrice,
      currentCandleTimestamp,
      'bonding_curve',
      seedCandle,
    );
  }

  /**
   * DEX OHLCV stub - returns empty array
   * DEX chart data is now handled by DexScreener iframe on frontend
   */
  private async fetchHistoricalDexOHLCV(
    _tokenAddress: string,
    _poolAddress: string,
    _options: ChartOptions,
    _seedCandle: Candle | null = null,
  ): Promise<Candle[]> {
    // DEX chart data handled by DexScreener iframe on frontend
    return [];
  }

  private applyLivePriceToCurrentCandle(
    candles: Candle[],
    latestTrade: Trade,
    currentCandleTimestamp: number,
    dataSource: 'bonding_curve' | 'dex',
  ): void {
    if (candles.length === 0) {
      return;
    }

    const current = candles[candles.length - 1];
    if (current.timestamp.getTime() !== currentCandleTimestamp) {
      return;
    }

    const livePriceAces = latestTrade.priceInAces;
    const livePriceUsd = latestTrade.priceInUsd;

    if (!Number.isFinite(livePriceUsd) || livePriceUsd <= 0) {
      return;
    }

    const parse = (value: string | number | undefined | null): number => {
      if (value === undefined || value === null) {
        return 0;
      }
      const parsed = Number.parseFloat(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const openAces = parse(current.open);
    const openUsd = parse(current.openUsd);
    const supply = parse(current.circulatingSupply ?? current.totalSupply ?? '0');

    current.close = livePriceAces.toFixed(18);
    current.closeUsd = livePriceUsd.toFixed(18);

    const highAces = Math.max(parse(current.high), livePriceAces, openAces);
    const lowAces = Math.min(parse(current.low), livePriceAces, openAces);
    current.high = highAces.toFixed(18);
    current.low = lowAces.toFixed(18);

    const highUsd = Math.max(parse(current.highUsd), livePriceUsd, openUsd);
    const lowUsd = Math.min(parse(current.lowUsd), livePriceUsd, openUsd);
    current.highUsd = highUsd.toFixed(18);
    current.lowUsd = lowUsd.toFixed(18);

    if (Number.isFinite(supply) && supply > 0) {
      const marketCapCloseAces = livePriceAces * supply;
      const marketCapCloseUsd = livePriceUsd * supply;
      current.marketCapAces = marketCapCloseAces.toFixed(2);
      current.marketCapUsd = marketCapCloseUsd.toFixed(2);
      current.marketCapCloseUsd = marketCapCloseUsd.toFixed(2);

      const marketCapHighUsd = Math.max(parse(current.marketCapHighUsd), marketCapCloseUsd);
      const marketCapLowUsd = Math.min(parse(current.marketCapLowUsd), marketCapCloseUsd);
      current.marketCapHighUsd = marketCapHighUsd.toFixed(2);
      current.marketCapLowUsd = marketCapLowUsd.toFixed(2);
      if (!current.marketCapOpenUsd) {
        current.marketCapOpenUsd = (openUsd * supply).toFixed(2);
      }
    }

    if (dataSource === 'bonding_curve' && latestTrade.circulatingSupply) {
      current.circulatingSupply = latestTrade.circulatingSupply.toString();
      current.totalSupply = latestTrade.circulatingSupply.toString();
    }
  }

  /**
   * DEX trades stub - returns empty array
   * DEX chart data is now handled by DexScreener iframe on frontend
   */
  private async fetchRecentDexTrades(
    _tokenAddress: string,
    _poolAddress: string,
    _options: ChartOptions,
    _currentCandleTimestamp: number,
    _providedSeedCandle: Candle | null = null,
  ): Promise<Candle[]> {
    // DEX chart data handled by DexScreener iframe on frontend
    return [];
  }

  /**
   * DEX data stub - returns empty array
   * DEX chart data is now handled by DexScreener iframe on frontend
   */
  private async fetchDexDataWithSmartSwitching(
    tokenAddress: string,
    _poolAddress: string,
    _options: ChartOptions,
    _currentCandleTimestamp: number,
    _seedCandle: Candle | null = null,
    _dexStartDate?: Date,
  ): Promise<Candle[]> {
    // DEX chart data is now handled by DexScreener iframe on frontend
    console.log('[ChartAggregation] ⏭️ Skipping DEX fetch - handled by DexScreener on frontend', {
      tokenAddress: tokenAddress.toLowerCase(),
    });
    return [];
  }

  private async getBondingSeedCandle(
    tokenAddress: string,
    timeframe: string,
    rangeStart: Date,
    acesUsdPrice: number | null,
  ): Promise<Candle | null> {
    try {
      const intervalMs = this.getIntervalMs(timeframe);
      const alignedStart = this.alignTimestamp(rangeStart, timeframe);
      const baselineEnd = new Date(alignedStart);
      const baselineFrom = new Date(baselineEnd.getTime() - intervalMs * 12); // ~3 candles back

      const seedTrades = await this.fetchBondingTrades(tokenAddress, baselineFrom, baselineEnd, 5);
      if (seedTrades.length === 0) {
        return null;
      }

      // 🔥 CRITICAL FIX: Always use the MOST RECENT trade for seed candle price
      // Previously used [length-1] which got the OLDEST trade = floor price from bonding curve start!
      // This caused big red candles on page refresh as seed used floor price instead of current price.
      //
      // DEFENSIVE: Sort by timestamp descending to guarantee most recent is first,
      // regardless of API ordering changes. This makes the code order-agnostic.
      const sortedTrades = [...seedTrades].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
      const mostRecentTrade = sortedTrades[0];
      const tradeSupply = mostRecentTrade.circulatingSupply;
      const supplyValue =
        typeof tradeSupply === 'number' && tradeSupply > 0
          ? tradeSupply
          : parseFloat(this.BONDING_SUPPLY);

      const usdPrice =
        typeof mostRecentTrade.priceInUsd === 'number' && mostRecentTrade.priceInUsd > 0
          ? mostRecentTrade.priceInUsd
          : acesUsdPrice
            ? mostRecentTrade.priceInAces * acesUsdPrice
            : 0;

      console.log('[ChartAggregation] 🌱 Bonding seed candle price:', {
        tokenAddress: tokenAddress.slice(0, 10),
        timeframe,
        tradesFound: seedTrades.length,
        usingTradeIndex: 0,
        tradeTime: mostRecentTrade.timestamp.toISOString(),
        priceInAces: mostRecentTrade.priceInAces,
        priceInUsd: usdPrice,
      });

      return this.buildSeedCandle(
        timeframe,
        alignedStart,
        mostRecentTrade.priceInAces,
        usdPrice,
        supplyValue,
        'bonding_curve',
      );
    } catch (error) {
      console.warn('[ChartAggregation] Failed to build bonding seed candle:', error);
      return null;
    }
  }

  private async getDexSeedCandle(
    _tokenAddress: string,
    _poolAddress: string,
    _timeframe: string,
    _rangeStart: Date,
  ): Promise<Candle | null> {
    // DEX data handled by DexScreener iframe on frontend
    return null;
  }

  private buildSeedCandle(
    timeframe: string,
    alignedStartMs: number,
    priceInAces: number,
    priceInUsd: number,
    supply: number,
    dataSource: 'bonding_curve' | 'dex',
  ): Candle {
    const intervalMs = this.getIntervalMs(timeframe);
    const seedTime = alignedStartMs - intervalMs;
    const safeSupply =
      Number.isFinite(supply) && supply > 0 ? supply : parseFloat(this.BONDING_SUPPLY);
    const closeAces = Number.isFinite(priceInAces) ? priceInAces : 0;
    const closeUsd = Number.isFinite(priceInUsd) ? priceInUsd : 0;
    const supplyStr = safeSupply.toString();
    const marketCapAces = (closeAces * safeSupply).toFixed(2);
    const marketCapUsd = (closeUsd * safeSupply).toFixed(2);

    const closeAcesStr = closeAces.toFixed(18);
    const closeUsdStr = closeUsd.toFixed(18);

    return {
      timestamp: new Date(seedTime),
      open: closeAcesStr,
      high: closeAcesStr,
      low: closeAcesStr,
      close: closeAcesStr,
      openUsd: closeUsdStr,
      highUsd: closeUsdStr,
      lowUsd: closeUsdStr,
      closeUsd: closeUsdStr,
      volume: '0',
      volumeUsd: '0',
      trades: 0,
      dataSource,
      circulatingSupply: supplyStr,
      totalSupply: supplyStr,
      marketCapAces,
      marketCapUsd,
      marketCapOpenUsd: marketCapUsd,
      marketCapHighUsd: marketCapUsd,
      marketCapLowUsd: marketCapUsd,
      marketCapCloseUsd: marketCapUsd,
    };
  }

  /**
   * Fetch data for graduated tokens - handles bonding→DEX graduation boundary
   * This method determines if the request spans the graduation date and fetches from both sources if needed
   */
  private async fetchGraduatedTokenData(
    tokenAddress: string,
    graduationState: GraduationState,
    options: ChartOptions,
    acesUsdPrice: number | null,
    currentCandleTimestamp: number,
  ): Promise<Candle[]> {
    const graduationDate = new Date(graduationState.dexLiveAt!);

    const rangeCase =
      options.to < graduationDate ? 'pre' : options.from >= graduationDate ? 'post' : 'spanning';

    console.log('[ChartAggregation] 🎓 Graduation routing decision:', {
      tokenAddress: tokenAddress.toLowerCase(),
      timeframe: options.timeframe,
      from: options.from.toISOString(),
      to: options.to.toISOString(),
      dexLiveAt: graduationDate.toISOString(),
      case: rangeCase,
    });

    // console.log('[ChartAggregation] 🎓 Graduation boundary check:', {
    //   graduationDate: graduationDate.toISOString(),
    //   requestFrom: options.from.toISOString(),
    //   requestTo: options.to.toISOString(),
    // });

    // Check if request spans the graduation boundary
    const requestSpansGraduation = options.from < graduationDate && options.to >= graduationDate;

    // CASE 1: Request spans graduation - need data from both bonding and DEX
    if (requestSpansGraduation) {
      // console.log('[ChartAggregation] 🔀 Request spans graduation - using HYBRID approach');

      // Fetch bonding curve data (before graduation)
      const bondingCandles = await this.fetchBondingCurveData(
        tokenAddress,
        { ...options, to: graduationDate },
        acesUsdPrice,
        currentCandleTimestamp,
      );

      // 🔥 NEW: Pass last bonding candle as seed to ensure smooth connection
      const lastBondingCandle =
        bondingCandles.length > 0 ? bondingCandles[bondingCandles.length - 1] : null;

      // Fetch DEX data (after graduation) using 7-day smart switching
      const dexCandles = await this.fetchDexDataWithSmartSwitching(
        tokenAddress,
        graduationState.poolAddress!,
        { ...options, from: graduationDate },
        currentCandleTimestamp,
        lastBondingCandle, // 🔥 Pass seed candle for connection
        graduationDate,
      );

      console.log('[ChartAggregation] ✅ Merged graduation boundary:', {
        bonding: bondingCandles.length,
        dex: dexCandles.length,
        total: bondingCandles.length + dexCandles.length,
        lastBondingClose: lastBondingCandle?.close,
        firstDexOpen: dexCandles[0]?.open,
        seamlessConnection:
          lastBondingCandle && dexCandles[0] && lastBondingCandle.close === dexCandles[0].open,
      });

      return [...bondingCandles, ...dexCandles];
    }

    // CASE 2: Request is entirely before graduation
    if (options.to < graduationDate) {
      console.log(
        '[ChartAggregation] 📈 Entire range is pre-graduation - using bonding curve data',
      );
      return this.fetchBondingCurveData(
        tokenAddress,
        options,
        acesUsdPrice,
        currentCandleTimestamp,
      );
    }

    // CASE 3: Request is entirely after graduation
    // console.log('[ChartAggregation] 🏊 Entire request post-graduation (DEX)');
    return this.fetchDexDataWithSmartSwitching(
      tokenAddress,
      graduationState.poolAddress!,
      options,
      currentCandleTimestamp,
      null,
      graduationDate,
    );
  }

  /**
   * Check if token is graduated
   * 🔥 OPTIMIZED: Now uses token metadata cache (5-minute TTL)
   */
  private async checkGraduation(tokenAddress: string): Promise<GraduationState> {
    try {
      // console.log('[ChartAggregation] Checking graduation state (using cache)');

      // 🔥 NEW: Use cached token metadata instead of direct query
      const tokenMetadata = await this.tokenMetadataCache.getTokenMetadata(
        tokenAddress.toLowerCase(),
      );

      if (!tokenMetadata) {
        // console.log('[ChartAggregation] Token not found, assuming bonding curve');
        return {
          isBonded: false,
          poolAddress: null,
          poolReady: false,
          dexLiveAt: null,
        };
      }

      // Check if token has graduated to DEX
      const isGraduated =
        tokenMetadata.phase === 'DEX_TRADING' &&
        tokenMetadata.poolAddress !== null &&
        tokenMetadata.dexLiveAt !== null;

      if (isGraduated) {
        // console.log('[ChartAggregation] ✅ Token is graduated to DEX');
        return {
          isBonded: true,
          poolAddress: tokenMetadata.poolAddress!,
          poolReady: true,
          dexLiveAt: tokenMetadata.dexLiveAt!,
        };
      }

      //console.log('[ChartAggregation] Token still on bonding curve');
      return {
        isBonded: false,
        poolAddress: null,
        poolReady: false,
        dexLiveAt: null,
      };
    } catch (error) {
      console.warn('[ChartAggregation] Failed to check graduation state:', error);
      // Assume bonding if query fails (safe fallback)
      return {
        isBonded: false,
        poolAddress: null,
        poolReady: false,
        dexLiveAt: null,
      };
    }
  }

  /**
   * Align timestamp to timeframe boundary
   */
  private alignTimestamp(timestamp: Date, timeframe: string): number {
    return bucketTimestamp(timestamp, timeframe);
  }

  /**
   * Get interval in milliseconds for timeframe
   */
  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || 60 * 60 * 1000; // Default to 1h
  }

  /**
   * 🔥 LOAD TEST FIX: Get cache statistics for monitoring
   */
  getCacheStats() {
    const hitRate =
      this.cacheHits + this.cacheMisses > 0
        ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2)
        : '0.00';

    return {
      size: this.chartCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
      ttlMs: this.CACHE_TTL_MS,
    };
  }
}
