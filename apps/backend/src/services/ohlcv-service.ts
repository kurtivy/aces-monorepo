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
      // For live data requests with time range, always generate fresh
      if (options.startTime || options.forceRefresh) {
        const fresh = await this.generateFreshCandles(contractAddress, timeframe, options);

        // If this is a partial/live request, merge with cached data for complete history
        if (options.startTime) {
          return await this.mergeWithCachedCandles(contractAddress, timeframe, fresh);
        }

        return fresh;
      }

      // For regular requests, check cache first
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1000);

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
      console.log(`[OHLCV] Generating daily candles for ${contractAddress}`);

      // Fetch trades for last 30 days using actual trade data
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const trades = await this.fetchTradesForTimeRange(contractAddress, thirtyDaysAgo, Date.now());

      console.log(`[OHLCV] Fetched ${trades.length} trades for daily candle generation`);

      if (trades.length === 0) {
        console.log(`[OHLCV] No trades found for daily candles`);
        return [];
      }

      // Group trades by day (86400000ms = 24 hours)
      const oneDayMs = 24 * 60 * 60 * 1000;
      const candleGroups = this.groupTradesByInterval(trades, oneDayMs, '1d');

      console.log(`[OHLCV] Created ${candleGroups.length} daily candle groups`);

      const candles: CandleData[] = [];

      for (const group of candleGroups) {
        if (group.trades.length > 0) {
          try {
            const candle = this.calculateOHLCV(group);
            candles.push(candle);
          } catch (error) {
            console.error(`[OHLCV] Error calculating daily candle at ${group.timestamp}:`, error);
          }
        }
      }

      console.log(`[OHLCV] Generated ${candles.length} daily candles with actual trade data`);

      if (candles.length > 0) {
        console.log('[OHLCV] Sample daily candle:', {
          date: candles[0].timestamp.toISOString().split('T')[0],
          open: candles[0].open,
          high: candles[0].high,
          low: candles[0].low,
          close: candles[0].close,
          trades: candles[0].trades,
          volume: candles[0].volume,
        });
      }

      return candles;
    } catch (error) {
      console.error('[OHLCV] Error generating daily candles:', error);
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

      const endTime = options.endTime || Date.now();
      const startTime =
        options.startTime || endTime - this.getHoursBack(timeframe) * 60 * 60 * 1000;

      // Fetch trades for the time range
      const trades = options.startTime
        ? await this.fetchTradesForTimeRange(contractAddress, startTime, endTime)
        : await this.tokenService.fetchTradesForChart(contractAddress, timeframe);

      // DIAGNOSTIC LOG for 15m timeframe
      if (timeframe === '15m' && trades.length > 0) {
        console.log('[OHLCV DEBUG] First 3 trades for 15m:');
        trades.slice(0, 3).forEach((t) => {
          const tradeTime = parseInt(t.createdAt) * 1000;
          const tradeDate = new Date(tradeTime);
          console.log(`  Trade at ${tradeDate.toISOString()} (${t.createdAt} seconds)`);
        });
      }

      console.log(`[OHLCV] Fetched ${trades.length} trades for ${contractAddress}`);

      if (trades.length === 0) {
        console.log(`[OHLCV] No trades found for ${contractAddress} ${timeframe}`);
        return [];
      }

      // Group trades by time intervals with validation
      const candleGroups = this.groupTradesByInterval(trades, intervalMs, timeframe);
      console.log(`[OHLCV] Created ${candleGroups.length} candle groups with trades`);

      // Only create candles for intervals that have actual trades
      const candles: CandleData[] = [];

      for (const group of candleGroups) {
        if (group.trades.length > 0) {
          try {
            const candle = this.calculateOHLCV(group);

            const hasVariation =
              candle.open !== candle.high ||
              candle.high !== candle.low ||
              candle.low !== candle.close;

            if (hasVariation || candle.trades > 1) {
              candles.push(candle);
            } else if (candle.trades === 1) {
              candles.push(candle);
            } else {
              console.log(`[OHLCV] Skipping empty candle at ${group.timestamp.toISOString()}`);
            }
          } catch (error) {
            console.error(`[OHLCV] Error calculating candle at ${group.timestamp}:`, error);
          }
        }
      }

      console.log(
        `[OHLCV] Generated ${candles.length} candles with actual trades for ${contractAddress} ${timeframe}`,
      );

      if (candles.length > 0) {
        console.log('[OHLCV] Sample candles:', {
          first: {
            time: candles[0].timestamp.toISOString(),
            O: candles[0].open,
            H: candles[0].high,
            L: candles[0].low,
            C: candles[0].close,
            trades: candles[0].trades,
          },
          last: {
            time: candles[candles.length - 1].timestamp.toISOString(),
            O: candles[candles.length - 1].open,
            H: candles[candles.length - 1].high,
            L: candles[candles.length - 1].low,
            C: candles[candles.length - 1].close,
            trades: candles[candles.length - 1].trades,
          },
        });
      }

      if (!options.skipStorage && !options.startTime) {
        console.log('[OHLCV] Storing candles to database...');
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
      throw error;
    }
  }

  private async mergeWithCachedCandles(
    contractAddress: string,
    timeframe: string,
    liveCandles: CandleData[],
  ): Promise<CandleData[]> {
    try {
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1000);

      if (cachedCandles.length === 0) {
        return liveCandles;
      }

      const liveStartTime =
        liveCandles.length > 0 ? liveCandles[0].timestamp.getTime() : Date.now();

      const oldCachedCandles = cachedCandles.filter((c) => c.timestamp.getTime() < liveStartTime);
      const combined = [...oldCachedCandles, ...liveCandles];
      combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      console.log(
        `[OHLCV] Merged candles: ${oldCachedCandles.length} cached + ${liveCandles.length} live = ${combined.length} total`,
      );

      return combined;
    } catch (error) {
      console.error('[OHLCV] Error merging candles:', error);
      return liveCandles;
    }
  }

  private groupTradesByInterval(
    trades: TradeForCandle[],
    intervalMs: number,
    timeframe: string = 'unknown',
  ) {
    const groups: { [key: number]: TradeForCandle[] } = {};
    const intervalMinutes = intervalMs / 60000;

    console.log(
      `[OHLCV] Grouping ${trades.length} trades into ${intervalMinutes}-minute intervals`,
    );

    trades.forEach((trade, index) => {
      const tradeTime = parseInt(trade.createdAt) * 1000;
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;

      // VALIDATION for 15m intervals
      if (intervalMs === 900000 && index < 5) {
        const tradeDate = new Date(tradeTime);
        const bucketDate = new Date(intervalStart);
        const bucketMinutes = bucketDate.getMinutes();

        console.log(`[OHLCV] Trade ${index + 1}:`);
        console.log(`  Time: ${tradeDate.toISOString()}`);
        console.log(`  Bucketed to: ${bucketDate.toISOString()} (minute: ${bucketMinutes})`);

        if (![0, 15, 30, 45].includes(bucketMinutes)) {
          console.error(`  ❌ ERROR: 15m candle at wrong minute: ${bucketMinutes}`);
          console.error(`  Trade timestamp: ${trade.createdAt} seconds`);
          console.error(`  Trade time in ms: ${tradeTime}`);
          console.error(`  Interval ms: ${intervalMs}`);
          console.error(`  Division: ${tradeTime} / ${intervalMs} = ${tradeTime / intervalMs}`);
          console.error(`  Floor result: ${Math.floor(tradeTime / intervalMs)}`);
          console.error(`  Final timestamp: ${intervalStart}`);
        } else {
          console.log(`  ✅ Correctly aligned to ${bucketMinutes} minutes`);
        }
      }

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

    // VALIDATION: Check all resulting timestamps
    if (intervalMs === 900000 && groupedResults.length > 0) {
      console.log(`[OHLCV] Validating ${groupedResults.length} candle timestamps for 15m:`);

      let misalignedCount = 0;
      groupedResults.forEach((group, i) => {
        const minutes = group.timestamp.getMinutes();
        if (![0, 15, 30, 45].includes(minutes)) {
          console.error(
            `  Candle ${i + 1}: ${group.timestamp.toISOString()} - minute ${minutes} ❌ MISALIGNED`,
          );
          misalignedCount++;
        }
      });

      if (misalignedCount === 0) {
        console.log(`  ✅ All ${groupedResults.length} candles properly aligned`);
      } else {
        console.error(`  ❌ Found ${misalignedCount} misaligned candles!`);
      }
    }

    console.log(`[OHLCV] Created ${groupedResults.length} candle groups`);
    return groupedResults;
  }

  private validateCandleAlignment(timestamp: Date, timeframe: string): boolean {
    const minutes = timestamp.getMinutes();
    const hours = timestamp.getHours();

    switch (timeframe) {
      case '1m':
        return true;
      case '5m':
        return minutes % 5 === 0;
      case '15m':
        return [0, 15, 30, 45].includes(minutes);
      case '1h':
        return minutes === 0;
      case '4h':
        return minutes === 0 && hours % 4 === 0;
      case '1d':
        return minutes === 0 && hours === 0;
      default:
        return true;
    }
  }

  private calculateOHLCV(candleGroup: { timestamp: Date; trades: TradeForCandle[] }): CandleData {
    const { timestamp, trades } = candleGroup;

    if (trades.length === 0) {
      throw new Error('No trades for candle calculation');
    }

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

    return {
      timestamp,
      open: prices[0].toString(),
      high: Decimal.max(...prices).toString(),
      low: Decimal.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: volumes.reduce((sum, vol) => sum.add(vol), new Decimal(0)).toString(),
      trades: trades.length,
    };
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

  private getHoursBack(timeframe: string): number {
    const timeframeHours: { [key: string]: number } = {
      '1m': 6,
      '5m': 12,
      '15m': 48,
      '1h': 168,
      '1d': 720,
    };

    return timeframeHours[timeframe] || 168;
  }

  private async storeCandles(contractAddress: string, timeframe: string, candles: CandleData[]) {
    if (candles.length === 0) return;

    try {
      const lowerAddress = contractAddress.toLowerCase();
      console.log(`[OHLCV] Storing ${candles.length} candles for ${lowerAddress} ${timeframe}`);

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
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades,
            },
            create: {
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

  async storeCandlesPublic(
    contractAddress: string,
    timeframe: string,
    candles: CandleData[],
  ): Promise<void> {
    await this.storeCandles(contractAddress, timeframe, candles);
  }

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
        signal: AbortSignal.timeout(10000),
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

  private isCacheValid(candles: CandleData[], timeframe: string): boolean {
    if (candles.length === 0) return false;

    const latestCandle = candles[candles.length - 1];
    const now = Date.now();
    const candleAge = now - latestCandle.timestamp.getTime();
    const maxAge = this.getIntervalMs(timeframe) * 2;

    return candleAge < maxAge;
  }

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
