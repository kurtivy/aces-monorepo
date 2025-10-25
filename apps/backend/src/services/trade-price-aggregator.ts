// src/services/trade-price-aggregator.ts
import { PrismaClient } from '@prisma/client';
import { goldskyClient, SubgraphTrade } from '../lib/goldsky-client';
import { FastifyBaseLogger } from 'fastify';
import { priceCacheService } from './price-cache-service';

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
   * Find the nearest price snapshot by timestamp when exact match not found
   * Searches within ±5 minute window for the SAME token first
   * NOTE: Database already stores tokenAddress for each snapshot, so we filter by it
   */
  private async findNearestPriceSnapshot(
    tradeTimestamp: number,
    tokenAddress: string,
  ): Promise<{ price: number; source: string } | null> {
    const SEARCH_WINDOW_SECONDS = 300; // ±5 minutes

    // Search for price snapshot of the SAME token within time window
    const nearestSnapshot = await this.prisma.acesPriceSnapshot.findFirst({
      where: {
        tokenAddress: tokenAddress.toLowerCase(), // Filter by specific token
        timestamp: {
          gte: BigInt(tradeTimestamp - SEARCH_WINDOW_SECONDS),
          lte: BigInt(tradeTimestamp + SEARCH_WINDOW_SECONDS),
        },
      },
      orderBy: {
        // Find closest by timestamp
        timestamp: 'asc',
      },
      select: {
        acesUsdPrice: true,
        source: true,
        timestamp: true,
      },
    });

    if (!nearestSnapshot) {
      return null;
    }

    return {
      price: parseFloat(nearestSnapshot.acesUsdPrice.toString()),
      source: `nearest_${nearestSnapshot.source}`,
    };
  }

  /**
   * Fetch trades and enrich with historical ACES prices
   */
  async getTradesWithPrices(
    tokenAddress: string,
    limit: number = 1000,
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

    // NEW: Get current ACES price for fallback scenarios
    const { acesUsd: currentAcesPrice } = await priceCacheService.getPrices();
    const now = Date.now();

    // NEW: Initialize monitoring stats
    const stats = {
      totalTrades: trades.length,
      foundExact: 0,
      raceCases: 0,
      nearestUsed: 0,
      fallbackUsed: 0,
    };

    if (logger) {
      logger.debug({
        msg: '[Aggregator] Price snapshots fetched',
        found: priceSnapshots.length,
        missing: trades.length - priceSnapshots.length,
      });
    }

    // Step 4: Enrich trades with prices (ENHANCED WITH FALLBACK LOGIC)
    const tradesWithPrices: TradeWithPrice[] = await Promise.all(
      trades.map(async (trade) => {
        const priceData = priceMap.get(trade.id);

        // CASE 1: Exact match found in database ✅
        if (priceData) {
          stats.foundExact++;
          return {
            ...trade,
            acesUsdPriceAtExecution: priceData.price,
            priceSource: priceData.source,
          };
        }

        // CASE 2: Missing price - determine why
        const tradeTimestamp = parseInt(trade.createdAt); // Unix timestamp in seconds
        const tradeTimestampMs = tradeTimestamp * 1000;
        const tradeAge = now - tradeTimestampMs;

        // CASE 2a: Race Condition - Trade is very recent (< 10 seconds)
        // Webhook is probably still processing, use current price temporarily
        if (tradeAge < 10000) {
          stats.raceCases++;
          if (logger) {
            logger.debug({
              msg: '[Aggregator] Trade is very recent, using current price',
              tradeId: trade.id,
              ageMs: tradeAge,
            });
          }
          return {
            ...trade,
            acesUsdPriceAtExecution: currentAcesPrice,
            priceSource: 'current_pending',
          };
        }

        // CASE 2b: Missing Snapshot - Try to find nearest price
        if (logger) {
          logger.warn({
            msg: '[Aggregator] Missing price snapshot, searching for nearest',
            tradeId: trade.id,
            ageMs: tradeAge,
          });
        }

        const nearestPrice = await this.findNearestPriceSnapshot(tradeTimestamp, tokenAddress);

        if (nearestPrice) {
          stats.nearestUsed++;
          if (logger) {
            logger.debug({
              msg: '[Aggregator] Found nearest price snapshot',
              tradeId: trade.id,
              source: nearestPrice.source,
            });
          }
          return {
            ...trade,
            acesUsdPriceAtExecution: nearestPrice.price,
            priceSource: nearestPrice.source,
          };
        }

        // CASE 2c: Last Resort - Use current price as fallback
        stats.fallbackUsed++;
        console.warn(
          `[Aggregator] No nearby price found for trade ${trade.id}, using current price fallback`,
        );
        return {
          ...trade,
          acesUsdPriceAtExecution: currentAcesPrice,
          priceSource: 'fallback_current',
        };
      }),
    );

    // NEW: Log monitoring statistics
    const missingRate = ((stats.totalTrades - stats.foundExact) / stats.totalTrades) * 100;

    console.log('[PriceMonitoring]', {
      tokenAddress,
      ...stats,
      missingRate: `${missingRate.toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    });

    // Alert if concerning rate of missing snapshots
    if (missingRate > 10) {
      console.error('⚠️ HIGH MISSING SNAPSHOT RATE:', {
        tokenAddress,
        missingRate: `${missingRate.toFixed(2)}%`,
        stats,
      });
    }

    if (logger) {
      logger.info({
        msg: '[Aggregator] Price enrichment complete',
        stats,
        missingRate: `${missingRate.toFixed(2)}%`,
      });
    }

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
      1000, // Subgraph max limit is 1000
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
