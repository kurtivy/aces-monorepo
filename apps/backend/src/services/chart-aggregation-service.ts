import { PrismaClient } from '@prisma/client';
import { BitQueryService } from './bitquery-service';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { ACES_TOKEN_ADDRESS } from '../config/bitquery.config';
import { TradePriceAggregator } from './trade-price-aggregator';
import { acesPriceTracker } from './aces-price-tracker';

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

    if (trades.length === 0) {
      console.warn(
        `[ChartAggregation] ⚠️ No trades found for ${tokenAddress}, returning empty candles`,
      );
      return {
        candles: [],
        graduationState,
        acesUsdPrice: acesUsdPrice ? acesUsdPrice.toFixed(6) : null,
      };
    }

    // Log first and last trade for debugging
    console.log(`[ChartAggregation] First trade:`, {
      timestamp: trades[0]?.timestamp,
      priceInUsd: trades[0]?.priceInUsd,
      amountToken: trades[0]?.amountToken,
    });
    console.log(`[ChartAggregation] Last trade:`, {
      timestamp: trades[trades.length - 1]?.timestamp,
      priceInUsd: trades[trades.length - 1]?.priceInUsd,
      amountToken: trades[trades.length - 1]?.amountToken,
    });

    // 4. Aggregate trades into candles WITH NO-GAP LOGIC
    const candles = this.aggregateTradesToCandlesWithNoGaps(
      trades,
      options.timeframe,
      options.from,
      options.to,
      acesUsdPrice,
      currentCandleTimestamp,
      graduationState.poolReady ? 'dex' : 'bonding_curve',
    );

    console.log(`[ChartAggregation] Generated ${candles.length} candles with no gaps`);

    if (candles.length > 0) {
      console.log(`[ChartAggregation] First candle:`, {
        timestamp: candles[0].timestamp,
        open: candles[0].open,
        high: candles[0].high,
        low: candles[0].low,
        close: candles[0].close,
        openUsd: candles[0].openUsd,
        closeUsd: candles[0].closeUsd,
        volume: candles[0].volume,
      });
      console.log(`[ChartAggregation] Last candle:`, {
        timestamp: candles[candles.length - 1].timestamp,
        open: candles[candles.length - 1].open,
        high: candles[candles.length - 1].high,
        low: candles[candles.length - 1].low,
        close: candles[candles.length - 1].close,
        openUsd: candles[candles.length - 1].openUsd,
        closeUsd: candles[candles.length - 1].closeUsd,
        volume: candles[candles.length - 1].volume,
      });
    }

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
   * Fetch bonding curve trades from SubGraph with historical ACES prices
   * NOW USES TradePriceAggregator for accurate historical pricing
   */
  private async fetchBondingTrades(tokenAddress: string, from: Date, to: Date): Promise<Trade[]> {
    const fromTimestamp = Math.floor(from.getTime() / 1000);
    const toTimestamp = Math.floor(to.getTime() / 1000);

    try {
      // Use TradePriceAggregator to get trades enriched with historical ACES prices
      const aggregator = new TradePriceAggregator(this.prisma);
      const tradesWithPrices = await aggregator.getTradesWithPrices(
        tokenAddress,
        1000, // Subgraph max limit is 1000
        fromTimestamp,
        toTimestamp,
      );

      console.log(
        `[ChartAggregation] Fetched ${tradesWithPrices.length} trades with historical ACES prices`,
      );

      // Transform to Trade format expected by the rest of the service
      return tradesWithPrices.map((trade) => {
        const tokenAmount = parseFloat(trade.tokenAmount) / 1e18;
        const acesTokenAmount = parseFloat(trade.acesTokenAmount) / 1e18;
        const supply = parseFloat(trade.supply) / 1e18; // Circulating supply at this trade

        // Price = ACES per Token
        const priceInAces = tokenAmount > 0 ? acesTokenAmount / tokenAmount : 0;

        // Calculate USD price using HISTORICAL ACES price
        const priceInUsd = priceInAces * trade.acesUsdPriceAtExecution;

        // Calculate volume in USD using historical ACES price
        const volumeUsd = tokenAmount * priceInAces * trade.acesUsdPriceAtExecution;

        return {
          timestamp: new Date(parseInt(trade.createdAt) * 1000),
          priceInAces,
          priceInUsd, // Now using historical ACES price! ✅
          amountToken: tokenAmount,
          volumeUsd, // Now accurate! ✅
          side: (trade.isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
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
    console.log('[ChartAggregation] 🕐 Time range:', {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      currentCandleTimestamp: new Date(currentCandleTimestamp).toISOString(),
      intervalMs,
      willCreateCurrentCandle: currentCandleTimestamp <= to.getTime(),
    });
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
      console.log(
        `[ChartAggregation] 🔗 Connecting candle at ${new Date(timestamp).toISOString()}: open=${openAces.toFixed(8)} (previous close)`,
      );
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
      // Bonding Curve: Combine token OHLC (in ACES) with ACES OHLC (in USD) from memory
      const candleEndTime = timestamp + intervalMs;

      // Try to get ACES OHLC from memory for this candle period
      const acesOHLC = acesPriceTracker.getAcesOHLCForPeriod(timestamp, candleEndTime);

      if (acesOHLC) {
        // 🔥 ENHANCED MODE: Use ACES OHLC from memory for accurate wicks
        console.log(
          `[ChartAggregation] 📊 Using ACES OHLC from memory for ${new Date(timestamp).toISOString()}:`,
          {
            open: `$${acesOHLC.open.toFixed(6)}`,
            high: `$${acesOHLC.high.toFixed(6)}`,
            low: `$${acesOHLC.low.toFixed(6)}`,
            close: `$${acesOHLC.close.toFixed(6)}`,
          },
        );

        // Open/Close: Connect properly
        openUsd = previousCandle ? parseFloat(previousCandle.closeUsd) : openAces * acesOHLC.open;
        closeUsd = closeAces * acesOHLC.close;

        // High/Low: Cartesian product to find true extremes
        // When both token and ACES are volatile, we need to check all combinations
        const usdPrices = [
          openAces * acesOHLC.open, // Token open × ACES open
          closeAces * acesOHLC.close, // Token close × ACES close
          highAces * acesOHLC.high, // Token high × ACES high (best case)
          highAces * acesOHLC.close, // Token high × ACES close
          closeAces * acesOHLC.high, // Token close × ACES high
          lowAces * acesOHLC.low, // Token low × ACES low (worst case)
          lowAces * acesOHLC.close, // Token low × ACES close
          closeAces * acesOHLC.low, // Token close × ACES low
        ];

        highUsd = Math.max(...usdPrices);
        lowUsd = Math.min(...usdPrices);

        console.log(
          `[ChartAggregation] 💎 Combined OHLC: Open=$${openUsd.toFixed(8)}, High=$${highUsd.toFixed(8)}, Low=$${lowUsd.toFixed(8)}, Close=$${closeUsd.toFixed(8)}`,
        );
      } else if (acesUsdPrice && acesUsdPrice > 0) {
        // Fallback: Use current ACES price (simple conversion)
        console.log(
          `[ChartAggregation] ⚠️ No ACES OHLC in memory, using current price: $${acesUsdPrice.toFixed(6)}`,
        );
        openUsd = openAces * acesUsdPrice;
        closeUsd = closeAces * acesUsdPrice;
        highUsd = highAces * acesUsdPrice;
        lowUsd = lowAces * acesUsdPrice;
      } else {
        // No USD price available at all
        openUsd = 0;
        closeUsd = 0;
        highUsd = 0;
        lowUsd = 0;
      }
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

    // Try to get ACES OHLC from memory for this period
    const candleEndTime = timestamp + intervalMs;
    const acesOHLC = acesPriceTracker.getAcesOHLCForPeriod(timestamp, candleEndTime);

    let closeUsd: number, highUsd: number, lowUsd: number;

    if (acesOHLC) {
      // 🔥 ENHANCED MODE: Use ACES OHLC from memory for accurate wicks (even with no trades!)
      console.log(
        `[ChartAggregation] 📊 Empty candle using ACES OHLC from memory for ${new Date(timestamp).toISOString()}:`,
        {
          open: `$${acesOHLC.open.toFixed(6)}`,
          high: `$${acesOHLC.high.toFixed(6)}`,
          low: `$${acesOHLC.low.toFixed(6)}`,
          close: `$${acesOHLC.close.toFixed(6)}`,
        },
      );

      // Close: Token price (in ACES) × latest ACES price (in USD)
      closeUsd = closeAces * acesOHLC.close;

      // High/Low: ACES volatility affects USD value even without token trades
      // Token price stays constant (in ACES), but USD value changes with ACES movement
      const usdPrices = [
        openAces * acesOHLC.open,
        openAces * acesOHLC.high,
        openAces * acesOHLC.low,
        openAces * acesOHLC.close,
      ];

      highUsd = Math.max(...usdPrices);
      lowUsd = Math.min(...usdPrices);

      console.log(
        `[ChartAggregation] 💎 Empty candle with wicks: Open=$${openUsd.toFixed(8)}, High=$${highUsd.toFixed(8)}, Low=$${lowUsd.toFixed(8)}, Close=$${closeUsd.toFixed(8)}`,
      );
    } else if (acesUsdPrice && acesUsdPrice > 0) {
      // Fallback: Use current ACES price (simple range)
      closeUsd = closeAces * acesUsdPrice;
      highUsd = Math.max(openUsd, closeUsd);
      lowUsd = Math.min(openUsd, closeUsd);
    } else {
      // No ACES price available - frozen
      closeUsd = openUsd;
      highUsd = openUsd;
      lowUsd = openUsd;
    }

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
