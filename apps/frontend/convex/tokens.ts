import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

const tokenValidator = {
  contractAddress: v.string(),
  symbol: v.string(),
  name: v.string(),
  chainId: v.number(),
  decimals: v.optional(v.number()),
  listingId: v.optional(v.string()),
  isActive: v.boolean(),
};

/**
 * List all active tokens (for profile holdings, etc).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('tokens')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .order('asc')
      .collect();
  },
});

/**
 * Get a single token by contract address.
 */
export const getByContractAddress = query({
  args: { contractAddress: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.contractAddress.toLowerCase();
    return await ctx.db
      .query('tokens')
      .withIndex('by_contractAddress', (q) => q.eq('contractAddress', normalized))
      .first();
  },
});

/**
 * Insert or update a token. Idempotent by contractAddress.
 * Used by sync from Prisma.
 */
export const insertToken = mutation({
  args: tokenValidator,
  handler: async (ctx, args) => {
    const normalizedAddress = args.contractAddress.toLowerCase();
    const existing = await ctx.db
      .query('tokens')
      .withIndex('by_contractAddress', (q) => q.eq('contractAddress', normalizedAddress))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        symbol: args.symbol,
        name: args.name,
        chainId: args.chainId,
        decimals: args.decimals,
        listingId: args.listingId,
        isActive: args.isActive,
      });
      return existing._id;
    }
    return await ctx.db.insert('tokens', {
      ...args,
      contractAddress: normalizedAddress,
    });
  },
});

/**
 * Remove a token by contract address (for pruning if needed).
 */
export const removeToken = mutation({
  args: { contractAddress: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.contractAddress.toLowerCase();
    const item = await ctx.db
      .query('tokens')
      .withIndex('by_contractAddress', (q) => q.eq('contractAddress', normalized))
      .first();
    if (!item) return null;
    await ctx.db.delete(item._id);
    return item._id;
  },
});
