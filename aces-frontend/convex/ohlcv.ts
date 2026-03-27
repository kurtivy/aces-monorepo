/**
 * Compute OHLCV candles on-the-fly from synced trade data.
 *
 * Used as a fallback when GeckoTerminal has no candle data for a pool
 * (e.g. Aerodrome CL pools that GeckoTerminal doesn't index).
 *
 * Price is denominated in ACES (acesAmount / tokenAmount) to match
 * the GeckoTerminal currency=token format.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/** Bucket size in seconds for each supported timeframe */
const BUCKET_SECONDS: Record<string, number> = {
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

/** How far back to look for each timeframe (matches GeckoTerminal limits) */
const LOOKBACK_SECONDS: Record<string, number> = {
  "1h": 1000 * 3600, // ~42 days
  "4h": 180 * 14400, // ~30 days
  "1d": 365 * 86400, // ~1 year
};

export const fromTrades = query({
  args: {
    tokenAddress: v.string(),
    timeframe: v.string(), // "1h" | "4h" | "1d"
  },
  handler: async (ctx, { tokenAddress, timeframe }) => {
    const bucket = BUCKET_SECONDS[timeframe];
    const lookback = LOOKBACK_SECONDS[timeframe];
    if (!bucket || !lookback) return [];

    const since = Math.floor(Date.now() / 1000) - lookback;

    // Fetch trades for this token within the time window
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_token_time", (q) =>
        q.eq("tokenAddress", tokenAddress.toLowerCase()).gte("timestamp", since),
      )
      .collect();

    if (trades.length === 0) return [];

    // Group trades into time buckets and compute OHLCV
    const buckets = new Map<
      number,
      { open: number; high: number; low: number; close: number; volume: number; firstTs: number; lastTs: number }
    >();

    for (const trade of trades) {
      const tokenAmt = Number(trade.tokenAmount);
      const acesAmt = Number(trade.acesAmount);
      // Skip trades with zero amounts (shouldn't happen but be safe)
      if (tokenAmt === 0 || acesAmt === 0) continue;

      // Price in ACES per token (both 18 decimals, units cancel)
      const price = acesAmt / tokenAmt;
      const volume = tokenAmt / 1e18; // human-readable token volume
      const openTime = Math.floor(trade.timestamp / bucket) * bucket;

      const existing = buckets.get(openTime);
      if (existing) {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.volume += volume;
        // Track first/last trade to set open/close correctly
        if (trade.timestamp < existing.firstTs) {
          existing.open = price;
          existing.firstTs = trade.timestamp;
        }
        if (trade.timestamp >= existing.lastTs) {
          existing.close = price;
          existing.lastTs = trade.timestamp;
        }
      } else {
        buckets.set(openTime, {
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
          firstTs: trade.timestamp,
          lastTs: trade.timestamp,
        });
      }
    }

    // Return sorted candles matching GeckoTerminal's OhlcvCandle shape
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([openTime, c]) => ({
        time: openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
  },
});
