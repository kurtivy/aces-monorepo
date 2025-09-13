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

export class OHLCVService {
  constructor(
    private prisma: PrismaClient,
    private tokenService: TokenService,
  ) {}

  async generateOHLCVCandles(contractAddress: string, timeframe: string): Promise<CandleData[]> {
    try {
      if (timeframe === '1d') {
        // Use aggregated TokenDay data for efficiency
        return await this.generateDailyCandles(contractAddress);
      } else {
        // Use individual trades for minute/hour data
        return await this.generateIntradayCandles(contractAddress, timeframe);
      }
    } catch (error) {
      console.error('Error generating OHLCV candles:', error);
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
  ): Promise<CandleData[]> {
    try {
      const trades = await this.tokenService.fetchTradesForChart(contractAddress, timeframe);

      if (trades.length === 0) return [];

      const intervalMs = this.getIntervalMs(timeframe);
      const candleGroups = this.groupTradesByInterval(trades, intervalMs);

      const candles = candleGroups.map((group) => this.calculateOHLCV(group));

      // Store in database for caching
      await this.storeCandles(contractAddress, timeframe, candles);

      return candles;
    } catch (error) {
      console.error('Error generating intraday candles:', error);
      return [];
    }
  }

  private groupTradesByInterval(trades: TradeForCandle[], intervalMs: number) {
    const groups: { [key: number]: TradeForCandle[] } = {};

    trades.forEach((trade) => {
      const tradeTime = parseInt(trade.createdAt) * 1000; // Convert to milliseconds
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;

      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      groups[intervalStart].push(trade);
    });

    return Object.entries(groups)
      .map(([timestamp, trades]) => ({
        timestamp: new Date(parseInt(timestamp)),
        trades,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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

  private async storeCandles(contractAddress: string, timeframe: string, candles: CandleData[]) {
    if (candles.length === 0) return;

    try {
      // Use createMany with skipDuplicates for better performance
      const lowerAddress = contractAddress.toLowerCase();

      // First, delete existing candles for this timeframe to avoid duplicates
      await this.prisma.tokenOHLCV.deleteMany({
        where: {
          contractAddress: lowerAddress,
          timeframe,
        },
      });

      // Then insert all candles in a single operation
      await this.prisma.tokenOHLCV.createMany({
        data: candles.map((candle) => ({
          contractAddress: lowerAddress,
          timeframe,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          trades: candle.trades,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.warn('Failed to store OHLCV candles:', error);
      // Fallback to individual upserts if batch operation fails
      for (const candle of candles) {
        try {
          await this.prisma.tokenOHLCV.upsert({
            where: {
              contractAddress_timeframe_timestamp: {
                contractAddress: contractAddress.toLowerCase(),
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
              contractAddress: contractAddress.toLowerCase(),
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
        } catch (upsertError) {
          console.warn('Failed to store individual OHLCV candle:', upsertError);
        }
      }
    }
  }

  async getStoredOHLCVData(contractAddress: string, timeframe: string, limit = 100) {
    return await this.prisma.tokenOHLCV.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        timeframe,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
