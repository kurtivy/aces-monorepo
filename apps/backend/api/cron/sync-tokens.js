// Prisma runtime polyfill for serverless
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = require('node-fetch');
}
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/api/cron/sync-tokens.ts
var sync_tokens_exports = {};
__export(sync_tokens_exports, {
  default: () => handler
});
module.exports = __toCommonJS(sync_tokens_exports);
var import_client = require("@prisma/client");

// src/services/token-service.ts
var import_decimal = require("decimal.js");
var TokenService = class {
  constructor(prisma2) {
    this.prisma = prisma2;
  }
  static {
    __name(this, "TokenService");
  }
  async getOrCreateToken(contractAddress) {
    const lowerAddress = contractAddress.toLowerCase();
    let token = await this.prisma.token.findUnique({
      where: { contractAddress: lowerAddress }
    });
    if (!token) {
      token = await this.prisma.token.create({
        data: {
          contractAddress: lowerAddress,
          symbol: "UNKNOWN",
          name: "Loading...",
          currentPrice: "0",
          currentPriceACES: "0",
          volume24h: "0"
        }
      });
    }
    return token;
  }
  async fetchAndUpdateTokenData(contractAddress) {
    try {
      let token = await this.getOrCreateToken(contractAddress);
      const subgraphData = await this.fetchFromSubgraph(contractAddress);
      if (subgraphData?.data.tokens?.[0]) {
        const tokenData = subgraphData.data.tokens[0];
        const trades = subgraphData.data.trades || [];
        let currentPrice = "0";
        if (trades.length > 0) {
          const latestTrade = trades[0];
          const tokenAmt = new import_decimal.Decimal(latestTrade.tokenAmount);
          const acesAmt = new import_decimal.Decimal(latestTrade.acesTokenAmount);
          currentPrice = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
        }
        const oneDayAgo = Date.now() / 1e3 - 24 * 60 * 60;
        const recentTrades = trades.filter((t) => parseInt(t.createdAt) > oneDayAgo);
        const volume24h = recentTrades.reduce((sum, trade) => {
          return sum.add(new import_decimal.Decimal(trade.acesTokenAmount));
        }, new import_decimal.Decimal(0)).toString();
        token = await this.prisma.token.update({
          where: { contractAddress: contractAddress.toLowerCase() },
          data: {
            symbol: tokenData.symbol,
            name: tokenData.name,
            currentPriceACES: currentPrice,
            volume24h,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
        await this.storeRecentTrades(contractAddress, trades);
      }
      return token;
    } catch (error) {
      console.error("Error updating token data:", error);
      return await this.getOrCreateToken(contractAddress);
    }
  }
  // New method to fetch trades for chart data
  async fetchTradesForChart(contractAddress, timeframe) {
    try {
      const hoursBack = this.getHoursBack(timeframe);
      const startTime = Math.floor(Date.now() / 1e3) - hoursBack * 60 * 60;
      const query = `{
        trades(
          where: {
            token: "${contractAddress.toLowerCase()}"
            createdAt_gte: "${startTime}"
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
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.trades || [];
    } catch (error) {
      console.error("Chart data fetch error:", error);
      return [];
    }
  }
  // New method to fetch daily aggregated data
  async fetchTokenDayData(contractAddress) {
    try {
      const query = `{
        tokenDays(
          where: {token: "${contractAddress.toLowerCase()}"}
          orderBy: date
          orderDirection: desc
          first: 30
        ) {
          id
          date
          tradesCount
          tokensBought
          tokensSold
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.tokenDays || [];
    } catch (error) {
      console.error("Token day data fetch error:", error);
      return [];
    }
  }
  getHoursBack(timeframe) {
    const timeframeHours = {
      "1m": 2,
      // 2 hours for minute data
      "5m": 12,
      // 12 hours for 5-minute data
      "15m": 48,
      // 48 hours for 15-minute data
      "1h": 168,
      // 1 week for hourly data
      "1d": 720
      // 30 days for daily data
    };
    return timeframeHours[timeframe] || 168;
  }
  async fetchFromSubgraph(contractAddress, retries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const query = `{
          tokens(where: {address: "${contractAddress.toLowerCase()}"}) {
            id
            address
            name
            symbol
            supply
            tradesCount
            owner {
              id
              address
            }
            bonded
            tokensBought
            tokensSold
            subjectFeeAmount
            protocolFeeAmount
            tokenHours(first: 24, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
            tokenDays(first: 30, orderBy: id, orderDirection: desc) {
              id
              tradesCount
              tokensBought
              tokensSold
            }
          }
          trades(
            where: {token: "${contractAddress.toLowerCase()}"}
            orderBy: createdAt
            orderDirection: desc
            first: 50
          ) {
            id
            isBuy
            tokenAmount
            acesTokenAmount
            supply
            createdAt
            blockNumber
            protocolFeeAmount
            subjectFeeAmount
          }
        }`;
        const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          // Add timeout
          signal: AbortSignal.timeout(15e3)
          // 15 second timeout
        });
        if (!response.ok) {
          throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        if (result.errors) {
          throw new Error(`Subgraph GraphQL errors: ${JSON.stringify(result.errors)}`);
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[TokenService] Subgraph attempt ${attempt}/${retries} failed:`,
          lastError.message
        );
        if (attempt < retries) {
          const delay = Math.pow(2, attempt - 1) * 1e3;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.error(
      `Subgraph fetch failed after ${retries} attempts. Last error: ${lastError.message}`
    );
    return null;
  }
  async storeRecentTrades(contractAddress, trades) {
    if (trades.length === 0) return;
    const tradeData = trades.slice(0, 10).map((trade) => {
      const tokenAmt = new import_decimal.Decimal(trade.tokenAmount);
      const acesAmt = new import_decimal.Decimal(trade.acesTokenAmount);
      const pricePerToken = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
      return {
        contractAddress: contractAddress.toLowerCase(),
        txHash: trade.id,
        trader: "unknown",
        tradeType: trade.isBuy ? "BUY" : "SELL",
        tokenAmount: trade.tokenAmount,
        acesAmount: trade.acesTokenAmount,
        pricePerToken,
        timestamp: new Date(parseInt(trade.createdAt) * 1e3),
        source: "SUBGRAPH"
      };
    });
    try {
      await this.prisma.tokenTrade.createMany({
        data: tradeData,
        skipDuplicates: true
        // Same behavior as the empty upsert update
      });
    } catch (error) {
      console.warn("Failed to store trades batch:", error);
      for (const trade of trades.slice(0, 10)) {
        try {
          const tokenAmt = new import_decimal.Decimal(trade.tokenAmount);
          const acesAmt = new import_decimal.Decimal(trade.acesTokenAmount);
          const pricePerToken = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
          await this.prisma.tokenTrade.upsert({
            where: { txHash: trade.id },
            update: {},
            create: {
              contractAddress: contractAddress.toLowerCase(),
              txHash: trade.id,
              trader: "unknown",
              tradeType: trade.isBuy ? "BUY" : "SELL",
              tokenAmount: trade.tokenAmount,
              acesAmount: trade.acesTokenAmount,
              pricePerToken,
              timestamp: new Date(parseInt(trade.createdAt) * 1e3),
              source: "SUBGRAPH"
            }
          });
        } catch (individualError) {
          console.warn("Failed to store individual trade:", individualError);
        }
      }
    }
  }
  async getRecentTrades(contractAddress, limit = 10) {
    return await this.prisma.tokenTrade.findMany({
      where: { contractAddress: contractAddress.toLowerCase() },
      orderBy: { timestamp: "desc" },
      take: limit
    });
  }
  // New method to fetch fresh trades from subgraph for trade history component
  async getRecentTradesForToken(contractAddress, limit = 50) {
    try {
      const query = `{
        trades(
          where: { token: "${contractAddress.toLowerCase()}" }
          orderBy: createdAt
          orderDirection: desc
          first: ${limit}
        ) {
          id
          isBuy
          trader { id }
          tokenAmount
          acesTokenAmount
          createdAt
          blockNumber
        }
      }`;
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      return result.data.trades || [];
    } catch (error) {
      console.error("Trade history fetch error:", error);
      return [];
    }
  }
};

// src/services/ohlcv-service.ts
var import_decimal2 = require("decimal.js");
var OHLCVService = class {
  constructor(prisma2, tokenService) {
    this.prisma = prisma2;
    this.tokenService = tokenService;
  }
  static {
    __name(this, "OHLCVService");
  }
  async generateOHLCVCandles(contractAddress, timeframe, options = {}) {
    try {
      if (options.startTime || options.forceRefresh) {
        const fresh = await this.generateFreshCandles(contractAddress, timeframe, options);
        if (options.startTime) {
          return await this.mergeWithCachedCandles(contractAddress, timeframe, fresh);
        }
        return fresh;
      }
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1e3);
      if (this.isCacheValid(cachedCandles, timeframe)) {
        console.log(`[OHLCV] Using cached data for ${contractAddress} ${timeframe}`);
        return cachedCandles;
      }
      console.log(`[OHLCV] Cache stale, generating fresh data for ${contractAddress} ${timeframe}`);
      return await this.generateFreshCandles(contractAddress, timeframe, options);
    } catch (error) {
      console.error("Error generating OHLCV candles:", error);
      const fallbackCandles = await this.getCachedCandles(contractAddress, timeframe);
      if (fallbackCandles.length > 0) {
        console.warn("Using stale cached data as fallback");
        return fallbackCandles;
      }
      return [];
    }
  }
  /**
   * NEW: Generate live candles for real-time updates
   * This is used by the new /live endpoint
   */
  async generateLiveCandles(contractAddress, timeframe, since) {
    const options = {
      startTime: since,
      endTime: Date.now(),
      forceRefresh: true
    };
    return await this.generateFreshCandles(contractAddress, timeframe, options);
  }
  /**
   * Generate fresh candles from subgraph data
   * This uses your existing logic but with enhanced time range support
   */
  async generateFreshCandles(contractAddress, timeframe, options = {}) {
    try {
      if (timeframe === "1d") {
        return await this.generateDailyCandles(contractAddress);
      } else {
        return await this.generateIntradayCandles(contractAddress, timeframe, options);
      }
    } catch (error) {
      console.error("Error generating fresh candles:", error);
      return [];
    }
  }
  async generateDailyCandles(contractAddress) {
    try {
      const tokenDayData = await this.tokenService.fetchTokenDayData(contractAddress);
      if (tokenDayData.length === 0) return [];
      const candles = [];
      for (const dayData of tokenDayData) {
        const netVolume = new import_decimal2.Decimal(dayData.tokensBought).minus(new import_decimal2.Decimal(dayData.tokensSold));
        const totalVolume = new import_decimal2.Decimal(dayData.tokensBought).plus(new import_decimal2.Decimal(dayData.tokensSold));
        const basePrice = new import_decimal2.Decimal(1);
        const priceVariation = netVolume.div(totalVolume.plus(1)).mul(0.1);
        const open = basePrice.toString();
        const close = basePrice.plus(priceVariation).toString();
        const high = import_decimal2.Decimal.max(new import_decimal2.Decimal(open), new import_decimal2.Decimal(close)).mul(1.05).toString();
        const low = import_decimal2.Decimal.min(new import_decimal2.Decimal(open), new import_decimal2.Decimal(close)).mul(0.95).toString();
        candles.push({
          timestamp: new Date(dayData.date * 1e3),
          open,
          high,
          low,
          close,
          volume: totalVolume.toString(),
          trades: dayData.tradesCount
        });
      }
      return candles.reverse();
    } catch (error) {
      console.error("Error generating daily candles:", error);
      return [];
    }
  }
  async generateIntradayCandles(contractAddress, timeframe, options = {}) {
    try {
      console.log(`[OHLCV] Starting generateIntradayCandles for ${contractAddress} ${timeframe}`);
      const intervalMs = this.getIntervalMs(timeframe);
      const endTime = options.endTime || Date.now();
      const startTime = options.startTime || endTime - this.getHoursBack(timeframe) * 60 * 60 * 1e3;
      const trades = options.startTime ? await this.fetchTradesForTimeRange(contractAddress, startTime, endTime) : await this.tokenService.fetchTradesForChart(contractAddress, timeframe);
      console.log(`[OHLCV] Fetched ${trades.length} trades for ${contractAddress}`);
      if (trades.length === 0) {
        console.log(`[OHLCV] No trades found for ${contractAddress} ${timeframe}`);
        return [];
      }
      const candleGroups = this.groupTradesByInterval(trades, intervalMs);
      console.log(`[OHLCV] Created ${candleGroups.length} candle groups with trades`);
      const candles = [];
      for (const group of candleGroups) {
        if (group.trades.length > 0) {
          try {
            const candle = this.calculateOHLCV(group);
            const hasVariation = candle.open !== candle.high || candle.high !== candle.low || candle.low !== candle.close;
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
        `[OHLCV] Generated ${candles.length} candles with actual trades for ${contractAddress} ${timeframe}`
      );
      if (candles.length > 0) {
        console.log("[OHLCV] Sample candles:", {
          first: {
            time: candles[0].timestamp.toISOString(),
            O: candles[0].open,
            H: candles[0].high,
            L: candles[0].low,
            C: candles[0].close,
            trades: candles[0].trades
          },
          last: {
            time: candles[candles.length - 1].timestamp.toISOString(),
            O: candles[candles.length - 1].open,
            H: candles[candles.length - 1].high,
            L: candles[candles.length - 1].low,
            C: candles[candles.length - 1].close,
            trades: candles[candles.length - 1].trades
          }
        });
      }
      if (!options.skipStorage && !options.startTime) {
        console.log("[OHLCV] Storing candles to database...");
        await this.storeCandles(contractAddress, timeframe, candles);
      } else {
        console.log("[OHLCV] Skipping database storage for fast response");
      }
      return candles;
    } catch (error) {
      console.error(
        `[OHLCV] Error generating intraday candles for ${contractAddress} ${timeframe}:`,
        error
      );
      if (error instanceof Error) {
        console.error(`[OHLCV] Error stack:`, error.stack);
      }
      throw error;
    }
  }
  /**
   * Merge live candles with cached historical data
   * This provides seamless hybrid mode: old cached data + new live data
   */
  async mergeWithCachedCandles(contractAddress, timeframe, liveCandles) {
    try {
      const cachedCandles = await this.getCachedCandles(contractAddress, timeframe, 1e3);
      if (cachedCandles.length === 0) {
        return liveCandles;
      }
      const liveStartTime = liveCandles.length > 0 ? liveCandles[0].timestamp.getTime() : Date.now();
      const oldCachedCandles = cachedCandles.filter((c) => c.timestamp.getTime() < liveStartTime);
      const combined = [...oldCachedCandles, ...liveCandles];
      combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      console.log(
        `[OHLCV] Merged candles: ${oldCachedCandles.length} cached + ${liveCandles.length} live = ${combined.length} total`
      );
      return combined;
    } catch (error) {
      console.error("[OHLCV] Error merging candles:", error);
      return liveCandles;
    }
  }
  groupTradesByInterval(trades, intervalMs) {
    const groups = {};
    console.log(
      `[OHLCV] Grouping ${trades.length} trades with interval ${intervalMs}ms (${intervalMs / 6e4}min)`
    );
    trades.forEach((trade) => {
      const tradeTime = parseInt(trade.createdAt) * 1e3;
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;
      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      groups[intervalStart].push(trade);
    });
    const groupedResults = Object.entries(groups).map(([timestamp, trades2]) => ({
      timestamp: new Date(parseInt(timestamp)),
      trades: trades2
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    console.log(`[OHLCV] Created ${groupedResults.length} candle groups`);
    console.log(
      `[OHLCV] Groups with trades: ${groupedResults.filter((g) => g.trades.length > 0).length}`
    );
    console.log(
      `[OHLCV] First group: ${groupedResults[0]?.timestamp.toISOString()} with ${groupedResults[0]?.trades.length} trades`
    );
    return groupedResults;
  }
  calculateOHLCV(candleGroup) {
    const { timestamp, trades } = candleGroup;
    if (trades.length === 0) {
      throw new Error("No trades for candle calculation");
    }
    const tradesWithPrice = trades.map((trade) => {
      const tokenAmt = new import_decimal2.Decimal(trade.tokenAmount);
      const acesAmt = new import_decimal2.Decimal(trade.acesTokenAmount);
      const price = tokenAmt.isZero() ? new import_decimal2.Decimal(0) : acesAmt.div(tokenAmt);
      return {
        price,
        volume: acesAmt,
        timestamp: parseInt(trade.createdAt)
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
    const prices = tradesWithPrice.map((t) => t.price);
    const volumes = tradesWithPrice.map((t) => t.volume);
    const candle = {
      timestamp,
      open: prices[0].toString(),
      high: import_decimal2.Decimal.max(...prices).toString(),
      low: import_decimal2.Decimal.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: volumes.reduce((sum, vol) => sum.add(vol), new import_decimal2.Decimal(0)).toString(),
      trades: trades.length
    };
    if (Math.random() < 0.1) {
      console.log(
        `[OHLCV] Candle at ${timestamp.toISOString()}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} trades=${trades.length}`
      );
    }
    return candle;
  }
  getIntervalMs(timeframe) {
    const intervals = {
      "1m": 60 * 1e3,
      "5m": 5 * 60 * 1e3,
      "15m": 15 * 60 * 1e3,
      "1h": 60 * 60 * 1e3,
      "4h": 4 * 60 * 60 * 1e3
    };
    return intervals[timeframe] || intervals["1h"];
  }
  generateTimeSlots(startTime, endTime, intervalMs) {
    const slots = [];
    const alignedStart = Math.floor(startTime / intervalMs) * intervalMs;
    for (let time = alignedStart; time < endTime; time += intervalMs) {
      slots.push(new Date(time));
    }
    return slots;
  }
  async getLastKnownPrice(contractAddress) {
    try {
      const lastCandle = await this.prisma.tokenOHLCV.findFirst({
        where: { contractAddress: contractAddress.toLowerCase() },
        orderBy: { timestamp: "desc" }
      });
      if (lastCandle) {
        return parseFloat(lastCandle.close);
      }
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: contractAddress.toLowerCase() }
      });
      return token ? parseFloat(token.currentPriceACES) : 1;
    } catch (error) {
      console.warn("Could not get last known price, defaulting to 1.0:", error);
      return 1;
    }
  }
  getHoursBack(timeframe) {
    const timeframeHours = {
      "1m": 2,
      // 2 hours for minute data
      "5m": 12,
      // 12 hours for 5-minute data
      "15m": 48,
      // 48 hours for 15-minute data
      "1h": 168,
      // 1 week for hourly data
      "1d": 720
      // 30 days for daily data
    };
    return timeframeHours[timeframe] || 168;
  }
  async storeCandles(contractAddress, timeframe, candles) {
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
                timestamp: candle.timestamp
              }
            },
            update: {
              // Update existing candle data
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades
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
              trades: candle.trades
            }
          });
          upsertedCount++;
        } catch (upsertError) {
          errorCount++;
          console.warn(`Failed to upsert candle at ${candle.timestamp}:`, upsertError);
        }
      }
      console.log(
        `[OHLCV] Stored ${upsertedCount} candles for ${lowerAddress} ${timeframe} (${errorCount} errors)`
      );
    } catch (error) {
      console.error("Failed to store OHLCV candles:", error);
    }
  }
  async getStoredOHLCVData(contractAddress, timeframe, limit = 100) {
    return await this.prisma.tokenOHLCV.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        timeframe
      },
      orderBy: { timestamp: "desc" },
      take: typeof limit === "string" ? parseInt(limit) : limit
    });
  }
  /**
   * Public method to allow external callers to store candles
   * Used by /live endpoint to persist real-time data
   */
  async storeCandlesPublic(contractAddress, timeframe, candles) {
    await this.storeCandles(contractAddress, timeframe, candles);
  }
  /**
   * NEW: Fetch trades for a specific time range from subgraph
   * This is optimized for live data requests
   */
  async fetchTradesForTimeRange(contractAddress, startTime, endTime) {
    try {
      const startTimeSeconds = Math.floor(startTime / 1e3);
      const endTimeSeconds = Math.floor(endTime / 1e3);
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
      const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(1e4)
        // 10 second timeout for live queries
      });
      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
      }
      const result = await response.json();
      if (result.errors) {
        throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
      }
      return result.data.trades || [];
    } catch (error) {
      console.error("Error fetching trades for time range:", error);
      return [];
    }
  }
  /**
   * NEW: Check if cached data is still valid
   */
  isCacheValid(candles, timeframe) {
    if (candles.length === 0) return false;
    const latestCandle = candles[candles.length - 1];
    const now = Date.now();
    const candleAge = now - latestCandle.timestamp.getTime();
    const maxAge = this.getIntervalMs(timeframe) * 2;
    return candleAge < maxAge;
  }
  /**
   * NEW: Get cached candles from database
   */
  async getCachedCandles(contractAddress, timeframe, limit = 200) {
    try {
      const stored = await this.prisma.tokenOHLCV.findMany({
        where: {
          contractAddress: contractAddress.toLowerCase(),
          timeframe
        },
        orderBy: { timestamp: "asc" },
        take: limit
      });
      return stored.map((candle) => ({
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        trades: candle.trades
      }));
    } catch (error) {
      console.error("Error fetching cached candles:", error);
      return [];
    }
  }
};

// src/api/cron/sync-tokens.ts
var prisma = new import_client.PrismaClient();
async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const vercelCronHeader = req.headers["x-vercel-cron"];
  const isVercelCron = Boolean(vercelCronHeader);
  if (!isVercelCron) {
    const cronSecret = req.headers["x-vercel-cron-signature"] || req.headers.authorization;
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized cron caller" });
    }
  }
  if (process.env.ENABLE_CRON !== "true") {
    return res.status(200).json({
      message: "Cron disabled",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const startTime = Date.now();
  const results = {
    processed: 0,
    errors: 0,
    skipped: 0,
    tokenResults: []
  };
  try {
    const activeTokensFromSubgraph = await getActiveTokensFromSubgraph();
    console.log(`[CRON] Starting sync for ${activeTokensFromSubgraph.length} active tokens`);
    const tokenService = new TokenService(prisma);
    const ohlcvService = new OHLCVService(prisma, tokenService);
    let tokensWithActivity = 0;
    let tokensRecentlyViewed = 0;
    let tokensSkipped = 0;
    for (const tokenData of activeTokensFromSubgraph) {
      try {
        const result = await syncTokenData(tokenData, tokenService, ohlcvService);
        if (result.processed) {
          results.processed++;
          if (result.reason === "active") tokensWithActivity++;
          if (result.reason === "recently_viewed") tokensRecentlyViewed++;
          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            tradesCount: tokenData.tradesCount,
            status: "success",
            reason: result.reason
          });
        } else {
          tokensSkipped++;
          results.skipped++;
          results.tokenResults.push({
            address: tokenData.address,
            symbol: tokenData.symbol,
            tradesCount: tokenData.tradesCount,
            status: "skipped",
            reason: result.reason
          });
        }
      } catch (error) {
        console.error(`[CRON] Error syncing token ${tokenData.address}:`, error);
        results.errors++;
        results.tokenResults.push({
          address: tokenData.address,
          symbol: tokenData.symbol,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    const duration = Date.now() - startTime;
    const efficiencyGain = tokensSkipped > 0 ? Math.round(tokensSkipped / activeTokensFromSubgraph.length * 100) : 0;
    console.log(
      `[CRON] Completed in ${duration}ms: ${results.processed} successful, ${results.errors} errors`
    );
    console.log(
      `[CRON] Efficiency: ${tokensSkipped} tokens skipped (${efficiencyGain}% reduction in API calls)`
    );
    console.log(
      `[CRON] Activity breakdown: ${tokensWithActivity} active, ${tokensRecentlyViewed} recently viewed`
    );
    res.status(200).json({
      success: true,
      message: "Sync completed",
      duration: `${duration}ms`,
      results,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[CRON] Fatal sync error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } finally {
    await prisma.$disconnect();
  }
}
__name(handler, "handler");
async function getActiveTokensFromSubgraph() {
  try {
    const query = `{
      tokens(first: 50, orderBy: tradesCount, orderDirection: desc) {
        id
        address
        name
        symbol
        tradesCount
        tokensBought
        tokensSold
        bonded
      }
    }`;
    const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`);
    }
    const result = await response.json();
    if (result.errors) {
      throw new Error(`Subgraph errors: ${JSON.stringify(result.errors)}`);
    }
    const allTokens = result.data?.tokens || [];
    const recentlyViewedTokens = await getRecentlyViewedTokens();
    const activeTokens = allTokens.filter(
      (token) => token.tradesCount > 0 || recentlyViewedTokens.includes(token.address.toLowerCase())
    );
    console.log(
      `[CRON] Found ${activeTokens.length} active tokens out of ${allTokens.length} total`
    );
    return activeTokens;
  } catch (error) {
    console.error("[CRON] Error fetching tokens from subgraph:", error);
    const fallbackTokens = await prisma.token.findMany({
      where: {
        isActive: true,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1e3)
          // Last 24h
        }
      },
      select: {
        contractAddress: true,
        symbol: true
      }
    });
    return fallbackTokens.map((t) => ({
      address: t.contractAddress,
      symbol: t.symbol,
      tradesCount: 0
    }));
  }
}
__name(getActiveTokensFromSubgraph, "getActiveTokensFromSubgraph");
async function getRecentlyViewedTokens() {
  const recentTokens = await prisma.token.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 6 * 60 * 60 * 1e3)
        // Last 6 hours
      }
    },
    select: {
      contractAddress: true
    }
  });
  return recentTokens.map((t) => t.contractAddress.toLowerCase());
}
__name(getRecentlyViewedTokens, "getRecentlyViewedTokens");
async function syncTokenData(tokenData, tokenService, ohlcvService) {
  const contractAddress = tokenData.address;
  const hasRecentActivity = tokenData.tradesCount > 0;
  const isRecentlyViewed = await isTokenRecentlyViewed(contractAddress);
  if (!hasRecentActivity && !isRecentlyViewed) {
    console.log(`[CRON] Skipping inactive token ${tokenData.symbol} (${contractAddress})`);
    return { processed: false, reason: "inactive" };
  }
  await prisma.$transaction(
    async (tx) => {
      const txTokenService = new TokenService(tx);
      const txOhlcvService = new OHLCVService(tx, txTokenService);
      await txTokenService.fetchAndUpdateTokenData(contractAddress);
      const allTimeframes = ["1m", "5m", "15m", "1h", "4h"];
      for (const timeframe of allTimeframes) {
        await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
        console.log(`[CRON] Generated ${timeframe} candles for ${tokenData.symbol}`);
      }
      await tx.token.update({
        where: { contractAddress: contractAddress.toLowerCase() },
        data: { updatedAt: /* @__PURE__ */ new Date() }
      });
    },
    {
      timeout: 9e4
      // 90 seconds timeout to handle all 5 timeframes
    }
  );
  const reason = hasRecentActivity ? "active" : "recently_viewed";
  return { processed: true, reason };
}
__name(syncTokenData, "syncTokenData");
async function isTokenRecentlyViewed(tokenAddress) {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1e3);
  const recentToken = await prisma.token.findFirst({
    where: {
      contractAddress: tokenAddress.toLowerCase(),
      updatedAt: { gte: sixHoursAgo }
    }
  });
  return !!recentToken;
}
__name(isTokenRecentlyViewed, "isTokenRecentlyViewed");
