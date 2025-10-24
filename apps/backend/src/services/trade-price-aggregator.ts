// src/services/trade-price-aggregator.ts
import { PrismaClient } from '@prisma/client';
import { goldskyClient, SubgraphTrade } from '../lib/goldsky-client';
import { FastifyBaseLogger } from 'fastify';

/**
 * Trade enriched with historical ACES USD price
 */
export interface TradeWithPrice extends SubgraphTrade {
  acesUsdPriceAtExecution: number;
  priceSource: string;
}

/**
 * Aggregated candlestick data
 */
export interface Candle {
  timestamp: number; // Unix timestamp in seconds (start of candle period)
  price: {
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
  };
  marketCap: {
    aces: string;
    usd: string;
    marketCapOpenUsd?: string;
    marketCapHighUsd?: string;
    marketCapLowUsd?: string;
    marketCapCloseUsd?: string;
  };
  supply: {
    circulating: string;
    total: string;
  };
  trades: number;
  dataSource: 'bonding_curve' | 'dex';
}

/**
 * Service for aggregating trades into candlestick data with historical ACES prices
 * This service joins trades from GoldSky subgraph with price snapshots from database
 */
export class TradePriceAggregator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Fetch trades and enrich with historical ACES prices
   */
  async getTradesWithPrices(
    tokenAddress: string,
    limit: number = 5000,
    fromTimestamp?: number,
    toTimestamp?: number,
    logger?: FastifyBaseLogger,
  ): Promise<TradeWithPrice[]> {
    // Step 1: Fetch trades from subgraph
    if (logger) {
      logger.debug({
        msg: '[Aggregator] Fetching trades from subgraph',
        tokenAddress,
        limit,
        fromTimestamp,
        toTimestamp,
      });
    }

    const trades = await goldskyClient.getTrades(
      tokenAddress,
      limit,
      fromTimestamp,
      toTimestamp,
      logger,
    );

    if (trades.length === 0) {
      if (logger) {
        logger.debug({
          msg: '[Aggregator] No trades found',
        });
      }
      return [];
    }

    // Step 2: Fetch corresponding ACES price snapshots
    const tradeIds = trades.map((t) => t.id);

    if (logger) {
      logger.debug({
        msg: '[Aggregator] Fetching price snapshots',
        tradeCount: tradeIds.length,
      });
    }

    const priceSnapshots = await this.prisma.acesPriceSnapshot.findMany({
      where: {
        tradeId: {
          in: tradeIds,
        },
      },
      select: {
        tradeId: true,
        acesUsdPrice: true,
        source: true,
      },
    });

    // Step 3: Create lookup map
    const priceMap = new Map(
      priceSnapshots.map((snap) => [
        snap.tradeId,
        {
          price: parseFloat(snap.acesUsdPrice.toString()),
          source: snap.source,
        },
      ]),
    );

    if (logger) {
      logger.debug({
        msg: '[Aggregator] Price snapshots fetched',
        found: priceSnapshots.length,
        missing: trades.length - priceSnapshots.length,
      });
    }

    // Step 4: Enrich trades with prices
    const tradesWithPrices: TradeWithPrice[] = trades.map((trade) => {
      const priceData = priceMap.get(trade.id);

      if (!priceData) {
        console.warn(`[Aggregator] Missing price snapshot for trade ${trade.id}`);

        // Fallback: This shouldn't happen if webhook is working properly
        // But we need a fallback to prevent crashes
        return {
          ...trade,
          acesUsdPriceAtExecution: 0,
          priceSource: 'missing',
        };
      }

      return {
        ...trade,
        acesUsdPriceAtExecution: priceData.price,
        priceSource: priceData.source,
      };
    });

    return tradesWithPrices;
  }

  /**
   * Aggregate trades into candlestick data
   */
  async aggregateToCandles(
    tokenAddress: string,
    timeframe: string,
    fromTimestamp?: number,
    toTimestamp?: number,
    logger?: FastifyBaseLogger,
  ): Promise<Candle[]> {
    // Fetch enriched trades
    const trades = await this.getTradesWithPrices(
      tokenAddress,
      5000,
      fromTimestamp,
      toTimestamp,
      logger,
    );

    if (trades.length === 0) {
      return [];
    }

    // Get interval in milliseconds
    const intervalMs = this.getIntervalMs(timeframe);

    // Group trades by time bucket
    const candleMap = new Map<
      number,
      {
        timestamp: number;
        trades: TradeWithPrice[];
      }
    >();

    for (const trade of trades) {
      const tradeTime = parseInt(trade.createdAt) * 1000; // Convert to ms
      const bucketTime = Math.floor(tradeTime / intervalMs) * intervalMs;

      if (!candleMap.has(bucketTime)) {
        candleMap.set(bucketTime, {
          timestamp: bucketTime / 1000, // Convert back to seconds
          trades: [],
        });
      }

      candleMap.get(bucketTime)!.trades.push(trade);
    }

    // Calculate OHLCV for each bucket
    const candles: Candle[] = Array.from(candleMap.values())
      .map((bucket) => this.calculateCandle(bucket, logger))
      .filter((candle) => candle !== null) as Candle[];

    // Sort by timestamp
    candles.sort((a, b) => a.timestamp - b.timestamp);

    if (logger) {
      logger.debug({
        msg: '[Aggregator] Candles aggregated',
        candleCount: candles.length,
        timeframe,
      });
    }

    return candles;
  }

  /**
   * Calculate OHLCV data for a single candle
   */
  private calculateCandle(
    bucket: { timestamp: number; trades: TradeWithPrice[] },
    logger?: FastifyBaseLogger,
  ): Candle | null {
    const { timestamp, trades: bucketTrades } = bucket;

    // Sort trades by timestamp within bucket
    const trades = bucketTrades.sort((a, b) => parseInt(a.createdAt) - parseInt(b.createdAt));

    if (trades.length === 0) {
      return null;
    }

    try {
      // Calculate price of token in ACES for each trade
      const pricesInAces = trades.map((t) => {
        const tokenAmount = parseFloat(t.tokenAmount);
        const acesAmount = parseFloat(t.acesTokenAmount);

        if (tokenAmount === 0) return 0;
        return acesAmount / tokenAmount; // Price of 1 token in ACES
      });

      // OHLC in ACES
      const openAces = pricesInAces[0];
      const closeAces = pricesInAces[pricesInAces.length - 1];
      const highAces = Math.max(...pricesInAces);
      const lowAces = Math.min(...pricesInAces);

      // Calculate USD prices using HISTORICAL ACES prices
      const openUsd = openAces * trades[0].acesUsdPriceAtExecution;
      const closeUsd = closeAces * trades[trades.length - 1].acesUsdPriceAtExecution;

      // For high/low, use the ACES price at the time of that specific trade
      const pricesInUsd = trades.map((t, i) => pricesInAces[i] * t.acesUsdPriceAtExecution);
      const highUsd = Math.max(...pricesInUsd);
      const lowUsd = Math.min(...pricesInUsd);

      // Calculate volume in ACES and USD
      const volumeAces = trades.reduce((sum, trade) => {
        return sum + parseFloat(trade.acesTokenAmount);
      }, 0);

      const volumeUsd = trades.reduce((sum, trade) => {
        const tokenAmount = parseFloat(trade.tokenAmount);
        const priceInAces = parseFloat(trade.acesTokenAmount) / tokenAmount;
        return sum + tokenAmount * priceInAces * trade.acesUsdPriceAtExecution;
      }, 0);

      // Get supply from last trade in bucket
      const lastTrade = trades[trades.length - 1];
      const circulatingSupply = lastTrade.supply;

      // Calculate market cap
      const circulatingSupplyNum = parseFloat(circulatingSupply);
      const marketCapAces = circulatingSupplyNum * closeAces;
      const marketCapUsd = circulatingSupplyNum * closeUsd;

      // Market cap OHLC (smooth connections)
      const marketCapOpenUsd = circulatingSupplyNum * openUsd;
      const marketCapHighUsd = circulatingSupplyNum * highUsd;
      const marketCapLowUsd = circulatingSupplyNum * lowUsd;
      const marketCapCloseUsd = marketCapUsd;

      return {
        timestamp,
        price: {
          open: openAces.toString(),
          high: highAces.toString(),
          low: lowAces.toString(),
          close: closeAces.toString(),
          openUsd: openUsd.toString(),
          highUsd: highUsd.toString(),
          lowUsd: lowUsd.toString(),
          closeUsd: closeUsd.toString(),
          volume: volumeAces.toString(),
          volumeUsd: volumeUsd.toString(),
        },
        marketCap: {
          aces: marketCapAces.toString(),
          usd: marketCapUsd.toString(),
          marketCapOpenUsd: marketCapOpenUsd.toString(),
          marketCapHighUsd: marketCapHighUsd.toString(),
          marketCapLowUsd: marketCapLowUsd.toString(),
          marketCapCloseUsd: marketCapCloseUsd.toString(),
        },
        supply: {
          circulating: circulatingSupply,
          total: circulatingSupply, // For bonding curve, total = circulating
        },
        trades: trades.length,
        dataSource: 'bonding_curve',
      };
    } catch (error) {
      console.error('[Aggregator] Error calculating candle:', error);
      return null;
    }
  }

  /**
   * Convert timeframe to milliseconds
   */
  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    return map[timeframe] || map['1h'];
  }
}

// Factory function to create an instance
// Use this in routes to inject the Prisma client
export const createTradePriceAggregator = (prisma: PrismaClient) => {
  return new TradePriceAggregator(prisma);
};

