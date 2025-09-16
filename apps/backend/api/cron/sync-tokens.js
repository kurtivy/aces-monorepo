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
    for (const trade of trades.slice(0, 10)) {
      try {
        const tokenAmt = new import_decimal.Decimal(trade.tokenAmount);
        const acesAmt = new import_decimal.Decimal(trade.acesTokenAmount);
        const pricePerToken = tokenAmt.isZero() ? "0" : acesAmt.div(tokenAmt).toString();
        await this.prisma.tokenTrade.upsert({
          where: { txHash: trade.id },
          // Using trade ID as txHash
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
      } catch (error) {
        console.warn("Failed to store trade:", error);
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
  async generateOHLCVCandles(contractAddress, timeframe) {
    try {
      if (timeframe === "1d") {
        return await this.generateDailyCandles(contractAddress);
      } else {
        return await this.generateIntradayCandles(contractAddress, timeframe);
      }
    } catch (error) {
      console.error("Error generating OHLCV candles:", error);
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
  async generateIntradayCandles(contractAddress, timeframe) {
    try {
      const trades = await this.tokenService.fetchTradesForChart(contractAddress, timeframe);
      const intervalMs = this.getIntervalMs(timeframe);
      const endTime = Date.now();
      const startTime = endTime - this.getHoursBack(timeframe) * 60 * 60 * 1e3;
      const timeSlots = this.generateTimeSlots(startTime, endTime, intervalMs);
      const candleGroups = this.groupTradesByInterval(trades, intervalMs);
      const candles = [];
      let lastClosePrice = await this.getLastKnownPrice(contractAddress);
      for (const slot of timeSlots) {
        const slotTrades = candleGroups.find((g) => g.timestamp.getTime() === slot.getTime());
        if (slotTrades && slotTrades.trades.length > 0) {
          const candle = this.calculateOHLCV(slotTrades);
          candles.push(candle);
          lastClosePrice = parseFloat(candle.close);
        } else {
          const emptyCandle = {
            timestamp: slot,
            open: lastClosePrice.toString(),
            high: lastClosePrice.toString(),
            low: lastClosePrice.toString(),
            close: lastClosePrice.toString(),
            volume: "0",
            trades: 0
          };
          candles.push(emptyCandle);
        }
      }
      await this.storeCandles(contractAddress, timeframe, candles);
      return candles;
    } catch (error) {
      console.error("Error generating intraday candles:", error);
      return [];
    }
  }
  groupTradesByInterval(trades, intervalMs) {
    const groups = {};
    trades.forEach((trade) => {
      const tradeTime = parseInt(trade.createdAt) * 1e3;
      const intervalStart = Math.floor(tradeTime / intervalMs) * intervalMs;
      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      groups[intervalStart].push(trade);
    });
    return Object.entries(groups).map(([timestamp, trades2]) => ({
      timestamp: new Date(parseInt(timestamp)),
      trades: trades2
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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
    return {
      timestamp,
      open: prices[0].toString(),
      high: import_decimal2.Decimal.max(...prices).toString(),
      low: import_decimal2.Decimal.min(...prices).toString(),
      close: prices[prices.length - 1].toString(),
      volume: volumes.reduce((sum, vol) => sum.add(vol), new import_decimal2.Decimal(0)).toString(),
      trades: trades.length
    };
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
      await this.prisma.tokenOHLCV.deleteMany({
        where: {
          contractAddress: lowerAddress,
          timeframe
        }
      });
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
          trades: candle.trades
        })),
        skipDuplicates: true
      });
    } catch (error) {
      console.warn("Failed to store OHLCV candles:", error);
      for (const candle of candles) {
        try {
          await this.prisma.tokenOHLCV.upsert({
            where: {
              contractAddress_timeframe_timestamp: {
                contractAddress: contractAddress.toLowerCase(),
                timeframe,
                timestamp: candle.timestamp
              }
            },
            update: {
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              trades: candle.trades
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
              trades: candle.trades
            }
          });
        } catch (upsertError) {
          console.warn("Failed to store individual OHLCV candle:", upsertError);
        }
      }
    }
  }
  async getStoredOHLCVData(contractAddress, timeframe, limit = 100) {
    return await this.prisma.tokenOHLCV.findMany({
      where: {
        contractAddress: contractAddress.toLowerCase(),
        timeframe
      },
      orderBy: { timestamp: "desc" },
      take: limit
    });
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
    for (const tokenData of activeTokensFromSubgraph) {
      try {
        await syncTokenData(tokenData, tokenService, ohlcvService);
        results.processed++;
        results.tokenResults.push({
          address: tokenData.address,
          symbol: tokenData.symbol,
          tradesCount: tokenData.tradesCount,
          status: "success"
        });
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
    console.log(
      `[CRON] Completed in ${duration}ms: ${results.processed} successful, ${results.errors} errors`
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
  if (tokenData.tradesCount === 0) {
    console.log(`[CRON] Skipping dormant token ${tokenData.symbol} (${contractAddress})`);
    return;
  }
  await prisma.$transaction(async (tx) => {
    const txTokenService = new TokenService(tx);
    const txOhlcvService = new OHLCVService(tx, txTokenService);
    await txTokenService.fetchAndUpdateTokenData(contractAddress);
    const timeframes = ["1h", "4h", "1d"];
    for (const timeframe of timeframes) {
      await txOhlcvService.generateOHLCVCandles(contractAddress, timeframe);
    }
    await tx.token.update({
      where: { contractAddress: contractAddress.toLowerCase() },
      data: { updatedAt: /* @__PURE__ */ new Date() }
    });
  });
}
__name(syncTokenData, "syncTokenData");
