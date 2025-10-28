import { PrismaClient } from '@prisma/client';
import { BitQueryService } from './bitquery-service';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { ACES_TOKEN_ADDRESS, DATA_SOURCE_CONFIG } from '../config/bitquery.config';
import { TradePriceAggregator } from './trade-price-aggregator';
import { TokenMetadataCacheService } from './token-metadata-cache-service'; // 🔥 NEW
import { AcesSnapshotCacheService } from './aces-snapshot-cache-service'; // 🔥 NEW
import { ethers } from 'ethers'; // 🔥 For smart contract calls
import { getNetworkConfig, createProvider } from '../config/network.config'; // 🔥 RPC provider

// 🔥 Factory ABI - only the functions we need
const FACTORY_ABI = [
  'function getBuyPriceAfterFee(address tokenAddress, uint256 amount) external view returns (uint256)',
  'function getSellPriceAfterFee(address tokenAddress, uint256 amount) external view returns (uint256)',
];

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

export class ChartAggregationService {
  private readonly BONDING_SUPPLY = '800000000'; // 800M tokens for bonding curve
  private readonly GRADUATED_SUPPLY = '1000000000'; // 1B tokens after graduation
  private tradePriceAggregator: TradePriceAggregator;

  constructor(
    private prisma: PrismaClient,
    private bitQueryService: BitQueryService,
    private acesUsdPriceService: AcesUsdPriceService,
    private tokenMetadataCache: TokenMetadataCacheService, // 🔥 NEW: Token metadata cache
    private acesSnapshotCache: AcesSnapshotCacheService, // 🔥 NEW: ACES snapshot cache
  ) {
    this.tradePriceAggregator = new TradePriceAggregator(prisma, acesSnapshotCache);
  }

  /**
   * Main method: Get unified chart data
   * NOW WITH NO-GAP LOGIC: candle[n].open = candle[n-1].close
   */
  async getChartData(tokenAddress: string, options: ChartOptions): Promise<UnifiedChartResponse> {
    // console.log(`[ChartAggregation] Fetching chart data for ${tokenAddress}`, {
    //   timeframe: options.timeframe,
    //   from: options.from.toISOString(),
    //   to: options.to.toISOString(),
    // });

    const now = Date.now();
    const currentCandleTimestamp = this.alignTimestamp(new Date(now), options.timeframe);

    // 1. Check graduation state
    const graduationState = await this.checkGraduation(tokenAddress);

    // 2. Fetch ACES/USD price ONCE (graceful failure handling)
    let acesUsdPrice: number | null = null;
    try {
      const priceResult = await this.acesUsdPriceService.getAcesUsdPrice();
      acesUsdPrice = parseFloat(priceResult.price);

      if (!acesUsdPrice || isNaN(acesUsdPrice) || acesUsdPrice <= 0) {
        console.warn('[ChartAggregation] ⚠️ ACES/USD price invalid, will return ACES prices only');
        acesUsdPrice = null;
      } else {
        // console.log('[ChartAggregation] ✅ ACES/USD price fetched:', acesUsdPrice);
      }
    } catch (error) {
      console.warn(
        '[ChartAggregation] ⚠️ Failed to fetch ACES/USD price, will return ACES prices only:',
        error,
      );
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

    return {
      candles: enrichedCandles,
      graduationState,
      acesUsdPrice: acesUsdPrice ? acesUsdPrice.toFixed(6) : null,
    };
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

    try {
      // 🔥 OPTIMIZED: Reuse trade aggregator with snapshot cache
      const tradesWithPrices = await this.tradePriceAggregator.getTradesWithPrices(
        tokenAddress,
        Math.min(limit, 1000), // 🔥 OPTIMIZED: Use passed limit (capped at subgraph max)
        fromTimestamp,
        toTimestamp,
      );

      // console.log(
      //   `[ChartAggregation] Fetched ${tradesWithPrices.length} trades with historical ACES prices`,
      // );

      // 🔥 Fetch token parameters (steepness, floor) from SubGraph
      let steepness: string | null = null;
      let floor: string | null = null;

      const subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL || process.env.SUBGRAPH_URL;

      if (!subgraphUrl) {
        console.warn(
          `[ChartAggregation] ⚠️ SubGraph URL not configured (GOLDSKY_SUBGRAPH_URL or SUBGRAPH_URL missing)`,
        );
      } else {
        try {
          const query = `{
            tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
              address
              steepness
              floor
            }
          }`;

          // Add timeout and retry logic to handle ECONNRESET errors
          const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
              const response = await fetch(url, {
                ...options,
                signal: controller.signal,
              });
              return response;
            } finally {
              clearTimeout(timeout);
            }
          };

          const maxRetries = 2;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const response = await fetchWithTimeout(
                subgraphUrl,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query }),
                },
                5000, // 5 second timeout
              );

              if (response.ok) {
                const result = (await response.json()) as {
                  data?: { tokens?: Array<{ steepness: string; floor: string }> };
                };
                const tokens = result?.data?.tokens;

                if (tokens && tokens.length > 0) {
                  steepness = tokens[0].steepness;
                  floor = tokens[0].floor;
                  break; // Success, exit retry loop
                }
              } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
            } catch (error) {
              lastError = error as Error;

              if (attempt < maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 3000);
                console.warn(
                  `[ChartAggregation] ⚠️ SubGraph fetch attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`,
                  error instanceof Error ? error.message : error,
                );
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
              }
            }
          }

          if (lastError && !steepness && !floor) {
            throw lastError;
          }
        } catch (error) {
          console.error(
            `[ChartAggregation] ❌ Failed to fetch token parameters from SubGraph after retries:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      if (!steepness || !floor) {
        console.warn(
          `[ChartAggregation] ⚠️ Missing token parameters for ${tokenAddress}, using fallback pricing`,
        );
      }

      // Transform to Trade format expected by the rest of the service
      // 🔥 CRITICAL CHANGE: Use marginal buy price logic for display
      const transformedTrades: Trade[] = [];

      for (const trade of tradesWithPrices) {
        const tokenAmount = parseFloat(trade.tokenAmount) / 1e18;
        const acesTokenAmount = parseFloat(trade.acesTokenAmount) / 1e18;
        const supply = parseFloat(trade.supply) / 1e18; // Circulating supply AFTER this trade

        // 🔥 MARGINAL PRICE LOGIC (CORRECTED):
        // SubGraph gives us supply AFTER the trade.
        // We need to show the marginal buy price at the CORRECT supply level:
        //
        // For BUY trades:
        // - User bought tokenAmount FROM curve
        // - Supply BEFORE trade = supply + tokenAmount (higher)
        // - Supply AFTER trade = supply (lower)
        // - Show marginal price at supply AFTER = HIGHER price ✅
        //
        // For SELL trades:
        // - User sold tokenAmount TO curve
        // - Supply BEFORE trade = supply - tokenAmount (lower)
        // - Supply AFTER trade = supply (higher)
        // - Show marginal price at supply AFTER = LOWER price ✅

        let priceInAces: number;

        if (steepness && floor) {
          // For BOTH: Calculate marginal price at supply AFTER trade
          // This automatically gives us the right relationship:
          // - BUY: supply is lower → price is higher
          // - SELL: supply is higher → price is lower
          priceInAces = this.calculateMarginalBuyPrice(supply, steepness, floor);

          // console.log(
          //   `[ChartAggregation] ${trade.isBuy ? 'BUY' : 'SELL'} trade ${trade.id.slice(0, 10)}: ` +
          //     `Marginal price=${priceInAces.toFixed(8)} ACES/token (supply after: ${supply.toFixed(0)})`,
          // );
        } else {
          // Fallback: Use execution price
          priceInAces = tokenAmount > 0 ? acesTokenAmount / tokenAmount : 0;

          // console.warn(
          //   `[ChartAggregation] ${trade.isBuy ? 'BUY' : 'SELL'} trade ${trade.id.slice(0, 10)}: ` +
          //     `Fallback price=${priceInAces.toFixed(8)} ACES/token`,
          // );
        }

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
      return transformedTrades;
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
    limit: number = 2000, // 🔥 OPTIMIZED: Sensible default instead of 5000
  ): Promise<Trade[]> {
    const bitQueryTrades = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
      from,
      to,
      counterTokenAddress: ACES_TOKEN_ADDRESS,
      limit: Math.min(limit, 5000), // 🔥 OPTIMIZED: Use passed limit (capped at BitQuery max)
    });

    // Transform to Trade format
    return bitQueryTrades.map((trade) => ({
      timestamp: trade.blockTime,
      priceInAces: parseFloat(trade.priceInAces),
      priceInUsd: parseFloat(trade.priceInUsd),
      amountToken: parseFloat(trade.amountToken),
      volumeUsd: parseFloat(trade.volumeUsd),
      side: trade.side,
    }));
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
    const endTime = this.alignTimestamp(to, timeframe);

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
        candle = this.createCandleWithTrades(
          bucketTrades,
          currentTime,
          acesUsdPrice,
          dataSource,
          supply,
          previousCandle,
          intervalMs,
        );
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
  ): Candle {
    // Sort trades by timestamp
    bucketTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Extract price arrays
    const pricesInAces = bucketTrades.map((t) => t.priceInAces);
    const pricesInUsd = bucketTrades.map((t) => t.priceInUsd);

    // OHLC in ACES
    let openAces = pricesInAces[0];
    const closeAces = pricesInAces[pricesInAces.length - 1];
    const highAces = Math.max(...pricesInAces);
    const lowAces = Math.min(...pricesInAces);

    // CRITICAL: Connect to previous candle (NO GAPS!)
    if (previousCandle) {
      openAces = parseFloat(previousCandle.close);
    }

    // OHLC in USD
    let openUsd: number, closeUsd: number, highUsd: number, lowUsd: number;

    if (dataSource === 'dex' && pricesInUsd.some((p) => p > 0)) {
      // DEX: Use BitQuery USD prices (already in USD from BitQuery)
      const firstTradeUsd = pricesInUsd[0];
      closeUsd = pricesInUsd[pricesInUsd.length - 1];
      highUsd = Math.max(...pricesInUsd);
      lowUsd = Math.min(...pricesInUsd);

      // Connect USD to previous candle
      openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : firstTradeUsd;
    } else {
      // Bonding Curve: Use snapshot USD prices (already in trades from TradePriceAggregator)
      // The pricesInUsd array (line 391) contains USD values calculated using database snapshots
      const firstTradeUsd = pricesInUsd[0];
      closeUsd = pricesInUsd[pricesInUsd.length - 1];
      highUsd = Math.max(...pricesInUsd);
      lowUsd = Math.min(...pricesInUsd);

      // Connect USD to previous candle (NO GAPS)
      openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : firstTradeUsd;
    }

    // Volume
    const volume = bucketTrades.reduce((sum, t) => sum + t.amountToken, 0);
    const volumeUsd = bucketTrades.reduce((sum, t) => sum + t.volumeUsd, 0);

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
      volumeUsd: volumeUsd.toFixed(2),
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

    let closeUsd: number, highUsd: number, lowUsd: number;

    // For both bonding curve AND DEX: Empty candle = flat line (no trades = no price movement)
    // No trades means no price change - USD value stays exactly the same
    closeUsd = openUsd; // Flat line
    highUsd = openUsd; // No wicks
    lowUsd = openUsd; // No movement

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

    const trades = await this.fetchBondingTrades(
      tokenAddress,
      options.from,
      options.to,
      (options.limit || 200) * 3,
    );

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
   * Fetch historical pre-aggregated OHLCV from Trading.Tokens (BitQuery)
   * Used for DEX data older than 7 days for better performance
   * BitQuery returns USD prices directly - no conversion needed!
   */
  private async fetchHistoricalDexOHLCV(
    tokenAddress: string,
    options: ChartOptions,
    seedCandle: Candle | null = null, // 🔥 NEW: Accept seed candle for graduation connection
  ): Promise<Candle[]> {
    // console.log('[ChartAggregation] 📜 Fetching pre-aggregated OHLCV from Trading.Tokens');

    const bitQueryCandles = await this.bitQueryService.getTradingTokensOHLC(
      tokenAddress,
      options.timeframe,
      {
        from: options.from,
        to: options.to,
      },
    );

    // console.log(`[ChartAggregation] ✅ Received ${bitQueryCandles.length} pre-aggregated candles`);

    if (bitQueryCandles.length === 0) {
      return [];
    }

    // Convert BitQuery candles to our Candle format
    const supply = this.GRADUATED_SUPPLY;
    const supplyNum = parseFloat(supply);

    const safeParse = (value: string | number | null | undefined): number => {
      if (value === null || value === undefined) {
        return 0;
      }
      const parsed = Number.parseFloat(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const adjustRangeForOpen = (
      openStr: string,
      highStr: string,
      lowStr: string,
    ): { high: string; low: string } => {
      const openVal = safeParse(openStr);
      let highVal = safeParse(highStr);
      let lowVal = safeParse(lowStr);

      if (openVal > highVal) {
        highVal = openVal;
      }
      if (openVal < lowVal) {
        lowVal = openVal;
      }

      return {
        high: highVal.toString(),
        low: lowVal.toString(),
      };
    };

    const candles = bitQueryCandles.map((bqCandle, index) => {
      // Trading.Tokens gives us USD prices directly - perfect!
      let openUsdStr = bqCandle.openUsd || bqCandle.open;
      let highUsdStr = bqCandle.highUsd || bqCandle.high;
      let lowUsdStr = bqCandle.lowUsd || bqCandle.low;
      const closeUsdStr = bqCandle.closeUsd || bqCandle.close;
      const volumeUsd = safeParse(bqCandle.volumeUsd || bqCandle.volume);

      // 🔥 GRADUATION CONNECTION: First candle should connect to seed
      if (index === 0 && seedCandle) {
        openUsdStr = seedCandle.closeUsd;
        const adjusted = adjustRangeForOpen(openUsdStr, highUsdStr, lowUsdStr);
        highUsdStr = adjusted.high;
        lowUsdStr = adjusted.low;
        console.log('[ChartAggregation] 🔗 Connected first DEX candle to bonding curve:', {
          bondingClose: seedCandle.closeUsd,
          dexOpen: openUsdStr,
          originalDexOpen: bqCandle.openUsd || bqCandle.open,
        });
      }

      let openAcesStr = bqCandle.open;
      let highAcesStr = bqCandle.high;
      let lowAcesStr = bqCandle.low;
      const closeAcesStr = bqCandle.close;

      if (index === 0 && seedCandle) {
        openAcesStr = seedCandle.close;
        const adjustedAces = adjustRangeForOpen(openAcesStr, highAcesStr, lowAcesStr);
        highAcesStr = adjustedAces.high;
        lowAcesStr = adjustedAces.low;
      }

      const openUsd = safeParse(openUsdStr);
      const highUsd = safeParse(highUsdStr);
      const lowUsd = safeParse(lowUsdStr);
      const closeUsd = safeParse(closeUsdStr);

      // Market cap will be calculated in enrichment step
      const marketCapCloseUsd = closeUsd * supplyNum;

      return {
        timestamp: bqCandle.timestamp,
        // ACES prices (same as USD for now, enrichment will handle conversion if needed)
        open: openAcesStr,
        high: highAcesStr,
        low: lowAcesStr,
        close: closeAcesStr,
        // USD prices (from BitQuery - already perfect!)
        openUsd: openUsdStr,
        highUsd: highUsdStr,
        lowUsd: lowUsdStr,
        closeUsd: closeUsdStr,
        // Volume
        volume: bqCandle.volume,
        volumeUsd: volumeUsd.toFixed(2),
        trades: bqCandle.trades || 0,
        // Metadata
        dataSource: 'dex' as const,
        circulatingSupply: supply,
        totalSupply: supply,
        marketCapAces: '0', // Will be enriched later
        marketCapUsd: marketCapCloseUsd.toFixed(2),
        marketCapOpenUsd: (openUsd * supplyNum).toFixed(2),
        marketCapHighUsd: (highUsd * supplyNum).toFixed(2),
        marketCapLowUsd: (lowUsd * supplyNum).toFixed(2),
        marketCapCloseUsd: marketCapCloseUsd.toFixed(2),
      };
    });

    return candles;
  }

  /**
   * Fetch recent DEX trades and aggregate them into candles
   * Used for DEX data less than 7 days old
   */
  private async fetchRecentDexTrades(
    tokenAddress: string,
    poolAddress: string,
    options: ChartOptions,
    currentCandleTimestamp: number,
    providedSeedCandle: Candle | null = null, // 🔥 NEW: Accept provided seed candle
  ): Promise<Candle[]> {
    const tradeLimit = Math.min((options.limit || 200) * 3, 5000);

    // console.log('[ChartAggregation] 🔥 Fetching recent DEX trades:', {
    //   limit: tradeLimit,
    //   from: options.from.toISOString(),
    //   to: options.to.toISOString(),
    //   hasProvidedSeed: !!providedSeedCandle,
    // });

    const bitQueryTrades = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
      from: options.from,
      to: options.to,
      counterTokenAddress: ACES_TOKEN_ADDRESS,
      limit: tradeLimit,
    });

    console.log(`[ChartAggregation] ✅ Fetched ${bitQueryTrades.length} DEX trades from BitQuery`);

    // Convert to internal Trade format
    const trades: Trade[] = bitQueryTrades.map((trade) => ({
      timestamp: trade.blockTime,
      priceInAces: parseFloat(trade.priceInAces),
      priceInUsd: parseFloat(trade.priceInUsd),
      amountToken: parseFloat(trade.amountToken),
      volumeUsd: parseFloat(trade.volumeUsd),
      side: trade.side,
    }));

    if (trades.length > 0) {
      console.log('[ChartAggregation] 📊 Sample DEX trade for candle creation:', {
        timestamp: trades[0].timestamp.toISOString(),
        priceInUsd: trades[0].priceInUsd,
        priceInAces: trades[0].priceInAces,
        amountToken: trades[0].amountToken,
      });
    }

    // 🔥 UPDATED: Use provided seed candle if available, otherwise fetch one
    let seedCandle: Candle | null = providedSeedCandle;

    if (!seedCandle) {
      const alignedRangeStart = this.alignTimestamp(options.from, options.timeframe);
      const firstTradeBucket =
        trades.length > 0 ? this.alignTimestamp(trades[0].timestamp, options.timeframe) : null;

      if (
        trades.length === 0 ||
        (firstTradeBucket !== null && firstTradeBucket > alignedRangeStart)
      ) {
        seedCandle = await this.getDexSeedCandle(
          tokenAddress,
          poolAddress,
          options.timeframe,
          options.from,
        );
      }
    }

    // Aggregate trades into candles using existing method
    const candles = this.aggregateTradesToCandlesWithNoGaps(
      trades,
      options.timeframe,
      options.from,
      options.to,
      null, // acesUsdPrice not needed - BitQuery trades already have USD prices
      currentCandleTimestamp,
      'dex',
      seedCandle,
    );

    console.log(
      `[ChartAggregation] 🕯️ Created ${candles.length} DEX candles from ${trades.length} trades`,
    );
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      console.log('[ChartAggregation] 📊 Last DEX candle:', {
        timestamp: lastCandle.timestamp.toISOString(),
        openUsd: lastCandle.openUsd,
        highUsd: lastCandle.highUsd,
        lowUsd: lastCandle.lowUsd,
        closeUsd: lastCandle.closeUsd,
        trades: lastCandle.trades,
        dataSource: lastCandle.dataSource,
      });
    }

    return candles;
  }

  /**
   * Smart switching between recent trades and historical OHLCV for DEX data
   * Implements the 7-day boundary strategy for optimal performance
   */
  private async fetchDexDataWithSmartSwitching(
    tokenAddress: string,
    poolAddress: string,
    options: ChartOptions,
    currentCandleTimestamp: number,
    seedCandle: Candle | null = null, // 🔥 NEW: Accept seed candle for graduation connection
  ): Promise<Candle[]> {
    const now = new Date();
    const historicalBoundary = new Date(
      now.getTime() - DATA_SOURCE_CONFIG.HISTORICAL_BOUNDARY_DAYS * 24 * 60 * 60 * 1000,
    );

    // Determine which strategy to use based on request time range
    const isEntirelyRecent = options.from >= historicalBoundary;
    const isEntirelyHistorical = options.to < historicalBoundary;

    // STRATEGY 1: Entirely recent (< 7 days) - use individual trades
    if (isEntirelyRecent) {
      // console.log('[ChartAggregation] 🔥 Using individual trades (real-time accuracy)');
      return this.fetchRecentDexTrades(
        tokenAddress,
        poolAddress,
        options,
        currentCandleTimestamp,
        seedCandle,
      );
    }

    // STRATEGY 2: Entirely historical (≥ 7 days old) - use pre-aggregated OHLCV
    if (isEntirelyHistorical) {
      // console.log('[ChartAggregation] 📜 Using pre-aggregated OHLCV (performance)');
      return this.fetchHistoricalDexOHLCV(tokenAddress, options, seedCandle);
    }

    // STRATEGY 3: Hybrid - request spans the 7-day boundary
    // console.log('[ChartAggregation] 🔀 Using HYBRID (historical + recent)');

    // Fetch historical part (7+ days ago)
    const historicalCandles = await this.fetchHistoricalDexOHLCV(
      tokenAddress,
      {
        ...options,
        to: historicalBoundary,
      },
      seedCandle,
    ); // 🔥 Pass seed to historical part

    // Fetch recent part (< 7 days)
    // Use last historical candle as seed for recent candles
    const historicalSeed =
      historicalCandles.length > 0 ? historicalCandles[historicalCandles.length - 1] : seedCandle;
    const recentCandles = await this.fetchRecentDexTrades(
      tokenAddress,
      poolAddress,
      { ...options, from: historicalBoundary },
      currentCandleTimestamp,
      historicalSeed, // 🔥 Pass seed for connection
    );

    return [...historicalCandles, ...recentCandles];
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

      const lastTrade = seedTrades[seedTrades.length - 1];
      const supplyValue =
        typeof lastTrade.circulatingSupply === 'number' && lastTrade.circulatingSupply > 0
          ? lastTrade.circulatingSupply
          : parseFloat(this.BONDING_SUPPLY);

      const usdPrice =
        typeof lastTrade.priceInUsd === 'number' && lastTrade.priceInUsd > 0
          ? lastTrade.priceInUsd
          : acesUsdPrice
            ? lastTrade.priceInAces * acesUsdPrice
            : 0;

      return this.buildSeedCandle(
        timeframe,
        alignedStart,
        lastTrade.priceInAces,
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
    tokenAddress: string,
    poolAddress: string,
    timeframe: string,
    rangeStart: Date,
  ): Promise<Candle | null> {
    try {
      const intervalMs = this.getIntervalMs(timeframe);
      const alignedStart = this.alignTimestamp(rangeStart, timeframe);
      const baselineEnd = new Date(alignedStart);
      const baselineFrom = new Date(baselineEnd.getTime() - intervalMs * 12);

      const seedTrades = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
        from: baselineFrom,
        to: baselineEnd,
        counterTokenAddress: ACES_TOKEN_ADDRESS,
        limit: 25,
      });

      if (seedTrades.length === 0) {
        return null;
      }

      const lastTrade = seedTrades[seedTrades.length - 1];
      const priceInAces = parseFloat(lastTrade.priceInAces);
      const priceInUsd = parseFloat(lastTrade.priceInUsd);
      const supplyValue = parseFloat(this.GRADUATED_SUPPLY);

      return this.buildSeedCandle(
        timeframe,
        alignedStart,
        priceInAces,
        priceInUsd,
        supplyValue,
        'dex',
      );
    } catch (error) {
      console.warn('[ChartAggregation] Failed to build DEX seed candle:', error);
      return null;
    }
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
      // console.log('[ChartAggregation] 📈 Entire request pre-graduation (bonding curve)');
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
    const ms = timestamp.getTime();
    const intervalMs = this.getIntervalMs(timeframe);
    return Math.floor(ms / intervalMs) * intervalMs;
  }

  /**
   * Get interval in milliseconds for timeframe
   */
  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || 60 * 60 * 1000; // Default to 1h
  }
}
