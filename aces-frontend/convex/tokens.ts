import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { RWA_TOKEN_SEEDS } from "./tokenSeedData";

export const getByAddress = query({
  args: { contractAddress: v.string() },
  handler: async (ctx, { contractAddress }) => {
    return await ctx.db
      .query("tokens")
      .withIndex("by_contractAddress", (q) =>
        q.eq("contractAddress", contractAddress.toLowerCase()),
      )
      .first();
  },
});

export const getBySymbol = query({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    return await ctx.db
      .query("tokens")
      .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
      .first();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tokens")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Reseed the tokens table from convex/tokenSeedData.ts.
 * Idempotent: upserts by contractAddress — existing records are updated,
 * new ones are inserted. Call with no args.
 */
export const reseedTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results: { symbol: string; action: "created" | "updated" }[] = [];

    for (const token of RWA_TOKEN_SEEDS) {
      const normalized = token.contractAddress.toLowerCase();
      const existing = await ctx.db
        .query("tokens")
        .withIndex("by_contractAddress", (q) =>
          q.eq("contractAddress", normalized),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          chainId: token.chainId,
          phase: token.phase,
          priceSource: token.priceSource,
          isActive: token.isActive,
          updatedAt: now,
        });
        results.push({ symbol: token.symbol, action: "updated" });
      } else {
        await ctx.db.insert("tokens", {
          contractAddress: normalized,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          chainId: token.chainId,
          phase: token.phase,
          priceSource: token.priceSource,
          isActive: token.isActive,
          createdAt: now,
          updatedAt: now,
        });
        results.push({ symbol: token.symbol, action: "created" });
      }
    }

    return results;
  },
});
