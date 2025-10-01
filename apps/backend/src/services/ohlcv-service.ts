import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { TokenService } from './token-service';

interface TradeForCandle {
  tokenAmount: string;
  acesTokenAmount: string;
  createdAt: string;
}

interface CandleData {
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
}

interface GenerateOptions {
  startTime?: number; // Unix timestamp in milliseconds
  endTime?: number; // Unix timestamp in milliseconds
  forceRefresh?: boolean;
  skipStorage?: boolean; // Skip database storage for faster response
}

interface SubgraphResponse {
  data: {
    trades: TradeForCandle[];
  };
  errors?: any[];
}

export class OHLCVService {
  constructor(
    private prisma: PrismaClient,
    private tokenService: TokenService,
  ) {}

  async generateOHLCVCandles(
    contractAddress: string,
    timeframe: string,
    options: GenerateOptions = {},
  ): Promise<CandleData[]> {
    try {
      // For live data requests, always generate fresh candles
      if (options.startTime || options.forceRefresh) {
        return await this.generateFreshCandles(contractAddress, timeframe, options);
      }

      // For regular requests, use cached data if available and fresh
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe);

      if (this.isCacheValid(cachedCandles, timeframe)) {
        console.log(`[OHLCV] Using cached data for ${contractAddress} ${timeframe}`);
        return cachedCandles;
      }

      // Cache is stale, generate fresh data
      console.log(`[OHLCV] Cache stale, generating fresh data for ${contractAddress} ${timeframe}`);
      return await this.generateFreshCandles(contractAddress, timeframe, options);
    } catch (error) {
      console.error('Error generating OHLCV candles:', error);

      // Fallback to cached data even if stale
      const fallbackCandles = await this.getCachedCandles(contractAddress, timeframe);
      if (fallbackCandles.length > 0) {
        console.warn('Using stale cached data as fallback');
        return fallbackCandles;
      }

      return [];
    }
  }

  /**
   * NEW: Generate live candles for real-time updates
   * This is used by the new /live endpoint
   */
  async generateLiveCandles(
    contractAddress: string,
    timeframe: string,
    since: number,
  ): Promise<CandleData[]> {
    const options: GenerateOptions = {
      startTime: since,
      endTime: Date.now(),
      forceRefresh: true,
    };

    return await this.generateFreshCandles(contractAddress, timeframe, options);
  }

  /**
   * Generate fresh candles from subgraph data
   * This uses your existing logic but with enhanced time range support
   */
  private async generateFreshCandles(
    contractAddress: string,
    timeframe: string,
    options: GenerateOptions = {},
  ): Promise<CandleData[]> {
    try {
      if (timeframe === '1d') {
        return await this.generateDailyCandles(contractAddress);
      } else {
        return await this.generateIntradayCandles(contractAddress, timeframe, options);
      }
    } catch (error) {
      console.error('Error generating fresh candles:', error);
      return [];
    }
  }

  private async generateDailyCandles(contractAddress: string): Promise<CandleData[]> {
    try {
      const tokenDayData = await this.tokenService.fetchTokenDayData(contractAddress);

      if (tokenDayData.length === 0) return [];

      const candles: CandleData[] = [];

      for (const dayData of tokenDayData) {
        // For daily data, we need to estimate OHLC from volume data
        // This is simplified - in reality you might want more sophisticated price estimation
        const netVolume = new Decimal(dayData.tokensBought).minus(new Decimal(dayData.tokensSold));
        const totalVolume = new Decimal(dayData.tokensBought).plus(new Decimal(dayData.tokensSold));

        // Estimate price trend for the day (this is a simplification)
        const basePrice = new Decimal(1); // You might want to calculate this differently
        const priceVariation = netVolume.div(totalVolume.plus(1)).mul(0.1); // 10% max daily variation

        const open = basePrice.toString();
        const close = basePrice.plus(priceVariation).toString();
        const high = Decimal.max(new Decimal(open), new Decimal(close)).mul(1.05).toString();
        const low = Decimal.min(new Decimal(open), new Decimal(close)).mul(0.95).toString();

        candles.push({
          timestamp: new Date(dayData.date * 1000),
          open,
          high,
          low,
          close,
          volume: totalVolume.toString(),
          trades: dayData.tradesCount,
        });
      }

      return candles.reverse(); // Oldest first for charting
    } catch (error) {
      console.error('Error generating daily candles:', error);
      return [];
    }
  }

  private async generateIntradayCandles(
    contractAddress: string,
    timeframe: string,
    options: GenerateOptions = {},
  ): Promise<CandleData[]> {
    try {
      console.log(`[OHLCV] Starting generateIntradayCandles for ${contractAddress} ${timeframe}`);
      const intervalMs = this.getIntervalMs(timeframe);

      // Determine time range - use options if provided for live data
      const endTime = options.endTime || Date.now();
      const startTime =
        options.startTime || endTime - this.getHoursBack(timeframe) * 60 * 60 * 1000;

      // Fetch trades for the time range
      const trades = options.startTime
        ? await this.fetchTradesForTimeRange(contractAddress, startTime, endTime)
        : await this.tokenService.fetchTradesForChart(contractAddress, timeframe);

      // Generate all possible time slots
      const timeSlots = this.generateTimeSlots(startTime, endTime, intervalMs);

      // Group trades by time intervals
      const candleGroups = this.groupTradesByInterval(trades, intervalMs);

      // Create candle data for each time slot
      const candles: CandleData[] = [];
      const initialLastKnownPrice = await this.getLastKnownPrice(contractAddress);
      let lastClosePrice = initialLastKnownPrice;

      let emptyCount = 0;
      let filledCount = 0;

      for (const slot of timeSlots) {
        const slotTrades = candleGroups.find((g) => g.timestamp.getTime() === slot.getTime());

        if (slotTrades && slotTrades.trades.length > 0) {
          // Time slot has trades - calculate OHLCV normally
          const candle = this.calculateOHLCV(slotTrades);
          candles.push(candle);
          lastClosePrice = parseFloat(candle.close);
          filledCount++;
        } else {
          // Empty time slot - create no-change candle
          const emptyCandle: CandleData = {
            timestamp: slot,
            open: lastClosePrice.toString(),
            high: lastClosePrice.toString(),
            low: lastClosePrice.toString(),
            close: lastClosePrice.toString(),
            volume: '0',
            trades: 0,
          };
          candles.push(emptyCandle);
          emptyCount++;
        }
      }

      if (candles.length > 0) {
        console.log(
          `[OHLCV] Generated ${candles.length} total candles: ${filledCount} with trades (${Math.round((filledCount / candles.length) * 100)}%), ${emptyCount} empty (${Math.round((emptyCount / candles.length) * 100)}%)`,
        );
        console.log(
          `[OHLCV] Initial lastKnownPrice: ${initialLastKnownPrice}, Final close price: ${lastClosePrice}`,
        );
      } else {
        console.log('[OHLCV] No candles generated');
      }

      // Store candles in database only if not skipped and not a partial request
      if (!options.skipStorage && !options.startTime) {
        console.log('[OHLCV] Storing candles to database (this may take a moment)...');
        await this.storeCandles(contractAddress, timeframe, candles);
      } else {
        console.log('[OHLCV] Skipping database storage for fast response');
      }

      return candles;
    } catch (error) {
      console.error(
        `[OHLCV] Error generating intraday candles for ${contractAddress} ${timeframe}:`,
        error,
      );
      if (error instanceof Error) {
        console.error(`[OHLCV] Error stack:`, error.stack);
      }
      throw error; // Re-throw to see full error in API response
    }
  }

  private groupTradesByInterval(trades: TradeForCandle[], intervalMs: number) {
    const groups: { [key: number]: TradeForCandle[] } = {};

    console.log(
      `[OHLCV] Grouping ${trades.length} trades with interval ${intervalMs}ms (${intervalMs / 60000}min)`,
    );

    trades.forEach((trade) => {
      const tradeTime = parseInt(trade.createdAt) * 1000; // Convert to milliseconds
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;

      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      groups[intervalStart].push(trade);
    });

    const groupedResults = Object.entries(groups)
      .map(([timestamp, trades]) => ({
        timestamp: new Date(parseInt(timestamp)),
        trades,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`[OHLCV] Created ${groupedResults.length} candle groups`);
    console.log(
      `[OHLCV] Groups with trades: ${groupedResults.filter((g) => g.trades.length > 0).length}`,
    );
    console.log(
      `[OHLCV] First group: ${groupedResults[0]?.timestamp.toISOString()} with ${groupedResults[0]?.trades.length} trades`,
    );

    return groupedResults;
  }

  private calculateOHLCV(candleGroup: { timestamp: Date; trades: TradeForCandle[] }): CandleData {
    const { timestamp, trades } = candleGroup;

    if (trades.length === 0) {
      throw new Error('No trades for candle calculation');
    }

    // Calculate price for each trade and sort by time
    const tradesWithPrice = trades
      .map((trade) => {
        const tokenAmt = new Decimal(trade.tokenAmount);
        const acesAmt = new Decimal(trade.acesTokenAmount);
        const price = tokenAmt.isZero() ? new Decimal(0) : acesAmt.div(tokenAmt);

        return {
          price,
          volume: acesAmt,
          timestamp: parseInt(trade.createdAt),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const prices = tradesWithPrice.map((t) => t.price);
    const volumes = tradesWithPrice.map((t) => t.volume);

    const candle = {
      timestamp,
      open: prices[0].toString(),
      high: Decimal.max(...prices).toString(),
      low: Decimal.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: volumes.reduce((sum, vol) => sum.add(vol), new Decimal(0)).toString(),
      trades: trades.length,
    };

    // Debug: Log first few candles to verify OHLC values
    if (Math.random() < 0.1) {
      // Log 10% of candles to avoid spam
      console.log(
        `[OHLCV] Candle at ${timestamp.toISOString()}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} trades=${trades.length}`,
      );
    }

    return candle;
  }

  private getIntervalMs(timeframe: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
    };

    return intervals[timeframe] || intervals['1h'];
  }

  private generateTimeSlots(startTime: number, endTime: number, intervalMs: number): Date[] {
    const slots: Date[] = [];

    // Align start time to interval boundary
    const alignedStart = Math.floor(startTime / intervalMs) * intervalMs;

    for (let time = alignedStart; time < endTime; time += intervalMs) {
      slots.push(new Date(time));
    }

    return slots;
  }

  private async getLastKnownPrice(contractAddress: string): Promise<number> {
    try {
      // Try to get the last close price from recent candles
      const lastCandle = await this.prisma.tokenOHLCV.findFirst({
        where: { contractAddress: contractAddress.toLowerCase() },
        orderBy: { timestamp: 'desc' },
      });

      if (lastCandle) {
        return parseFloat(lastCandle.close);
      }

      // Fallback to current token price
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: contractAddress.toLowerCase() },
      });

      return token ? parseFloat(token.currentPriceACES) : 1.0;
    } catch (error) {
      console.warn('Could not get last known price, defaulting to 1.0:', error);
      return 1.0;
    }
  }

  private getHoursBack(timeframe: string): number {
    const timeframeHours: { [key: string]: number } = {
      '1m': 2, // 2 hours for minute data
      '5m': 12, // 12 hours for 5-minute data
      '15m': 48, // 48 hours for 15-minute data
      '1h': 168, // 1 week for hourly data
      '1d': 720, // 30 days for daily data
    };

    return timeframeHours[timeframe] || 168;
  }

  private async storeCandles(contractAddress: string, timeframe: string, candles: CandleData[]) {
    if (candles.length === 0) return;

    try {
      const lowerAddress = contractAddress.toLowerCase();

      console.log(`[OHLCV] Storing ${candles.length} candles for ${lowerAddress} ${timeframe}`);

      // CRITICAL FIX: Use upsert instead of delete+create
      // This preserves historical data while updating current candles
      let upsertedCount = 0;
      let errorCount = 0;

      for (const candle of candles) {
        try {
          await this.prisma.tokenOHLCV.upsert({
            where: {
              contractAddress_timeframe_timestamp: {
                contractAddress: lowerAddress,
                timeframe,
                timestamp: candle.timestamp,
              },
            },
            update: {
              // Update existing candle data
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades,
            },
            create: {
              // Create new candle if it doesn't exist
              contractAddress: lowerAddress,
              timeframe,
              timestamp: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades,
            },
          });
          upsertedCount++;
        } catch (upsertError) {
          errorCount++;
          console.warn(`Failed to upsert candle at ${candle.timestamp}:`, upsertError);
        }
      }

      console.log(
        `[OHLCV] Stored ${upsertedCount} candles for ${lowerAddress} ${timeframe} (${errorCount} errors)`,
      );
    } catch (error) {
      console.error('Failed to store OHLCV candles:', error);
    }
  }

  async getStoredOHLCVData(
    contractAddress: string,
    timeframe: string,
    limit: string | number = 100,
  ) {
    return await this.prisma.tokenOHLCV.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        timeframe,
      },
      orderBy: { timestamp: 'desc' },
      take: typeof limit === 'string' ? parseInt(limit) : limit,
    });
  }

  /**
   * Public method to allow external callers to store candles
   * Used by /live endpoint to persist real-time data
   */
  async storeCandlesPublic(
    contractAddress: string,
    timeframe: string,
    candles: CandleData[],
  ): Promise<void> {
    await this.storeCandles(contractAddress, timeframe, candles);
  }

  /**
   * NEW: Fetch trades for a specific time range from subgraph
   * This is optimized for live data requests
   */
  private async fetchTradesForTimeRange(
    contractAddress: string,
    startTime: number,
    endTime: number,
  ): Promise<TradeForCandle[]> {
    try {
      const startTimeSeconds = Math.floor(startTime / 1000);
      const endTimeSeconds = Math.floor(endTime / 1000);

      const query = `{
        trades(
          where: {
            token: "${contractAddress.toLowerCase()}"
            createdAt_gte: "${startTimeSeconds}"
            createdAt_lte: "${endTimeSeconds}"
          }
          orderBy: createdAt
          orderDirection: asc
          first: 1000
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
        }
      }`;

      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000), // 10 second timeout for live queries
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }

      const result = (await response.json()) as SubgraphResponse;
      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }

      return result.data.trades || [];
    } catch (error) {
      console.error('Error fetching trades for time range:', error);
      return [];
    }
  }

  /**
   * NEW: Check if cached data is still valid
   */
  private isCacheValid(candles: CandleData[], timeframe: string): boolean {
    if (candles.length === 0) return false;

    const latestCandle = candles[candles.length - 1];
    const now = Date.now();
    const candleAge = now - latestCandle.timestamp.getTime();

    // Cache validity based on timeframe
    const maxAge = this.getIntervalMs(timeframe) * 2; // 2 intervals old max

    return candleAge < maxAge;
  }

  /**
   * NEW: Get cached candles from database
   */
  private async getCachedCandles(
    contractAddress: string,
    timeframe: string,
    limit = 200,
  ): Promise<CandleData[]> {
    try {
      const stored = await this.prisma.tokenOHLCV.findMany({
        where: {
          contractAddress: contractAddress.toLowerCase(),
          timeframe,
        },
        orderBy: { timestamp: 'asc' },
        take: limit,
      });

      return stored.map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades,
      }));
    } catch (error) {
      console.error('Error fetching cached candles:', error);
      return [];
    }
  }
}
