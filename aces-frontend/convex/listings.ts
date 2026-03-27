import { query } from "./_generated/server";
import { v } from "convex/values";

export const getBySymbol = query({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("listings").collect();
  },
});

export const listLive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("listings")
      .withIndex("by_isLive", (q) => q.eq("isLive", true))
      .collect();
  },
});
