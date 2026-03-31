/**
 * Trade insertion mutation — separated from tradeListener.ts because
 * Convex requires Node.js runtime files ("use node") to only export
 * actions, not mutations. This mutation runs in the default V8 runtime.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Insert a single trade, deduplicating by txHash.
 *
 * Uses the by_txHash index for O(1) lookup. If the trade already
 * exists (e.g. from the backup tradeSyncer), it's silently skipped.
 *
 * Schema matches the trades table exactly: uses `timestamp` field
 * (not `blockTimestamp`) to stay consistent with existing data.
 */
export const insertTrade = internalMutation({
  args: {
    txHash: v.string(),
    tokenAddress: v.string(),
    tradeType: v.string(),
    trader: v.string(),
    tokenAmount: v.string(),
    acesAmount: v.string(),
    blockNumber: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Deduplicate — check if this txHash was already inserted
    // (by the backup poller or a previous listener run)
    const existing = await ctx.db
      .query("trades")
      .withIndex("by_txHash", (q) => q.eq("txHash", args.txHash))
      .first();
    if (existing) return;

    await ctx.db.insert("trades", args);
  },
});
