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
  poolAddress: v.optional(v.string()),
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
 * List active tokens that are not linked to a listing (for admin token-launch dropdown).
 */
export const listUnlinked = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query('tokens')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .collect();
    return all.filter((t) => !t.listingId || t.listingId === '');
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
        poolAddress: args.poolAddress,
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

/**
 * Link a token to a listing by contract address and listing id.
 */
export const linkTokenToListing = mutation({
  args: { contractAddress: v.string(), listingId: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.contractAddress.toLowerCase();
    const token = await ctx.db
      .query('tokens')
      .withIndex('by_contractAddress', (q) => q.eq('contractAddress', normalized))
      .first();
    if (!token) return null;
    await ctx.db.patch(token._id, { listingId: args.listingId });
    return await ctx.db.get(token._id);
  },
});

/**
 * Create or update a token and optionally link to a listing.
 * Useful for admin token creation workflow.
 */
export const createOrUpdateToken = mutation({
  args: {
    contractAddress: v.string(),
    symbol: v.string(),
    name: v.string(),
    chainId: v.number(),
    decimals: v.optional(v.number()),
    poolAddress: v.optional(v.string()),
    listingId: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const normalized = args.contractAddress.toLowerCase();
    const existing = await ctx.db
      .query('tokens')
      .withIndex('by_contractAddress', (q) => q.eq('contractAddress', normalized))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        symbol: args.symbol,
        name: args.name,
        chainId: args.chainId,
      };
      if (args.decimals !== undefined) updates.decimals = args.decimals;
      if (args.poolAddress !== undefined) updates.poolAddress = args.poolAddress;
      if (args.listingId !== undefined) updates.listingId = args.listingId;
      if (args.isActive !== undefined) updates.isActive = args.isActive;

      await ctx.db.patch(existing._id, updates);
      return await ctx.db.get(existing._id);
    }

    return await ctx.db.insert('tokens', {
      contractAddress: normalized,
      symbol: args.symbol,
      name: args.name,
      chainId: args.chainId,
      decimals: args.decimals,
      poolAddress: args.poolAddress,
      listingId: args.listingId,
      isActive: args.isActive ?? true,
    });
  },
});
