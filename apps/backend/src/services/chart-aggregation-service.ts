import { PrismaClient } from '@prisma/client';
import { BitQueryService } from './bitquery-service';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { ACES_TOKEN_ADDRESS } from '../config/bitquery.config';

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

  constructor(
    private prisma: PrismaClient,
    private bitQueryService: BitQueryService,
    private acesUsdPriceService: AcesUsdPriceService,
  ) {}

  /**
   * Main method: Get unified chart data
   * NOW WITH NO-GAP LOGIC: candle[n].open = candle[n-1].close
   */
  async getChartData(tokenAddress: string, options: ChartOptions): Promise<UnifiedChartResponse> {
    console.log(`[ChartAggregation] Fetching chart data for ${tokenAddress}`, {
      timeframe: options.timeframe,
      from: options.from.toISOString(),
      to: options.to.toISOString(),
    });

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
        console.log(`[ChartAggregation] ✅ ACES/USD price: $${acesUsdPrice.toFixed(6)}`);
      }
    } catch (error) {
      console.warn(
        '[ChartAggregation] ⚠️ Failed to fetch ACES/USD price, will return ACES prices only:',
        error,
      );
      acesUsdPrice = null;
    }

    // 3. Fetch trades based on graduation state
    let trades: Trade[];
    if (graduationState.poolReady && graduationState.poolAddress) {
      console.log('[ChartAggregation] Token is graduated - fetching DEX trades');
      trades = await this.fetchDexTrades(
        tokenAddress,
        graduationState.poolAddress,
        options.from,
        options.to,
      );
    } else {
      console.log('[ChartAggregation] Token is bonding - fetching SubGraph trades');
      trades = await this.fetchBondingTrades(tokenAddress, options.from, options.to);
    }

    console.log(`[ChartAggregation] Fetched ${trades.length} trades`);

    // 4. Aggregate trades into candles WITH NO-GAP LOGIC
    let candles = this.aggregateTradesToCandlesWithNoGaps(
      trades,
      options.timeframe,
      options.from,
      options.to,
      acesUsdPrice,
      currentCandleTimestamp,
      graduationState.poolReady ? 'dex' : 'bonding_curve',
    );

    console.log(`[ChartAggregation] Generated ${candles.length} candles with no gaps`);

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
   * Fetch bonding curve trades from SubGraph
   */
  private async fetchBondingTrades(tokenAddress: string, from: Date, to: Date): Promise<Trade[]> {
    const subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL;
    if (!subgraphUrl) {
      throw new Error('GOLDSKY_SUBGRAPH_URL not configured');
    }

    const fromTimestamp = Math.floor(from.getTime() / 1000);
    const toTimestamp = Math.floor(to.getTime() / 1000);

    const query = `{
      trades(
        where: {
          token: "${tokenAddress.toLowerCase()}",
          createdAt_gte: ${fromTimestamp},
          createdAt_lte: ${toTimestamp}
        }
        orderBy: createdAt
        orderDirection: asc
        first: 1000
      ) {
        id
        createdAt
        tokenAmount
        acesTokenAmount
        isBuy
        supply
      }
    }`;

    try {
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`SubGraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as any;

      if (result.errors) {
        throw new Error(`SubGraph errors: ${JSON.stringify(result.errors)}`);
      }

      const subgraphTrades = result.data?.trades || [];

      // Transform to Trade format
      return subgraphTrades.map((trade: any) => {
        const tokenAmount = parseFloat(trade.tokenAmount) / 1e18;
        const acesTokenAmount = parseFloat(trade.acesTokenAmount) / 1e18;
        const supply = parseFloat(trade.supply) / 1e18; // Circulating supply at this trade

        // Price = ACES per Token
        const priceInAces = tokenAmount > 0 ? acesTokenAmount / tokenAmount : 0;

        return {
          timestamp: new Date(parseInt(trade.createdAt) * 1000),
          priceInAces,
          priceInUsd: 0, // Will be calculated with ACES/USD price later
          amountToken: tokenAmount,
          volumeUsd: 0, // Will be calculated later
          side: trade.isBuy ? 'buy' : 'sell',
          circulatingSupply: supply, // Actual circulating supply from SubGraph
        };
      });
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
  ): Promise<Trade[]> {
    const bitQueryTrades = await this.bitQueryService.getDexTrades(tokenAddress, poolAddress, {
      from,
      to,
      counterTokenAddress: ACES_TOKEN_ADDRESS,
      limit: 5000,
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
    let previousCandle: Candle | null = null;
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
      console.log(
        `[ChartAggregation] 🔗 Connecting candle at ${new Date(timestamp).toISOString()}: open=${openAces.toFixed(8)} (previous close)`,
      );
    }

    // OHLC in USD
    let openUsd: number, closeUsd: number, highUsd: number, lowUsd: number;

    if (dataSource === 'dex' && pricesInUsd.some((p) => p > 0)) {
      // DEX: Use BitQuery USD prices
      const firstTradeUsd = pricesInUsd[0];
      closeUsd = pricesInUsd[pricesInUsd.length - 1];
      highUsd = Math.max(...pricesInUsd);
      lowUsd = Math.min(...pricesInUsd);

      // Connect USD to previous candle
      openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : firstTradeUsd;
    } else if (acesUsdPrice && acesUsdPrice > 0) {
      // Bonding: Convert ACES to USD
      openUsd = openAces * acesUsdPrice;
      closeUsd = closeAces * acesUsdPrice;
      highUsd = highAces * acesUsdPrice;
      lowUsd = lowAces * acesUsdPrice;
    } else {
      // No USD price available
      openUsd = 0;
      closeUsd = 0;
      highUsd = 0;
      lowUsd = 0;
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
      console.log(
        `[ChartAggregation] 📊 Candle supply: ${(parseFloat(actualSupply) / 1e6).toFixed(2)}M (from trade)`,
      );
    } else {
      // DEX: Use fixed graduated supply
      actualSupply = supply;
    }

    const supplyNum = parseFloat(actualSupply);

    // Calculate Market Cap OHLC with NO-GAP logic
    let marketCapOpenUsd: number;
    let marketCapCloseUsd: number;
    let marketCapHighUsd: number;
    let marketCapLowUsd: number;

    // CRITICAL: Market cap open connects to previous candle's market cap close (NO GAPS!)
    if (previousCandle && previousCandle.marketCapCloseUsd) {
      marketCapOpenUsd = parseFloat(previousCandle.marketCapCloseUsd);
      console.log(
        `[ChartAggregation] 🔗 Connecting market cap: open=$${marketCapOpenUsd.toFixed(2)} (previous close)`,
      );
    } else {
      // First candle: calculate from open price
      marketCapOpenUsd = openUsd * supplyNum;
    }

    // Close market cap: current price × current supply
    marketCapCloseUsd = closeUsd * supplyNum;

    // High/Low: Calculate from price high/low × supply, but also consider open/close
    const marketCapAtHigh = highUsd * supplyNum;
    const marketCapAtLow = lowUsd * supplyNum;

    marketCapHighUsd = Math.max(marketCapOpenUsd, marketCapCloseUsd, marketCapAtHigh);
    marketCapLowUsd = Math.min(marketCapOpenUsd, marketCapCloseUsd, marketCapAtLow);

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
  ): Candle {
    // CRITICAL: Connect to previous candle (NO GAPS!)
    const openAces = parseFloat(previousCandle.close);
    const closeAces = openAces; // No RWA trades, ACES price per RWA stays same

    // Open USD connects to previous candle
    const openUsd = parseFloat(previousCandle.closeUsd);

    // Close USD reflects current ACES/USD rate (shows ACES movement!)
    let closeUsd: number;
    if (acesUsdPrice && acesUsdPrice > 0) {
      closeUsd = closeAces * acesUsdPrice;
    } else {
      closeUsd = openUsd; // Frozen if no ACES/USD available
    }

    // High/Low show range of ACES movement during this period
    const highUsd = Math.max(openUsd, closeUsd);
    const lowUsd = Math.min(openUsd, closeUsd);

    // Use supply from previous candle (no trades = no supply change)
    const supplyNum = parseFloat(previousCandle.circulatingSupply);

    // Calculate Market Cap OHLC with NO-GAP logic for empty candles
    let marketCapOpenUsd: number;
    let marketCapCloseUsd: number;
    let marketCapHighUsd: number;
    let marketCapLowUsd: number;

    // CRITICAL: Market cap open connects to previous candle's market cap close (NO GAPS!)
    if (previousCandle.marketCapCloseUsd) {
      marketCapOpenUsd = parseFloat(previousCandle.marketCapCloseUsd);
    } else {
      // Fallback: calculate from open price
      marketCapOpenUsd = openUsd * supplyNum;
    }

    // Close market cap: current price × current supply (supply unchanged for empty candle)
    marketCapCloseUsd = closeUsd * supplyNum;

    // High/Low: Range of ACES movement affects market cap
    marketCapHighUsd = Math.max(marketCapOpenUsd, marketCapCloseUsd);
    marketCapLowUsd = Math.min(marketCapOpenUsd, marketCapCloseUsd);

    console.log(
      `[ChartAggregation] 📊 Empty candle at ${new Date(timestamp).toISOString()}: ` +
        `price: $${openUsd.toFixed(8)} → $${closeUsd.toFixed(8)} ` +
        `mcap: $${marketCapOpenUsd.toFixed(2)} → $${marketCapCloseUsd.toFixed(2)} ` +
        `(ACES movement: ${((closeUsd / openUsd - 1) * 100).toFixed(2)}%)`,
    );

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
   * Check if token is graduated
   */
  private async checkGraduation(tokenAddress: string): Promise<GraduationState> {
    try {
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: tokenAddress.toLowerCase() },
        select: {
          poolAddress: true,
          dexLiveAt: true,
          phase: true,
        },
      });

      if (token?.poolAddress && token?.dexLiveAt) {
        return {
          isBonded: true,
          poolAddress: token.poolAddress,
          poolReady: true,
          dexLiveAt: token.dexLiveAt,
        };
      }

      return {
        isBonded: false,
        poolAddress: null,
        poolReady: false,
        dexLiveAt: null,
      };
    } catch (error) {
      console.warn('[ChartAggregation] Failed to check graduation state:', error);
      // Assume bonding if DB query fails
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
