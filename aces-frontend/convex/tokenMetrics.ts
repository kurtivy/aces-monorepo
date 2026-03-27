/**
 * Queries for reading token metrics from the DB.
 * Data is populated by the onchainMetrics cron every 1 minute.
 * Clients subscribe via useQuery — Convex pushes updates over websocket.
 */

import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Get live metrics for a single token by symbol. */
export const getBySymbol = query({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    return await ctx.db
      .query("tokenMetrics")
      .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
      .first();
  },
});

/** Get live metrics for all tokens that have been populated. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tokenMetrics").collect();
  },
});

/** Upsert token metrics records — called by the onchainMetrics cron action. */
export const saveMetrics = internalMutation({
  args: {
    metrics: v.array(
      v.object({
        symbol: v.string(),
        tokenPriceUsd: v.number(),
        marketCapUsd: v.number(),
        liquidityUsd: v.number(),
        tradeRewardPct: v.number(),
        eligibleSupply: v.number(),
        communityRewardUsd: v.number(),
        acesPriceUsd: v.number(),
        ethPriceUsd: v.number(),
      }),
    ),
  },
  handler: async (ctx, { metrics }) => {
    const now = Date.now();

    for (const m of metrics) {
      const existing = await ctx.db
        .query("tokenMetrics")
        .withIndex("by_symbol", (q) => q.eq("symbol", m.symbol))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...m, updatedAt: now });
      } else {
        await ctx.db.insert("tokenMetrics", { ...m, updatedAt: now });
      }
    }
  },
});
