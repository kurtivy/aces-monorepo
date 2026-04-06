/**
 * Trade queries and mutations.
 *
 * Public queries (byToken, recent) are consumed by the frontend via
 * Convex's useQuery — updates push over websocket automatically.
 *
 * Internal functions are used by the tradeSyncer cron action:
 *   - getSyncCursor / setSyncCursor — track block-scanning progress
 *   - insertBatch — deduplicate + insert trades
 *   - pruneOldest — delete oldest trades to stay under the cap
 */

import {
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { RWA_TOKENS } from "./tokenData";

/** Max trades stored per token — oldest are pruned beyond this */
const MAX_TRADES_PER_TOKEN = 5000;

/**
 * Hard cap on how many trades pruneOldest will delete in one call.
 * Keeps the mutation well under Convex's 4096-read limit.
 */
const MAX_PRUNE_BATCH = 500;

// ── Public queries (frontend) ────────────────────────────────

/**
 * Paginated query for trades of a specific token, newest first.
 * Used by TradeHistory with usePaginatedQuery — the client controls
 * how many items to fetch per page via paginationOpts.numItems.
 * Uses the by_token_time compound index for efficient lookups.
 */
export const byToken = query({
  args: { tokenAddress: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { tokenAddress, paginationOpts }) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_token_time", (q) =>
        q.eq("tokenAddress", tokenAddress.toLowerCase()),
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

/**
 * Get the 20 most recent trades across all tokens.
 * Could be used for a global activity feed.
 */
export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trades")
      .withIndex("by_timestamp")
      .order("desc")
      .take(20);
  },
});

// ── Internal: sync cursor ────────────────────────────────────

/**
 * Read the sync cursor for a given key.
 * Returns the last fully-processed block number, or null on first run.
 */
export const getSyncCursor = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const cursor = await ctx.db
      .query("syncCursors")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return cursor?.blockNumber ?? null;
  },
});

/**
 * Upsert the sync cursor to a new block number.
 * Called after every sync tick — even when no trades are found —
 * so we don't re-scan the same block range next time.
 */
export const setSyncCursor = internalMutation({
  args: { key: v.string(), blockNumber: v.number() },
  handler: async (ctx, { key, blockNumber }) => {
    const existing = await ctx.db
      .query("syncCursors")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        blockNumber,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("syncCursors", {
        key,
        blockNumber,
        updatedAt: Date.now(),
      });
    }
  },
});

// ── Internal: insert + prune ─────────────────────────────────

/**
 * Insert a batch of trades, skipping any whose txHash already exists.
 *
 * Callers should limit batch size to ~100 trades per call so the
 * dedup reads (1 per trade) stay well under Convex's 4096 read limit.
 */
export const insertBatch = internalMutation({
  args: {
    trades: v.array(
      v.object({
        txHash: v.string(),
        tokenAddress: v.string(),
        tradeType: v.string(),
        trader: v.string(),
        tokenAmount: v.string(),
        acesAmount: v.string(),
        blockNumber: v.number(),
        timestamp: v.number(),
      }),
    ),
  },
  handler: async (ctx, { trades }) => {
    for (const trade of trades) {
      // Check the by_txHash index — O(1) lookup, costs 1 read
      const existing = await ctx.db
        .query("trades")
        .withIndex("by_txHash", (q) => q.eq("txHash", trade.txHash))
        .first();

      // Skip duplicates (safe to re-run after retries or overlapping ranges)
      if (existing) continue;

      await ctx.db.insert("trades", trade);
    }
  },
});

/**
 * Delete the oldest trades for a token to stay under MAX_TRADES_PER_TOKEN.
 *
 * `count` is how many new trades were just inserted — we delete that many
 * from the oldest end. Capped at MAX_PRUNE_BATCH to stay within Convex
 * read/write limits. If the token has fewer than MAX total, nothing is deleted.
 */
/**
 * Delete one batch of trades for a token address.
 * Returns how many were deleted (0 = done).
 */
export const _deleteBatch = internalMutation({
  args: { tokenAddress: v.string() },
  handler: async (ctx, { tokenAddress }) => {
    const batch = await ctx.db
      .query("trades")
      .withIndex("by_token_time", (q) => q.eq("tokenAddress", tokenAddress))
      .take(500);

    for (const trade of batch) {
      await ctx.db.delete(trade._id);
    }
    return batch.length;
  },
});

/**
 * Delete ALL trades for a token by symbol. Used to wipe and re-backfill.
 * Run from dashboard: { symbol: "RMILLE" }
 * Calls _deleteBatch in a loop, each batch is a separate mutation
 * to stay within Convex's 4096-read limit.
 */
export const clearTradesForToken = internalAction({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    const token = RWA_TOKENS.find(
      (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
    );
    const tokenAddress = token?.contractAddress?.toLowerCase();
    if (!tokenAddress) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }

    let totalDeleted = 0;
    let deleted: number;
    do {
      deleted = await ctx.runMutation(internal.trades._deleteBatch, {
        tokenAddress,
      });
      totalDeleted += deleted;
    } while (deleted > 0);

    console.log(`clearTradesForToken: ${symbol} — deleted ${totalDeleted} trades`);
  },
});

/**
 * Count trades for a token and delete the oldest ones beyond the cap.
 * Returns how many were deleted (0 = under cap or no trades).
 * Reads are bounded: MAX cap + delete batch, well under 4096.
 */
export const _pruneToken = internalMutation({
  args: { tokenAddress: v.string() },
  handler: async (ctx, { tokenAddress }) => {
    // Count total trades for this token (read up to cap + 1 to check if over)
    const trades = await ctx.db
      .query("trades")
      .withIndex("by_token_time", (q) => q.eq("tokenAddress", tokenAddress))
      .take(MAX_TRADES_PER_TOKEN + 1);

    const excess = trades.length - MAX_TRADES_PER_TOKEN;
    if (excess <= 0) return 0;

    // Fetch the oldest N to delete (capped to stay within limits)
    const deleteCount = Math.min(excess, MAX_PRUNE_BATCH);
    const oldest = await ctx.db
      .query("trades")
      .withIndex("by_token_time", (q) => q.eq("tokenAddress", tokenAddress))
      .order("asc")
      .take(deleteCount);

    for (const trade of oldest) {
      await ctx.db.delete(trade._id);
    }

    return oldest.length;
  },
});

/**
 * Prune all tokens that exceed MAX_TRADES_PER_TOKEN.
 * Runs as a cron every hour. Loops through all active tokens
 * and calls _pruneToken for each.
 */
export const pruneAllTokens = internalAction({
  args: {},
  handler: async (ctx) => {
    const tokens = RWA_TOKENS.filter((t) => t.contractAddress && t.isActive);
    let totalPruned = 0;

    for (const token of tokens) {
      const tokenAddress = token.contractAddress!.toLowerCase();
      // Loop in case a token is way over cap (prune batch is capped)
      let deleted: number;
      do {
        deleted = await ctx.runMutation(internal.trades._pruneToken, {
          tokenAddress,
        });
        totalPruned += deleted;
      } while (deleted > 0);
    }

    if (totalPruned > 0) {
      console.log(`pruneAllTokens: pruned ${totalPruned} trades`);
    }
  },
});

